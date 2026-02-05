import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { notes } from "@/db/schema/notes";
import { noteLinks } from "@/db/schema/noteLinks";
import { rlsExecutor } from "@/db/lib/rls";
import { eq, and, or } from "drizzle-orm";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const createLinkSchema = z.object({
  targetNoteId: z.string().min(1, "Target note ID is required"),
  linkType: z.enum(["reference", "ai_suggested", "manual"]).default("manual"),
  strength: z.number().min(0).max(1).default(1.0),
});

/**
 * POST /api/notes/[id]/link
 * 
 * Create a bidirectional link between two notes.
 */
export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: sourceNoteId } = await context.params;
    const body = await request.json();
    
    const validationResult = createLinkSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { targetNoteId, linkType, strength } = validationResult.data;
    const rls = rlsExecutor(session.user.id);

    // Prevent self-linking
    if (sourceNoteId === targetNoteId) {
      return NextResponse.json(
        { error: "Cannot link a note to itself" },
        { status: 400 }
      );
    }

    // Verify both notes exist and belong to the user
    const [sourceNote] = await db
      .select({ id: notes.id })
      .from(notes)
      .where(rls.where(notes, eq(notes.id, sourceNoteId)))
      .limit(1);

    const [targetNote] = await db
      .select({ id: notes.id })
      .from(notes)
      .where(rls.where(notes, eq(notes.id, targetNoteId)))
      .limit(1);

    if (!sourceNote) {
      return NextResponse.json({ error: "Source note not found" }, { status: 404 });
    }

    if (!targetNote) {
      return NextResponse.json({ error: "Target note not found" }, { status: 404 });
    }

    // Check if link already exists (in either direction)
    const existingLink = await db
      .select({ id: noteLinks.id })
      .from(noteLinks)
      .where(
        or(
          and(
            eq(noteLinks.sourceNoteId, sourceNoteId),
            eq(noteLinks.targetNoteId, targetNoteId)
          ),
          and(
            eq(noteLinks.sourceNoteId, targetNoteId),
            eq(noteLinks.targetNoteId, sourceNoteId)
          )
        )
      )
      .limit(1);

    if (existingLink.length > 0) {
      return NextResponse.json(
        { error: "Link already exists between these notes", existingLinkId: existingLink[0]?.id },
        { status: 409 }
      );
    }

    // Create the link
    const [newLink] = await db
      .insert(noteLinks)
      .values({
        sourceNoteId,
        targetNoteId,
        linkType,
        strength,
      })
      .returning();

    return NextResponse.json(newLink, { status: 201 });
  } catch (error) {
    console.error("Error creating note link:", error);
    return NextResponse.json(
      { error: "Failed to create note link" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notes/[id]/link
 * 
 * Remove a link between two notes.
 */
export async function DELETE(
  request: Request,
  context: RouteContext
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: sourceNoteId } = await context.params;
    const { searchParams } = new URL(request.url);
    const targetNoteId = searchParams.get("targetNoteId");

    if (!targetNoteId) {
      return NextResponse.json(
        { error: "targetNoteId query parameter is required" },
        { status: 400 }
      );
    }

    const rls = rlsExecutor(session.user.id);

    // Verify both notes exist and belong to the user
    const [sourceNote] = await db
      .select({ id: notes.id })
      .from(notes)
      .where(rls.where(notes, eq(notes.id, sourceNoteId)))
      .limit(1);

    const [targetNote] = await db
      .select({ id: notes.id })
      .from(notes)
      .where(rls.where(notes, eq(notes.id, targetNoteId)))
      .limit(1);

    if (!sourceNote || !targetNote) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // Find and delete the link (in either direction)
    const deletedLinks = await db
      .delete(noteLinks)
      .where(
        or(
          and(
            eq(noteLinks.sourceNoteId, sourceNoteId),
            eq(noteLinks.targetNoteId, targetNoteId)
          ),
          and(
            eq(noteLinks.sourceNoteId, targetNoteId),
            eq(noteLinks.targetNoteId, sourceNoteId)
          )
        )
      )
      .returning();

    if (deletedLinks.length === 0) {
      return NextResponse.json(
        { error: "Link not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, deleted: deletedLinks[0] });
  } catch (error) {
    console.error("Error deleting note link:", error);
    return NextResponse.json(
      { error: "Failed to delete note link" },
      { status: 500 }
    );
  }
}
