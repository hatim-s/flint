/**
 * Notes API Routes - List and Create
 * 
 * GET /api/notes - List notes with filtering and pagination
 * POST /api/notes - Create a new note
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createNote,
  listNotes,
  createNoteSchema,
  listNotesSchema,
} from "@/lib/notes";
import { ZodError } from "zod";

/**
 * GET /api/notes
 * List notes with optional filters and pagination
 * 
 * Query Parameters:
 * - limit: Number of notes to return (1-100, default: 20)
 * - cursor: Pagination cursor (note ID)
 * - noteType: Filter by 'note' or 'journal'
 * - tags: Filter by tags (comma-separated)
 * - minMood: Minimum mood score (1-10)
 * - maxMood: Maximum mood score (1-10)
 * - startDate: Filter notes created after this date (ISO 8601)
 * - endDate: Filter notes created before this date (ISO 8601)
 * - sortBy: Sort field ('createdAt', 'updatedAt', 'title')
 * - sortOrder: Sort direction ('asc', 'desc')
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    
    const rawParams = {
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined,
      cursor: searchParams.get("cursor") ?? undefined,
      noteType: searchParams.get("noteType") as "note" | "journal" | undefined,
      tags: searchParams.get("tags")?.split(",").filter(Boolean) ?? undefined,
      minMood: searchParams.get("minMood") ? parseInt(searchParams.get("minMood")!, 10) : undefined,
      maxMood: searchParams.get("maxMood") ? parseInt(searchParams.get("maxMood")!, 10) : undefined,
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
      sortBy: searchParams.get("sortBy") as "createdAt" | "updatedAt" | "title" | undefined,
      sortOrder: searchParams.get("sortOrder") as "asc" | "desc" | undefined,
    };

    // Validate parameters
    const params = listNotesSchema.parse(rawParams);

    // Fetch notes
    const result = await listNotes(session.user.id, params);

    return NextResponse.json({
      data: result.notes,
      pagination: {
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid parameters", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error listing notes:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notes
 * Create a new note
 * 
 * Body:
 * {
 *   title: string (required)
 *   content: string (required)
 *   noteType: 'note' | 'journal' (required)
 *   sourceUrl?: string
 *   moodScore?: number (1-10)
 *   qualityScore?: number (0-1)
 *   templateId?: string
 *   metadata?: Record<string, unknown>
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const input = createNoteSchema.parse(body);

    // Create note
    const note = await createNote(session.user.id, input);

    return NextResponse.json(
      { data: note },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error creating note:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
