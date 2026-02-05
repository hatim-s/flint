/**
 * Full-Text Search Utilities
 * 
 * Provides keyword-based search functionality for notes using PostgreSQL's
 * full-text search capabilities with GIN indexes for optimal performance.
 */

import { db } from "@/db";
import { notes, type Note } from "@/db/schema/notes";
import { sql } from "drizzle-orm";
import { rlsExecutor } from "./rls";

/**
 * Search result with ranking score
 */
export interface SearchResult extends Note {
  rank: number;
}

/**
 * Search options for filtering and pagination
 */
export interface SearchOptions {
  /** User ID to search within (required for RLS) */
  userId: string;
  /** Search query string */
  query: string;
  /** Maximum number of results to return (default: 20) */
  limit?: number;
  /** Number of results to skip for pagination (default: 0) */
  offset?: number;
  /** Filter by note type */
  noteType?: "note" | "journal";
  /** Filter by minimum mood score */
  minMoodScore?: number;
  /** Filter by maximum mood score */
  maxMoodScore?: number;
}

/**
 * Sanitizes search query for PostgreSQL full-text search.
 * Removes special characters that could cause errors.
 * 
 * @param query - Raw user input
 * @returns Sanitized query string safe for plainto_tsquery
 */
export function sanitizeSearchQuery(query: string): string {
  // Remove leading/trailing whitespace
  let sanitized = query.trim();
  
  // If empty after trimming, return empty string
  if (!sanitized) return "";
  
  // plainto_tsquery handles most special characters, but we remove some problematic ones
  sanitized = sanitized.replace(/[<>{}[\]\\]/g, " ");
  
  // Collapse multiple spaces into one
  sanitized = sanitized.replace(/\s+/g, " ");
  
  return sanitized;
}

/**
 * Performs keyword-based full-text search on notes using PostgreSQL's
 * tsvector and tsquery for efficient searching.
 * 
 * Uses the GIN index created by the fulltext-search-index.sql migration
 * for optimal performance.
 * 
 * @param options - Search parameters and filters
 * @returns Array of search results with ranking scores
 * 
 * @example
 * ```ts
 * const results = await searchNotes({
 *   userId: session.user.id,
 *   query: "productivity anxiety",
 *   limit: 10,
 *   noteType: "journal"
 * });
 * ```
 */
export async function searchNotes(
  options: SearchOptions
): Promise<SearchResult[]> {
  const {
    userId,
    query,
    limit = 20,
    offset = 0,
    noteType,
    minMoodScore,
    maxMoodScore,
  } = options;

  // Sanitize the search query
  const sanitizedQuery = sanitizeSearchQuery(query);
  
  // If query is empty after sanitization, return empty results
  if (!sanitizedQuery) {
    return [];
  }

  const rls = rlsExecutor(userId);

  // Build the WHERE clause conditions
  const conditions: unknown[] = [
    rls.where(notes),
    sql`to_tsvector('english', COALESCE(${notes.contentPlain}, '') || ' ' || COALESCE(${notes.title}, '')) @@ plainto_tsquery('english', ${sanitizedQuery})`,
  ];

  // Add optional filters
  if (noteType) {
    conditions.push(sql`${notes.noteType} = ${noteType}`);
  }
  
  if (minMoodScore !== undefined) {
    conditions.push(sql`${notes.moodScore} >= ${minMoodScore}`);
  }
  
  if (maxMoodScore !== undefined) {
    conditions.push(sql`${notes.moodScore} <= ${maxMoodScore}`);
  }

  // Combine all conditions with AND
  const whereClause = conditions.length > 1 
    ? sql`${conditions.reduce((acc, condition) => sql`${acc} AND ${condition}`)}`
    : conditions[0];

  // Execute the search query with ranking
  const results = await db.execute(sql`
    SELECT 
      ${notes.id},
      ${notes.userId},
      ${notes.title},
      ${notes.content},
      ${notes.contentPlain},
      ${notes.noteType}::TEXT as note_type,
      ${notes.sourceUrl},
      ${notes.moodScore},
      ${notes.qualityScore},
      ${notes.templateId},
      ${notes.createdAt},
      ${notes.updatedAt},
      ${notes.metadata},
      ts_rank(
        to_tsvector('english', COALESCE(${notes.contentPlain}, '') || ' ' || COALESCE(${notes.title}, '')),
        plainto_tsquery('english', ${sanitizedQuery})
      ) as rank
    FROM ${notes}
    WHERE ${whereClause}
    ORDER BY rank DESC, ${notes.updatedAt} DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  return results.rows as unknown as SearchResult[];
}

/**
 * Counts the total number of search results without pagination.
 * Useful for implementing pagination UI.
 * 
 * @param options - Search parameters (excluding limit and offset)
 * @returns Total count of matching notes
 */
export async function countSearchResults(
  options: Omit<SearchOptions, "limit" | "offset">
): Promise<number> {
  const { userId, query, noteType, minMoodScore, maxMoodScore } = options;

  // Sanitize the search query
  const sanitizedQuery = sanitizeSearchQuery(query);
  
  // If query is empty, return 0
  if (!sanitizedQuery) {
    return 0;
  }

  const rls = rlsExecutor(userId);

  // Build WHERE clause (same as searchNotes)
  const conditions: unknown[] = [
    rls.where(notes),
    sql`to_tsvector('english', COALESCE(${notes.contentPlain}, '') || ' ' || COALESCE(${notes.title}, '')) @@ plainto_tsquery('english', ${sanitizedQuery})`,
  ];

  if (noteType) {
    conditions.push(sql`${notes.noteType} = ${noteType}`);
  }
  
  if (minMoodScore !== undefined) {
    conditions.push(sql`${notes.moodScore} >= ${minMoodScore}`);
  }
  
  if (maxMoodScore !== undefined) {
    conditions.push(sql`${notes.moodScore} <= ${maxMoodScore}`);
  }

  const whereClause = conditions.length > 1 
    ? sql`${conditions.reduce((acc, condition) => sql`${acc} AND ${condition}`)}`
    : conditions[0];

  // Execute count query
  const result = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM ${notes}
    WHERE ${whereClause}
  `);

  return Number(result.rows[0]?.count ?? 0);
}
