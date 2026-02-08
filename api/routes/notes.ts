import { createApp } from "@/api/app";
import { embedNote } from "@/db/operations/jobs/embedNote";
import {
  createNote as baseCreateNote,
  deleteNote as baseDeleteNote,
  getNote,
  listNotes,
  updateNote as baseUpdateNote,
} from "@/db/operations/notes";
import {
  createNoteSchema,
  listNotesSchema,
  updateNoteSchema,
} from "@/db/schema/inputs/notes";
import { ZodError, z } from "zod";
import { deleteNoteVector, findRelatedNotes, semanticSearch } from "@/lib/vector";
import { getEmbedding } from "@/lib/embeddings";
import { db } from "@/db";
import { notes } from "@/db/schema/notes";
import { noteLinks } from "@/db/schema/noteLinks";
import { rlsExecutor } from "@/db/lib/rls";
import { eq, and, or, inArray } from "drizzle-orm";
import {
  syncNoteMentions as baseSyncNoteMentions,
  getNoteMentions as fetchNoteMentions,
} from "@/db/operations/people";
import {
  syncNoteTags as baseSyncNoteTags,
  getNoteTags as fetchNoteTags,
} from "@/db/operations/tags";

const createLinkSchema = z.object({
  targetNoteId: z.string().min(1, "Target note ID is required"),
  linkType: z.enum(["reference", "ai_suggested", "manual"]).default("manual"),
  strength: z.number().min(0).max(1).default(1.0),
});

const syncMentionsSchema = z.object({
  content: z.string(),
});

const syncTagsSchema = z.object({
  content: z.string(),
});

