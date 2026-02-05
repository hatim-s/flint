/**
 * Database Seed Script
 * Populates the database with sample data for development and testing
 */

import { db } from "../index";
import { user } from "@/auth/schema";
import { 
  notes, 
  tags, 
  people, 
  templates, 
  noteTags, 
  noteMentions,
  noteLinks 
} from "@/db/schema";
import { defaultTemplates } from "./templates";
import { defaultTags } from "./tags";
import { samplePeople } from "./people";
import { sampleNotes } from "./notes";
import { eq } from "drizzle-orm";

/**
 * Main seed function
 */
export async function seedDatabase() {
  console.log("🌱 Starting database seed...");

  try {
    // Create or get a test user
    const testUser = await getOrCreateTestUser();
    console.log(`✅ User: ${testUser.name}`);

    // Seed templates
    await seedTemplates(testUser.id);
    console.log("✅ Templates seeded");

    // Seed tags
    const seededTags = await seedTags(testUser.id);
    console.log(`✅ Tags seeded: ${seededTags.length}`);

    // Seed people
    const seededPeople = await seedPeople(testUser.id);
    console.log(`✅ People seeded: ${seededPeople.length}`);

    // Seed notes
    const seededNotes = await seedNotes(testUser.id, seededTags, seededPeople);
    console.log(`✅ Notes seeded: ${seededNotes.length}`);

    // Create some note links
    await seedNoteLinks(seededNotes);
    console.log("✅ Note links created");

    console.log("🎉 Database seed completed successfully!");
  } catch (error) {
    console.error("❌ Seed failed:", error);
    throw error;
  }
}

/**
 * Get or create a test user
 */
async function getOrCreateTestUser() {
  // Check if test user exists
  const existingUser = await db
    .select()
    .from(user)
    .where(eq(user.email, "hatimshakir9179@gmail.com"))
    .limit(1);

  if (existingUser.length > 0) {
    return existingUser[0]!;
  }

  // Create new test user
  const newUser = await db
    .insert(user)
    .values({
      id: crypto.randomUUID(),
      name: "Test User",
      email: "test@example.com",
      emailVerified: true,
    })
    .returning();

  return newUser[0]!;
}

/**
 * Seed templates
 */
async function seedTemplates(userId: string) {
  // Clear existing templates for this user
  await db.delete(templates).where(eq(templates.userId, userId));

  // Insert default templates
  const templateData = defaultTemplates.map(template => ({
    ...template,
    userId,
  }));

  await db.insert(templates).values(templateData);
}

/**
 * Seed tags
 */
async function seedTags(userId: string) {
  // Clear existing tags for this user
  await db.delete(tags).where(eq(tags.userId, userId));

  // Insert default tags
  const tagData = defaultTags.map(tag => ({
    ...tag,
    id: crypto.randomUUID(),
    userId,
  }));

  return await db.insert(tags).values(tagData).returning();
}

/**
 * Seed people
 */
async function seedPeople(userId: string) {
  // Clear existing people for this user
  await db.delete(people).where(eq(people.userId, userId));

  // Insert sample people
  const peopleData = samplePeople.map(person => ({
    id: crypto.randomUUID(),
    userId,
    name: person.name,
    email: person.email || undefined,
    metadata: {
      ...person.metadata,
      avatar: person.metadata.avatar || undefined,
    },
  }));

  return await db.insert(people).values(peopleData).returning();
}

/**
 * Seed notes
 */
