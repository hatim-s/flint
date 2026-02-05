/**
 * Background Job: Generate and Store Note Embeddings
 * 
 * This job is triggered after note creation/update to:
 * 1. Generate embeddings using Voyage AI
 * 2. Store embeddings in Upstash Vector
 * 3. Update note metadata with embedding status
 * 
 * For MVP, this runs synchronously. In production, use a queue like Inngest.
 */

import { getEmbedding } from "@/lib/embeddings";
import { indexNote } from "@/lib/vector";
import { db } from "@/db";
import { notes, type Note } from "@/db/schema/notes";
import { noteTags } from "@/db/schema/noteTags";
import { tags } from "@/db/schema/tags";
import { eq } from "drizzle-orm";
import { setCurrentUser } from "@/db/lib/rls";

interface EmbedNoteResult {
  success: boolean;
  error?: string;
  noteId: string;
}

/**
 * Generate and store embedding for a note
 * @param noteId - The note ID to embed
 * @param userId - The user ID (for RLS)
 * @param retryCount - Current retry attempt (default: 0)
 * @param maxRetries - Maximum number of retries (default: 3)
 */
export async function embedNote(
  noteId: string,
  userId: string,
  retryCount: number = 0,
  maxRetries: number = 3
): Promise<EmbedNoteResult> {
  try {
    // Set RLS context
    await setCurrentUser(userId);

    // Fetch the note
    const [note] = await db
      .select()
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    if (!note) {
      return {
        success: false,
        error: "Note not found",
        noteId,
      };
    }

    // Don't re-embed if already complete (unless explicitly requested)
    if (note.metadata?.embeddingStatus === "complete" && retryCount === 0) {
      return {
        success: true,
        noteId,
      };
    }

    // Prepare text for embedding (title + content plain)
    const textToEmbed = `${note.title}\n\n${note.contentPlain || note.content}`;

    // Generate embedding using Voyage AI
    const embedding = await getEmbedding(textToEmbed);

    // Fetch note tags for metadata
    const noteTags_ = await db
      .select({
        tagName: tags.name,
      })
      .from(noteTags)
      .innerJoin(tags, eq(noteTags.tagId, tags.id))
      .where(eq(noteTags.noteId, noteId));

    const tagNames = noteTags_.map(nt => nt.tagName);

    // Store embedding in Upstash Vector
    await indexNote(noteId, embedding, {
      userId: note.userId,
      noteId: note.id,
      title: note.title,
      noteType: note.noteType,
      tags: tagNames,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    });

    // Update note metadata with success status
    await db
      .update(notes)
      .set({
        metadata: {
          ...note.metadata,
          embeddingStatus: "complete" as const,
          embeddedAt: new Date().toISOString(),
        },
      })
      .where(eq(notes.id, noteId));

    console.log(`✅ Successfully embedded note ${noteId}`);

    return {
      success: true,
      noteId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ Error embedding note ${noteId} (attempt ${retryCount + 1}/${maxRetries + 1}):`, errorMessage);

    // Retry logic with exponential backoff
    if (retryCount < maxRetries) {
      const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
      console.log(`⏳ Retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return embedNote(noteId, userId, retryCount + 1, maxRetries);
    }

    // All retries exhausted, mark as failed
    try {
      await setCurrentUser(userId);
      const [note] = await db
        .select()
        .from(notes)
        .where(eq(notes.id, noteId))
        .limit(1);

      if (note) {
        await db
          .update(notes)
          .set({
            metadata: {
              ...note.metadata,
              embeddingStatus: "failed" as const,
              embeddingError: errorMessage,
              lastEmbedAttempt: new Date().toISOString(),
            },
          })
          .where(eq(notes.id, noteId));
      }
    } catch (updateError) {
      console.error(`Failed to update note status after failed embedding:`, updateError);
    }

    return {
      success: false,
      error: errorMessage,
      noteId,
    };
  }
}

/**
 * Batch embed multiple notes (useful for migrations or bulk operations)
 * @param noteIds - Array of note IDs to embed
 * @param userId - The user ID (for RLS)
 */
export async function embedNotes(
  noteIds: string[],
  userId: string
): Promise<EmbedNoteResult[]> {
  const results: EmbedNoteResult[] = [];

  for (const noteId of noteIds) {
    const result = await embedNote(noteId, userId);
    results.push(result);
    
    // Small delay between notes to avoid rate limiting
    if (noteIds.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  console.log(`📊 Batch embedding complete: ${successCount} succeeded, ${failureCount} failed`);

  return results;
}

/**
 * Re-embed a note (useful for updating embeddings after content changes)
 * @param noteId - The note ID to re-embed
 * @param userId - The user ID (for RLS)
 */
export async function reembedNote(
  noteId: string,
  userId: string
): Promise<EmbedNoteResult> {
  console.log(`🔄 Re-embedding note ${noteId}`);
  
  // Reset embedding status first
  try {
    await setCurrentUser(userId);
    const [note] = await db
      .select()
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    if (note) {
      await db
        .update(notes)
        .set({
          metadata: {
            ...note.metadata,
            embeddingStatus: "pending" as const,
          },
        })
        .where(eq(notes.id, noteId));
    }
  } catch (error) {
    console.error(`Failed to reset embedding status:`, error);
  }

  // Embed with retry
  return embedNote(noteId, userId);
}
