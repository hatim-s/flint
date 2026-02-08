/**
 * Note CRUD Operations
 * 
 * This module provides type-safe functions for creating, reading, updating, and deleting notes.
 * All operations automatically respect Row Level Security (RLS) policies.
 */

import { db } from "@/db";
import { notes, type Note, type NewNote } from "@/db/schema/notes";
import { noteTags } from "@/db/schema/noteTags";
import { tags } from "@/db/schema/tags";
import { eq, and, desc, asc, gte, lte, sql, inArray } from "drizzle-orm";
import { rlsExecutor } from "@/db/lib/rls";
import { z } from "zod";

/**
 * Zod Schemas for Request Validation
 */

export const createNoteSchema = z.object({
  title: z.string().min(1, "Title is required").max(500, "Title must be 500 characters or less"),
  content: z.string(),
  noteType: z.enum(["note", "journal"]),
  sourceUrl: z.union([z.string().url(), z.literal("")]).optional(),
  moodScore: z.number().int().min(1).max(10).optional(),
  qualityScore: z.number().min(0).max(1).optional(),
  templateId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateNoteSchema = z.object({
  title: z.string().min(1, "Title is required").max(500, "Title must be 500 characters or less").optional(),
  content: z.string().optional(),
  noteType: z.enum(["note", "journal"]).optional(),
  sourceUrl: z.union([z.string().url(), z.literal("")]).optional(),
  moodScore: z.number().int().min(1).max(10).optional().nullable(),
  qualityScore: z.number().min(0).max(1).optional().nullable(),
  templateId: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  updatedAt: z.string().datetime().optional(), // For optimistic locking
});

export const listNotesSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(), // Cursor-based pagination (note ID)
  noteType: z.enum(["note", "journal"]).optional(),
  tags: z.array(z.string()).optional(),
  minMood: z.number().int().min(1).max(10).optional(),
  maxMood: z.number().int().min(1).max(10).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "title"]).default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type ListNotesInput = z.infer<typeof listNotesSchema>;

/**
 * Strips markdown formatting from content to create plain text for search
 */