const app = createApp()
  .get('/notes', async (c) => {
    try {
      const { searchParams } = new URL(c.req.url);
      const rawParams = {
        limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined,
        cursor: searchParams.get("cursor") ?? undefined,
        noteType: searchParams.get("noteType") as "note" | "journal" | undefined,
        tags: searchParams.get("tags")?.split(",").filter(Boolean) ?? undefined,
        minMood: searchParams.get("minMood") ? parseInt(searchParams.get("minMood")!, 10) : undefined,
        maxMood: searchParams.get("maxMood") ? parseInt(searchParams.get("maxMood")!, 10) : undefined,
        startDate: searchParams.get("startDate") ?? undefined,
        endDate: searchParams.get("endDate") ?? undefined,
        sortBy: searchParams.get("sortBy") as "createdAt" | "updatedAt" | "title" | undefined,
        sortOrder: searchParams.get("sortOrder") as "asc" | "desc" | undefined,
      };
  
      const params = listNotesSchema.parse(rawParams);
      const result = await listNotes(c.get("userId"), params);
  
      return c.json({
        data: result.notes,
        pagination: {
          nextCursor: result.nextCursor,
          hasMore: result.hasMore,
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return c.json(
          { error: "Invalid parameters", details: error.issues },
          400
        );
      }
  
      console.error("Error listing notes:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  })
  .post('/notes', async (c) => {
    try {
      const body = await c.req.json();
      const input = createNoteSchema.parse(body);
  
      const note = await baseCreateNote(c.get("userId"), input);
  
      embedNote(note.id, c.get("userId")).catch((error) => {
        console.error(`Failed to embed note ${note.id}:`, error);
      });
  
      return c.json({ data: note }, 201);
    } catch (error) {
      if (error instanceof ZodError) {
        return c.json(
          { error: "Invalid input", details: error.issues },
          400
        );
      }
  
      console.error("Error creating note:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  })
  .get('/notes/:id', async (c) => {
    try {
      const id = c.req.param("id");
      const note = await getNote(c.get("userId"), id);
  
      if (!note) {
        return c.json({ error: "Note not found" }, 404);
      }
  
      return c.json({ data: note });
    } catch (error) {
      console.error("Error fetching note:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  })
  .put('/notes/:id', async (c) => {
    try {
      const id = c.req.param("id");
      const body = await c.req.json();
      const input = updateNoteSchema.parse(body);
  
      const note = await baseUpdateNote(c.get("userId"), id, input);
  
      if (input.content !== undefined) {
        embedNote(note.id, c.get("userId")).catch((error) => {
          console.error(`Failed to re-embed note ${note.id}:`, error);
        });
      }
  
      return c.json({ data: note });
    } catch (error) {
      if (error instanceof ZodError) {
        return c.json(
          { error: "Invalid input", details: error.issues },
          400
        );
      }
  
      if (error instanceof Error) {
        if (error.message === "Note not found") {
          return c.json({ error: "Note not found" }, 404);
        }
  
        if (error.message.includes("modified by another process")) {
          return c.json({ error: "Conflict", message: error.message }, 409);
        }
      }
  
      console.error("Error updating note:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  })
  .delete('/notes/:id', async (c) => {
    try {
      const id = c.req.param("id");
      await baseDeleteNote(c.get("userId"), id);
  
      deleteNoteVector(id).catch((error) => {
        console.error(`Failed to delete vector for note ${id}:`, error);
      });
  
      return c.json({ message: "Note deleted successfully" }, 200);
    } catch (error) {
      if (error instanceof Error && error.message === "Note not found") {
        return c.json({ error: "Note not found" }, 404);
      }
  
      console.error("Error deleting note:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  })
  .post('/notes/:id/link', async (c) => {
    try {
      const sourceNoteId = c.req.param("id");
      const body = await c.req.json();
      const validationResult = createLinkSchema.safeParse(body);
  
      if (!validationResult.success) {
        return c.json(
          { error: validationResult.error.issues[0]?.message || "Invalid input" },
          400
        );
      }
  
      const { targetNoteId, linkType, strength } = validationResult.data;
      const rls = rlsExecutor(c.get("userId"));
  
      if (sourceNoteId === targetNoteId) {
        return c.json({ error: "Cannot link a note to itself" }, 400);
      }
  
      const [sourceNote] = await db
        .select({ id: notes.id })
        .from(notes)
        .where(rls.where(notes, eq(notes.id, sourceNoteId)))
        .limit(1);
  
      const [targetNote] = await db
        .select({ id: notes.id })
        .from(notes)
        .where(rls.where(notes, eq(notes.id, targetNoteId)))
        .limit(1);
  
      if (!sourceNote) {
        return c.json({ error: "Source note not found" }, 404);
      }
  
      if (!targetNote) {
        return c.json({ error: "Target note not found" }, 404);
      }
  
      const existingLink = await db
        .select({ id: noteLinks.id })
        .from(noteLinks)
        .where(
          or(
            and(
              eq(noteLinks.sourceNoteId, sourceNoteId),
              eq(noteLinks.targetNoteId, targetNoteId)
            ),
            and(
              eq(noteLinks.sourceNoteId, targetNoteId),
              eq(noteLinks.targetNoteId, sourceNoteId)
            )
          )
        )
        .limit(1);
  
      if (existingLink.length > 0) {
        return c.json(
          {
            error: "Link already exists between these notes",
            existingLinkId: existingLink[0]?.id,
          },
          409
        );
      }
  
      const [newLink] = await db
        .insert(noteLinks)
        .values({
          sourceNoteId,
          targetNoteId,
          linkType,
          strength,
        })
        .returning();
  
      return c.json(newLink, 201);
    } catch (error) {
      console.error("Error creating note link:", error);
      return c.json({ error: "Failed to create note link" }, 500);
    }
  })
  .delete('/notes/:id/link', async (c) => {
    try {
      const sourceNoteId = c.req.param("id");
      const { searchParams } = new URL(c.req.url);
      const targetNoteId = searchParams.get("targetNoteId");
  
      if (!targetNoteId) {
        return c.json({ error: "targetNoteId query parameter is required" }, 400);
      }
  
      const rls = rlsExecutor(c.get("userId"));
  
      const [sourceNote] = await db
        .select({ id: notes.id })
        .from(notes)
        .where(rls.where(notes, eq(notes.id, sourceNoteId)))
        .limit(1);
  
      const [targetNote] = await db
        .select({ id: notes.id })
        .from(notes)
        .where(rls.where(notes, eq(notes.id, targetNoteId)))
        .limit(1);
  
      if (!sourceNote || !targetNote) {
        return c.json({ error: "Note not found" }, 404);
      }
  
      const deletedLinks = await db
        .delete(noteLinks)
        .where(
          or(
            and(
              eq(noteLinks.sourceNoteId, sourceNoteId),
              eq(noteLinks.targetNoteId, targetNoteId)
            ),
            and(
              eq(noteLinks.sourceNoteId, targetNoteId),
              eq(noteLinks.targetNoteId, sourceNoteId)
            )
          )
        )
        .returning();
  
      if (deletedLinks.length === 0) {
        return c.json({ error: "Link not found" }, 404);
      }
  
      return c.json({ success: true, deleted: deletedLinks[0] });
    } catch (error) {
      console.error("Error deleting note link:", error);
      return c.json({ error: "Failed to delete note link" }, 500);
    }
  })
  .get('/notes/:id/mentions', async (c) => {
    try {
      const noteId = c.req.param("id");
      const mentions = await fetchNoteMentions(c.get("userId"), noteId);
      return c.json(mentions);
    } catch (error) {
      console.error("Error fetching note mentions:", error);
      return c.json({ error: "Failed to fetch note mentions" }, 500);
    }
  })
  .post('/notes/:id/mentions', async (c) => {
    try {
      const noteId = c.req.param("id");
      const body = await c.req.json();
      const validationResult = syncMentionsSchema.safeParse(body);
  
      if (!validationResult.success) {
        return c.json(
          { error: "Invalid input", details: validationResult.error.issues },
          400
        );
      }
  
      const { content } = validationResult.data;
  
      await baseSyncNoteMentions(c.get("userId"), noteId, content);
      const mentions = await fetchNoteMentions(c.get("userId"), noteId);
  
      return c.json({ success: true, mentions });
    } catch (error) {
      console.error("Error syncing note mentions:", error);
      return c.json({ error: "Failed to sync note mentions" }, 500);
    }
  })
  .get('/notes/:id/tags', async (c) => {
    try {
      const noteId = c.req.param("id");
      const tags = await fetchNoteTags(c.get("userId"), noteId);
      return c.json(tags);
    } catch (error) {
      console.error("Error fetching note tags:", error);
      return c.json({ error: "Failed to fetch note tags" }, 500);
    }
  })
  .post('/notes/:id/tags', async (c) => {
    try {
      const noteId = c.req.param("id");
      const body = await c.req.json();
      const validationResult = syncTagsSchema.safeParse(body);
  
      if (!validationResult.success) {
        return c.json(
          { error: "Invalid input", details: validationResult.error.issues },
          400
        );
      }
  
      const { content } = validationResult.data;
  
      await baseSyncNoteTags(c.get("userId"), noteId, content);
      const tags = await fetchNoteTags(c.get("userId"), noteId);
  
      return c.json({ success: true, tags });
    } catch (error) {
      console.error("Error syncing note tags:", error);
      return c.json({ error: "Failed to sync note tags" }, 500);
    }
  })
  .get('/notes/:id/related', async (c) => {
    try {
      const noteId = c.req.param("id");
      const { searchParams } = new URL(c.req.url);
      const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "5"), 1), 10);
      const rls = rlsExecutor(c.get("userId"));
  
      const [note] = await db
        .select({ id: notes.id })
        .from(notes)
        .where(rls.where(notes, eq(notes.id, noteId)))
        .limit(1);
  
      if (!note) {
        return c.json({ error: "Note not found" }, 404);
      }
  
      const relatedResults = await findRelatedNotes(noteId, c.get("userId"), limit);
  
      if (relatedResults.length === 0) {
        return c.json({ related: [], hasEmbedding: false });
      }
  
      const relatedNoteIds = relatedResults.map((r) => r.id);
  
      const relatedNotes = await db
        .select({
          id: notes.id,
          title: notes.title,
          content: notes.content,
          noteType: notes.noteType,
          createdAt: notes.createdAt,
          updatedAt: notes.updatedAt,
        })
        .from(notes)
        .where(rls.where(notes, inArray(notes.id, relatedNoteIds)));
  
      const existingLinks = await db
        .select({
          sourceNoteId: noteLinks.sourceNoteId,
          targetNoteId: noteLinks.targetNoteId,
          linkType: noteLinks.linkType,
        })
        .from(noteLinks)
        .where(
          or(
            and(
              eq(noteLinks.sourceNoteId, noteId),
              inArray(noteLinks.targetNoteId, relatedNoteIds)
            ),
            and(
              eq(noteLinks.targetNoteId, noteId),
              inArray(noteLinks.sourceNoteId, relatedNoteIds)
            )
          )
        );
  
      const linkedNoteIds = new Set(
        existingLinks.map((link) =>
          link.sourceNoteId === noteId ? link.targetNoteId : link.sourceNoteId
        )
      );
  
      const related = relatedResults
        .map((result) => {
          const noteData = relatedNotes.find((n) => n.id === result.id);
          if (!noteData) return null;
  
          const plainContent = noteData.content
            .replace(/#{1,6}\s+/g, "")
            .replace(/\*\*([^*]+)\*\*/g, "$1")
            .replace(/\*([^*]+)\*/g, "$1")
            .replace(/`([^`]+)`/g, "$1")
            .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
            .replace(/\n+/g, " ")
            .trim();
  
          const preview = plainContent.length > 150
            ? plainContent.slice(0, 150) + "..."
            : plainContent;
  
          return {
            id: noteData.id,
            title: noteData.title,
            preview,
            noteType: noteData.noteType,
            similarity: Math.round(result.score * 100),
            createdAt: noteData.createdAt,
            updatedAt: noteData.updatedAt,
            isLinked: linkedNoteIds.has(noteData.id),
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .sort((a, b) => b.similarity - a.similarity);
  
      return c.json({ related, hasEmbedding: true });
    } catch (error) {
      console.error("Error fetching related notes:", error);
      return c.json({ error: "Failed to fetch related notes" }, 500);
    }
  })
  .post('/notes/:id/related', async (c) => {
    try {
      const noteId = c.req.param("id");
      const body = await c.req.json();
      const { content } = body;
  
      if (!content || typeof content !== "string" || content.trim().length < 50) {
        return c.json({ related: [], hasEmbedding: false });
      }
  
      const { searchParams } = new URL(c.req.url);
      const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "5"), 1), 10);
      const rls = rlsExecutor(c.get("userId"));
  
      const embedding = await getEmbedding(content);
  
      const relatedResults = await semanticSearch(embedding, c.get("userId"), {
        topK: limit + 1,
        includeMetadata: true,
      });
  
      const filteredResults = relatedResults.filter((r) => r.id !== noteId).slice(0, limit);
  
      if (filteredResults.length === 0) {
        return c.json({ related: [], hasEmbedding: true });
      }
  
      const relatedNoteIds = filteredResults.map((r) => r.id);
  
      const relatedNotes = await db
        .select({
          id: notes.id,
          title: notes.title,
          content: notes.content,
          noteType: notes.noteType,
          createdAt: notes.createdAt,
          updatedAt: notes.updatedAt,
        })
        .from(notes)
        .where(rls.where(notes, inArray(notes.id, relatedNoteIds)));
  
      const [ownedNote] = await db
        .select({ id: notes.id })
        .from(notes)
        .where(rls.where(notes, eq(notes.id, noteId)))
        .limit(1);
  
      const existingLinks = ownedNote
        ? await db
            .select({
              sourceNoteId: noteLinks.sourceNoteId,
              targetNoteId: noteLinks.targetNoteId,
            })
            .from(noteLinks)
            .where(
              or(
                and(
                  eq(noteLinks.sourceNoteId, noteId),
                  inArray(noteLinks.targetNoteId, relatedNoteIds)
                ),
                and(
                  eq(noteLinks.targetNoteId, noteId),
                  inArray(noteLinks.sourceNoteId, relatedNoteIds)
                )
              )
            )
        : [];
  
      const linkedNoteIds = new Set(
        existingLinks.map((link) =>
          link.sourceNoteId === noteId ? link.targetNoteId : link.sourceNoteId
        )
      );
  
      const related = filteredResults
        .map((result) => {
          const noteData = relatedNotes.find((n) => n.id === result.id);
          if (!noteData) return null;
  
          const plainContent = noteData.content
            .replace(/#{1,6}\s+/g, "")
            .replace(/\*\*([^*]+)\*\*/g, "$1")
            .replace(/\*([^*]+)\*/g, "$1")
            .replace(/`([^`]+)`/g, "$1")
            .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
            .replace(/\n+/g, " ")
            .trim();
  
          const preview = plainContent.length > 150
            ? plainContent.slice(0, 150) + "..."
            : plainContent;
  
          return {
            id: noteData.id,
            title: noteData.title,
            preview,
            noteType: noteData.noteType,
            similarity: Math.round(result.score * 100),
            createdAt: noteData.createdAt,
            updatedAt: noteData.updatedAt,
            isLinked: linkedNoteIds.has(noteData.id),
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .sort((a, b) => b.similarity - a.similarity);
  
      return c.json({ related, hasEmbedding: true });
    } catch (error) {
      console.error("Error finding related notes from content:", error);
      return c.json({ error: "Failed to find related notes" }, 500);
    }
  });

export default app;
