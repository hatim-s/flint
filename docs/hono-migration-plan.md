# Hono API Migration with Typesafe Client

Migrate all 17 Next.js API routes to Hono, creating end-to-end type safety with Hono's RPC client (`hc`).

## User Review Required

> [!IMPORTANT]
> **Breaking Change**: All API consumption patterns will change from raw [fetch()](file:///Users/admin/Projects/flint/components/dashboard/StreakCalendar.tsx#38-58) to typed `api.route.method()` calls. Any code using direct fetch to `/api/*` endpoints needs updating.

> [!IMPORTANT]
> **Auth Integration**: The better-auth catch-all route (`/api/auth/[...all]`) will remain as Next.js route handler since better-auth provides its own adapter.

---

## Current State Analysis

### Existing API Routes (17 total)
| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/notes` | GET, POST | List/Create notes |
| `/api/notes/[id]` | GET, PUT, DELETE | CRUD single note |
| `/api/notes/[id]/link` | ? | Note linking |
| `/api/notes/[id]/mentions` | ? | Note mentions |
| `/api/notes/[id]/related` | ? | Related notes |
| `/api/notes/[id]/tags` | ? | Note tags |
| `/api/search` | GET | Hybrid search |
| `/api/search/keyword` | GET | Keyword search |
| `/api/analytics/activity` | GET | Activity data |
| `/api/analytics/mood-trends` | GET | Mood analytics |
| `/api/tags` | GET, POST | Tags CRUD |
| `/api/people` | GET, POST | People CRUD |
| `/api/templates` | GET, POST | Templates list/create |
| `/api/templates/[id]` | GET, PUT, DELETE | Template CRUD |
| `/api/transcribe` | POST | Audio transcription |
| `/api/embed` | POST | Generate embeddings |
| `/api/auth/[...all]` | GET, POST | Auth (keep as-is) |

### Current Client Usage
- Direct [fetch("/api/...")](file:///Users/admin/Projects/flint/components/dashboard/StreakCalendar.tsx#38-58) calls in components
- No type safety between API and consumers
- Manual response type casting

---

## Proposed Changes

### 1. Dependencies

#### [MODIFY] [package.json](file:///Users/admin/Projects/flint/package.json)
Add Hono packages:
```diff
+ "hono": "^4.7.10",
+ "@hono/zod-openapi": "^0.19.0"
```

---

### 2. API Infrastructure

#### [NEW] [app.ts](file:///Users/admin/Projects/flint/lib/api/app.ts)
Create base Hono app factory with:
- CORS middleware (if needed)
- Auth middleware (extracts session from better-auth)
- Error handling middleware
- Request logging

```typescript
import { Hono } from "hono";
import { auth } from "@/auth";

// Base app type with session context
export type AppContext = {
  Variables: {
    session: Awaited<ReturnType<typeof auth.api.getSession>>;
    userId: string;
  };
};

export function createApp() {
  return new Hono<AppContext>();
}

// Auth middleware
export const authMiddleware = async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("session", session);
  c.set("userId", session.user.id);
  await next();
};
```

#### [NEW] [client.ts](file:///Users/admin/Projects/flint/lib/api/client.ts)
Create typed Hono client wrapper:
```typescript
import { hc } from "hono/client";
import type { AppType } from "./routes";

// For client components (browser)
export const api = hc<AppType>("/api");

// For server components (with headers forwarding)
export function createServerClient(headers: Headers) {
  return hc<AppType>("/api", {
    headers: Object.fromEntries(headers.entries()),
  });
}
```

---

### 3. Route Definitions

#### [NEW] [routes/index.ts](file:///Users/admin/Projects/flint/lib/api/routes/index.ts)
Main route aggregator that composes all sub-routes:
```typescript
import { createApp } from "../app";
import notesRoutes from "./notes";
import searchRoutes from "./search";
// ... other routes

const app = createApp()
  .route("/notes", notesRoutes)
  .route("/search", searchRoutes)
  // ... other routes

export type AppType = typeof app;
export default app;
```

#### [NEW] [routes/notes.ts](file:///Users/admin/Projects/flint/lib/api/routes/notes.ts)
Notes API with typed routes:
```typescript
import { createApp, authMiddleware } from "../app";
import { zValidator } from "@hono/zod-validator";
import { createNoteSchema, listNotesSchema } from "@/db/schema/inputs/notes";
import { listNotes } from "@/db/operations/notes";

