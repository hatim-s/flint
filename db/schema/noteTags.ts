import { index, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { notes } from "./notes";
import { tags } from "./tags";

const noteTags = pgTable(
  "note_tags",
  {
    noteId: text("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.noteId, table.tagId] }),
    index("note_tags_noteId_idx").on(table.noteId),
    index("note_tags_tagId_idx").on(table.tagId),
  ],
);

type NoteTag = typeof noteTags.$inferSelect;
type NewNoteTag = typeof noteTags.$inferInsert;

export { noteTags };
export type { NoteTag, NewNoteTag };
