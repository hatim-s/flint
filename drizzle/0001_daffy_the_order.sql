CREATE TYPE "public"."note_type" AS ENUM('note', 'journal');--> statement-breakpoint
CREATE TYPE "public"."link_type" AS ENUM('reference', 'ai_suggested', 'manual');--> statement-breakpoint
CREATE TABLE "notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"content_plain" text,
	"note_type" "note_type" NOT NULL,
	"source_url" text,
	"mood_score" integer,
	"quality_score" real,
	"template_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tags_userId_name_unique" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "note_tags" (
	"note_id" text NOT NULL,
	"tag_id" text NOT NULL,
	CONSTRAINT "note_tags_note_id_tag_id_pk" PRIMARY KEY("note_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note_mentions" (
	"note_id" text NOT NULL,
	"person_id" text NOT NULL,
	CONSTRAINT "note_mentions_note_id_person_id_pk" PRIMARY KEY("note_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "note_links" (
	"id" text PRIMARY KEY NOT NULL,
	"source_note_id" text NOT NULL,
	"target_note_id" text NOT NULL,
	"link_type" "link_type" DEFAULT 'reference' NOT NULL,
	"strength" real DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "note_links_source_target_unique" UNIQUE("source_note_id","target_note_id")
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"note_type" "note_type" NOT NULL,
	"content" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_tags" ADD CONSTRAINT "note_tags_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_tags" ADD CONSTRAINT "note_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_mentions" ADD CONSTRAINT "note_mentions_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_mentions" ADD CONSTRAINT "note_mentions_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_links" ADD CONSTRAINT "note_links_source_note_id_notes_id_fk" FOREIGN KEY ("source_note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_links" ADD CONSTRAINT "note_links_target_note_id_notes_id_fk" FOREIGN KEY ("target_note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notes_userId_idx" ON "notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notes_noteType_idx" ON "notes" USING btree ("note_type");--> statement-breakpoint
CREATE INDEX "notes_createdAt_idx" ON "notes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tags_userId_idx" ON "tags" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "note_tags_noteId_idx" ON "note_tags" USING btree ("note_id");--> statement-breakpoint
CREATE INDEX "note_tags_tagId_idx" ON "note_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "people_userId_idx" ON "people" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "note_mentions_noteId_idx" ON "note_mentions" USING btree ("note_id");--> statement-breakpoint
CREATE INDEX "note_mentions_personId_idx" ON "note_mentions" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "note_links_sourceNoteId_idx" ON "note_links" USING btree ("source_note_id");--> statement-breakpoint
CREATE INDEX "note_links_targetNoteId_idx" ON "note_links" USING btree ("target_note_id");--> statement-breakpoint
CREATE INDEX "templates_userId_idx" ON "templates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "templates_noteType_idx" ON "templates" USING btree ("note_type");