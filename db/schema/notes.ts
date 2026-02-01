import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, integer, real, jsonb, pgEnum, index } from "drizzle-orm/pg-core";
import { user } from "@/auth/schema";

// Enum for note types
export const noteTypeEnum = pgEnum("note_type", ["note", "journal"]);

export const notes = pgTable(
  "notes",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(), // Rich markdown content
    contentPlain: text("content_plain"), // Stripped plain text for search
    noteType: noteTypeEnum("note_type").notNull(),
    sourceUrl: text("source_url"), // Optional URL source
    moodScore: integer("mood_score"), // 1-10 scale
    qualityScore: real("quality_score"), // AI-computed quality metric
    templateId: text("template_id"), // Reference to template used
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    metadata: jsonb("metadata").$type<{
      embeddingStatus?: "pending" | "complete" | "failed";
      wordCount?: number;
      lastViewedAt?: string;
      [key: string]: unknown;
    }>().default({}).notNull(),
  },
  (table) => [
    index("notes_userId_idx").on(table.userId),
    index("notes_noteType_idx").on(table.noteType),
    index("notes_createdAt_idx").on(table.createdAt),
  ]
);

// Relations will be defined in index.ts after all tables are created
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
