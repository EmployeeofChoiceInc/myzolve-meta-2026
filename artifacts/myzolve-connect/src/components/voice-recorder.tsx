import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAX_VOICE_MS = 120_000;

type Props = {
  onCapture: (file: File, durationMs: number) => void;
  disabled?: boolean;
};

function pickMimeType(): { mimeType: string; ext: string } | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates: { mimeType: string; ext: string }[] = [
    { mimeType: "audio/webm;codecs=opus", ext: "webm" },
    { mimeType: "audio/webm", ext: "webm" },
    { mimeType: "audio/mp4", ext: "m4a" },
    { mimeType: "audio/ogg;codecs=opus", ext: "ogg" },
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c.mimeType)) return c;
  }
  return null;
}

export function VoiceRecorder({ onCapture, disabled }: Props) {
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ file: File; durationMs: number } | null>(null);
  const [playing, setPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function cleanup() {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }

  useEffect(() => {
    return () => {
      cleanup();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Microphone is not supported in this browser.");
      return;
    }
    const picked = pickMimeType();
    if (!picked) {
      setError("Audio recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream, { mimeType: picked.mimeType });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: picked.mimeType });
        const file = new File([blob], `voice-note.${picked.ext}`, { type: picked.mimeType });
        const durationMs = Math.min(MAX_VOICE_MS, Date.now() - startTimeRef.current);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setPreviewFile({ file, durationMs });
        cleanup();
      };
      startTimeRef.current = Date.now();
      mr.start();
      setRecording(true);
      setElapsedMs(0);
      intervalRef.current = window.setInterval(() => {
        const e = Date.now() - startTimeRef.current;
        setElapsedMs(e);
        if (e >= MAX_VOICE_MS) {
          stop();
        }
      }, 200);
    } catch (e) {
      setError("Microphone permission was not granted.");
      cleanup();
    }
  }

  function stop() {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
    setRecording(false);
  }

  function discard() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewFile(null);
    setElapsedMs(0);
    setPlaying(false);
  }

  function send() {
    if (!previewFile) return;
    onCapture(previewFile.file, previewFile.durationMs);
    discard();
  }

  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
    } else {
      a.play().catch(() => {});
    }
  }

  if (previewUrl) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card p-3 flex items-center gap-3" data-testid="voice-preview">
        <Button type="button" size="icon" variant="ghost" className="rounded-full bg-muted" onClick={togglePlay}>
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
        <audio
          ref={audioRef}
          src={previewUrl}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          className="hidden"
        />
        <div className="flex-1 text-sm">
          <p className="font-medium">Voice note ready</p>
          <p className="text-xs text-muted-foreground">{formatDuration(previewFile?.durationMs ?? 0)}</p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={discard} className="text-muted-foreground">
          <Trash2 className="w-4 h-4 mr-1" /> Discard
        </Button>
        <Button type="button" size="sm" onClick={send} className="rounded-full" data-testid="voice-send">
          Add to post
        </Button>
      </div>
    );
  }

  if (recording) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 flex items-center gap-3" data-testid="voice-recording">
        <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
        <p className="text-sm font-medium flex-1">Recording — {formatDuration(elapsedMs)}</p>
        <Button type="button" size="sm" variant="outline" onClick={stop} className="rounded-full">
          <Square className="w-4 h-4 mr-1 fill-current" /> Stop
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full"
        onClick={start}
        disabled={disabled}
        data-testid="voice-record"
      >
        <Mic className="w-4 h-4 mr-2" /> Record voice note
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
