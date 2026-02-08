import { z } from "zod";
import { getEmbedding } from "@/lib/embeddings";
import { createApp } from "../app";

const EmbedRequestSchema = z.object({
  text: z.string().min(1).max(4000),
  model: z.enum(["voyage-3-lite", "voyage-3", "voyage-2"]).optional(),
});

export type EmbedRequest = z.infer<typeof EmbedRequestSchema>;

const app = createApp().post("/embed", async (c) => {
  try {
    const body = await c.req.json();
    const input = EmbedRequestSchema.parse(body);

    const embedding = await getEmbedding(input.text, input.model);

    return c.json({
      embedding,
      model: input.model || "voyage-3-lite",
      usage: {
        total_tokens: Math.ceil(input.text.length / 4),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Invalid request", details: error.issues }, 400);
    }

    console.error("Error generating embedding:", error);
    return c.json({ error: "Failed to generate embedding" }, 500);
  }
});

export default app;
