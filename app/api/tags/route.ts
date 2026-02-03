import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tags } from '@/db/schema/tags';
import { auth } from '@/auth';
import { setCurrentUser } from '@/db/lib/rls';
import { z } from 'zod';
import { eq, and, ilike } from 'drizzle-orm';

// Validation schema for creating/updating tags
const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#6366f1'),
});

/**
 * GET /api/tags
 * List all tags for the authenticated user with optional search
 * Query params:
 * - search: Optional string to filter tags by name (case-insensitive)
 */
export async function GET(req: NextRequest) {
  try {
    // Get session
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Set RLS context
    await setCurrentUser(session.user.id);

    // Get search query param
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get('search');

    // Build query
    let query = db.select().from(tags);
    
    // Apply search filter if provided
    if (search && search.trim()) {
      query = query.where(
        and(
          eq(tags.userId, session.user.id),
          ilike(tags.name, `%${search.trim()}%`)
        )
      ) as typeof query;
    } else {
      query = query.where(eq(tags.userId, session.user.id)) as typeof query;
    }

    // Execute query with ordering
    const userTags = await query.orderBy(tags.name);

    return NextResponse.json(userTags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tags' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tags
 * Create a new tag (or return existing if name already exists)
 */
export async function POST(req: NextRequest) {
  try {
    // Get session
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate body
    const body = await req.json();
    const validationResult = createTagSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { name, color } = validationResult.data;

    // Set RLS context
    await setCurrentUser(session.user.id);

    // Check if tag with this name already exists for this user
    const existingTags = await db
      .select()
      .from(tags)
      .where(and(eq(tags.userId, session.user.id), eq(tags.name, name)))
      .limit(1);

    if (existingTags.length > 0) {
      // Return existing tag instead of creating duplicate
      return NextResponse.json(existingTags[0], { status: 200 });
    }

    // Create new tag
    const newTag = await db
      .insert(tags)
      .values({
        userId: session.user.id,
        name,
        color,
      })
      .returning();

    return NextResponse.json(newTag[0], { status: 201 });
  } catch (error) {
    console.error('Error creating tag:', error);
    return NextResponse.json(
      { error: 'Failed to create tag' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tags?id=<tagId>
 * Delete a tag
 */
export async function DELETE(req: NextRequest) {
  try {
    // Get session
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get tag ID from query params
    const searchParams = req.nextUrl.searchParams;
    const tagId = searchParams.get('id');

    if (!tagId) {
      return NextResponse.json(
        { error: 'Tag ID is required' },
        { status: 400 }
      );
    }

    // Set RLS context
    await setCurrentUser(session.user.id);

    // Delete the tag (RLS ensures user owns it)
    const deleted = await db
      .delete(tags)
      .where(and(eq(tags.id, tagId), eq(tags.userId, session.user.id)))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: 'Tag not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: 'Tag deleted' });
  } catch (error) {
    console.error('Error deleting tag:', error);
    return NextResponse.json(
      { error: 'Failed to delete tag' },
      { status: 500 }
    );
  }
}