const app = createApp()
  .use("*", authMiddleware)
  .get("/", zValidator("query", listNotesSchema), async (c) => {
    const userId = c.get("userId");
    const params = c.req.valid("query");
    const result = await listNotes(userId, params);
    return c.json({ data: result.notes, pagination: {...} });
  })
  .post("/", zValidator("json", createNoteSchema), async (c) => {
    // ... create note logic
  })
  .get("/:id", async (c) => {
    // ... get single note
  });
  // ... other routes

export default app;
```

Similar pattern for:
- [routes/search.ts](file:///Users/admin/Projects/flint/lib/api/routes/search.ts)
- [routes/analytics.ts](file:///Users/admin/Projects/flint/lib/api/routes/analytics.ts)
- [routes/tags.ts](file:///Users/admin/Projects/flint/lib/api/routes/tags.ts)
- [routes/people.ts](file:///Users/admin/Projects/flint/lib/api/routes/people.ts)
- [routes/templates.ts](file:///Users/admin/Projects/flint/lib/api/routes/templates.ts)
- [routes/transcribe.ts](file:///Users/admin/Projects/flint/lib/api/routes/transcribe.ts)
- [routes/embed.ts](file:///Users/admin/Projects/flint/lib/api/routes/embed.ts)

---

### 4. Next.js Integration

#### [MODIFY] [route.ts](file:///Users/admin/Projects/flint/app/api/%5B%5B...route%5D%5D/route.ts)
Replace all individual route files with a single catch-all handler:
```typescript
import { handle } from "hono/vercel";
import app from "@/api/routes";

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
```

#### [DELETE] Individual route files
Remove all files in `app/api/` except:
- `app/api/auth/[...all]/route.ts` (keep for better-auth)
- `app/api/[[...route]]/route.ts` (new Hono handler)

---

### 5. Update Client Consumers

#### [MODIFY] [StreakCalendar.tsx](file:///Users/admin/Projects/flint/components/dashboard/StreakCalendar.tsx)
```diff
- const response = await fetch("/api/analytics/activity");
- const result: ActivityResponse = await response.json();
+ import { api } from "@/api/client";
+ const result = await api.analytics.activity.$get();
+ const data = await result.json();
```

#### [MODIFY] [page.tsx](file:///Users/admin/Projects/flint/app/(protected)/search/page.tsx)
```diff
- const response = await fetch("/api/tags");
+ import { api } from "@/api/client";
+ const result = await api.tags.$get();
```

---

## File Structure After Migration

```
lib/api/
├── app.ts              # Hono app factory & middleware
├── client.ts           # Typed client for consumers
└── routes/
    ├── index.ts        # Route aggregator (exports AppType)
    ├── notes.ts        # /notes routes
    ├── search.ts       # /search routes
    ├── analytics.ts    # /analytics routes
    ├── tags.ts         # /tags routes
    ├── people.ts       # /people routes
    ├── templates.ts    # /templates routes
    ├── transcribe.ts   # /transcribe routes
    └── embed.ts        # /embed routes

app/api/
├── auth/[...all]/route.ts     # Keep: better-auth handler
└── [[...route]]/route.ts      # New: Hono catch-all
```

---

## Type System Benefits

After migration, client code will have:

1. **Autocomplete for routes**: `api.notes.$get()`, `api.notes[":id"].$put()`
2. **Typed request bodies**: TypeScript errors if wrong payload shape
3. **Typed responses**: No more manual type casting
4. **Refactoring safety**: Rename route → TypeScript shows all broken consumers

Example typed usage:
```typescript
// Client component
const { data } = await api.notes.$get({ 
  query: { limit: 10, noteType: "journal" } 
});
// data is typed as { notes: Note[], pagination: {...} }

// Server component
const client = createServerClient(headers());
const note = await client.notes[":id"].$get({ param: { id: "123" } });
```

---

## Verification Plan

### Automated Tests
No existing test suite found. Will rely on:
1. **TypeScript compilation**: `bun run typecheck`
   - Must pass with no errors after migration
   - Verifies all client consumers use correct types

### Manual Verification (User Required)
After implementation, please verify the following flows:

1. **Notes CRUD**
   - Navigate to notes page
   - Create a new note → should succeed
   - Edit the note → should save
   - Delete the note → should remove

2. **Search**
   - Go to search page
   - Type a query → results should appear
   - Verify tags dropdown loads

3. **Analytics**
   - Go to dashboard
   - Verify streak calendar loads with activity data

4. **Auth flows**
   - Sign out and sign back in
   - Verify protected routes still require auth

> [!NOTE]
> If you have specific test scenarios or edge cases you'd like covered, please let me know.
