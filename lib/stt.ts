import Groq from 'groq-sdk';

/**
 * Groq SDK client for speech-to-text transcription
 * Uses Whisper large-v3 model for high-quality transcription
 */

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Supported audio MIME types for transcription
 */
export const SUPPORTED_AUDIO_TYPES = [
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/ogg',
  'audio/ogg;codecs=opus',
  'audio/mp3',
  'audio/mpeg',
  'audio/mp4',
  'audio/m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
] as const;

/**
 * Maximum file size for transcription (25MB)
 */
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB in bytes

/**
 * Response from transcription API
 */
export interface TranscriptionResult {
  /** Transcribed text */
  text: string;
  /** Detected or specified language */
  language?: string;
  /** Duration of audio in seconds (if available) */
  duration?: number;
}

/**
 * Options for transcription
 */
export interface TranscribeOptions {
  /** Language hint for better accuracy (ISO 639-1 code, e.g., 'en', 'es', 'fr') */
  language?: string;
  /** Custom prompt to guide the model (useful for domain-specific terms) */
  prompt?: string;
  /** Response format: 'json' | 'text' | 'verbose_json' */
  responseFormat?: 'json' | 'text' | 'verbose_json';
}

/**
 * Check if a MIME type is supported for transcription
 */
export function isSupportedAudioType(mimeType: string): boolean {
  // Extract base MIME type without codec info
  const baseMimeType = mimeType.split(';')[0]?.toLowerCase();
  return SUPPORTED_AUDIO_TYPES.some((type) => {
    const baseType = type.split(';')[0]?.toLowerCase();
    return baseMimeType === baseType;
  });
}

/**
 * Validate audio file before transcription
 */
export function validateAudioFile(
  size: number,
  mimeType: string
): { valid: boolean; error?: string } {
  if (size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed (${MAX_FILE_SIZE / (1024 * 1024)}MB)`,
    };
  }

  if (!isSupportedAudioType(mimeType)) {
    return {
      valid: false,
      error: `Unsupported audio type: ${mimeType}. Supported types: ${SUPPORTED_AUDIO_TYPES.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Transcribe audio using Groq's Whisper API with retry logic
 * 
 * @param audioFile - Audio file as a File or Blob
 * @param options - Transcription options
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Transcription result with text and metadata
 * @throws Error if transcription fails after all retries
 * 
 * @example
 * ```ts
 * const blob = await recorder.stopRecording();
 * const file = new File([blob], 'recording.webm', { type: 'audio/webm' });
 * const result = await transcribeAudio(file);
 * console.log(result.text);
 * ```
 */
export async function transcribeAudio(
  audioFile: File,
  options: TranscribeOptions = {},
  maxRetries = 3
): Promise<TranscriptionResult> {
  const { language, prompt, responseFormat = 'verbose_json' } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Exponential backoff: wait 2^attempt * 1000ms before retry
      if (attempt > 0) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.log(`Retrying transcription (attempt ${attempt + 1}/${maxRetries}) after ${backoffMs}ms`);
        await sleep(backoffMs);
      }

      const transcription = await groq.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-large-v3',
        language,
        prompt,
        response_format: responseFormat,
      });

      // Handle different response formats
      if (responseFormat === 'text') {
        return {
          text: transcription as unknown as string,
        };
      }

      // For JSON and verbose_json formats
      const response = transcription as unknown as {
        text: string;
        language?: string;
        duration?: number;
      };

      return {
        text: response.text,
        language: response.language,
        duration: response.duration,
      };
    } catch (error) {
      lastError = error as Error;
      
      // Check if it's a rate limit error (429) or server error (5xx)
      const isRetryable = 
        lastError.message.includes('429') || 
        lastError.message.includes('rate limit') ||
        lastError.message.includes('500') ||
        lastError.message.includes('502') ||
        lastError.message.includes('503') ||
        lastError.message.includes('504');

      if (!isRetryable) {
        // Non-retryable error, throw immediately
        throw lastError;
      }

      console.error(`Transcription attempt ${attempt + 1} failed:`, lastError.message);
    }
  }

  // All retries exhausted
  throw new Error(
    `Transcription failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
  );
}

export { groq };
