import { pgTable, text, primaryKey, index } from "drizzle-orm/pg-core";
import { notes } from "./notes";
import { people } from "./people";

const noteMentions = pgTable(
  "note_mentions",
  {
    noteId: text("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.noteId, table.personId] }),
    index("note_mentions_noteId_idx").on(table.noteId),
    index("note_mentions_personId_idx").on(table.personId),
  ]
);

type NoteMention = typeof noteMentions.$inferSelect;
type NewNoteMention = typeof noteMentions.$inferInsert;

export { noteMentions };
export type { NoteMention, NewNoteMention };
