import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getEmbedding } from "@/lib/embeddings";
import { z } from "zod";

// Validation schema for request body
const EmbedRequestSchema = z.object({
  text: z.string().min(1).max(4000),
  model: z.enum(["voyage-3-lite", "voyage-3", "voyage-2"]).optional(),
});

export type EmbedRequest = z.infer<typeof EmbedRequestSchema>;

/**
 * POST /api/embed
 * Generate embedding for text using Voyage AI
 * 
 * Request Body:
 * {
 *   text: string (required, max 4000 chars)
 *   model?: "voyage-3-lite" | "voyage-3" | "voyage-2" (optional)
 * }
 * 
 * Response:
 * {
 *   embedding: number[],
 *   model: string,
 *   usage: { total_tokens: number }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request body
    const body = await req.json();
    const input = EmbedRequestSchema.parse(body);

    // Generate embedding
    const embedding = await getEmbedding(
      input.text,
      input.model as any
    );

    return NextResponse.json({
      embedding,
      model: input.model || "voyage-3-lite",
      usage: {
        total_tokens: Math.ceil(input.text.length / 4), // Approximate
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error generating embedding:", error);
    return NextResponse.json(
      { error: "Failed to generate embedding" },
      { status: 500 }
    );
  }
}
