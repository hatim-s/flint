"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Recording state for the voice recorder
 */
type RecordingState = "idle" | "recording" | "paused" | "stopped";

/**
 * Error types for voice recording
 */
type VoiceRecorderError =
  | "permission_denied"
  | "not_supported"
  | "no_audio_device"
  | "recording_failed"
  | null;

/**
 * Options for the voice recorder hook
 */
interface VoiceRecorderOptions {
  /** Audio mime type (default: 'audio/webm') */
  mimeType?: string;
  /** Audio bits per second (default: 128000) */
  audioBitsPerSecond?: number;
  /** Whether to enable audio level visualization (default: true) */
  enableVisualization?: boolean;
  /** FFT size for audio analysis (default: 256) */
  fftSize?: number;
}

/**
 * Return type for the useVoiceRecorder hook
 */
interface VoiceRecorderReturn {
  /** Current recording state */
  state: RecordingState;
  /** Whether currently recording (state === 'recording') */
  isRecording: boolean;
  /** Whether recording is paused (state === 'paused') */
  isPaused: boolean;
  /** Recording duration in seconds */
  duration: number;
  /** Formatted duration string (MM:SS) */
  formattedDuration: string;
  /** Audio blob after recording stops */
  audioBlob: Blob | null;
  /** Audio URL for playback */
  audioUrl: string | null;
  /** Current audio level (0-1) for visualization */
  audioLevel: number;
  /** Current error if any */
  error: VoiceRecorderError;
  /** User-friendly error message */
  errorMessage: string | null;
  /** Start recording */
  startRecording: () => Promise<boolean>;
  /** Pause recording */
  pauseRecording: () => void;
  /** Resume recording */
  resumeRecording: () => void;
  /** Stop recording and get audio blob */
  stopRecording: () => Promise<Blob | null>;
  /** Reset to initial state */
  reset: () => void;
  /** Check if browser supports recording */
  isSupported: boolean;
}

/**
 * Error messages for different error types
 */
const ERROR_MESSAGES: Record<NonNullable<VoiceRecorderError>, string> = {
  permission_denied:
    "Microphone access was denied. Please allow microphone access in your browser settings.",
  not_supported:
    "Voice recording is not supported in this browser. Please try Chrome, Firefox, or Safari.",
  no_audio_device:
    "No microphone found. Please connect a microphone and try again.",
  recording_failed: "Recording failed. Please try again.",
};

/**
 * Format seconds to MM:SS string
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Check if MediaRecorder is supported
 */
function isMediaRecorderSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "MediaRecorder" in window &&
    "mediaDevices" in navigator &&
    "getUserMedia" in navigator.mediaDevices
  );
}

/**
 * Get supported mime type for recording
 */
