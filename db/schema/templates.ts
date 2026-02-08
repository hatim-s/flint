import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "@/auth/schema";
import { noteTypeEnum } from "./notes";

const templates = pgTable(
  "templates",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    noteType: noteTypeEnum("note_type").notNull(),
    content: text("content").notNull(), // Template markdown content
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("templates_userId_idx").on(table.userId),
    index("templates_noteType_idx").on(table.noteType),
  ],
);

type Template = typeof templates.$inferSelect;
type NewTemplate = typeof templates.$inferInsert;

export { templates };
export type { Template, NewTemplate };
