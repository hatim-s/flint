-- Row Level Security Policies for Flint
-- This file sets up RLS to ensure users can only access their own data

-- Enable RLS on all user-scoped tables
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_links ENABLE ROW LEVEL SECURITY;

-- Policy for notes table
-- Users can only access notes where user_id matches the current user
CREATE POLICY notes_user_policy ON notes
  USING (user_id = current_setting('app.current_user_id', true)::text);

-- Policy for tags table
-- Users can only access tags they created
CREATE POLICY tags_user_policy ON tags
  USING (user_id = current_setting('app.current_user_id', true)::text);

-- Policy for people table
-- Users can only access people they added
CREATE POLICY people_user_policy ON people
  USING (user_id = current_setting('app.current_user_id', true)::text);

-- Policy for templates table
-- Users can only access templates they created
CREATE POLICY templates_user_policy ON templates
  USING (user_id = current_setting('app.current_user_id', true)::text);

-- Policy for note_tags junction table
-- Users can access note_tags if they own either the note or the tag
CREATE POLICY note_tags_user_policy ON note_tags
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_tags.note_id
      AND notes.user_id = current_setting('app.current_user_id', true)::text
    )
  );

-- Policy for note_mentions junction table
-- Users can access note_mentions if they own the note
CREATE POLICY note_mentions_user_policy ON note_mentions
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_mentions.note_id
      AND notes.user_id = current_setting('app.current_user_id', true)::text
    )
  );

-- Policy for note_links table
-- Users can access note_links if they own the source note
-- (We check source note ownership, not target, to prevent cross-user link discovery)
CREATE POLICY note_links_user_policy ON note_links
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_links.source_note_id
      AND notes.user_id = current_setting('app.current_user_id', true)::text
    )
  );
