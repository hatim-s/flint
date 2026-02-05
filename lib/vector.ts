import { Index } from "@upstash/vector";
import { config } from 'dotenv';

config({ path: '.env.local' });

const UPSTASH_VECTOR_URL = process.env.UPSTASH_VECTOR_REST_URL;
const UPSTASH_VECTOR_TOKEN = process.env.UPSTASH_VECTOR_REST_TOKEN;

if (!UPSTASH_VECTOR_URL || !UPSTASH_VECTOR_TOKEN) {
  throw new Error("UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN environment variables must be set");
}

// Create Upstash Vector index instance
// Note: Create an index in Upstash console with 512 dimensions (for voyage-3-lite)
export const vectorIndex = new Index({
  url: UPSTASH_VECTOR_URL,
  token: UPSTASH_VECTOR_TOKEN,
});

// Vector dimension for voyage-3-lite model
export const EMBEDDING_DIMENSIONS = 512;

// Metadata structure for note embeddings
export interface NoteVectorMetadata {
  userId: string;
  noteId: string;
  title: string;
  noteType: "note" | "journal";
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Upsert a note embedding to Upstash Vector
 * 
 * @param noteId - The ID of the note
 * @param embedding - The embedding vector (512 dimensions for voyage-3-lite)
 * @param metadata - Additional metadata for filtering and retrieval
 * @returns Promise<void>
 */
export async function indexNote(
  noteId: string,
  embedding: number[],
  metadata: NoteVectorMetadata
): Promise<void> {
  try {
    await vectorIndex.upsert({
      id: noteId,
      vector: embedding,
      metadata: metadata as unknown as Record<string, unknown>,
    });
  } catch (error) {
    console.error("Error indexing note:", noteId, error);
    throw new Error(`Failed to index note: ${noteId}`);
  }
}

/**
 * Upsert multiple notes in batch
 * 
 * @param items - Array of { noteId, embedding, metadata } objects
 * @returns Promise<void>
 */
export async function indexNotes(
  items: Array<{
    noteId: string;
    embedding: number[];
    metadata: NoteVectorMetadata;
  }>
): Promise<void> {
  try {
    const vectors = items.map((item) => ({
      id: item.noteId,
      vector: item.embedding,
      metadata: item.metadata as unknown as Record<string, unknown>,
    }));

    await vectorIndex.upsert(vectors);
  } catch (error) {
    console.error("Error batch indexing notes:", error);
    throw new Error("Failed to batch index notes");
  }
}

/**
 * Perform semantic search for similar notes
 * 
 * @param queryEmbedding - The embedding vector of the search query
 * @param userId - The user ID to filter results
 * @param options - Search options
 * @returns Promise<Array<{ id, score, metadata }>>
 */
export interface SemanticSearchOptions {
  topK?: number;
  includeMetadata?: boolean;
  filterNoteType?: "note" | "journal";
  filterTags?: string[];
}

export interface SemanticSearchResult {
  id: string;
  score: number;
  metadata?: NoteVectorMetadata;
}

export async function semanticSearch(
  queryEmbedding: number[],
  userId: string,
  options: SemanticSearchOptions = {}
): Promise<SemanticSearchResult[]> {
  const {
    topK = 10,
    includeMetadata = true,
    filterNoteType,
    filterTags,
  } = options;

  try {
    // Build filter expression for Upstash
    const filters: string[] = [`userId = '${userId}'`];

    if (filterNoteType) {
      filters.push(`noteType = '${filterNoteType}'`);
    }

    if (filterTags && filterTags.length > 0) {
      const tagFilters = filterTags.map((tag) => `'${tag}'`);
      filters.push(`tags IN [${tagFilters.join(", ")}]`);
    }

    const filterString = filters.length > 0 ? filters.join(" AND ") : undefined;

    const results = await vectorIndex.query({
      vector: queryEmbedding,
      topK,
      includeMetadata,
      filter: filterString,
    });

    return results.map((result) => ({
      id: typeof result.id === "string" ? result.id : String(result.id),
      score: result.score,
      metadata: result.metadata as NoteVectorMetadata | undefined,
    }));
  } catch (error) {
    console.error("Error performing semantic search:", error);
    throw new Error("Failed to perform semantic search");
  }
}

/**
 * Find related notes for a given note
 * 
 * @param noteId - The ID of the note to find related notes for
 * @param userId - The user ID to ensure data isolation
 * @param topK - Number of related notes to return (default: 5)
 * @returns Promise<SemanticSearchResult[]>
 */
export async function findRelatedNotes(
  noteId: string,
  userId: string,
  topK: number = 5
): Promise<SemanticSearchResult[]> {
  try {
    // Fetch the note's embedding
    const noteResults = await vectorIndex.fetch([noteId]);
    const note = noteResults[0];

    if (!note?.vector) {
      return [];
    }

    // Query for similar notes (excluding the original note)
    const similarNotes = await semanticSearch(note.vector, userId, {
      topK: topK + 1, // Fetch one extra to exclude the original
      includeMetadata: true,
    });

    // Filter out the original note
    return similarNotes.filter((result) => result.id !== noteId).slice(0, topK);
  } catch (error) {
    console.error("Error finding related notes:", noteId, error);
    return [];
  }
}

/**
 * Delete a note embedding from the vector store
 * 
 * @param noteId - The ID of the note to delete
 * @returns Promise<void>
 */
export async function deleteNoteVector(noteId: string): Promise<void> {
  try {
    await vectorIndex.delete([noteId]);
  } catch (error) {
    console.error("Error deleting note vector:", noteId, error);
    throw new Error(`Failed to delete note vector: ${noteId}`);
  }
}

/**
 * Delete multiple note embeddings in batch
 * 
 * @param noteIds - Array of note IDs to delete
 * @returns Promise<void>
 */
export async function deleteNoteVectors(noteIds: string[]): Promise<void> {
  try {
    await vectorIndex.delete(noteIds);
  } catch (error) {
    console.error("Error deleting note vectors:", error);
    throw new Error("Failed to delete note vectors");
  }
}

/**
 * Get statistics about the vector store
 * 
 * @returns Promise<{ count: number }>
 */
export async function getVectorStats(): Promise<{ count: number }> {
  try {
    // Upstash Vector doesn't have a direct count API
    // This is a placeholder - implement based on your needs
    return { count: 0 };
  } catch (error) {
    console.error("Error getting vector stats:", error);
    throw new Error("Failed to get vector stats");
  }
}
