import { createApp } from "../app";
import { getEmbedding } from "@/lib/embeddings";
import { searchNotes as keywordSearch, countSearchResults } from "@/db/lib/search";
import { semanticSearch } from "@/lib/vector";
import { db } from "@/db";
import { notes } from "@/db/schema/notes";
import { rlsExecutor } from "@/db/lib/rls";
import { inArray } from "drizzle-orm";
import { z } from "zod";


const SearchParamsSchema = z.object({
  q: z.string().min(1, "Query is required"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  noteType: z.enum(["note", "journal"]).optional(),
  tags: z.string().optional(),
  minMood: z.coerce.number().int().min(1).max(10).optional(),
  maxMood: z.coerce.number().int().min(1).max(10).optional(),
  includeCount: z.coerce.boolean().default(false),
  searchMode: z.enum(["hybrid", "keyword", "semantic"]).default("hybrid"),
  semanticWeight: z.coerce.number().min(0).max(1).default(0.6),
});

type SearchParams = z.infer<typeof SearchParamsSchema>;

interface HybridSearchResult {
  id: string;
  title: string;
  content: string;
  contentPlain: string | null;
  noteType: "note" | "journal";
  sourceUrl: string | null;
  moodScore: number | null;
  createdAt: Date;
  updatedAt: Date;
  score: number;
  keywordRank?: number;
  semanticScore?: number;
}

function normalizeScore(score: number, min: number, max: number): number {
  if (max === min) return 1;
  return (score - min) / (max - min);
}

function fuseResults(
  keywordResults: Array<{ id: string; rank: number }>,
  semanticResults: Array<{ id: string; score: number }>,
  semanticWeight: number
): Map<string, { score: number; keywordRank?: number; semanticScore?: number }> {
  const keywordWeight = 1 - semanticWeight;
  const fusedScores = new Map<string, { score: number; keywordRank?: number; semanticScore?: number }>();

  const keywordRanks = keywordResults.map((r) => r.rank);
  const semanticScores = semanticResults.map((r) => r.score);

  const minKeywordRank = Math.min(...keywordRanks, 0);
  const maxKeywordRank = Math.max(...keywordRanks, 1);
  const minSemanticScore = Math.min(...semanticScores, 0);
  const maxSemanticScore = Math.max(...semanticScores, 1);

  for (const result of keywordResults) {
    const normalizedRank = normalizeScore(result.rank, minKeywordRank, maxKeywordRank);
    fusedScores.set(result.id, {
      score: normalizedRank * keywordWeight,
      keywordRank: result.rank,
    });
  }

  for (const result of semanticResults) {
    const normalizedScore = normalizeScore(result.score, minSemanticScore, maxSemanticScore);
    const existing = fusedScores.get(result.id);

    if (existing) {
      existing.score += normalizedScore * semanticWeight;
      existing.semanticScore = result.score;
    } else {
      fusedScores.set(result.id, {
        score: normalizedScore * semanticWeight,
        semanticScore: result.score,
      });
    }
  }

  return fusedScores;
}

const app = createApp().get("/search", async (c) => {
  try {
    const { searchParams } = new URL(c.req.url);
    const params = SearchParamsSchema.safeParse({
      q: searchParams.get("q"),
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
      noteType: searchParams.get("noteType"),
      tags: searchParams.get("tags"),
      minMood: searchParams.get("minMood"),
      maxMood: searchParams.get("maxMood"),
      includeCount: searchParams.get("includeCount"),
      searchMode: searchParams.get("searchMode"),
      semanticWeight: searchParams.get("semanticWeight"),
    });

    if (!params.success) {
      return c.json(
        { error: "Invalid parameters", details: params.error.issues },
        400
      );
    }

    const {
      q: query,
      limit,
      offset,
      noteType,
      tags: tagsParam,
      minMood,
      maxMood,
      searchMode,
      semanticWeight,
    } = params.data;

    const userId = c.get("userId");
    const rls = rlsExecutor(userId);
    const tags = tagsParam ? tagsParam.split(",").map((t) => t.trim()) : undefined;

    let fusedScores: Map<string, { score: number; keywordRank?: number; semanticScore?: number }>;

    if (searchMode === "keyword") {
      const keywordResults = await keywordSearch({
        userId,
        query,
        limit: limit * 2,
        noteType,
        minMoodScore: minMood,
        maxMoodScore: maxMood,
      });

      fusedScores = new Map(
        keywordResults.map((r) => [
          r.id,
          { score: r.rank, keywordRank: r.rank },
        ])
      );
    } else if (searchMode === "semantic") {
      const queryEmbedding = await getEmbedding(query);
      const semanticResults = await semanticSearch(queryEmbedding, userId, {
        topK: limit * 2,
        includeMetadata: true,
        filterNoteType: noteType,
        filterTags: tags,
      });

      fusedScores = new Map(
        semanticResults.map((r) => [
          r.id,
          { score: r.score, semanticScore: r.score },
        ])
      );
    } else {
      const [keywordResults, queryEmbedding] = await Promise.all([
        keywordSearch({
          userId,
          query,
          limit: limit * 2,
          noteType,
          minMoodScore: minMood,
          maxMoodScore: maxMood,
        }),
        getEmbedding(query),
      ]);

      const semanticResults = await semanticSearch(queryEmbedding, userId, {
        topK: limit * 2,
        includeMetadata: true,
        filterNoteType: noteType,
        filterTags: tags,
      });

      fusedScores = fuseResults(
        keywordResults.map((r) => ({ id: r.id, rank: r.rank })),
        semanticResults,
        semanticWeight
      );
    }

    const sortedNoteIds = Array.from(fusedScores.entries())
      .sort(([, a], [, b]) => b.score - a.score)
      .slice(offset, offset + limit)
      .map(([id]) => id);

    if (sortedNoteIds.length === 0) {
      return c.json({
        results: [],
        count: 0,
        offset,
        limit,
        query,
        searchMode,
      });
    }

    const notesData = await db
      .select()
      .from(notes)
      .where(rls.where(notes, inArray(notes.id, sortedNoteIds)));

    const results: HybridSearchResult[] = [];
    for (const id of sortedNoteIds) {
      const note = notesData.find((n) => n.id === id);
      const scoreData = fusedScores.get(id);

      if (!note || !scoreData) continue;

      results.push({
        id: note.id,
        title: note.title,
        content: note.content,
        contentPlain: note.contentPlain,
        noteType: note.noteType,
        sourceUrl: note.sourceUrl,
        moodScore: note.moodScore,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        score: scoreData.score,
        keywordRank: scoreData.keywordRank,
        semanticScore: scoreData.semanticScore,
      });
    }

    return c.json({
      results,
      count: fusedScores.size,
      offset,
      limit,
      query,
      searchMode,
      semanticWeight: searchMode === "hybrid" ? semanticWeight : undefined,
    });
  } catch (error) {
    console.error("Search error:", error);
    return c.json(
      { error: "Failed to perform search", details: String(error) },
      500
    );
  }
}).get("/search/keyword", async (c) => {
  try {
    const { searchParams } = new URL(c.req.url);
    const query = searchParams.get("q") || "";
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const noteType = searchParams.get("noteType") as "note" | "journal" | null;
    const minMoodScore = searchParams.get("minMood")
      ? parseInt(searchParams.get("minMood")!, 10)
      : undefined;
    const maxMoodScore = searchParams.get("maxMood")
      ? parseInt(searchParams.get("maxMood")!, 10)
      : undefined;
    const includeCount = searchParams.get("includeCount") === "true";

    if (!query.trim()) {
      return c.json(
        {
          error: "Bad Request",
          message: "Search query parameter 'q' is required and cannot be empty",
        },
        400
      );
    }

    if (limit < 1 || limit > 100) {
      return c.json(
        { error: "Bad Request", message: "Limit must be between 1 and 100" },
        400
      );
    }

    if (offset < 0) {
      return c.json(
        { error: "Bad Request", message: "Offset must be non-negative" },
        400
      );
    }

    if (minMoodScore !== undefined && (minMoodScore < 1 || minMoodScore > 10)) {
      return c.json(
        { error: "Bad Request", message: "minMood must be between 1 and 10" },
        400
      );
    }

    if (maxMoodScore !== undefined && (maxMoodScore < 1 || maxMoodScore > 10)) {
      return c.json(
        { error: "Bad Request", message: "maxMood must be between 1 and 10" },
        400
      );
    }

    if (minMoodScore !== undefined && maxMoodScore !== undefined && minMoodScore > maxMoodScore) {
      return c.json(
        { error: "Bad Request", message: "minMood cannot be greater than maxMood" },
        400
      );
    }

    const results = await keywordSearch({
      userId: c.get("userId"),
      query,
      limit,
      offset,
      noteType: noteType || undefined,
      minMoodScore,
      maxMoodScore,
    });

    let totalCount: number | undefined;
    if (includeCount) {
      totalCount = await countSearchResults({
        userId: c.get("userId"),
        query,
        noteType: noteType || undefined,
        minMoodScore,
        maxMoodScore,
      });
    }

    return c.json({
      results,
      query,
      count: results.length,
      totalCount,
      pagination: {
        limit,
        offset,
        hasMore: includeCount ? offset + results.length < totalCount! : undefined,
      },
    });
  } catch (error) {
    console.error("Search API error:", error);
    return c.json(
      {
        error: "Internal Server Error",
        message:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while searching",
      },
      500
    );
  }
});

export default app;
export type { SearchParams, HybridSearchResult };
