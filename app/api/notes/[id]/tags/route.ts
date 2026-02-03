import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { syncNoteTags, getNoteTags } from '@/lib/tags';
import { z } from 'zod';
import React from 'react';

const syncTagsSchema = z.object({
  content: z.string(),
});

/**
 * GET /api/notes/[id]/tags
 * Get tags for a specific note
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Get session
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const noteId = params.id;

    // Get tags for this note
    const tags = await getNoteTags(session.user.id, noteId);

    return NextResponse.json(tags);
  } catch (error) {
    console.error('Error fetching note tags:', error);
    return NextResponse.json(
      { error: 'Failed to fetch note tags' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notes/[id]/tags
 * Sync tags for a note based on its content
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Get session
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const noteId = params.id;

    // Parse and validate body
    const body = await req.json();
    const validationResult = syncTagsSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { content } = validationResult.data;

    // Sync tags
    await syncNoteTags(session.user.id, noteId, content);

    // Return updated tags
    const tags = await getNoteTags(session.user.id, noteId);

    return NextResponse.json({ success: true, tags });
  } catch (error) {
    console.error('Error syncing note tags:', error);
    return NextResponse.json(
      { error: 'Failed to sync note tags' },
      { status: 500 }
    );
  }
}
