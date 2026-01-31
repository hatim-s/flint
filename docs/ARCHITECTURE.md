# Flint: Cost-Optimized System Architecture

## Design Principles
- **Zero/minimal cost** at scale (free tiers only where possible)
- **Relationship-aware data** (graph-like connections between notes)
- **Semantic + keyword search** capability
- **Voice-first input** with transcription
- **Rich markdown rendering** with tags, dates, mentions

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Web/PWA)                         │
│                     Next.js on Vercel (Free)                    │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API / SERVERLESS LAYER                      │
│              Vercel Serverless Functions (Free Tier)            │
│                   - Auth endpoints                              │
│                   - CRUD operations                             │
│                   - Search orchestration                        │
└──────┬─────────────────┬────────────────────┬───────────────────┘
       │                 │                    │
       ▼                 ▼                    ▼
┌──────────────┐  ┌─────────────────┐  ┌─────────────────────────┐
│   Supabase   │  │   Upstash       │  │   External Services     │
│   (Free)     │  │   Vector (Free) │  │                         │
│              │  │                 │  │  - Groq (STT - Free)    │
│  - Postgres  │  │  - Embeddings   │  │  - Voyage/OpenAI (Emb)  │
│  - Auth      │  │  - Semantic     │  │  - Vercel Blob (Files)  │
│  - Realtime  │  │    Search       │  │                         │
└──────────────┘  └─────────────────┘  └─────────────────────────┘
```

---

## 2. Data Layer: Supabase PostgreSQL (Free Tier)

### Why Supabase?
- **500MB database** (free tier)
- **Built-in Auth** (saves building auth from scratch)
- **Row Level Security** (user data isolation)
- **Realtime subscriptions** (live updates)
- **50,000 monthly active users** on free tier

### Schema Design (Relationship-Aware)

```sql
-- Core tables
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  preferences JSONB DEFAULT '{}'
);

CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,                    -- Raw markdown
  content_plain TEXT,                       -- Stripped for search
  note_type TEXT CHECK (note_type IN ('journal', 'note')),
  source_url TEXT,
  mood_score INT CHECK (mood_score BETWEEN 1 AND 10),
  quality_score FLOAT,                      -- AI-computed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'               -- Flexible fields
);

-- Full-text search index (free, built into Postgres)
CREATE INDEX notes_fts_idx ON notes 
  USING GIN (to_tsvector('english', content_plain || ' ' || title));

-- Tags (many-to-many)
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  UNIQUE(user_id, name)
);

CREATE TABLE note_tags (
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

-- People mentions (for @mentions)
CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE note_mentions (
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  person_id UUID REFERENCES people(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, person_id)
);

-- ⭐ RELATIONSHIP TABLE (The Graph Layer)
CREATE TABLE note_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  target_note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  link_type TEXT DEFAULT 'reference',       -- 'reference', 'ai_suggested', 'manual'
  strength FLOAT DEFAULT 1.0,               -- AI-computed similarity
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_note_id, target_note_id)
);

-- Index for graph traversal
CREATE INDEX note_links_source_idx ON note_links(source_note_id);
CREATE INDEX note_links_target_idx ON note_links(target_note_id);
```

### Keyword Search (Free, Native Postgres)

```sql
-- Function for full-text search
CREATE OR REPLACE FUNCTION search_notes(
  search_query TEXT,
  p_user_id UUID
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  rank FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.id,
    n.title,
    n.content,
    ts_rank(to_tsvector('english', n.content_plain), plainto_tsquery(search_query)) as rank
  FROM notes n
  WHERE n.user_id = p_user_id
    AND to_tsvector('english', n.content_plain || ' ' || n.title) @@ plainto_tsquery(search_query)
  ORDER BY rank DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;
```

---

## 3. Vector/Semantic Search: Upstash Vector (Free Tier)

### Why Upstash Vector?
- **10,000 vectors free** (enough for ~10k notes)
- **Serverless** (no cold starts, scales to zero)
- **Simple REST API**
- **Metadata filtering** built-in

### Implementation

```typescript
// lib/vector.ts
import { Index } from '@upstash/vector';

const index = new Index({
  url: process.env.UPSTASH_VECTOR_URL!,
  token: process.env.UPSTASH_VECTOR_TOKEN!,
});

// Upsert note embedding
export async function indexNote(noteId: string, embedding: number[], metadata: {
  userId: string;
  title: string;
  noteType: 'journal' | 'note';
  tags: string[];
  createdAt: string;
}) {
  await index.upsert({
    id: noteId,
    vector: embedding,
    metadata,
  });
}

// Semantic search
export async function semanticSearch(
  queryEmbedding: number[],
  userId: string,
  topK = 10
) {
  const results = await index.query({
    vector: queryEmbedding,
    topK,
    filter: `userId = '${userId}'`,
    includeMetadata: true,
  });
  return results;
}

// Find related notes (for Serendipity Engine)
export async function findRelatedNotes(noteId: string, userId: string) {
  // Get the note's vector, then find similar
  const note = await index.fetch([noteId]);
  if (!note[0]?.vector) return [];
  
  return semanticSearch(note[0].vector, userId, 5);
}
```

---

## 4. Embeddings: Cost-Optimized Strategy

### Option A: Voyage AI (Recommended)
- **50M tokens free/month**
- Excellent quality for notes/documents
- `voyage-3-lite` model is fast and cheap

### Option B: OpenAI (Fallback)
- Pay-as-you-go at $0.02/1M tokens
- `text-embedding-3-small` is very affordable

### Option C: Local Embeddings (Zero Cost)
- Use `@xenova/transformers` in browser
- Process on client, send vectors to server
- Slower, but completely free

```typescript
// lib/embeddings.ts
import Anthropic from '@anthropic-ai/sdk';

// Using Voyage via Anthropic's partnership (or direct)
export async function getEmbedding(text: string): Promise<number[]> {
  // Option 1: Voyage AI direct
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'voyage-3-lite',
      input: text.slice(0, 4000), // Truncate to save tokens
    }),
  });
  
  const data = await response.json();
  return data.data[0].embedding;
}

