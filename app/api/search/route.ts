/**
 * Hybrid Search API Route
 * 
 * Combines keyword-based full-text search with semantic vector search
 * for comprehensive note retrieval. Results are fused using weighted scores.
 */

import { auth } from "@/auth";
import { getEmbedding } from "@/lib/embeddings";
import { searchNotes as keywordSearch } from "@/db/lib/search";
import { semanticSearch } from "@/lib/vector";
import { db } from "@/db";
import { notes } from "@/db/schema/notes";
import { rlsExecutor } from "@/db/lib/rls";
import { inArray } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";

// Request validation schema
const SearchParamsSchema = z.object({
  q: z.string().min(1, "Query is required"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  noteType: z.enum(["note", "journal"]).optional(),
  tags: z.string().optional(), // Comma-separated tag names
  minMood: z.coerce.number().int().min(1).max(10).optional(),
  maxMood: z.coerce.number().int().min(1).max(10).optional(),
  includeCount: z.coerce.boolean().default(false),
  searchMode: z.enum(["hybrid", "keyword", "semantic"]).default("hybrid"),
  semanticWeight: z.coerce.number().min(0).max(1).default(0.6), // Weight for semantic score
});

export type SearchParams = z.infer<typeof SearchParamsSchema>;

export interface HybridSearchResult {
  id: string;
  title: string;
  content: string;
  contentPlain: string | null;
  noteType: "note" | "journal";
  sourceUrl: string | null;
  moodScore: number | null;
  createdAt: Date;
  updatedAt: Date;
  score: number; // Combined score
  keywordRank?: number; // Keyword search rank
  semanticScore?: number; // Semantic similarity score
}

/**
 * Normalize scores to 0-1 range
 */
function normalizeScore(score: number, min: number, max: number): number {
  if (max === min) return 1;
  return (score - min) / (max - min);
}

/**
 * Fuse keyword and semantic search results with weighted scoring
 */
function fuseResults(
  keywordResults: Array<{ id: string; rank: number }>,
  semanticResults: Array<{ id: string; score: number }>,
  semanticWeight: number
): Map<string, { score: number; keywordRank?: number; semanticScore?: number }> {
  const keywordWeight = 1 - semanticWeight;
  const fusedScores = new Map<string, { score: number; keywordRank?: number; semanticScore?: number }>();

  // Find min/max for normalization
  const keywordRanks = keywordResults.map((r) => r.rank);
  const semanticScores = semanticResults.map((r) => r.score);

  const minKeywordRank = Math.min(...keywordRanks, 0);
  const maxKeywordRank = Math.max(...keywordRanks, 1);
  const minSemanticScore = Math.min(...semanticScores, 0);
  const maxSemanticScore = Math.max(...semanticScores, 1);

  // Process keyword results
  for (const result of keywordResults) {
    const normalizedRank = normalizeScore(result.rank, minKeywordRank, maxKeywordRank);
    fusedScores.set(result.id, {
      score: normalizedRank * keywordWeight,
      keywordRank: result.rank,
    });
  }

  // Process semantic results
  for (const result of semanticResults) {
    const normalizedScore = normalizeScore(result.score, minSemanticScore, maxSemanticScore);
    const existing = fusedScores.get(result.id);

    if (existing) {
      // Combine scores if note appears in both results
      existing.score += normalizedScore * semanticWeight;
      existing.semanticScore = result.score;
    } else {
      // Add semantic-only result
      fusedScores.set(result.id, {
        score: normalizedScore * semanticWeight,
        semanticScore: result.score,
      });
    }
  }

  return fusedScores;
}

/**
 * GET /api/search - Unified hybrid search endpoint
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Validate query parameters
    const searchParams = request.nextUrl.searchParams;
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
      return Response.json(
        { error: "Invalid parameters", details: params.error.issues },
        { status: 400 }
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

    const userId = session.user.id;
    const rls = rlsExecutor(userId);

    // Parse tags if provided
    const tags = tagsParam ? tagsParam.split(",").map((t) => t.trim()) : undefined;

    // 3. Perform search based on mode
    let fusedScores: Map<string, { score: number; keywordRank?: number; semanticScore?: number }>;

    if (searchMode === "keyword") {
      // Keyword-only search
      const keywordResults = await keywordSearch({
        userId,
        query,
        limit: limit * 2, // Fetch more for better results
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
      // Semantic-only search
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
      // Hybrid search (default)
      // Execute both searches in parallel
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

      // Fuse results with weighted scoring
      fusedScores = fuseResults(
        keywordResults.map((r) => ({ id: r.id, rank: r.rank })),
        semanticResults,
        semanticWeight
      );
    }

    // 4. Get unique note IDs sorted by fused score
    const sortedNoteIds = Array.from(fusedScores.entries())
      .sort(([, a], [, b]) => b.score - a.score)
      .slice(offset, offset + limit)
      .map(([id]) => id);

    if (sortedNoteIds.length === 0) {
      return Response.json({
        results: [],
        count: 0,
        offset,
        limit,
        query,
        searchMode,
      });
    }

    // 5. Fetch full note data from database
    const notesData = await db
      .select()
      .from(notes)
      .where(rls.where(notes, inArray(notes.id, sortedNoteIds)));

    // 6. Construct response with scores
    const results: HybridSearchResult[] = sortedNoteIds
      .map((id) => {
        const note = notesData.find((n) => n.id === id);
        const scoreData = fusedScores.get(id);

        if (!note || !scoreData) return null;

        const result: HybridSearchResult = {
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
        };
        
        return result;
      })
      .filter((r): r is HybridSearchResult => r !== null);

    return Response.json({
      results,
      count: fusedScores.size, // Total unique results (before pagination)
      offset,
      limit,
      query,
      searchMode,
      semanticWeight: searchMode === "hybrid" ? semanticWeight : undefined,
    });
  } catch (error) {
    console.error("Search error:", error);
    return Response.json(
      { error: "Failed to perform search", details: String(error) },
      { status: 500 }
    );
  }
}
