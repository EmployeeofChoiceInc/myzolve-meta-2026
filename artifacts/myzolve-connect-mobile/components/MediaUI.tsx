import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  AudioModule,
  RecordingPresets,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { useVideoPlayer, VideoView } from "expo-video";

import { AppText, Row } from "@/components/UI";
import { useColors } from "@/hooks/useColors";

export const MAX_VOICE_MS = 2 * 60 * 1000;
export const MAX_VIDEO_MS = 30 * 1000;

function formatClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/**
 * VoiceRecorder
 *
 * In-place mic recorder. Caps recordings at MAX_VOICE_MS and surfaces a
 * gentle, non-blocking permission explainer on denial. Calls `onComplete`
 * with a local file URI plus measured duration so the caller can upload.
 */
export function VoiceRecorder({
  onComplete,
  onCancel,
  testID,
}: {
  onComplete: (data: { uri: string; durationMs: number; mimeType: string; fileName: string }) => void;
  onCancel?: () => void;
  testID?: string;
}) {
  const c = useColors();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 200);

  const [phase, setPhase] = useState<"idle" | "recording" | "stopping">("idle");
  const [errorText, setErrorText] = useState<string | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const stopRequestedRef = useRef(false);

  // Auto-stop the moment we cross the 2 minute ceiling. iOS/Android both
  // round generously, so we add a tiny buffer to avoid stopping at 1:59.
  useEffect(() => {
    if (phase !== "recording") return;
    if (state.durationMillis >= MAX_VOICE_MS && !stopRequestedRef.current) {
      stopRequestedRef.current = true;
      void stop();
    }
  }, [state.durationMillis, phase]);

  async function start() {
    setErrorText(null);
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Microphone access needed",
          "Allow microphone access in Settings to record a voice note.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAtRef.current = Date.now();
      stopRequestedRef.current = false;
      setPhase("recording");
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : "Couldn't start recording.");
      setPhase("idle");
    }
  }

  async function stop() {
    if (phase !== "recording") return;
    setPhase("stopping");
    try {
      await recorder.stop();
      const uri = recorder.uri;
      const durationMs = Math.min(
        MAX_VOICE_MS,
        startedAtRef.current ? Date.now() - startedAtRef.current : state.durationMillis,
      );
      if (!uri) {
        setErrorText("The recording came back empty. Please try again.");
        setPhase("idle");
        return;
      }
      const mimeType = uri.endsWith(".3gp") ? "audio/3gpp" : "audio/mp4";
      const fileName = `voice-note-${Date.now()}.${uri.split(".").pop() ?? "m4a"}`;
      onComplete({ uri, durationMs, mimeType, fileName });
      setPhase("idle");
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : "Couldn't stop recording.");
      setPhase("idle");
    }
  }

  function discard() {
    if (phase === "recording") {
      void recorder.stop();
    }
    setPhase("idle");
    onCancel?.();
  }

  const elapsedSec = phase === "recording" ? state.durationMillis / 1000 : 0;
  const remaining = Math.max(0, MAX_VOICE_MS / 1000 - elapsedSec);

  return (
    <View
      testID={testID}
      style={{
        borderRadius: 16,
        backgroundColor: c.muted,
        padding: 14,
        gap: 10,
      }}
    >
      <Row gap={10} align="center" justify="space-between">
        <Row gap={10} align="center">
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: phase === "recording" ? c.destructive : c.primarySoft,
            }}
          >
            <Feather
              name={phase === "recording" ? "mic" : "mic"}
              size={18}
              color={phase === "recording" ? "#fff" : c.primary}
            />
          </View>
          <View>
            <AppText weight="semibold">
              {phase === "recording" ? "Recording…" : phase === "stopping" ? "Saving…" : "Voice note"}
            </AppText>
            <AppText variant="caption" color={c.mutedForeground}>
              {phase === "recording"
                ? `${formatClock(elapsedSec)} · ${formatClock(remaining)} left`
                : "Up to 2 minutes"}
            </AppText>
          </View>
        </Row>
        {phase === "idle" ? (
          <Pressable
            onPress={start}
            accessibilityRole="button"
            accessibilityLabel="Start recording voice note"
            testID={testID ? `${testID}-start` : undefined}
            style={{
              backgroundColor: c.primary,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 999,
            }}
          >
            <AppText color="#fff" weight="semibold">
              Record
            </AppText>
          </Pressable>
        ) : (
          <Row gap={8}>
            <Pressable
              onPress={discard}
              disabled={phase === "stopping"}
              accessibilityRole="button"
              accessibilityLabel="Discard recording"
              style={{
                backgroundColor: c.muted,
                borderColor: c.border,
                borderWidth: 1,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 999,
              }}
            >
              <AppText color={c.foreground}>Cancel</AppText>
            </Pressable>
            <Pressable
              onPress={stop}
              disabled={phase === "stopping"}
              accessibilityRole="button"
              accessibilityLabel="Stop recording"
              testID={testID ? `${testID}-stop` : undefined}
              style={{
                backgroundColor: c.destructive,
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 999,
              }}
            >
              <AppText color="#fff" weight="semibold">
                {phase === "stopping" ? "Saving…" : "Stop"}
              </AppText>
            </Pressable>
          </Row>
        )}
      </Row>
      {errorText ? (
        <AppText variant="caption" color={c.destructive}>
          {errorText}
        </AppText>
      ) : null}
    </View>
  );
}

