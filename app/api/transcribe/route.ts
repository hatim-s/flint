/**
 * Transcription API Route
 * 
 * POST /api/transcribe - Transcribe audio to text using Groq's Whisper API
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  transcribeAudio,
  validateAudioFile,
  MAX_FILE_SIZE,
  SUPPORTED_AUDIO_TYPES,
} from '@/lib/stt';

/**
 * POST /api/transcribe
 * Transcribe audio file to text
 * 
 * Request: multipart/form-data
 * - audio: Audio file (required, max 25MB)
 * - language: Language hint (optional, ISO 639-1 code e.g., 'en', 'es')
 * - prompt: Custom prompt for domain-specific terms (optional)
 * 
 * Response:
 * {
 *   text: string,
 *   language?: string,
 *   duration?: number
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if GROQ_API_KEY is configured
    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'your-groq-api-key-here') {
      console.error('GROQ_API_KEY is not configured');
      return NextResponse.json(
        { error: 'Transcription service not configured. Please set GROQ_API_KEY in environment variables.' },
        { status: 503 }
      );
    }

    // Parse multipart form data
    const formData = await req.formData();
    const audioFile = formData.get('audio');
    const language = formData.get('language') as string | null;
    const prompt = formData.get('prompt') as string | null;

    // Validate audio file exists
    if (!audioFile || !(audioFile instanceof File)) {
      return NextResponse.json(
        { 
          error: 'Missing audio file. Please upload an audio file in the "audio" field.',
          supportedTypes: SUPPORTED_AUDIO_TYPES,
          maxSize: `${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        },
        { status: 400 }
      );
    }

    // Get file metadata
    const fileSize = audioFile.size;
    const mimeType = audioFile.type || 'audio/webm'; // Default for webm recordings

    // Validate file size and type
    const validation = validateAudioFile(fileSize, mimeType);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Log transcription request (for debugging)
    console.log(`Transcribing audio: ${audioFile.name}, size: ${fileSize} bytes, type: ${mimeType}`);

    // Transcribe audio
    const result = await transcribeAudio(
      audioFile,
      {
        language: language ?? undefined,
        prompt: prompt ?? undefined,
        responseFormat: 'verbose_json',
      },
      3 // Max retries
    );

    // Log successful transcription
    console.log(`Transcription complete: ${result.text.length} characters, language: ${result.language || 'unknown'}`);

    return NextResponse.json({
      text: result.text,
      language: result.language,
      duration: result.duration,
    });
  } catch (error) {
    console.error('Transcription error:', error);

    // Handle specific error types
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check for rate limit errors
    if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
      return NextResponse.json(
        { error: 'Transcription rate limit exceeded. Please try again in a few moments.' },
        { status: 429 }
      );
    }

    // Check for API key errors
    if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('invalid_api_key')) {
      return NextResponse.json(
        { error: 'Invalid Groq API key. Please check your configuration.' },
        { status: 503 }
      );
    }

    // Generic error
    return NextResponse.json(
      { error: 'Failed to transcribe audio. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/transcribe
 * Returns API information and supported formats
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/transcribe',
    method: 'POST',
    contentType: 'multipart/form-data',
    fields: {
      audio: {
        type: 'File',
        required: true,
        description: 'Audio file to transcribe',
        supportedTypes: SUPPORTED_AUDIO_TYPES,
        maxSize: `${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      },
      language: {
        type: 'string',
        required: false,
        description: 'Language hint (ISO 639-1 code, e.g., "en", "es", "fr")',
      },
      prompt: {
        type: 'string',
        required: false,
        description: 'Custom prompt for domain-specific vocabulary',
      },
    },
    response: {
      text: 'Transcribed text',
      language: 'Detected or specified language',
      duration: 'Audio duration in seconds',
    },
  });
}
