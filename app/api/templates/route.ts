import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { templates } from '@/db/schema/templates';
import { setCurrentUser } from '@/db/lib/rls';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const querySchema = z.object({
  noteType: z.enum(['note', 'journal']).optional(),
});

// GET /api/templates - List templates
export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query params
    const searchParams = req.nextUrl.searchParams;
    const queryResult = querySchema.safeParse({
      noteType: searchParams.get('noteType'),
    });

    if (!queryResult.success) {
      return Response.json(
        { error: 'Invalid query parameters', details: queryResult.error.issues },
        { status: 400 }
      );
    }

    const { noteType } = queryResult.data;

    // Set RLS context
    await setCurrentUser(session.user.id);

    // Build query
    const conditions = [eq(templates.userId, session.user.id)];
    if (noteType) {
      conditions.push(eq(templates.noteType, noteType));
    }

    // Fetch templates
    const userTemplates = await db
      .select()
      .from(templates)
      .where(and(...conditions))
      .orderBy(templates.createdAt);

    return Response.json({
      templates: userTemplates,
      count: userTemplates.length,
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/templates - Create template
const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  noteType: z.enum(['note', 'journal']),
  content: z.string(),
  isDefault: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await req.json();
    const validationResult = createTemplateSchema.safeParse(body);

    if (!validationResult.success) {
      return Response.json(
        { error: 'Invalid input', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Set RLS context
    await setCurrentUser(session.user.id);

    // Create template
    const [template] = await db
      .insert(templates)
      .values({
        userId: session.user.id,
        name: data.name,
        noteType: data.noteType,
        content: data.content,
        isDefault: data.isDefault,
      })
      .returning();

    return Response.json({ template }, { status: 201 });
  } catch (error) {
    console.error('Error creating template:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
