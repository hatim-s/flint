import { relations } from "drizzle-orm";

export * from "./noteLinks";
export * from "./noteMentions";
// Export all tables
export * from "./notes";
export * from "./noteTags";
export * from "./people";
export * from "./tags";
export * from "./templates";

import { user } from "@/auth/schema";
import { noteLinks } from "./noteLinks";
import { noteMentions } from "./noteMentions";
// Import tables for defining relations
import { notes } from "./notes";
import { noteTags } from "./noteTags";
import { people } from "./people";
import { tags } from "./tags";
import { templates } from "./templates";

// Define relations
const notesRelations = relations(notes, ({ one, many }) => ({
  user: one(user, {
    fields: [notes.userId],
    references: [user.id],
  }),
  template: one(templates, {
    fields: [notes.templateId],
    references: [templates.id],
  }),
  noteTags: many(noteTags),
  noteMentions: many(noteMentions),
  sourceLinks: many(noteLinks, { relationName: "sourceLinks" }),
  targetLinks: many(noteLinks, { relationName: "targetLinks" }),
}));

const tagsRelations = relations(tags, ({ one, many }) => ({
  user: one(user, {
    fields: [tags.userId],
    references: [user.id],
  }),
  noteTags: many(noteTags),
}));

const noteTagsRelations = relations(noteTags, ({ one }) => ({
  note: one(notes, {
    fields: [noteTags.noteId],
    references: [notes.id],
  }),
  tag: one(tags, {
    fields: [noteTags.tagId],
    references: [tags.id],
  }),
}));

const peopleRelations = relations(people, ({ one, many }) => ({
  user: one(user, {
    fields: [people.userId],
    references: [user.id],
  }),
  noteMentions: many(noteMentions),
}));

const noteMentionsRelations = relations(noteMentions, ({ one }) => ({
  note: one(notes, {
    fields: [noteMentions.noteId],
    references: [notes.id],
  }),
  person: one(people, {
    fields: [noteMentions.personId],
    references: [people.id],
  }),
}));

const noteLinksRelations = relations(noteLinks, ({ one }) => ({
  sourceNote: one(notes, {
    fields: [noteLinks.sourceNoteId],
    references: [notes.id],
    relationName: "sourceLinks",
  }),
  targetNote: one(notes, {
    fields: [noteLinks.targetNoteId],
    references: [notes.id],
    relationName: "targetLinks",
  }),
}));

const templatesRelations = relations(templates, ({ one, many }) => ({
  user: one(user, {
    fields: [templates.userId],
    references: [user.id],
  }),
  notes: many(notes),
}));

// Extend user relations with new tables
const userNotesRelations = relations(user, ({ many }) => ({
  notes: many(notes),
  tags: many(tags),
  people: many(people),
  templates: many(templates),
}));

export {
  notesRelations,
  tagsRelations,
  noteTagsRelations,
  peopleRelations,
  noteMentionsRelations,
  noteLinksRelations,
  templatesRelations,
  userNotesRelations,
};
