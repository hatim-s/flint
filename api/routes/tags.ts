import { eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { rlsExecutor } from "@/db/lib/rls";
import { tags } from "@/db/schema/tags";
import { createApp } from "../app";

const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default("#6366f1"),
});

const app = createApp()
  .get("/tags", async (c) => {
    try {
      const rls = rlsExecutor(c.get("userId"));
      const searchParams = new URL(c.req.url).searchParams;
      const search = searchParams.get("search");

      let query = db.select().from(tags);

      const whereClause = search?.trim()
        ? rls.where(tags, ilike(tags.name, `%${search.trim()}%`))
        : rls.where(tags);

      query = query.where(whereClause) as typeof query;

      const userTags = await query.orderBy(tags.name);

      return c.json(userTags);
    } catch (error) {
      console.error("Error fetching tags:", error);
      return c.json({ error: "Failed to fetch tags" }, 500);
    }
  })
  .post("/tags", async (c) => {
    try {
      const body = await c.req.json();
      const validationResult = createTagSchema.safeParse(body);

      if (!validationResult.success) {
        return c.json(
          { error: "Invalid input", details: validationResult.error.issues },
          400,
        );
      }

      const { name, color } = validationResult.data;
      const rls = rlsExecutor(c.get("userId"));

      const existingTags = await db
        .select()
        .from(tags)
        .where(rls.where(tags, eq(tags.name, name)))
        .limit(1);

      if (existingTags.length > 0) {
        return c.json(existingTags[0], 200);
      }

      const newTag = await db
        .insert(tags)
        .values(
          rls.values({
            name,
            color,
          }),
        )
        .returning();

      return c.json(newTag[0], 201);
    } catch (error) {
      console.error("Error creating tag:", error);
      return c.json({ error: "Failed to create tag" }, 500);
    }
  })
  .delete("/tags", async (c) => {
    try {
      const searchParams = new URL(c.req.url).searchParams;
      const tagId = searchParams.get("id");

      if (!tagId) {
        return c.json({ error: "Tag ID is required" }, 400);
      }

      const rls = rlsExecutor(c.get("userId"));

      const deleted = await db
        .delete(tags)
        .where(rls.where(tags, eq(tags.id, tagId)))
        .returning();

      if (deleted.length === 0) {
        return c.json({ error: "Tag not found" }, 404);
      }

      return c.json({ success: true, message: "Tag deleted" });
    } catch (error) {
      console.error("Error deleting tag:", error);
      return c.json({ error: "Failed to delete tag" }, 500);
    }
  });

export default app;
