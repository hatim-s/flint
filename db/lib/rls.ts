/**
 * Row Level Security (RLS) Helpers
 * 
 * These utilities set the current user ID in the PostgreSQL session,
 * which RLS policies use to filter data access.
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Sets the current user ID in the PostgreSQL session for RLS policies.
 * This must be called before any database operations to ensure RLS works correctly.
 * 
 * @param userId - The current authenticated user's ID
 * @returns Promise that resolves when the user context is set
 * 
 * @example
 * ```ts
 * import { setCurrentUser } from '@/db/lib/rls';
 * import { db } from '@/db';
 * import { notes } from '@/db/schema/notes';
 * 
 * async function getUserNotes(userId: string) {
 *   await setCurrentUser(userId);
 *   return await db.select().from(notes);
 * }
 * ```
 */
export async function setCurrentUser(userId: string): Promise<void> {
  // SET LOCAL is transaction-scoped, so it automatically resets after the transaction
  // For serverless environments, each request typically gets its own connection
  await db.execute(sql`SET LOCAL app.current_user_id = ${userId}`);
}

/**
 * Wraps a database operation with RLS context.
 * Automatically sets the current user before executing the operation.
 * 
 * @param userId - The current authenticated user's ID
 * @param operation - Async function that performs database operations
 * @returns The result of the operation
 * 
 * @example
 * ```ts
 * import { withRLS } from '@/db/lib/rls';
 * import { db } from '@/db';
 * import { notes } from '@/db/schema/notes';
 * 
 * const userNotes = await withRLS(userId, async () => {
 *   return await db.select().from(notes);
 * });
 * ```
 */
export async function withRLS<T>(
  userId: string,
  operation: () => Promise<T>
): Promise<T> {
  await setCurrentUser(userId);
  return await operation();
}

/**
 * Creates a database client scoped to a specific user.
 * All queries through this client will automatically respect RLS for the given user.
 * 
 * @param userId - The current authenticated user's ID
 * @returns Object with scoped database operations
 * 
 * @example
 * ```ts
 * import { scopedDb } from '@/db/lib/rls';
 * import { notes } from '@/db/schema/notes';
 * 
 * const userDb = scopedDb(userId);
 * const userNotes = await userDb.query(async () => {
 *   return await db.select().from(notes);
 * });
 * ```
 */
export function scopedDb(userId: string) {
  return {
    query: async <T>(operation: () => Promise<T>): Promise<T> => {
      return withRLS(userId, operation);
    },
  };
}
