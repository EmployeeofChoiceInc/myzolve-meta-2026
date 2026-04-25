import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@clerk/expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { formatDistanceToNow } from "date-fns";

import {
  AppText,
  Avatar,
  Button,
  Card,
  Empty,
  Field,
  IconButton,
  Input,
  Row,
  Skeleton,
} from "@/components/UI";
import {
  CircleVideoPlayer,
  VideoPreview,
  VoicePlayer,
  VoiceRecorder,
} from "@/components/MediaUI";
import { CircleWelcomeNudge } from "@/components/CircleWelcomeNudge";
import { Screen } from "@/components/Screen";
import { ImageViewer } from "@/components/ImageViewer";
import { CopilotAttribution, CopilotSwitcher } from "@/components/CopilotSwitcher";
import { PaywallSheet } from "@/components/PaywallSheet";
import { useColors } from "@/hooks/useColors";
import { useActingForInCircle } from "@/lib/copilot";
import { useSubscription } from "@/lib/revenuecat";
import {
  type AttachmentTarget,
  type CircleAttachment,
  FREE_PHOTO_CAP,
  type LocalMediaFile,
  type LocalPostImage,
  MAX_FREE_MEDIA_BYTES,
  MAX_PLUS_MEDIA_BYTES,
  PLUS_PHOTO_CAP,
  PlusRequiredError,
  recordEntityAttachment,
  uploadCircleMediaToStorage,
  useCircleMediaUpload,
  useCirclePosts,
  useCreateCirclePost,
  useEntityAttachments,
} from "@/lib/postApi";
import { safeBack } from "@/lib/safeBack";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

function objectPathToUrl(objectPath: string | null | undefined): string | undefined {
  if (!objectPath) return undefined;
  const stripped = objectPath.startsWith("/objects/")
    ? objectPath.slice("/objects/".length)
    : objectPath;
  return `${API_BASE}/api/storage/user-media/${stripped}`;
}

function PostImage({
  uri,
  token,
  onOpen,
}: {
  uri: string;
  token: string | null;
  onOpen: () => void;
}) {
  const c = useColors();
  if (!token) {
    return (
      <View
        style={{
          width: "100%",
          aspectRatio: 4 / 3,
          borderRadius: 16,
          backgroundColor: c.muted,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 8,
        }}
      >
        <ActivityIndicator color={c.mutedForeground} />
      </View>
    );
  }
  const headers = { Authorization: `Bearer ${token}` };
  return (
    <Pressable onPress={onOpen} accessibilityRole="imagebutton" accessibilityLabel="View photo">
      <Image
        source={{ uri, headers }}
        style={{
          width: "100%",
          aspectRatio: 4 / 3,
          borderRadius: 16,
          marginTop: 8,
          backgroundColor: c.muted,
        }}
        contentFit="cover"
        transition={150}
      />
    </Pressable>
  );
}

function inferContentType(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType) return asset.mimeType;
  const ext = (asset.fileName ?? asset.uri).split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    case "mov":
      return "video/quicktime";
    case "mp4":
      return "video/mp4";
    default:
      return "image/jpeg";
  }
}

function inferFileName(asset: ImagePicker.ImagePickerAsset, contentType: string): string {
  if (asset.fileName) return asset.fileName;
  const extFromType = contentType.split("/")[1] ?? "jpg";
  const tail = asset.uri.split("/").pop() ?? `media.${extFromType}`;
  return tail.includes(".") ? tail : `${tail}.${extFromType}`;
}

/**
 * Inline renderer for any extra attachments associated with a wall post
 * (photos beyond `imageObjectPath`, voice notes, short videos).
 */
