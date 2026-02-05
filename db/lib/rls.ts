/**
 * Row Level Security (RLS) Helpers
 *
 * Serverless environments (like Neon) do not reliably persist session variables,
 * so we enforce ownership at the application layer by appending userId filters
 * and ensuring insert values include the current user.
 */

import { and, eq, type SQL } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm/column";

type OwnedTable = { userId: AnyColumn };

/**
 * Creates a lightweight RLS executor that appends the owner check to queries.
 *
 * @param userId - The current authenticated user's ID
 * @returns Helper functions for adding owner filters and values
 *
 * @example
 * ```ts
 * import { rlsExecutor } from "@/db/lib/rls";
 * import { notes } from "@/db/schema/notes";
 *
 * const rls = rlsExecutor(userId);
 * const note = await db
 *   .select()
 *   .from(notes)
 *   .where(rls.where(notes, eq(notes.id, noteId)));
 * ```
 */
export function rlsExecutor(userId: string) {
  const where = <T extends OwnedTable>(table: T, condition?: SQL) => {
    const ownerCheck = eq(table.userId, userId);
    return condition ? and(ownerCheck, condition) : ownerCheck;
  };

  function values<T extends Record<string, unknown>>(input: T): T & { userId: string };
  function values<T extends Record<string, unknown>>(input: T[]): (T & { userId: string })[];
  function values<T extends Record<string, unknown>>(input: T | T[]) {
    if (Array.isArray(input)) {
      return input.map((value) => ({ ...value, userId }));
    }

    return { ...input, userId };
  }

  return {
    userId,
    where,
    values,
  };
}
