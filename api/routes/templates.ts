import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { rlsExecutor } from "@/db/lib/rls";
import { templates } from "@/db/schema/templates";
import { createApp } from "../app";

const querySchema = z.object({
  noteType: z.enum(["note", "journal"]).optional(),
});

const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  noteType: z.enum(["note", "journal"]),
  content: z.string(),
  isDefault: z.boolean().optional().default(false),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  noteType: z.enum(["note", "journal"]).optional(),
  content: z.string().optional(),
  isDefault: z.boolean().optional(),
});

const app = createApp()
  .get("/templates", async (c) => {
    try {
      const searchParams = new URL(c.req.url).searchParams;
      const queryResult = querySchema.safeParse({
        noteType: searchParams.get("noteType"),
      });

      if (!queryResult.success) {
        return c.json(
          {
            error: "Invalid query parameters",
            details: queryResult.error.issues,
          },
          400,
        );
      }

      const { noteType } = queryResult.data;
      const rls = rlsExecutor(c.get("userId"));

      const conditions = [rls.where(templates)];
      if (noteType) {
        conditions.push(eq(templates.noteType, noteType));
      }

      const userTemplates = await db
        .select()
        .from(templates)
        .where(and(...conditions))
        .orderBy(templates.createdAt);

      return c.json({
        templates: userTemplates,
        count: userTemplates.length,
      });
    } catch (error) {
      console.error("Error fetching templates:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  })
  .post("/templates", async (c) => {
    try {
      const body = await c.req.json();
      const validationResult = createTemplateSchema.safeParse(body);

      if (!validationResult.success) {
        return c.json(
          { error: "Invalid input", details: validationResult.error.issues },
          400,
        );
      }

      const data = validationResult.data;
      const rls = rlsExecutor(c.get("userId"));

      const [template] = await db
        .insert(templates)
        .values(
          rls.values({
            name: data.name,
            noteType: data.noteType,
            content: data.content,
            isDefault: data.isDefault,
          }),
        )
        .returning();

      return c.json({ template }, 201);
    } catch (error) {
      console.error("Error creating template:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  })
  .get("/templates/:id", async (c) => {
    try {
      const id = c.req.param("id");
      const rls = rlsExecutor(c.get("userId"));

      const [template] = await db
        .select()
        .from(templates)
        .where(rls.where(templates, eq(templates.id, id)))
        .limit(1);

      if (!template) {
        return c.json({ error: "Template not found" }, 404);
      }

      return c.json(template);
    } catch (error) {
      console.error("Error fetching template:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  })
  .put("/templates/:id", async (c) => {
    try {
      const id = c.req.param("id");
      const body = await c.req.json();
      const validationResult = updateTemplateSchema.safeParse(body);

      if (!validationResult.success) {
        return c.json(
          { error: "Invalid input", details: validationResult.error.issues },
          400,
        );
      }

      const data = validationResult.data;
      const rls = rlsExecutor(c.get("userId"));

      const [existingTemplate] = await db
        .select()
        .from(templates)
        .where(rls.where(templates, eq(templates.id, id)))
        .limit(1);

      if (!existingTemplate) {
        return c.json({ error: "Template not found" }, 404);
      }

      const [updatedTemplate] = await db
        .update(templates)
        .set(data)
        .where(rls.where(templates, eq(templates.id, id)))
        .returning();

      return c.json(updatedTemplate);
    } catch (error) {
      console.error("Error updating template:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  })
  .delete("/templates/:id", async (c) => {
    try {
      const id = c.req.param("id");
      const rls = rlsExecutor(c.get("userId"));

      const [existingTemplate] = await db
        .select()
        .from(templates)
        .where(rls.where(templates, eq(templates.id, id)))
        .limit(1);

      if (!existingTemplate) {
        return c.json({ error: "Template not found" }, 404);
      }

      await db
        .delete(templates)
        .where(rls.where(templates, eq(templates.id, id)));

      return c.json({ message: "Template deleted successfully" });
    } catch (error) {
      console.error("Error deleting template:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

export default app;