/**
 * VoicePlayer
 *
 * Plays a remote voice note. Streams via the authenticated user-media
 * endpoint so we never bake bearer tokens into the audio URL itself —
 * the player's URL points at our own /api/storage proxy.
 */
export function VoicePlayer({
  uri,
  authHeader,
  durationMs,
  testID,
}: {
  uri: string;
  authHeader?: string | null;
  durationMs?: number | null;
  testID?: string;
}) {
  const c = useColors();
  const source = useMemo(
    () => ({
      uri,
      headers: authHeader ? { Authorization: authHeader } : undefined,
    }),
    [uri, authHeader],
  );
  const player = useAudioPlayer(source, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);

  const fallbackTotal = (durationMs ?? 0) / 1000;
  const total = status.duration > 0 ? status.duration : fallbackTotal;
  const current = Math.min(total, status.currentTime);
  const pct = total > 0 ? (current / total) * 100 : 0;

  function toggle() {
    if (status.playing) {
      player.pause();
    } else {
      // expo-audio resumes from where we paused; if we played to the end
      // we want to start over.
      if (total > 0 && current >= total - 0.25) {
        player.seekTo(0);
      }
      player.play();
    }
  }

  return (
    <View
      testID={testID}
      style={{
        borderRadius: 16,
        backgroundColor: c.muted,
        padding: 12,
        gap: 8,
      }}
    >
      <Row gap={12} align="center">
        <Pressable
          onPress={toggle}
          disabled={!status.isLoaded}
          accessibilityRole="button"
          accessibilityLabel={status.playing ? "Pause voice note" : "Play voice note"}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: c.primary,
            opacity: status.isLoaded ? 1 : 0.6,
          }}
        >
          {status.isLoaded ? (
            <Feather name={status.playing ? "pause" : "play"} size={18} color="#fff" />
          ) : (
            <ActivityIndicator color="#fff" size="small" />
          )}
        </Pressable>
        <View style={{ flex: 1 }}>
          <View
            style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: c.border,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${Math.min(100, Math.max(0, pct))}%`,
                height: "100%",
                backgroundColor: c.primary,
              }}
            />
          </View>
          <Row justify="space-between" style={{ marginTop: 4 }}>
            <AppText variant="caption" color={c.mutedForeground}>
              {formatClock(current)}
            </AppText>
            <AppText variant="caption" color={c.mutedForeground}>
              {formatClock(total)}
            </AppText>
          </Row>
        </View>
        <Feather name="mic" size={16} color={c.mutedForeground} />
      </Row>
    </View>
  );
}

/**
 * VideoPlayer
 *
 * Inline player for short video clips (≤30 s). Starts muted and looped so
 * autoplay works without surprising the user; tap once to unmute.
 */
export function CircleVideoPlayer({
  uri,
  authHeader,
  testID,
}: {
  uri: string;
  authHeader?: string | null;
  testID?: string;
}) {
  const c = useColors();
  const [muted, setMuted] = useState(true);
  const player = useVideoPlayer(
    { uri, headers: authHeader ? { Authorization: authHeader } : undefined },
    (p) => {
      p.loop = true;
      p.muted = true;
      p.play();
    },
  );

  function toggleMuted() {
    const next = !muted;
    setMuted(next);
    player.muted = next;
  }

  return (
    <View
      testID={testID}
      style={{
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor: "#000",
        position: "relative",
      }}
    >
      <VideoView
        player={player}
        style={{ width: "100%", aspectRatio: 4 / 3 }}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
      <Pressable
        onPress={toggleMuted}
        accessibilityRole="button"
        accessibilityLabel={muted ? "Unmute video" : "Mute video"}
        style={{
          position: "absolute",
          right: 10,
          bottom: 10,
          backgroundColor: "rgba(0,0,0,0.55)",
          borderRadius: 999,
          padding: 8,
        }}
      >
        <Feather name={muted ? "volume-x" : "volume-2"} size={16} color="#fff" />
      </Pressable>
    </View>
  );
}

/**
 * VideoPreview
 *
 * Lightweight composer-side preview for a freshly picked clip. We don't
 * need server auth headers here since the source is the local file URI.
 */
export function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <View style={{ borderRadius: 16, overflow: "hidden", backgroundColor: "#000" }}>
      <VideoView
        player={player}
        style={{ width: "100%", aspectRatio: 4 / 3 }}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
    </View>
  );
}

export const __mediaPlatform = Platform.OS;
