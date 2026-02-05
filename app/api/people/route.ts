import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { people } from '@/db/schema/people';
import { rlsExecutor } from '@/db/lib/rls';
import { eq, ilike, and } from 'drizzle-orm';
import { z } from 'zod';

// Validation schema for creating/updating people
const createPersonSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email').optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * GET /api/people
 * List all people for the current user with optional search filter
 */
export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const rls = rlsExecutor(session.user.id);

    // Get search query parameter
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get('search');

    // Build query
    let query = db.select().from(people);

    // Apply search filter if provided
    const whereClause = search
      ? rls.where(people, ilike(people.name, `%${search}%`))
      : rls.where(people);

    query = query.where(whereClause) as typeof query;

    // Execute query with ordering
    const result = await query.orderBy(people.name);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching people:', error);
    return NextResponse.json(
      { error: 'Failed to fetch people' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/people
 * Create a new person (or return existing if name+email combo exists)
 */
export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await req.json();
    const validation = createPersonSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { name, email, metadata } = validation.data;
    const rls = rlsExecutor(session.user.id);

    // Check if person already exists (by name and optionally email)
    const existingQuery = email
      ? db
          .select()
          .from(people)
          .where(
            rls.where(people, and(eq(people.name, name), eq(people.email, email)))
          )
      : db
          .select()
          .from(people)
          .where(rls.where(people, eq(people.name, name)));

    const existing = await existingQuery;

    if (existing.length > 0) {
      // Return existing person
      return NextResponse.json(existing[0]);
    }

    // Create new person
    const [newPerson] = await db
      .insert(people)
      .values(rls.values({
        name,
        email: email || null,
        metadata: metadata || {},
      }))
      .returning();

    return NextResponse.json(newPerson, { status: 201 });
  } catch (error) {
    console.error('Error creating person:', error);
    return NextResponse.json(
      { error: 'Failed to create person' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/people?id=<personId>
 * Delete a person
 */
export async function DELETE(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get person ID from query params
    const searchParams = req.nextUrl.searchParams;
    const personId = searchParams.get('id');

    if (!personId) {
      return NextResponse.json(
        { error: 'Person ID is required' },
        { status: 400 }
      );
    }

    const rls = rlsExecutor(session.user.id);

    // Delete the person
    const result = await db
      .delete(people)
      .where(rls.where(people, eq(people.id, personId)))
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted: result[0] });
  } catch (error) {
    console.error('Error deleting person:', error);
    return NextResponse.json(
      { error: 'Failed to delete person' },
      { status: 500 }
    );
  }
}
