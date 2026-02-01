import { relations } from "drizzle-orm";

// Export all tables
export * from "./notes";
export * from "./tags";
export * from "./noteTags";
export * from "./people";
export * from "./noteMentions";
export * from "./noteLinks";
export * from "./templates";

// Import tables for defining relations
import { notes } from "./notes";
import { tags } from "./tags";
import { noteTags } from "./noteTags";
import { people } from "./people";
import { noteMentions } from "./noteMentions";
import { noteLinks } from "./noteLinks";
import { templates } from "./templates";
import { user } from "@/auth/schema";

// Define relations
export const notesRelations = relations(notes, ({ one, many }) => ({
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

export const tagsRelations = relations(tags, ({ one, many }) => ({
  user: one(user, {
    fields: [tags.userId],
    references: [user.id],
  }),
  noteTags: many(noteTags),
}));

export const noteTagsRelations = relations(noteTags, ({ one }) => ({
  note: one(notes, {
    fields: [noteTags.noteId],
    references: [notes.id],
  }),
  tag: one(tags, {
    fields: [noteTags.tagId],
    references: [tags.id],
  }),
}));

export const peopleRelations = relations(people, ({ one, many }) => ({
  user: one(user, {
    fields: [people.userId],
    references: [user.id],
  }),
  noteMentions: many(noteMentions),
}));

export const noteMentionsRelations = relations(noteMentions, ({ one }) => ({
  note: one(notes, {
    fields: [noteMentions.noteId],
    references: [notes.id],
  }),
  person: one(people, {
    fields: [noteMentions.personId],
    references: [people.id],
  }),
}));

export const noteLinksRelations = relations(noteLinks, ({ one }) => ({
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

export const templatesRelations = relations(templates, ({ one, many }) => ({
  user: one(user, {
    fields: [templates.userId],
    references: [user.id],
  }),
  notes: many(notes),
}));

// Extend user relations with new tables
export const userNotesRelations = relations(user, ({ many }) => ({
  notes: many(notes),
  tags: many(tags),
  people: many(people),
  templates: many(templates),
}));
