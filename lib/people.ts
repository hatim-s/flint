/**
 * People/Contact Management and Sync Operations
 * 
 * This module provides functions for @mention extraction from notes and syncing with the junction table.
 */

import { db } from "@/db";
import { notes } from "@/db/schema/notes";
import { people, type Person } from "@/db/schema/people";
import { noteMentions } from "@/db/schema/noteMentions";
import { eq, and, inArray } from "drizzle-orm";
import { rlsExecutor } from "@/db/lib/rls";

/**
 * Extracts people/contact names from markdown content
 * People are identified by the @name pattern (mention format)
 * 
 * @param content - Markdown content to extract mentions from
 * @returns Array of unique person names
 */
export function extractPeopleFromContent(content: string): string[] {
  // Match @name pattern, supporting names with spaces, hyphens, and apostrophes
  // More lenient than tags to support full names like "John Smith"
  const mentionRegex = /@([a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)*)/g;
  const matches = content.matchAll(mentionRegex);
  
  const personNames = new Set<string>();
  for (const match of matches) {
    if (match[1]) {
      personNames.add(match[1].trim());
    }
  }
  
  return Array.from(personNames);
}

/**
 * Syncs people mentions for a note:
 * 1. Extracts person names from content
 * 2. Creates any new people that don't exist
 * 3. Updates the note_mentions junction table to match extracted mentions
 * 
 * @param userId - User ID who owns the note
 * @param noteId - Note ID to sync mentions for
 * @param content - Note content to extract mentions from
 */
export async function syncNoteMentions(
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

  // Extract person names from content
  const personNames = extractPeopleFromContent(content);

  if (personNames.length === 0) {
    // No mentions in content, remove all existing associations
    await db
      .delete(noteMentions)
      .where(eq(noteMentions.noteId, noteId));
    return;
  }

  // Get or create people
  const personRecords: Person[] = [];
  
  for (const personName of personNames) {
    // Check if person exists
    const [existingPerson] = await db
      .select()
      .from(people)
      .where(rls.where(people, eq(people.name, personName)))
      .limit(1);

    if (existingPerson) {
      personRecords.push(existingPerson);
    } else {
      // Create new person
      const [newPerson] = await db
        .insert(people)
        .values(rls.values({
          name: personName,
          email: null,
          metadata: {},
        }))
        .returning();

      if (newPerson) {
        personRecords.push(newPerson);
      }
    }
  }

  // Get current mention associations for this note
  const currentAssociations = await db
    .select()
    .from(noteMentions)
    .where(eq(noteMentions.noteId, noteId));

  const currentPersonIds = new Set(currentAssociations.map(nm => nm.personId));
  const newPersonIds = new Set(personRecords.map(p => p.id));

  // Find people to add and remove
  const toAdd = personRecords.filter(p => !currentPersonIds.has(p.id));
  const toRemove = currentAssociations.filter(nm => !newPersonIds.has(nm.personId));

  // Remove old associations
  if (toRemove.length > 0) {
    await db
      .delete(noteMentions)
      .where(
        and(
          eq(noteMentions.noteId, noteId),
          inArray(noteMentions.personId, toRemove.map(nm => nm.personId))
        )
      );
  }

  // Add new associations
  if (toAdd.length > 0) {
    await db
      .insert(noteMentions)
      .values(toAdd.map(person => ({
        noteId,
        personId: person.id,
      })))
      .onConflictDoNothing(); // In case of race conditions
  }
}

/**
 * Get people mentioned in a note
 * 
 * @param userId - User ID who owns the note
 * @param noteId - Note ID to get mentions for
 * @returns Array of people
 */
export async function getNoteMentions(
  userId: string,
  noteId: string
): Promise<Person[]> {
  const rls = rlsExecutor(userId);

  const result = await db
    .select({
      id: people.id,
      userId: people.userId,
      name: people.name,
      email: people.email,
      createdAt: people.createdAt,
      metadata: people.metadata,
    })
    .from(people)
    .innerJoin(noteMentions, eq(noteMentions.personId, people.id))
    .innerJoin(notes, eq(noteMentions.noteId, notes.id))
    .where(
      and(
        rls.where(people),
        rls.where(notes, eq(notes.id, noteId))
      )
    );

  return result;
}