export function stripMarkdown(markdown: string): string {
  return markdown
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    // Remove headers
    .replace(/^#{1,6}\s+/gm, "")
    // Remove bold/italic
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
    // Remove horizontal rules
    .replace(/^(-{3,}|_{3,}|\*{3,})$/gm, "")
    // Remove blockquotes
    .replace(/^>\s+/gm, "")
    // Remove list markers
    .replace(/^[\s]*[-*+]\s+/gm, "")
    .replace(/^[\s]*\d+\.\s+/gm, "")
    // Remove task list markers
    .replace(/^[\s]*-\s+\[[x\s]\]\s+/gim, "")
    // Clean up extra whitespace
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Count words in text
 */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Create a new note
 */
export async function createNote(
  userId: string,
  input: CreateNoteInput
): Promise<Note> {
  const rls = rlsExecutor(userId);

  // Strip markdown for plain text search
  const contentPlain = stripMarkdown(input.content);
  const wordCount = countWords(contentPlain);

  // Prepare metadata
  const metadata = {
    wordCount,
    embeddingStatus: "pending" as const,
    ...input.metadata,
  };

  const newNote: NewNote = rls.values({
    title: input.title,
    content: input.content,
    contentPlain,
    noteType: input.noteType,
    sourceUrl: input.sourceUrl || null,
    moodScore: input.moodScore ?? null,
    qualityScore: input.qualityScore ?? null,
    templateId: input.templateId ?? null,
    metadata,
  }) as NewNote;

  const [note] = await db.insert(notes).values(newNote).returning();

  if (!note) {
    throw new Error("Failed to create note");
  }

  return note;
}

/**
 * Get a single note by ID
 */
export async function getNote(
  userId: string,
  noteId: string
): Promise<Note | null> {
  const rls = rlsExecutor(userId);

  const [note] = await db
    .select()
    .from(notes)
    .where(rls.where(notes, eq(notes.id, noteId)))
    .limit(1);

  return note ?? null;
}

/**
 * Update an existing note
 */
export async function updateNote(
  userId: string,
  noteId: string,
  input: UpdateNoteInput
): Promise<Note> {
  const rls = rlsExecutor(userId);

  // First, verify the note exists and get current updatedAt for optimistic locking
  const existingNote = await getNote(userId, noteId);
  if (!existingNote) {
    throw new Error("Note not found");
  }

  // Optimistic locking: check if updatedAt matches
  if (input.updatedAt) {
    const providedUpdatedAt = new Date(input.updatedAt);
    if (existingNote.updatedAt.getTime() !== providedUpdatedAt.getTime()) {
      throw new Error("Note was modified by another process. Please refresh and try again.");
    }
  }

  // Build update object
  const updateData: Partial<NewNote> = {};

  if (input.title !== undefined) updateData.title = input.title;
  if (input.noteType !== undefined) updateData.noteType = input.noteType;
  if (input.sourceUrl !== undefined) updateData.sourceUrl = input.sourceUrl || null;
  if (input.moodScore !== undefined) updateData.moodScore = input.moodScore;
  if (input.qualityScore !== undefined) updateData.qualityScore = input.qualityScore;
  if (input.templateId !== undefined) updateData.templateId = input.templateId;

  // If content is being updated, re-strip markdown
  if (input.content !== undefined) {
    updateData.content = input.content;
    updateData.contentPlain = stripMarkdown(input.content);
    
    // Update word count in metadata
    const wordCount = countWords(updateData.contentPlain);
    updateData.metadata = {
      ...existingNote.metadata,
      wordCount,
      embeddingStatus: "pending" as const, // Reset embedding status when content changes
      ...input.metadata,
    };
  } else if (input.metadata) {
    // Just update metadata if provided
    updateData.metadata = {
      ...existingNote.metadata,
      ...input.metadata,
    };
  }

  const [updatedNote] = await db
    .update(notes)
    .set(updateData)
    .where(rls.where(notes, eq(notes.id, noteId)))
    .returning();

  if (!updatedNote) {
    throw new Error("Failed to update note");
  }

  return updatedNote;
}

/**
 * Delete a note
 */
export async function deleteNote(
  userId: string,
  noteId: string
): Promise<void> {
  const rls = rlsExecutor(userId);

  // Verify note exists first
  const existingNote = await getNote(userId, noteId);
  if (!existingNote) {
    throw new Error("Note not found");
  }

  await db.delete(notes).where(rls.where(notes, eq(notes.id, noteId)));
}

/**
 * List notes with filtering and pagination
 */
export async function listNotes(
  userId: string,
  options: ListNotesInput = { limit: 20, sortBy: "updatedAt", sortOrder: "desc" }
): Promise<{ notes: Note[]; nextCursor: string | null; hasMore: boolean }> {
  const rls = rlsExecutor(userId);

  // Build WHERE conditions
  const conditions = [];

  if (options.noteType) {
    conditions.push(eq(notes.noteType, options.noteType));
  }

  if (options.minMood !== undefined) {
    conditions.push(gte(notes.moodScore, options.minMood));
  }

  if (options.maxMood !== undefined) {
    conditions.push(lte(notes.moodScore, options.maxMood));
  }

  if (options.startDate) {
    conditions.push(gte(notes.createdAt, new Date(options.startDate)));
  }

  if (options.endDate) {
    conditions.push(lte(notes.createdAt, new Date(options.endDate)));
  }

  // Cursor-based pagination
  if (options.cursor) {
    // For cursor-based pagination, we filter by the sort field
    // This assumes cursor is the ID of the last item from previous page
    const cursorNote = await db
      .select()
      .from(notes)
      .where(rls.where(notes, eq(notes.id, options.cursor)))
      .limit(1);

    if (cursorNote[0]) {
      const cursorValue = cursorNote[0][options.sortBy];
      if (options.sortOrder === "desc") {
        conditions.push(sql`${notes[options.sortBy]} < ${cursorValue}`);
      } else {
        conditions.push(sql`${notes[options.sortBy]} > ${cursorValue}`);
      }
    }
  }

  // Tag filtering requires a join
  const query = db.select().from(notes);

  if (options.tags && options.tags.length > 0) {
    // Find tag IDs first
    const tagRecords = await db
      .select()
      .from(tags)
      .where(
        rls.where(tags, inArray(tags.name, options.tags))
      );

    const tagIds = tagRecords.map(t => t.id);

    if (tagIds.length > 0) {
      // Find note IDs that have all requested tags
      const noteIdsWithTags = await db
        .select({ noteId: noteTags.noteId })
        .from(noteTags)
        .where(inArray(noteTags.tagId, tagIds))
        .groupBy(noteTags.noteId);

      const noteIds = noteIdsWithTags.map(nt => nt.noteId);

      if (noteIds.length > 0) {
        conditions.push(inArray(notes.id, noteIds));
      } else {
        // No notes have these tags, return empty
        return { notes: [], nextCursor: null, hasMore: false };
      }
    } else {
      // Tags don't exist, return empty
      return { notes: [], nextCursor: null, hasMore: false };
    }
  }

  // Apply WHERE conditions
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Determine sort order
  const sortColumn = notes[options.sortBy];
  const orderBy = options.sortOrder === "desc" ? desc(sortColumn) : asc(sortColumn);

  // Fetch one extra to determine if there are more results
  const results = await query
    .where(rls.where(notes, whereClause))
    .orderBy(orderBy)
    .limit(options.limit + 1);

  const hasMore = results.length > options.limit;
  const returnedNotes = hasMore ? results.slice(0, options.limit) : results;
  const nextCursor = hasMore && returnedNotes.length > 0
    ? returnedNotes[returnedNotes.length - 1]!.id
    : null;

  return {
    notes: returnedNotes,
    nextCursor,
    hasMore,
  };
}

/**
 * Get note count for a user
 */
export async function getNoteCount(
  userId: string,
  noteType?: "note" | "journal"
): Promise<number> {
  const rls = rlsExecutor(userId);

  const conditions = noteType ? [eq(notes.noteType, noteType)] : [];
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(notes)
    .where(rls.where(notes, whereClause));

  return result[0]?.count ?? 0;
}