function getSupportedMimeType(preferred: string): string {
  if (typeof window === "undefined") return preferred;

  const types = [
    preferred,
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
    "audio/mpeg",
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return "audio/webm"; // fallback
}

/**
 * Hook for browser-based audio recording with visualization support
 *
 * @example
 * ```tsx
 * const {
 *   isRecording,
 *   duration,
 *   formattedDuration,
 *   audioLevel,
 *   startRecording,
 *   stopRecording,
 *   audioBlob,
 * } = useVoiceRecorder();
 *
 * const handleRecord = async () => {
 *   if (isRecording) {
 *     const blob = await stopRecording();
 *     // Use blob for transcription
 *   } else {
 *     await startRecording();
 *   }
 * };
 * ```
 */
function useVoiceRecorder(
  options: VoiceRecorderOptions = {},
): VoiceRecorderReturn {
  const {
    mimeType = "audio/webm",
    audioBitsPerSecond = 128000,
    enableVisualization = true,
    fftSize = 256,
  } = options;

  // State
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<VoiceRecorderError>(null);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);

  // Check browser support
  const isSupported = isMediaRecorderSupported();

  /**
   * Clean up audio resources
   */
  const cleanupAudio = useCallback(() => {
    // Stop duration timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Clear analyser
    analyserRef.current = null;

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => void track.stop());
      streamRef.current = null;
    }

    // Clear media recorder
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore errors when stopping
        }
      }
      mediaRecorderRef.current = null;
    }

    // Reset audio level
    setAudioLevel(0);
  }, []);

  /**
   * Revoke old audio URL to prevent memory leaks
   */
  const revokeAudioUrl = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  }, [audioUrl]);

  /**
   * Update audio level visualization
   */
  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current || state !== "recording") {
      setAudioLevel(0);
      return;
    }

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average level
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] ?? 0;
    }
    const average = sum / dataArray.length / 255; // Normalize to 0-1
    setAudioLevel(average);

    // Continue animation loop
    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, [state]);

  /**
   * Start the duration timer
   */
  const startDurationTimer = useCallback(() => {
    startTimeRef.current = Date.now() - pausedDurationRef.current * 1000;

    durationIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setDuration(elapsed);
    }, 100);
  }, []);

  /**
   * Stop the duration timer
   */
  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  /**
   * Set up audio analysis for visualization
   */
  const setupAudioAnalysis = useCallback(
    (stream: MediaStream) => {
      if (!enableVisualization) return;

      try {
        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = fftSize;
        analyserRef.current.smoothingTimeConstant = 0.8;

        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);

        // Start visualization loop
        updateAudioLevel();
      } catch (err) {
        console.warn("Failed to set up audio visualization:", err);
      }
    },
    [enableVisualization, fftSize, updateAudioLevel],
  );

  /**
   * Start recording
   */
  const startRecording = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError("not_supported");
      return false;
    }

    setError(null);
    revokeAudioUrl();
    setAudioBlob(null);
    chunksRef.current = [];
    pausedDurationRef.current = 0;
    setDuration(0);

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Get supported mime type
      const supportedType = getSupportedMimeType(mimeType);

      // Create MediaRecorder
      const recorder = new MediaRecorder(stream, {
        mimeType: supportedType,
        audioBitsPerSecond,
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setError("recording_failed");
        cleanupAudio();
        setState("idle");
      };

      mediaRecorderRef.current = recorder;

      // Start recording
      recorder.start(1000); // Collect data every second
      setState("recording");

      // Start duration timer
      startDurationTimer();

      // Set up audio analysis
      setupAudioAnalysis(stream);

      return true;
    } catch (err) {
      console.error("Failed to start recording:", err);

      if (err instanceof DOMException) {
        if (
          err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError"
        ) {
          setError("permission_denied");
        } else if (err.name === "NotFoundError") {
          setError("no_audio_device");
        } else {
          setError("recording_failed");
        }
      } else {
        setError("recording_failed");
      }

      cleanupAudio();
      return false;
    }
  }, [
    isSupported,
    mimeType,
    audioBitsPerSecond,
    revokeAudioUrl,
    cleanupAudio,
    startDurationTimer,
    setupAudioAnalysis,
  ]);

  /**
   * Pause recording
   */
  const pauseRecording = useCallback(() => {
    if (!mediaRecorderRef.current || state !== "recording") return;

    try {
      mediaRecorderRef.current.pause();
      pausedDurationRef.current = duration;
      stopDurationTimer();
      setState("paused");

      // Stop visualization during pause
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setAudioLevel(0);
    } catch (err) {
      console.error("Failed to pause recording:", err);
    }
  }, [state, duration, stopDurationTimer]);

  /**
   * Resume recording
   */
  const resumeRecording = useCallback(() => {
    if (!mediaRecorderRef.current || state !== "paused") return;

    try {
      mediaRecorderRef.current.resume();
      setState("recording");

      // Resume duration timer
      startDurationTimer();

      // Resume visualization
      updateAudioLevel();
    } catch (err) {
      console.error("Failed to resume recording:", err);
    }
  }, [state, startDurationTimer, updateAudioLevel]);

  /**
   * Stop recording and return audio blob
   */
  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    if (!mediaRecorderRef.current || state === "idle") {
      return null;
    }

    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) {
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        // Create blob from chunks
        const supportedType = getSupportedMimeType(mimeType);
        const blob = new Blob(chunksRef.current, { type: supportedType });

        setAudioBlob(blob);

        // Create URL for playback
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        setState("stopped");
        stopDurationTimer();
        cleanupAudio();

        resolve(blob);
      };

      // Stop recording
      try {
        if (recorder.state !== "inactive") {
          recorder.stop();
        }
      } catch {
        resolve(null);
      }
    });
  }, [state, mimeType, stopDurationTimer, cleanupAudio]);

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    cleanupAudio();
    revokeAudioUrl();
    setAudioBlob(null);
    setDuration(0);
    setError(null);
    setState("idle");
    chunksRef.current = [];
    pausedDurationRef.current = 0;
  }, [cleanupAudio, revokeAudioUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudio();
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [cleanupAudio, audioUrl]);

  return {
    state,
    isRecording: state === "recording",
    isPaused: state === "paused",
    duration,
    formattedDuration: formatDuration(duration),
    audioBlob,
    audioUrl,
    audioLevel,
    error,
    errorMessage: error ? ERROR_MESSAGES[error] : null,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    reset,
    isSupported,
  };
}

export { useVoiceRecorder };
export type {
  RecordingState,
  VoiceRecorderError,
  VoiceRecorderOptions,
  VoiceRecorderReturn,
};
