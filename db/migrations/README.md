# Database Migrations

This directory contains SQL migration files for database schema changes that cannot be handled by Drizzle ORM alone.

## Applying Migrations

### Using Neon Console (Recommended)

1. Log in to your [Neon Console](https://console.neon.tech/)
2. Navigate to your project's SQL Editor
3. Copy and paste the contents of the migration file
4. Execute the SQL

### Using psql

If you have direct database access:

```bash
psql $DATABASE_URL -f db/migrations/<migration-file>.sql
```

## Migration Files

### `rls-policies.sql`
**Status:** ✅ Applied (as of F1-005)

Implements Row Level Security (RLS) policies to ensure users can only access their own data.

**Apply with:**
```bash
psql $DATABASE_URL -f db/migrations/rls-policies.sql
```

### `fulltext-search-index.sql`
**Status:** ⏳ Pending (F1-006)

Creates GIN index for full-text search on notes and a helper function for efficient searching.

**Features:**
- GIN index on `to_tsvector('english', content_plain || title)`
- Additional index on `updated_at` for recency sorting
- `search_notes()` PostgreSQL function for consistent search queries

**Apply with:**
```bash
psql $DATABASE_URL -f db/migrations/fulltext-search-index.sql
```

**Or via Neon Console:**
Copy the contents of `fulltext-search-index.sql` and run in the SQL Editor.

## Verification

After applying a migration, verify it was successful:

```sql
-- Check if the GIN index exists
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'notes' 
AND indexname = 'notes_fts_idx';

-- Check if the search function exists
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'search_notes';
```

## Troubleshooting

### Index already exists
If you see an error like "relation 'notes_fts_idx' already exists", the migration has already been applied. You can safely ignore this error due to the `IF NOT EXISTS` clauses.

### Function already exists
The migration uses `CREATE OR REPLACE FUNCTION`, so re-running it will update the function definition rather than fail.
