/**
 * People/Contact Management and Sync Operations
 *
 * This module provides functions for @mention extraction from notes and syncing with the junction table.
 */

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { rlsExecutor } from "@/db/lib/rls";
import { noteMentions } from "@/db/schema/noteMentions";
import { notes } from "@/db/schema/notes";
import { type Person, people } from "@/db/schema/people";
import { extractPeopleFromContent } from "@/lib/mentions";

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
async function syncNoteMentions(
  userId: string,
  noteId: string,
  content: string,
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
    await db.delete(noteMentions).where(eq(noteMentions.noteId, noteId));
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
        .values(
          rls.values({
            name: personName,
            email: null,
            metadata: {},
          }),
        )
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

  const currentPersonIds = new Set(
    currentAssociations.map((nm) => nm.personId),
  );
  const newPersonIds = new Set(personRecords.map((p) => p.id));

  // Find people to add and remove
  const toAdd = personRecords.filter((p) => !currentPersonIds.has(p.id));
  const toRemove = currentAssociations.filter(
    (nm) => !newPersonIds.has(nm.personId),
  );

  // Remove old associations
  if (toRemove.length > 0) {
    await db.delete(noteMentions).where(
      and(
        eq(noteMentions.noteId, noteId),
        inArray(
          noteMentions.personId,
          toRemove.map((nm) => nm.personId),
        ),
      ),
    );
  }

  // Add new associations
  if (toAdd.length > 0) {
    await db
      .insert(noteMentions)
      .values(
        toAdd.map((person) => ({
          noteId,
          personId: person.id,
        })),
      )
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
async function getNoteMentions(
  userId: string,
  noteId: string,
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
    .where(and(rls.where(people), rls.where(notes, eq(notes.id, noteId))));

  return result;
}

export { syncNoteMentions, getNoteMentions };
