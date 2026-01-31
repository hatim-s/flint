// lib/transcription.ts
import Groq from 'groq-sdk';
import { Uploadable } from 'groq-sdk/uploads.mjs';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function transcribeAudio(audioBlob: Uploadable): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob as unknown as Blob, 'audio.webm');
  formData.append('model', 'whisper-large-v3');
  formData.append('response_format', 'text');
  
  const transcription = await groq.audio.transcriptions.create({
    file: audioBlob,
    model: 'whisper-large-v3',
  });
  
  return transcription.text;
}