// Option 2: Client-side (zero cost)
// In browser:
import { pipeline } from '@xenova/transformers';
const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
const output = await embedder(text, { pooling: 'mean', normalize: true });
```

---

## 5. Speech-to-Text: Groq (Free Tier)

### Why Groq?
- **Whisper large-v3** model
- **Free tier available**
- Extremely fast (real-time transcription)
- High accuracy

```typescript
// lib/transcription.ts
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('model', 'whisper-large-v3');
  formData.append('response_format', 'text');
  
  const transcription = await groq.audio.transcriptions.create({
    file: audioBlob,
    model: 'whisper-large-v3',
  });
  
  return transcription.text;
}
```

### Client-Side Recording

```typescript
// hooks/useVoiceCapture.ts
export function useVoiceCapture() {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    
    mediaRecorder.current.ondataavailable = (e) => chunks.current.push(e.data);
    mediaRecorder.current.start();
    setIsRecording(true);
  };

  const stopRecording = async (): Promise<string> => {
    return new Promise((resolve) => {
      mediaRecorder.current!.onstop = async () => {
        const blob = new Blob(chunks.current, { type: 'audio/webm' });
        chunks.current = [];
        
        // Send to API for transcription
        const formData = new FormData();
        formData.append('audio', blob);
        const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
        const { text } = await res.json();
        resolve(text);
      };
      mediaRecorder.current!.stop();
      setIsRecording(false);
    });
  };

  return { isRecording, startRecording, stopRecording };
}
```

---

## 6. Frontend: Next.js + Vercel (Free)

### Stack
- **Next.js 14** (App Router)
- **Tailwind CSS** (styling)
- **shadcn/ui** (components)
- **TipTap** or **Milkdown** (Markdown editor)
- **Vercel** hosting (free tier: 100GB bandwidth)

### Key Components

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── signup/page.tsx
├── (dashboard)/
│   ├── page.tsx              # Home/Dashboard
│   ├── notes/
│   │   ├── page.tsx          # Notes list
│   │   └── [id]/page.tsx     # Note editor
│   ├── journal/
│   │   └── page.tsx          # Journal entries
│   └── search/
│       └── page.tsx          # Unified search
├── api/
│   ├── notes/route.ts        # CRUD
│   ├── search/route.ts       # Hybrid search
│   ├── transcribe/route.ts   # STT endpoint
│   └── embed/route.ts        # Generate embeddings
└── components/
    ├── editor/
    │   ├── MarkdownEditor.tsx
    │   ├── VoiceButton.tsx
    │   └── LiveTrackers.tsx   # Quality/Mood sidebar
    ├── dashboard/
    │   ├── MoodChart.tsx
    │   ├── StreakCalendar.tsx
    │   └── WeeklySummary.tsx
    └── search/
        ├── SearchBar.tsx
        └── RelatedNotes.tsx   # Serendipity Engine
```

---

## 7. AI Features: Claude Integration

### Weekly Summary Generation

```typescript
// api/weekly-summary/route.ts
export async function GET(req: Request) {
  const userId = await getAuthUserId(req);
  
  // Fetch last 7 days of notes
  const { data: notes } = await supabase
    .from('notes')
    .select('title, content, mood_score, note_type, created_at')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });

  // Generate summary with Claude (via API in artifact)
  const prompt = `Analyze these notes from the past week and provide:
1. Key themes and topics discussed
2. Mood patterns observed
3. Connections between emotional state and productivity
4. One actionable insight

Notes:
${notes.map(n => `[${n.note_type}] ${n.title}: ${n.content.slice(0, 500)}... (mood: ${n.mood_score})`).join('\n\n')}`;

  // Use Claude API...
  return Response.json({ summary });
}
```

---

## 8. Cost Summary

| Service | Free Tier Limits | Est. Users Supported |
|---------|-----------------|---------------------|
| **Supabase** | 500MB DB, 50k MAU | ~5,000 users |
| **Upstash Vector** | 10k vectors | ~500 heavy users |
| **Vercel** | 100GB bandwidth | ~10,000 users |
| **Groq STT** | Free tier | ~1,000 transcriptions/day |
| **Voyage AI** | 50M tokens/mo | ~50,000 embeds/mo |

### When to Upgrade
- **>500MB data**: Supabase Pro ($25/mo)
- **>10k vectors**: Upstash Pay-as-you-go (~$0.40/10k)
- **Heavy traffic**: Vercel Pro ($20/mo)

---

## 9. Scaling Strategy

### Phase 1: MVP (Free Tier)
- All services on free tiers
- ~500-1000 active users comfortably

### Phase 2: Growth ($50/mo budget)
- Supabase Pro ($25)
- Upstash upgrade ($10)
- Buffer for API costs ($15)
- Supports ~10,000 users

### Phase 3: Scale (Revenue-funded)
- Dedicated vector DB (Pinecone/Weaviate)
- Edge caching (Vercel/Cloudflare)
- Background job queues (Inngest free tier → paid)