function PostAttachments({
  circleId,
  postId,
  token,
  onOpenPhoto,
}: {
  circleId: number;
  postId: number;
  token: string | null;
  onOpenPhoto: (uri: string, headers: Record<string, string>) => void;
}) {
  const target: AttachmentTarget = useMemo(
    () => ({ circleId, entityType: "circle_post", entityId: postId }),
    [circleId, postId],
  );
  const { data } = useEntityAttachments(target);
  if (!data || data.length === 0) return null;
  const authHeader = token ? `Bearer ${token}` : null;
  return (
    <View style={{ gap: 8, marginTop: 8 }}>
      {data.map((a) => {
        const uri = a.downloadUrl ? `${API_BASE}${a.downloadUrl}` : undefined;
        if (!uri) return null;
        if (a.kind === "voice") {
          return (
            <VoicePlayer
              key={a.id}
              uri={uri}
              authHeader={authHeader}
              durationMs={a.durationMs}
              testID={`post-${postId}-voice-${a.id}`}
            />
          );
        }
        if (a.kind === "video") {
          return (
            <CircleVideoPlayer
              key={a.id}
              uri={uri}
              authHeader={authHeader}
              testID={`post-${postId}-video-${a.id}`}
            />
          );
        }
        // photo
        return (
          <PostImage
            key={a.id}
            uri={uri}
            token={token}
            onOpen={() =>
              onOpenPhoto(uri, token ? { Authorization: `Bearer ${token}` } : {})
            }
          />
        );
      })}
    </View>
  );
}

interface PendingVoice {
  uri: string;
  durationMs: number;
  mimeType: string;
  fileName: string;
}

interface PendingVideo {
  uri: string;
  fileName: string;
  contentType: string;
  size: number;
  durationMs: number;
  width?: number;
  height?: number;
}

