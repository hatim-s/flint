import { pgTable, text, timestamp, real, pgEnum, index, unique } from "drizzle-orm/pg-core";
import { notes } from "./notes";

// Enum for link types
export const linkTypeEnum = pgEnum("link_type", ["reference", "ai_suggested", "manual"]);

export const noteLinks = pgTable(
  "note_links",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    sourceNoteId: text("source_note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    targetNoteId: text("target_note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    linkType: linkTypeEnum("link_type").default("reference").notNull(),
    strength: real("strength").default(1.0).notNull(), // AI-computed similarity score
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("note_links_sourceNoteId_idx").on(table.sourceNoteId),
    index("note_links_targetNoteId_idx").on(table.targetNoteId),
    unique("note_links_source_target_unique").on(table.sourceNoteId, table.targetNoteId),
  ]
);

export type NoteLink = typeof noteLinks.$inferSelect;
export type NewNoteLink = typeof noteLinks.$inferInsert;
