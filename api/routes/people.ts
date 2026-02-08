import { createApp } from "../app";
import { db } from "@/db";
import { people } from "@/db/schema/people";
import { rlsExecutor } from "@/db/lib/rls";
import { eq, ilike, and } from "drizzle-orm";
import { z } from "zod";


const createPersonSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Invalid email").optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const app = createApp().get("/people", async (c) => {
  try {
    const rls = rlsExecutor(c.get("userId"));
    const searchParams = new URL(c.req.url).searchParams;
    const search = searchParams.get("search");

    let query = db.select().from(people);

    const whereClause = search
      ? rls.where(people, ilike(people.name, `%${search}%`))
      : rls.where(people);

    query = query.where(whereClause) as typeof query;

    const result = await query.orderBy(people.name);

    return c.json(result);
  } catch (error) {
    console.error("Error fetching people:", error);
    return c.json({ error: "Failed to fetch people" }, 500);
  }
}).post("/people", async (c) => {
  try {
    const body = await c.req.json();
    const validation = createPersonSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        { error: "Invalid input", details: validation.error.issues },
        400
      );
    }

    const { name, email, metadata } = validation.data;
    const rls = rlsExecutor(c.get("userId"));

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
      return c.json(existing[0]);
    }

    const [newPerson] = await db
      .insert(people)
      .values(rls.values({
        name,
        email: email || null,
        metadata: metadata || {},
      }))
      .returning();

    return c.json(newPerson, 201);
  } catch (error) {
    console.error("Error creating person:", error);
    return c.json({ error: "Failed to create person" }, 500);
  }
}).delete("/people", async (c) => {
  try {
    const searchParams = new URL(c.req.url).searchParams;
    const personId = searchParams.get("id");

    if (!personId) {
      return c.json({ error: "Person ID is required" }, 400);
    }

    const rls = rlsExecutor(c.get("userId"));

    const result = await db
      .delete(people)
      .where(rls.where(people, eq(people.id, personId)))
      .returning();

    if (result.length === 0) {
      return c.json({ error: "Person not found" }, 404);
    }

    return c.json({ success: true, deleted: result[0] });
  } catch (error) {
    console.error("Error deleting person:", error);
    return c.json({ error: "Failed to delete person" }, 500);
  }
});

export default app;
