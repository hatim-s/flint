/**
 * Individual Note API Routes
 * 
 * GET /api/notes/[id] - Get a single note
 * PUT /api/notes/[id] - Update a note
 * DELETE /api/notes/[id] - Delete a note
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getNote,
  updateNote,
  deleteNote,
  updateNoteSchema,
} from "@/lib/notes";
import { ZodError } from "zod";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/notes/[id]
 * Retrieve a single note by ID
 */
export async function GET(
  req: NextRequest,
  context: RouteContext
) {
  try {
    // Authenticate user
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    // Fetch note
    const note = await getNote(session.user.id, id);

    if (!note) {
      return NextResponse.json(
        { error: "Note not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: note });
  } catch (error) {
    console.error("Error fetching note:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/notes/[id]
 * Update a note
 * 
 * Body (all fields optional):
 * {
 *   title?: string
 *   content?: string
 *   noteType?: 'note' | 'journal'
 *   sourceUrl?: string
 *   moodScore?: number (1-10) | null
 *   qualityScore?: number (0-1) | null
 *   templateId?: string | null
 *   metadata?: Record<string, unknown>
 *   updatedAt?: string (ISO 8601, for optimistic locking)
 * }
 */
export async function PUT(
  req: NextRequest,
  context: RouteContext
) {
  try {
    // Authenticate user
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    // Parse and validate request body
    const body = await req.json();
    const input = updateNoteSchema.parse(body);

    // Update note
    const note = await updateNote(session.user.id, id, input);

    return NextResponse.json({ data: note });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      // Handle specific error messages
      if (error.message === "Note not found") {
        return NextResponse.json(
          { error: "Note not found" },
          { status: 404 }
        );
      }

      if (error.message.includes("modified by another process")) {
        return NextResponse.json(
          { error: "Conflict", message: error.message },
          { status: 409 }
        );
      }
    }

    console.error("Error updating note:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notes/[id]
 * Delete a note
 */
export async function DELETE(
  req: NextRequest,
  context: RouteContext
) {
  try {
    // Authenticate user
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    // Delete note
    await deleteNote(session.user.id, id);

    return NextResponse.json(
      { message: "Note deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Note not found") {
      return NextResponse.json(
        { error: "Note not found" },
        { status: 404 }
      );
    }

    console.error("Error deleting note:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
