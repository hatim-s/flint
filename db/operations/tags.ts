/**
 * Tag Management and Sync Operations
 * 
 * This module provides functions for tag extraction from notes and syncing with the junction table.
 */

import { db } from "@/db";
import { notes } from "@/db/schema/notes";
import { tags, type Tag } from "@/db/schema/tags";
import { noteTags } from "@/db/schema/noteTags";
import { eq, and, inArray } from "drizzle-orm";
import { rlsExecutor } from "@/db/lib/rls";
import { extractTagsFromContent } from "@/lib/mentions";

/**
 * Syncs tags for a note:
 * 1. Extracts tag names from content
 * 2. Creates any new tags that don't exist
 * 3. Updates the note_tags junction table to match extracted tags
 * 
 * @param userId - User ID who owns the note
 * @param noteId - Note ID to sync tags for
 * @param content - Note content to extract tags from
 */
export async function syncNoteTags(
  userId: string,
  noteId: string,
  content: string
): Promise<void> {
  const rls = rlsExecutor(userId);

  const [ownedNote] = await db
    .select({ id: notes.id })
    .from(notes)
    .where(rls.where(notes, eq(notes.id, noteId)))
    .limit(1);

  if (!ownedNote) {
    throw new Error("Note not found");
  }

  // Extract tag names from content
  const tagNames = extractTagsFromContent(content);

  if (tagNames.length === 0) {
    // No tags in content, remove all existing tag associations
    await db
      .delete(noteTags)
      .where(eq(noteTags.noteId, noteId));
    return;
  }

  // Get or create tags
  const tagRecords: Tag[] = [];

  for (const tagName of tagNames) {
    // Check if tag exists
    const [existingTag] = await db
      .select()
      .from(tags)
      .where(rls.where(tags, eq(tags.name, tagName)))
      .limit(1);

    if (existingTag) {
      tagRecords.push(existingTag);
    } else {
      // Create new tag
      const [newTag] = await db
        .insert(tags)
        .values(rls.values({
          name: tagName,
          color: generateRandomColor(),
        }))
        .returning();

      if (newTag) {
        tagRecords.push(newTag);
      }
    }
  }

  // Get current tag associations for this note
  const currentAssociations = await db
    .select()
    .from(noteTags)
    .where(eq(noteTags.noteId, noteId));

  const currentTagIds = new Set(currentAssociations.map(nt => nt.tagId));
  const newTagIds = new Set(tagRecords.map(t => t.id));

  // Find tags to add and remove
  const toAdd = tagRecords.filter(t => !currentTagIds.has(t.id));
  const toRemove = currentAssociations.filter(nt => !newTagIds.has(nt.tagId));

  // Remove old associations
  if (toRemove.length > 0) {
    await db
      .delete(noteTags)
      .where(
        and(
          eq(noteTags.noteId, noteId),
          inArray(noteTags.tagId, toRemove.map(nt => nt.tagId))
        )
      );
  }

  // Add new associations
  if (toAdd.length > 0) {
    await db
      .insert(noteTags)
      .values(toAdd.map(tag => ({
        noteId,
        tagId: tag.id,
      })))
      .onConflictDoNothing(); // In case of race conditions
  }
}

/**
 * Get tags associated with a note
 * 
 * @param userId - User ID who owns the note
 * @param noteId - Note ID to get tags for
 * @returns Array of tags
 */
export async function getNoteTags(
  userId: string,
  noteId: string
): Promise<Tag[]> {
  const rls = rlsExecutor(userId);

  const result = await db
    .select({
      id: tags.id,
      userId: tags.userId,
      name: tags.name,
      color: tags.color,
      createdAt: tags.createdAt,
    })
    .from(tags)
    .innerJoin(noteTags, eq(noteTags.tagId, tags.id))
    .innerJoin(notes, eq(noteTags.noteId, notes.id))
    .where(
      and(
        rls.where(tags),
        rls.where(notes, eq(notes.id, noteId))
      )
    );

  return result;
}

/**
 * Generates a random color for new tags
 * Uses a predefined palette of visually appealing colors
 */
function generateRandomColor(): string {
  const colors = [
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#f43f5e', // Rose
    '#f97316', // Orange
    '#eab308', // Yellow
    '#84cc16', // Lime
    '#10b981', // Emerald
    '#14b8a6', // Teal
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#6366f1', // Indigo (repeat for variety)
  ];

  return colors[Math.floor(Math.random() * colors.length)] ?? '#6366f1';
}