async function seedNotes(
  userId: string, 
  seededTags: Array<{ id: string; name: string }>, 
  seededPeople: Array<{ id: string; name: string }>
) {
  // Clear existing notes for this user
  await db.delete(notes).where(eq(notes.userId, userId));

  // Create a map for quick lookup
  const tagMap = new Map(seededTags.map(tag => [tag.name, tag.id]));
  const personMap = new Map(seededPeople.map(person => [person.name, person.id]));

  const seededNotes: Array<{ id: string; title: string }> = [];

  for (const note of sampleNotes) {
    // Insert the note
    const insertedNotes = await db.insert(notes).values({
      ...note,
      id: crypto.randomUUID(),
      userId,
      contentPlain: stripMarkdown(note.content),
    }).returning();

    const insertedNote = insertedNotes[0]!;
    seededNotes.push({ id: insertedNote.id, title: insertedNote.title });

    // Handle tags
    if (note.tags && note.tags.length > 0) {
      const noteTagData = note.tags
        .map(tagName => tagMap.get(tagName))
        .filter((tagId): tagId is string => tagId !== undefined)
        .map(tagId => ({
          noteId: insertedNote.id,
          tagId,
        }));

      if (noteTagData.length > 0) {
        await db.insert(noteTags).values(noteTagData);
      }
    }

    // Handle mentions
    if (note.mentions && note.mentions.length > 0) {
      const noteMentionData = note.mentions
        .map(personName => personMap.get(personName))
        .filter((personId): personId is string => personId !== undefined)
        .map(personId => ({
          noteId: insertedNote.id,
          personId,
        }));

      if (noteMentionData.length > 0) {
        await db.insert(noteMentions).values(noteMentionData);
      }
    }
  }

  return seededNotes;
}

/**
 * Create some sample note links
 */
async function seedNoteLinks(seededNotes: Array<{ id: string; title: string }>) {
  // Clear existing note links
  await db.delete(noteLinks);

  // Create some sample links between notes
  const typeScriptNote = seededNotes.find(n => n.title.includes("TypeScript"));
  const systemsNote = seededNotes.find(n => n.title.includes("Thinking in Systems"));
  const q4Note = seededNotes.find(n => n.title.includes("Q4 Planning"));
  const knowledgeNote = seededNotes.find(n => n.title.includes("Personal Knowledge Graph"));
  const morningNote = seededNotes.find(n => n.title.includes("Morning Reflection"));
  const weeklyNote = seededNotes.find(n => n.title.includes("Weekly Review"));

  const links: Array<{
    sourceNoteId: string;
    targetNoteId: string;
    linkType: "reference" | "ai_suggested" | "manual";
    strength: number;
  }> = [];

  // Link TypeScript learning to systems thinking
  if (typeScriptNote && systemsNote) {
    links.push({
      sourceNoteId: typeScriptNote.id,
      targetNoteId: systemsNote.id,
      linkType: "reference",
      strength: 0.8,
    });
  }

  // Link Q4 planning to dashboard idea
  if (q4Note && knowledgeNote) {
    links.push({
      sourceNoteId: q4Note.id,
      targetNoteId: knowledgeNote.id,
      linkType: "ai_suggested",
      strength: 0.6,
    });
  }

  // Link morning reflection to weekly review
  if (morningNote && weeklyNote) {
    links.push({
      sourceNoteId: morningNote.id,
      targetNoteId: weeklyNote.id,
      linkType: "manual",
      strength: 0.9,
    });
  }

  if (links.length > 0) {
    await db.insert(noteLinks).values(links);
  }
}

/**
 * Helper function to strip markdown
 */
function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/#{1,6}\s/g, '') // Headers
    .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
    .replace(/\*(.*?)\*/g, '$1') // Italic
    .replace(/`(.*?)`/g, '$1') // Inline code
    .replace(/```[\s\S]*?```/g, '') // Code blocks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
    .replace(/^\s*[-*+]\s/gm, '') // List items
    .replace(/^\s*\d+\.\s/gm, '') // Numbered lists
    .replace(/^\s*>\s/gm, '') // Blockquotes
    .replace(/\n{3,}/g, '\n\n') // Multiple newlines
    .trim();
}

/**
 * Run seed if this file is executed directly
 */
// Note: In Bun/Node.js, you can run this with: bunx tsx db/seed/index.ts
if (require.main === module) {
  seedDatabase().catch(console.error);
}