export default function WallScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const circleId = Number(params.id);
  const { data: posts, isLoading, refetch, isRefetching } = useCirclePosts(circleId);
  const create = useCreateCirclePost(circleId);
  const upload = useCircleMediaUpload(circleId);
  const actingForUserId = useActingForInCircle(circleId);
  const { isPlus } = useSubscription();

  const photoCap = isPlus ? PLUS_PHOTO_CAP : FREE_PHOTO_CAP;
  const perFileCap = isPlus ? MAX_PLUS_MEDIA_BYTES : MAX_FREE_MEDIA_BYTES;

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<LocalPostImage[]>([]);
  const [voice, setVoice] = useState<PendingVoice | null>(null);
  const [video, setVideo] = useState<PendingVideo | null>(null);
  const [recording, setRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getToken()
      .then((t) => alive && setToken(t ?? null))
      .catch(() => alive && setToken(null));
    return () => {
      alive = false;
    };
  }, [getToken]);

  // The core wall feed still surfaces the legacy `imageObjectPath` photo so
  // we drop it into the same lightbox stream as new attachments. We render
  // attachments lazily per-post, so the lightbox here only spans legacy
  // photos to keep it simple.
  const photoItems = useMemo(() => {
    if (!posts || !token)
      return [] as { uri: string; headers: Record<string, string>; postId: number }[];
    const headers = { Authorization: `Bearer ${token}` };
    return posts
      .filter((p) => !!p.imageObjectPath)
      .map((p) => ({
        uri: objectPathToUrl(p.imageObjectPath!)!,
        headers,
        postId: p.id,
      }));
  }, [posts, token]);

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const photoIndexByPostId = useMemo(() => {
    const map = new Map<number, number>();
    photoItems.forEach((p, i) => map.set(p.postId, i));
    return map;
  }, [photoItems]);
  const openLegacyPhoto = (postId: number) => {
    const idx = photoIndexByPostId.get(postId);
    if (idx !== undefined) setViewerIndex(idx);
  };

  function resetComposer() {
    setTitle("");
    setBody("");
    setPhotos([]);
    setVoice(null);
    setVideo(null);
    setRecording(false);
  }

  async function pickPhotos() {
    if (photos.length >= photoCap) {
      if (!isPlus) {
        setPaywallOpen(true);
      } else {
        Alert.alert("Photo limit", `Up to ${photoCap} photos per post.`);
      }
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Photo access needed",
        "Allow photo library access in Settings to attach images.",
      );
      return;
    }
    const remaining = photoCap - photos.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: false,
      allowsMultipleSelection: remaining > 1,
      selectionLimit: remaining,
      exif: false,
    });
    if (result.canceled || result.assets.length === 0) return;
    const next: LocalPostImage[] = [];
    for (const asset of result.assets) {
      const contentType = inferContentType(asset);
      if (!contentType.startsWith("image/")) continue;
      const size = asset.fileSize ?? 0;
      if (size > perFileCap) {
        Alert.alert(
          "Image too large",
          isPlus ? "Photos must be 50 MB or smaller." : "Photos must be 10 MB or smaller.",
        );
        continue;
      }
      next.push({
        uri: asset.uri,
        name: inferFileName(asset, contentType),
        size,
        contentType,
      });
    }
    if (next.length === 0) return;
    setPhotos((cur) => [...cur, ...next].slice(0, photoCap));
  }

  function startVoice() {
    if (!isPlus) {
      setPaywallOpen(true);
      return;
    }
    if (video) {
      Alert.alert("One clip per post", "Remove the video first to add a voice note.");
      return;
    }
    setRecording(true);
  }

  async function pickVideo() {
    if (!isPlus) {
      setPaywallOpen(true);
      return;
    }
    if (voice) {
      Alert.alert("One clip per post", "Remove the voice note first to add a video.");
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Photo access needed",
        "Allow photo library access in Settings to attach videos.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      quality: 0.85,
      videoMaxDuration: 30,
      allowsEditing: true,
      exif: false,
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    const contentType = inferContentType(asset);
    if (!contentType.startsWith("video/")) {
      Alert.alert("Unsupported file", "Please pick a video.");
      return;
    }
    const durationMs = Math.round(asset.duration ?? 0);
    if (durationMs > 30_500) {
      Alert.alert("Clip too long", "Videos must be 30 seconds or shorter.");
      return;
    }
    const size = asset.fileSize ?? 0;
    if (size > perFileCap) {
      Alert.alert("Video too large", "Videos must be 50 MB or smaller.");
      return;
    }
    setVideo({
      uri: asset.uri,
      fileName: inferFileName(asset, contentType),
      contentType,
      size,
      durationMs,
      width: asset.width,
      height: asset.height,
    });
  }

  async function submit() {
    if (body.trim().length < 1) {
      Alert.alert("Add a note", "Share what's on your heart.");
      return;
    }
    if (recording) {
      Alert.alert("Finish recording", "Stop or cancel the voice note before posting.");
      return;
    }
    setSubmitting(true);
    // Upload all media to object storage BEFORE creating the post so a media
    // failure cannot leave behind a half-baked post that the user thinks
    // failed. If any pre-create upload fails we abort cleanly with no post.
    type PendingAttachment = {
      kind: "photo" | "voice" | "video";
      fileName: string;
      fileSize?: number;
      mimeType?: string;
      durationMs?: number;
      width?: number;
      height?: number;
      storageKey: string;
    };
    let primaryObjectPath: string | undefined;
    const pendingAttachments: PendingAttachment[] = [];
    try {
      if (photos.length > 0) {
        primaryObjectPath = await upload.mutateAsync(photos[0]);
      }
      for (let i = 1; i < photos.length; i++) {
        const p = photos[i];
        const objectPath = await uploadCircleMediaToStorage(circleId, {
          ...p,
          kind: "photo",
        });
        pendingAttachments.push({
          kind: "photo",
          fileName: p.name,
          fileSize: p.size,
          mimeType: p.contentType,
          storageKey: objectPath,
        });
      }
      if (voice) {
        const file: LocalMediaFile = {
          uri: voice.uri,
          name: voice.fileName,
          size: 0,
          contentType: voice.mimeType,
          kind: "voice",
          durationMs: voice.durationMs,
        };
        const objectPath = await uploadCircleMediaToStorage(circleId, file);
        pendingAttachments.push({
          kind: "voice",
          fileName: voice.fileName,
          mimeType: voice.mimeType,
          durationMs: voice.durationMs,
          storageKey: objectPath,
        });
      }
      if (video) {
        const file: LocalMediaFile = {
          uri: video.uri,
          name: video.fileName,
          size: video.size,
          contentType: video.contentType,
          kind: "video",
          durationMs: video.durationMs,
        };
        const objectPath = await uploadCircleMediaToStorage(circleId, file);
        pendingAttachments.push({
          kind: "video",
          fileName: video.fileName,
          fileSize: video.size,
          mimeType: video.contentType,
          durationMs: video.durationMs,
          width: video.width,
          height: video.height,
          storageKey: objectPath,
        });
      }
    } catch (err) {
      setSubmitting(false);
      if (err instanceof PlusRequiredError) {
        setPaywallOpen(true);
      } else {
        Alert.alert("Couldn't post", "Please try again.");
      }
      return;
    }

    let post: Awaited<ReturnType<typeof create.mutateAsync>>;
    try {
      post = await create.mutateAsync({
        title: title.trim() || undefined,
        body: body.trim(),
        imageObjectPath: primaryObjectPath,
        ...(actingForUserId ? { actingForUserId } : {}),
      });
    } catch (err) {
      setSubmitting(false);
      if (err instanceof PlusRequiredError) {
        setPaywallOpen(true);
      } else {
        Alert.alert("Couldn't post", "Please try again.");
      }
      return;
    }

    // Post is now persisted. Attachment-record failures should NOT pretend
    // the post itself failed; surface a partial-success message instead.
    const target: AttachmentTarget = {
      circleId,
      entityType: "circle_post",
      entityId: post.id,
    };
    let attachmentFailures = 0;
    let plusBlocked = false;
    for (const a of pendingAttachments) {
      try {
        await recordEntityAttachment(target, a);
      } catch (err) {
        attachmentFailures += 1;
        if (err instanceof PlusRequiredError) plusBlocked = true;
      }
    }

    resetComposer();
    setOpen(false);
    refetch();
    setSubmitting(false);
    if (attachmentFailures > 0) {
      if (plusBlocked) {
        setPaywallOpen(true);
      } else {
        Alert.alert(
          "Posted, but some media didn't attach",
          "Your post is live. You can try adding the media again from the post.",
        );
      }
    }
  }

  const isBusy = submitting || upload.isPending || create.isPending;

  return (
    <>
      <Stack.Screen options={{ title: "Wall" }} />
      <Screen
        contentStyle={{ paddingTop: insets.top + 12 }}
        refreshing={isRefetching}
        onRefresh={refetch}
      >
        <Row justify="space-between" align="center" style={{ marginBottom: 16 }}>
          <IconButton icon="arrow-left" onPress={() => safeBack(router)} />
          <IconButton icon="edit-3" bg={c.primary} color="#fff" onPress={() => setOpen(true)} />
        </Row>
        <View style={{ marginBottom: 16 }}>
          <AppText variant="h1">Wall</AppText>
          <AppText color={c.mutedForeground} style={{ marginTop: 4 }}>
            Notes, gratitude and shared moments.
          </AppText>
        </View>

        {isLoading ? (
          <Skeleton height={150} />
        ) : !posts || posts.length === 0 ? (
          <View>
            <CircleWelcomeNudge circleId={circleId} />
            <Empty
              icon="edit-3"
              title="The wall is quiet"
              subtitle="Be the first to share a note."
              action={<Button title="Write something" onPress={() => setOpen(true)} />}
            />
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {posts.map((p) => (
              <Card key={p.id}>
                <Row gap={10} align="center" style={{ marginBottom: 8 }}>
                  <Avatar
                    name={p.authorName}
                    objectPath={p.authorAvatarObjectPath}
                    size={36}
                  />
                  <View style={{ flex: 1 }}>
                    <AppText weight="semibold">{p.authorName}</AppText>
                    <AppText variant="caption" color={c.mutedForeground}>
                      {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
                    </AppText>
                  </View>
                </Row>
                {p.actingForUserId && p.actingForName ? (
                  <CopilotAttribution
                    helperName={p.authorName}
                    forName={p.actingForName}
                    review={p.copilotReview}
                  />
                ) : null}
                {p.title ? (
                  <AppText variant="title" style={{ marginBottom: 6 }}>
                    {p.title}
                  </AppText>
                ) : null}
                <AppText>{p.body}</AppText>
                {p.imageObjectPath ? (
                  <PostImage
                    uri={objectPathToUrl(p.imageObjectPath)!}
                    token={token}
                    onOpen={() => openLegacyPhoto(p.id)}
                  />
                ) : null}
                <PostAttachments
                  circleId={circleId}
                  postId={p.id}
                  token={token}
                  onOpenPhoto={() => {
                    /* no-op: per-post attachments aren't part of the legacy
                       lightbox set; tap-to-zoom can be added later */
                  }}
                />
              </Card>
            ))}
          </View>
        )}
      </Screen>

      <ImageViewer
        visible={viewerIndex !== null}
        images={photoItems}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
      />

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: c.background }}>
          <Row
            justify="space-between"
            style={{
              paddingHorizontal: 20,
              paddingTop: 20,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: c.border,
            }}
          >
            <Pressable
              onPress={() => {
                if (isBusy) return;
                resetComposer();
                setOpen(false);
              }}
            >
              <AppText color={c.mutedForeground}>Cancel</AppText>
            </Pressable>
            <AppText weight="semibold">New post</AppText>
            <View style={{ width: 50 }} />
          </Row>
          <KeyboardAwareScrollView
            contentContainerStyle={{ padding: 20 }}
            bottomOffset={40}
            keyboardShouldPersistTaps="handled"
          >
            <CopilotSwitcher circleId={circleId} testID="wall-copilot-switcher" />
            <Field label="Title (optional)">
              <Input value={title} onChangeText={setTitle} placeholder="A short headline" />
            </Field>
            <Field label="What would you like to share?">
              <Input
                value={body}
                onChangeText={setBody}
                placeholder="Write from the heart…"
                multiline
                style={{ minHeight: 120, textAlignVertical: "top" }}
              />
            </Field>

            {photos.length > 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {photos.map((p, i) => (
                  <View key={`${p.uri}-${i}`} style={{ position: "relative" }}>
                    <Image
                      source={{ uri: p.uri }}
                      style={{ width: 96, height: 96, borderRadius: 12, backgroundColor: c.muted }}
                      contentFit="cover"
                    />
                    <Pressable
                      onPress={() => setPhotos((cur) => cur.filter((_, idx) => idx !== i))}
                      disabled={isBusy}
                      style={{
                        position: "absolute",
                        top: 4,
                        right: 4,
                        backgroundColor: "rgba(0,0,0,0.55)",
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Feather name="x" size={12} color="#fff" />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            {voice ? (
              <View style={{ marginBottom: 12 }}>
                <VoicePlayer uri={voice.uri} durationMs={voice.durationMs} />
                <Pressable
                  onPress={() => setVoice(null)}
                  disabled={isBusy}
                  style={{ alignSelf: "flex-start", marginTop: 6, padding: 4 }}
                >
                  <AppText variant="caption" color={c.destructive}>
                    Remove voice note
                  </AppText>
                </Pressable>
              </View>
            ) : null}

            {recording ? (
              <View style={{ marginBottom: 12 }}>
                <VoiceRecorder
                  testID="wall-voice-recorder"
                  onComplete={(v) => {
                    setVoice(v);
                    setRecording(false);
                  }}
                  onCancel={() => setRecording(false)}
                />
              </View>
            ) : null}

            {video ? (
              <View style={{ marginBottom: 12 }}>
                <VideoPreview uri={video.uri} />
                <Pressable
                  onPress={() => setVideo(null)}
                  disabled={isBusy}
                  style={{ alignSelf: "flex-start", marginTop: 6, padding: 4 }}
                >
                  <AppText variant="caption" color={c.destructive}>
                    Remove video
                  </AppText>
                </Pressable>
              </View>
            ) : null}

            <Row gap={16} style={{ marginBottom: 8, flexWrap: "wrap" }}>
              <Pressable
                onPress={pickPhotos}
                disabled={isBusy}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 }}
                testID="wall-add-photo"
              >
                <Feather name="image" size={18} color={c.primary} />
                <AppText color={c.primary} weight="medium">
                  {photos.length > 0 ? `Add photo (${photos.length}/${photoCap})` : "Add photo"}
                </AppText>
              </Pressable>
              <Pressable
                onPress={voice ? undefined : startVoice}
                disabled={isBusy || !!voice || recording}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingVertical: 8,
                  opacity: voice || recording ? 0.5 : 1,
                }}
                testID="wall-add-voice"
              >
                <Feather name="mic" size={18} color={c.primary} />
                <AppText color={c.primary} weight="medium">
                  Voice note{!isPlus ? " · Plus" : ""}
                </AppText>
              </Pressable>
              <Pressable
                onPress={video ? undefined : pickVideo}
                disabled={isBusy || !!video}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingVertical: 8,
                  opacity: video ? 0.5 : 1,
                }}
                testID="wall-add-video"
              >
                <Feather name="video" size={18} color={c.primary} />
                <AppText color={c.primary} weight="medium">
                  Video{!isPlus ? " · Plus" : ""}
                </AppText>
              </Pressable>
            </Row>

            <Button
              title={
                upload.isPending || submitting
                  ? "Uploading…"
                  : create.isPending
                    ? "Posting…"
                    : "Post to the wall"
              }
              onPress={submit}
              loading={isBusy}
              icon="send"
              style={{ marginTop: 8 }}
              testID="wall-submit"
            />
          </KeyboardAwareScrollView>
        </View>
      </Modal>

      <PaywallSheet
        visible={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        onSubscribed={() => setPaywallOpen(false)}
      />
    </>
  );
}
