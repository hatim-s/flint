# Upstash Vector Setup Guide

## Prerequisites

1. **Create an Upstash Vector index**:
   - Go to: https://console.upstash.io
   - Navigate to Vector → Create Index
   - Configure:
     - Index Name: `flint-notes` (or your preferred name)
     - Dimensions: `512` (for voyage-3-lite model)
     - Metric: `Cosine`
     - Enable Indexing
   - Copy the REST URL and token to `.env.local`

2. **Environment Variables**:
   ```bash
   UPSTASH_VECTOR_REST_URL="https://your-index-name-vector.upstash.io"
   UPSTASH_VECTOR_REST_TOKEN="your-rest-token"
   ```

3. **Vector Index Configuration**:
   - Dimensions: 512 (matches voyage-3-lite output)
   - Metric: Cosine similarity (standard for text embeddings)
   - Indexing: Enabled (for faster queries)

## Usage Examples

### Index a Note
```typescript
import { indexNote, getEmbedding } from '@/lib/vector';
import { getEmbedding } from '@/lib/embeddings';

const embedding = await getEmbedding(note.content);
await indexNote(note.id, embedding, {
  userId: user.id,
  noteId: note.id,
  title: note.title,
  noteType: note.noteType,
  tags: note.tags,
  createdAt: note.createdAt,
  updatedAt: note.updatedAt,
});
```

### Semantic Search
```typescript
import { semanticSearch, getEmbedding } from '@/lib/vector';
import { getEmbedding } from '@/lib/embeddings';

const queryEmbedding = await getEmbedding(searchQuery);
const results = await semanticSearch(queryEmbedding, user.id, {
  topK: 10,
  filterNoteType: 'note',
  filterTags: ['productivity', 'work'],
});

// results: [{ id, score, metadata }, ...]
```

### Find Related Notes
```typescript
import { findRelatedNotes } from '@/lib/vector';

const relatedNotes = await findRelatedNotes(noteId, user.id, {
  topK: 5,
});

// relatedNotes: [{ id, score, metadata }, ...]
```

### Delete Vector
```typescript
import { deleteNoteVector } from '@/lib/vector';

await deleteNoteVector(noteId);
```

## API Functions

### `indexNote(noteId, embedding, metadata)`
Upsert a single note embedding to the vector store.

### `indexNotes(items)`
Upsert multiple note embeddings in batch (up to 128 items).

### `semanticSearch(queryEmbedding, userId, options)`
Perform semantic search with optional filters:
- `topK`: Number of results (default: 10)
- `includeMetadata`: Include metadata in results (default: true)
- `filterNoteType`: Filter by "note" or "journal"
- `filterTags`: Filter by array of tag names

### `findRelatedNotes(noteId, userId, topK)`
Find similar notes for a given note (excludes the note itself).

### `deleteNoteVector(noteId)`
Delete a single note embedding.

### `deleteNoteVectors(noteIds)`
Delete multiple note embeddings in batch.

## Troubleshooting

### "Index not found" error
- Verify the index exists in Upstash console
- Check that dimensions match (512 for voyage-3-lite)
- Ensure REST URL and token are correct

### "Invalid dimension" error
- Verify embedding dimensions match index dimensions
- voyage-3-lite produces 512-dimensional vectors
- voyage-3 produces 1024-dimensional vectors

### Empty search results
- Check that userId filter matches (case-sensitive)
- Verify note was indexed after creation/update
- Use `includeMetadata: true` to see results

### Performance issues
- Batch indexing is faster for multiple notes
- Use appropriate `topK` value (10-20 is typical)
- Consider caching query embeddings for repeated searches
