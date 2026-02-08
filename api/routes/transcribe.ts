import { createApp, authMiddleware } from "../app";
import {
  transcribeAudio,
  validateAudioFile,
  MAX_FILE_SIZE,
  SUPPORTED_AUDIO_TYPES,
} from "@/lib/stt";
import { config } from "dotenv";

config({ path: ".env.local" });

const app = createApp().post("/transcribe", async (c) => {
  try {
    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === "your-groq-api-key-here") {
      console.error("GROQ_API_KEY is not configured");
      return c.json(
        {
          error:
            "Transcription service not configured. Please set GROQ_API_KEY in environment variables.",
        },
        503
      );
    }

    const formData = await c.req.raw.formData();
    const audioFile = formData.get("audio");
    const language = formData.get("language") as string | null;
    const prompt = formData.get("prompt") as string | null;

    if (!audioFile || !(audioFile instanceof File)) {
      return c.json(
        {
          error: "Missing audio file. Please upload an audio file in the \"audio\" field.",
          supportedTypes: SUPPORTED_AUDIO_TYPES,
          maxSize: `${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        },
        400
      );
    }

    const fileSize = audioFile.size;
    const mimeType = audioFile.type || "audio/webm";

    const validation = validateAudioFile(fileSize, mimeType);
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }

    console.log(
      `Transcribing audio: ${audioFile.name}, size: ${fileSize} bytes, type: ${mimeType}`
    );

    const result = await transcribeAudio(
      audioFile,
      {
        language: language ?? undefined,
        prompt: prompt ?? undefined,
        responseFormat: "verbose_json",
      },
      3
    );

    console.log(
      `Transcription complete: ${result.text.length} characters, language: ${result.language || "unknown"}`
    );

    return c.json({
      text: result.text,
      language: result.language,
      duration: result.duration,
    });
  } catch (error) {
    console.error("Transcription error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
      return c.json(
        { error: "Transcription rate limit exceeded. Please try again in a few moments." },
        429
      );
    }

    if (
      errorMessage.includes("401") ||
      errorMessage.includes("Unauthorized") ||
      errorMessage.includes("invalid_api_key")
    ) {
      return c.json({ error: "Invalid Groq API key. Please check your configuration." }, 503);
    }

    return c.json(
      { error: "Failed to transcribe audio. Please try again." },
      500
    );
  }
}).get("/transcribe", async (c) => {
  return c.json({
    endpoint: "/api/transcribe",
    method: "POST",
    contentType: "multipart/form-data",
    fields: {
      audio: {
        type: "File",
        required: true,
        description: "Audio file to transcribe",
        supportedTypes: SUPPORTED_AUDIO_TYPES,
        maxSize: `${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      },
      language: {
        type: "string",
        required: false,
        description: "Language hint (ISO 639-1 code, e.g., \"en\", \"es\", \"fr\")",
      },
      prompt: {
        type: "string",
        required: false,
        description: "Custom prompt for domain-specific vocabulary",
      },
    },
    response: {
      text: "Transcribed text",
      language: "Detected or specified language",
      duration: "Audio duration in seconds",
    },
  });
});

export default app;
