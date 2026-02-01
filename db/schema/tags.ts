import { pgTable, text, timestamp, index, unique } from "drizzle-orm/pg-core";
import { user } from "@/auth/schema";

export const tags = pgTable(
  "tags",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").default("#6366f1").notNull(), // Default indigo color
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("tags_userId_idx").on(table.userId),
    unique("tags_userId_name_unique").on(table.userId, table.name),
  ]
);

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
