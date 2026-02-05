import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findRelatedNotes, semanticSearch } from "@/lib/vector";
import { getEmbedding } from "@/lib/embeddings";
import { db } from "@/db";
import { notes } from "@/db/schema/notes";
import { noteLinks } from "@/db/schema/noteLinks";
import { setCurrentUser } from "@/db/lib/rls";
import { eq, inArray, and, or } from "drizzle-orm";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/notes/[id]/related
 * 
 * Fetch semantically related notes for the Serendipity Engine.
 * Uses the note's embedding to find similar notes via vector search.
 */
export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: noteId } = await context.params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "5"), 1), 10);

    // Set RLS context
    await setCurrentUser(session.user.id);

    // First verify the note exists and belongs to the user
    const [note] = await db
      .select({ id: notes.id })
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // Find related notes using vector similarity
    const relatedResults = await findRelatedNotes(noteId, session.user.id, limit);

    if (relatedResults.length === 0) {
      return NextResponse.json({ related: [], hasEmbedding: false });
    }

    // Fetch full note data for the related notes
    const relatedNoteIds = relatedResults.map((r) => r.id);
    
    const relatedNotes = await db
      .select({
        id: notes.id,
        title: notes.title,
        content: notes.content,
        noteType: notes.noteType,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
      })
      .from(notes)
      .where(inArray(notes.id, relatedNoteIds));

    // Check for existing links (both directions)
    const existingLinks = await db
      .select({
        sourceNoteId: noteLinks.sourceNoteId,
        targetNoteId: noteLinks.targetNoteId,
        linkType: noteLinks.linkType,
      })
      .from(noteLinks)
      .where(
        or(
          and(
            eq(noteLinks.sourceNoteId, noteId),
            inArray(noteLinks.targetNoteId, relatedNoteIds)
          ),
          and(
            eq(noteLinks.targetNoteId, noteId),
            inArray(noteLinks.sourceNoteId, relatedNoteIds)
          )
        )
      );

    // Create a set of linked note IDs
    const linkedNoteIds = new Set(
      existingLinks.map((link) =>
        link.sourceNoteId === noteId ? link.targetNoteId : link.sourceNoteId
      )
    );

    // Merge results with scores
    const related = relatedResults
      .map((result) => {
        const noteData = relatedNotes.find((n) => n.id === result.id);
        if (!noteData) return null;

        // Create a preview from content (first 150 chars, strip markdown)
        const plainContent = noteData.content
          .replace(/#{1,6}\s+/g, "") // Remove headers
          .replace(/\*\*([^*]+)\*\*/g, "$1") // Remove bold
          .replace(/\*([^*]+)\*/g, "$1") // Remove italic
          .replace(/`([^`]+)`/g, "$1") // Remove inline code
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Remove links
          .replace(/\n+/g, " ") // Replace newlines with spaces
          .trim();
        
        const preview = plainContent.length > 150
          ? plainContent.slice(0, 150) + "..."
          : plainContent;

        return {
          id: noteData.id,
          title: noteData.title,
          preview,
          noteType: noteData.noteType,
          similarity: Math.round(result.score * 100), // Convert to percentage
          createdAt: noteData.createdAt,
          updatedAt: noteData.updatedAt,
          isLinked: linkedNoteIds.has(noteData.id),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.similarity - a.similarity); // Sort by similarity (highest first)

    return NextResponse.json({
      related,
      hasEmbedding: true,
    });
  } catch (error) {
    console.error("Error fetching related notes:", error);
    return NextResponse.json(
      { error: "Failed to fetch related notes" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notes/[id]/related
 * 
 * Find related notes based on provided content (for real-time suggestions while editing).
 * This allows finding related notes before the current note is saved/embedded.
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

    const { id: noteId } = await context.params;
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== "string" || content.trim().length < 50) {
      // Not enough content to generate meaningful embeddings
      return NextResponse.json({ related: [], hasEmbedding: false });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "5"), 1), 10);

    // Set RLS context
    await setCurrentUser(session.user.id);

    // Generate embedding for the current content
    const embedding = await getEmbedding(content);

    // Search for similar notes
    const relatedResults = await semanticSearch(embedding, session.user.id, {
      topK: limit + 1, // Fetch extra to exclude current note
      includeMetadata: true,
    });

    // Filter out the current note
    const filteredResults = relatedResults.filter((r) => r.id !== noteId).slice(0, limit);

    if (filteredResults.length === 0) {
      return NextResponse.json({ related: [], hasEmbedding: true });
    }

    // Fetch full note data
    const relatedNoteIds = filteredResults.map((r) => r.id);
    
    const relatedNotes = await db
      .select({
        id: notes.id,
        title: notes.title,
        content: notes.content,
        noteType: notes.noteType,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
      })
      .from(notes)
      .where(inArray(notes.id, relatedNoteIds));

    // Check for existing links
    const existingLinks = await db
      .select({
        sourceNoteId: noteLinks.sourceNoteId,
        targetNoteId: noteLinks.targetNoteId,
      })
      .from(noteLinks)
      .where(
        or(
          and(
            eq(noteLinks.sourceNoteId, noteId),
            inArray(noteLinks.targetNoteId, relatedNoteIds)
          ),
          and(
            eq(noteLinks.targetNoteId, noteId),
            inArray(noteLinks.sourceNoteId, relatedNoteIds)
          )
        )
      );

    const linkedNoteIds = new Set(
      existingLinks.map((link) =>
        link.sourceNoteId === noteId ? link.targetNoteId : link.sourceNoteId
      )
    );

    // Merge and format results
    const related = filteredResults
      .map((result) => {
        const noteData = relatedNotes.find((n) => n.id === result.id);
        if (!noteData) return null;

        const plainContent = noteData.content
          .replace(/#{1,6}\s+/g, "")
          .replace(/\*\*([^*]+)\*\*/g, "$1")
          .replace(/\*([^*]+)\*/g, "$1")
          .replace(/`([^`]+)`/g, "$1")
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
          .replace(/\n+/g, " ")
          .trim();
        
        const preview = plainContent.length > 150
          ? plainContent.slice(0, 150) + "..."
          : plainContent;

        return {
          id: noteData.id,
          title: noteData.title,
          preview,
          noteType: noteData.noteType,
          similarity: Math.round(result.score * 100),
          createdAt: noteData.createdAt,
          updatedAt: noteData.updatedAt,
          isLinked: linkedNoteIds.has(noteData.id),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.similarity - a.similarity);

    return NextResponse.json({
      related,
      hasEmbedding: true,
    });
  } catch (error) {
    console.error("Error finding related notes from content:", error);
    return NextResponse.json(
      { error: "Failed to find related notes" },
      { status: 500 }
    );
  }
}
