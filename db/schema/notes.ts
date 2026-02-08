import { z } from 'zod'
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

export const createNoteSchema = z.object({
  title: z.string().min(1, "Title is required").max(500, "Title must be 500 characters or less"),
  content: z.string(),
  noteType: z.enum(["note", "journal"]),
  sourceUrl: z.union([z.string().url(), z.literal("")]).optional(),
  moodScore: z.number().int().min(1).max(10).optional(),
  qualityScore: z.number().min(0).max(1).optional(),
  templateId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateNoteSchema = z.object({
  title: z.string().min(1, "Title is required").max(500, "Title must be 500 characters or less").optional(),
  content: z.string().optional(),
  noteType: z.enum(["note", "journal"]).optional(),
  sourceUrl: z.union([z.string().url(), z.literal("")]).optional(),
  moodScore: z.number().int().min(1).max(10).optional().nullable(),
  qualityScore: z.number().min(0).max(1).optional().nullable(),
  templateId: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  updatedAt: z.string().datetime().optional(),
});

export const listNotesSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  noteType: z.enum(["note", "journal"]).optional(),
  tags: z.array(z.string()).optional(),
  minMood: z.number().int().min(1).max(10).optional(),
  maxMood: z.number().int().min(1).max(10).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "title"]).default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type ListNotesInput = z.infer<typeof listNotesSchema>;
