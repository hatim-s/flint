'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useVoiceRecorder } from '@/hooks';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { api } from '@/api/client';
import {
  Mic,
  MicOff,
  Square,
  X,
  Loader2,
  Play,
  Pause,
  RotateCcw,
  Check,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/components/ui/lib/utils';

/**
 * Voice capture state machine
 */
type VoiceCaptureState =
  | 'idle'
  | 'recording'
  | 'paused'
  | 'processing'
  | 'preview'
  | 'error';

/**
 * Props for the VoiceCapture component
 */
interface VoiceCaptureProps {
  /** Callback when transcription is ready to insert */
  onInsert: (text: string) => void;
  /** Optional class name for the floating button */
  className?: string;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Floating button position (for styling) */
  position?: 'inline' | 'floating';
}

/**
 * Audio waveform visualization component
 */
function AudioWaveform({
  audioLevel,
  isRecording,
}: {
  audioLevel: number;
  isRecording: boolean;
}) {
  const bars = 12;

  return (
    <div className="flex items-center justify-center gap-1 h-12">
      {Array.from({ length: bars }).map((_, i) => {
        // Create a wave effect based on position and audio level
        const offset = Math.abs(i - bars / 2) / (bars / 2);
        const baseHeight = isRecording ? 0.3 + audioLevel * 0.7 : 0.2;
        const height = Math.max(0.15, baseHeight * (1 - offset * 0.4));

        return (
          <div
            key={i}
            className={cn(
              'w-1 rounded-full transition-all duration-75',
              isRecording ? 'bg-red-500' : 'bg-muted-foreground/30'
            )}
            style={{
              height: `${height * 48}px`,
              transform: isRecording ? `scaleY(${0.8 + Math.random() * 0.4})` : 'scaleY(1)',
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * VoiceCapture - Voice recording button with transcription flow
 *
 * States:
 * - idle: Microphone button ready to record
 * - recording: Pulsing red indicator with timer and waveform
 * - processing: Spinner while transcribing
 * - preview: Modal showing transcription with edit capability
 * - error: Error state with retry option
 */
export function VoiceCapture({
  onInsert,
  className,
  disabled = false,
  position = 'inline',
}: VoiceCaptureProps) {
  // Voice recorder hook
  const {
    state: recorderState,
    isRecording,
    isPaused,
    formattedDuration,
    audioLevel,
    audioBlob,
    audioUrl,
    error: recorderError,
    errorMessage,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    reset,
    isSupported,
  } = useVoiceRecorder();

  // Component state
  const [captureState, setCaptureState] = useState<VoiceCaptureState>('idle');
  const [transcription, setTranscription] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync recorder state with capture state
  useEffect(() => {
    if (recorderError) {
      setCaptureState('error');
      setTranscriptionError(errorMessage);
    } else if (recorderState === 'recording') {
      setCaptureState('recording');
    } else if (recorderState === 'paused') {
      setCaptureState('paused');
    }
  }, [recorderState, recorderError, errorMessage]);

  /**
   * Handle starting a recording
   */
  const handleStart = useCallback(async () => {
    setTranscriptionError(null);
    setTranscription('');
    const success = await startRecording();
    if (!success) {
      setCaptureState('error');
    }
  }, [startRecording]);

  /**
   * Handle stopping and transcribing
   */
  const handleDone = useCallback(async () => {
    const blob = await stopRecording();
    if (!blob) {
      toast.error('Failed to capture audio');
      setCaptureState('error');
      return;
    }

    setCaptureState('processing');

    try {
      // Upload to transcription API
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');

      const response = await api.transcribe.$post({
        form: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Transcription failed');
      }

      const data = await response.json();
      setTranscription(data.text || '');
      setCaptureState('preview');
    } catch (err) {
      console.error('Transcription error:', err);
      setTranscriptionError(
        err instanceof Error ? err.message : 'Failed to transcribe audio'
      );
      setCaptureState('error');
    }
  }, [stopRecording]);

  /**
   * Handle canceling the recording
   */
  const handleCancel = useCallback(() => {
    reset();
    setCaptureState('idle');
    setTranscription('');
    setTranscriptionError(null);
  }, [reset]);

  /**
   * Handle inserting the transcription
   */
  const handleInsert = useCallback(() => {
    if (transcription.trim()) {
      onInsert(transcription.trim());
      toast.success('Transcription inserted');
    }
    handleCancel();
  }, [transcription, onInsert, handleCancel]);

  /**
   * Handle re-recording
   */
  const handleReRecord = useCallback(() => {
    reset();
    setTranscription('');
    setCaptureState('idle');
    // Start recording again after a short delay
    setTimeout(() => handleStart(), 100);
  }, [reset, handleStart]);

  /**
   * Handle audio playback
   */
  const togglePlayback = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  // Audio element event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => setIsPlaying(false);
    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [audioUrl]);

  // Not supported message
  if (!isSupported) {
    return (
      <Button
        variant="outline"
        size="icon"
        disabled
        className={cn(
          'relative',
          position === 'floating' &&
          'fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg',
          className
        )}
        title="Voice recording not supported in this browser"
      >
        <MicOff className="h-5 w-5 text-muted-foreground" />
      </Button>
    );
  }

  // Render based on state
  return (
    <>
      {/* Main Button - Idle State */}
      {captureState === 'idle' && (
        <Button
          variant={position === 'floating' ? 'default' : 'outline'}
          size={position === 'floating' ? 'lg' : 'icon'}
          onClick={handleStart}
          disabled={disabled}
          className={cn(
            'relative',
            position === 'floating' &&
            'fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow',
            className
          )}
          title="Start voice recording"
        >
          <Mic className={cn('h-5 w-5', position === 'floating' && 'h-6 w-6')} />
        </Button>
      )}

      {/* Recording/Paused State - Expanded UI */}
      {(captureState === 'recording' || captureState === 'paused') && (
        <div
          className={cn(
            'flex flex-col items-center gap-4 p-4 rounded-lg border bg-background',
            position === 'floating' &&
            'fixed bottom-6 right-6 shadow-xl min-w-[280px]',
            position === 'inline' && 'w-full max-w-sm mx-auto',
            className
          )}
        >
          {/* Pulsing Indicator */}
          <div className="relative">
            <div
              className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center',
                captureState === 'recording'
                  ? 'bg-red-500 animate-pulse'
                  : 'bg-yellow-500'
              )}
            >
              {captureState === 'recording' ? (
                <Mic className="h-8 w-8 text-white" />
              ) : (
                <Pause className="h-8 w-8 text-white" />
              )}
            </div>
            {captureState === 'recording' && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
              </span>
            )}
          </div>

          {/* Duration Timer */}
          <div className="text-2xl font-mono font-semibold tabular-nums">
            {formattedDuration}
          </div>

          {/* Audio Waveform */}
          <AudioWaveform
            audioLevel={audioLevel}
            isRecording={captureState === 'recording'}
          />

          {/* Controls */}
          <div className="flex items-center gap-3">
            {/* Cancel Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={handleCancel}
              title="Cancel recording"
            >
              <X className="h-4 w-4" />
            </Button>

            {/* Pause/Resume Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={captureState === 'recording' ? pauseRecording : resumeRecording}
              title={captureState === 'recording' ? 'Pause' : 'Resume'}
            >
              {captureState === 'recording' ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>

            {/* Done Button */}
            <Button
              variant="default"
              onClick={handleDone}
              className="gap-2"
              title="Finish recording"
            >
              <Square className="h-4 w-4" />
              Done
            </Button>
          </div>
        </div>
      )}

      {/* Processing State */}
      {captureState === 'processing' && (
        <div
          className={cn(
            'flex flex-col items-center gap-4 p-6 rounded-lg border bg-background',
            position === 'floating' &&
            'fixed bottom-6 right-6 shadow-xl min-w-[280px]',
            position === 'inline' && 'w-full max-w-sm mx-auto',
            className
          )}
        >
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <div className="text-center">
            <p className="font-medium">Transcribing...</p>
            <p className="text-sm text-muted-foreground">
              Converting speech to text
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {captureState === 'error' && (
        <div
          className={cn(
            'flex flex-col items-center gap-4 p-6 rounded-lg border border-destructive/50 bg-background',
            position === 'floating' &&
            'fixed bottom-6 right-6 shadow-xl min-w-[280px]',
            position === 'inline' && 'w-full max-w-sm mx-auto',
            className
          )}
        >
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <div className="text-center">
            <p className="font-medium text-destructive">Recording Error</p>
            <p className="text-sm text-muted-foreground">
              {transcriptionError || 'Something went wrong'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleStart}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog
        open={captureState === 'preview'}
        onOpenChange={(open) => {
          if (!open) handleCancel();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Voice Transcription</DialogTitle>
            <DialogDescription>
              Review and edit the transcription before inserting it into your note.
            </DialogDescription>
          </DialogHeader>

          {/* Audio Playback */}
          {audioUrl && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <Button
                variant="outline"
                size="icon"
                onClick={togglePlayback}
                className="shrink-0"
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              <div className="flex-1 text-sm text-muted-foreground">
                {isPlaying ? 'Playing audio...' : 'Click to play recording'}
              </div>
              <audio ref={audioRef} src={audioUrl} className="hidden" />
            </div>
          )}

          {/* Transcription Text */}
          <Textarea
            value={transcription}
            onChange={(e) => setTranscription(e.target.value)}
            placeholder="Transcription will appear here..."
            className="min-h-[150px] resize-none"
          />

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleReRecord}
              className="sm:mr-auto"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Re-record
            </Button>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              onClick={handleInsert}
              disabled={!transcription.trim()}
            >
              <Check className="h-4 w-4 mr-2" />
              Insert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
