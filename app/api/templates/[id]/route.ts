import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { templates } from '@/db/schema/templates';
import { rlsExecutor } from '@/db/lib/rls';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// GET /api/templates/[id] - Get single template
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Authenticate user
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const rls = rlsExecutor(session.user.id);

    // Fetch template
    const [template] = await db
      .select()
      .from(templates)
      .where(rls.where(templates, eq(templates.id, id)))
      .limit(1);

    if (!template) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }

    return Response.json(template);
  } catch (error) {
    console.error('Error fetching template:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/templates/[id] - Update template
const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  noteType: z.enum(['note', 'journal']).optional(),
  content: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Authenticate user
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await req.json();
    const validationResult = updateTemplateSchema.safeParse(body);

    if (!validationResult.success) {
      return Response.json(
        { error: 'Invalid input', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const data = validationResult.data;
    const rls = rlsExecutor(session.user.id);

    // Check if template exists and user owns it
    const [existingTemplate] = await db
      .select()
      .from(templates)
      .where(rls.where(templates, eq(templates.id, id)))
      .limit(1);

    if (!existingTemplate) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }

    // Update template
    const [updatedTemplate] = await db
      .update(templates)
      .set(data)
      .where(rls.where(templates, eq(templates.id, id)))
      .returning();

    return Response.json(updatedTemplate);
  } catch (error) {
    console.error('Error updating template:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/templates/[id] - Delete template
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Authenticate user
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const rls = rlsExecutor(session.user.id);

    // Check if template exists and user owns it
    const [existingTemplate] = await db
      .select()
      .from(templates)
      .where(rls.where(templates, eq(templates.id, id)))
      .limit(1);

    if (!existingTemplate) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }

    // Delete template
    await db
      .delete(templates)
      .where(rls.where(templates, eq(templates.id, id)));

    return Response.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
