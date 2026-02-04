import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { syncNoteMentions, getNoteMentions } from '@/lib/people';
import { z } from 'zod';

const syncMentionsSchema = z.object({
  content: z.string(),
});

/**
 * GET /api/notes/[id]/mentions
 * Get people mentioned in a specific note
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

    // Get people mentioned in this note
    const mentions = await getNoteMentions(session.user.id, noteId);

    return NextResponse.json(mentions);
  } catch (error) {
    console.error('Error fetching note mentions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch note mentions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notes/[id]/mentions
 * Sync people mentions for a note based on its content
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
    const validationResult = syncMentionsSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { content } = validationResult.data;

    // Sync mentions
    await syncNoteMentions(session.user.id, noteId, content);

    // Return updated mentions
    const mentions = await getNoteMentions(session.user.id, noteId);

    return NextResponse.json({ success: true, mentions });
  } catch (error) {
    console.error('Error syncing note mentions:', error);
    return NextResponse.json(
      { error: 'Failed to sync note mentions' },
      { status: 500 }
    );
  }
}
