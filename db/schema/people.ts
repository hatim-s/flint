import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { user } from "@/auth/schema";

export const people = pgTable(
  "people",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    metadata: jsonb("metadata").$type<{
      avatar?: string;
      bio?: string;
      [key: string]: unknown;
    }>().default({}).notNull(),
  },
  (table) => [
    index("people_userId_idx").on(table.userId),
  ]
);

export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;
