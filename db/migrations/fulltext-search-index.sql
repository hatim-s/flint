-- Full-Text Search Index for Notes
-- This migration creates a GIN index for efficient full-text search on notes

-- Create a GIN index for full-text search on notes table
-- The index combines both the title and content_plain fields
-- Using English text search configuration for better stemming and stop words
CREATE INDEX IF NOT EXISTS notes_fts_idx 
  ON notes 
  USING GIN (to_tsvector('english', COALESCE(content_plain, '') || ' ' || COALESCE(title, '')));

-- Create an index on updated_at for efficient sorting by recency
CREATE INDEX IF NOT EXISTS notes_updated_at_idx 
  ON notes (updated_at DESC);

-- Optional: Create a function for easier search queries
-- This function can be called from the application for consistent search behavior
CREATE OR REPLACE FUNCTION search_notes(
  search_query TEXT,
  p_user_id TEXT,
  result_limit INTEGER DEFAULT 20,
  result_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id TEXT,
  user_id TEXT,
  title TEXT,
  content TEXT,
  content_plain TEXT,
  note_type TEXT,
  source_url TEXT,
  mood_score INTEGER,
  quality_score REAL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.id,
    n.user_id,
    n.title,
    n.content,
    n.content_plain,
    n.note_type::TEXT,
    n.source_url,
    n.mood_score,
    n.quality_score,
    n.created_at,
    n.updated_at,
    ts_rank(
      to_tsvector('english', COALESCE(n.content_plain, '') || ' ' || COALESCE(n.title, '')),
      plainto_tsquery('english', search_query)
    ) as rank
  FROM notes n
  WHERE n.user_id = p_user_id
    AND to_tsvector('english', COALESCE(n.content_plain, '') || ' ' || COALESCE(n.title, '')) 
        @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC, n.updated_at DESC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission on the search function
GRANT EXECUTE ON FUNCTION search_notes TO PUBLIC;
