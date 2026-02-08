import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "@/auth/schema";

const people = pgTable(
  "people",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    metadata: jsonb("metadata")
      .$type<{
        avatar?: string;
        bio?: string;
        [key: string]: unknown;
      }>()
      .default({})
      .notNull(),
  },
  (table) => [index("people_userId_idx").on(table.userId)],
);

type Person = typeof people.$inferSelect;
type NewPerson = typeof people.$inferInsert;

export { people };
export type { Person, NewPerson };
