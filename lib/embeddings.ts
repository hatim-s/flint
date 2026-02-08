import { z } from "zod";
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });

// Voyage AI configuration
const VOYAGE_API_KEY = process.env.VOYAGEAI_API_KEY;

if (!VOYAGE_API_KEY) {
  throw new Error("VOYAGEAI_API_KEY environment variable is not set");
}

const VOYAGE_API_URL = "https://api.voyageai.com/v1";

// Voyage AI models
const VOYAGE_MODELS = {
  voyage3Lite: "voyage-3-lite",
  voyage3: "voyage-3",
  voyage2: "voyage-2",
} as const;

type VoyageModel = (typeof VOYAGE_MODELS)[keyof typeof VOYAGE_MODELS];

// Embedding response schema
const EmbeddingResponseSchema = z.object({
  object: z.literal("list"),
  data: z.array(
    z.object({
      embedding: z.array(z.number()),
      index: z.number(),
    })
  ),
  model: z.string(),
  usage: z.object({
    total_tokens: z.number(),
  }),
});

type EmbeddingResponse = z.infer<typeof EmbeddingResponseSchema>;

// Input validation schema
const EmbeddingRequestSchema = z.object({
  model: z.enum(["voyage-3-lite", "voyage-3", "voyage-2"]),
  input: z.string(),
  input_type: z.enum(["document", "query"]).optional(),
});

type EmbeddingRequest = z.infer<typeof EmbeddingRequestSchema>;

/**
 * Generate embedding vector from text using Voyage AI
 * 
 * @param text - The text to generate embedding for (max 4000 chars for voyage-3-lite)
 * @param model - The Voyage AI model to use (default: voyage-3-lite)
 * @returns Promise<number[]> - The embedding vector
 */
async function getEmbedding(
  text: string,
  model: VoyageModel = VOYAGE_MODELS.voyage3Lite
): Promise<number[]> {
  // Truncate text to 4000 characters to stay within token limits
  const truncatedText = text.slice(0, 4000);

  // Validate input
  const input: EmbeddingRequest = {
    model,
    input: truncatedText,
  };

  EmbeddingRequestSchema.parse(input);

  try {
    const response = await fetch(`${VOYAGE_API_URL}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${VOYAGE_API_KEY}`,
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Voyage AI API error: ${response.status} - ${errorText}`
      );
    }

    const data = await response.json();
    const validatedData = EmbeddingResponseSchema.parse(data);

    // Return the first (and only) embedding vector
    const firstEmbedding = validatedData.data[0];
    if (!firstEmbedding) {
      throw new Error("No embedding returned from Voyage AI");
    }

    return firstEmbedding.embedding;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Voyage AI validation error:", error.issues);
      throw new Error("Invalid embedding request");
    }

    console.error("Error generating embedding with Voyage AI:", error);
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * 
 * @param texts - Array of texts to generate embeddings for
 * @param model - The Voyage AI model to use (default: voyage-3-lite)
 * @returns Promise<number[][]> - Array of embedding vectors
 */
async function getEmbeddings(
  texts: string[],
  model: VoyageModel = VOYAGE_MODELS.voyage3Lite
): Promise<number[][]> {
  // Voyage AI supports batch processing (up to 128 documents)
  const batchSize = 128;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    // Use input_type: "document" for batch processing
    const response = await fetch(`${VOYAGE_API_URL}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        input: batch.map((t) => t.slice(0, 4000)),
        input_type: "document",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Voyage AI batch API error: ${response.status} - ${errorText}`
      );
    }

    const data = await response.json();
    const validatedData = EmbeddingResponseSchema.parse(data);

    const batchEmbeddings = validatedData.data.map((item) => item.embedding);
    allEmbeddings.push(...batchEmbeddings);
  }

  return allEmbeddings;
}

/**
 * Calculate cosine similarity between two vectors
 * 
 * @param vecA - First vector
 * @param vecB - Second vector
 * @returns number - Cosine similarity score (-1 to 1, higher is more similar)
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i];
    const b = vecB[i];
    if (a !== undefined && b !== undefined) {
      dotProduct += a * b;
      normA += a * a;
      normB += b * b;
    }
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

export {
  VOYAGE_MODELS,
  getEmbedding,
  getEmbeddings,
  cosineSimilarity,
};

export type {
  VoyageModel,
  EmbeddingResponse,
  EmbeddingRequest,
};
