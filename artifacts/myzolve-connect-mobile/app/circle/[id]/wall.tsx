import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
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
import { Screen } from "@/components/Screen";
import { ImageViewer } from "@/components/ImageViewer";
import { useColors } from "@/hooks/useColors";
import {
  useCirclePosts,
  useCreateCirclePost,
  useCircleMediaUpload,
  MAX_POST_IMAGE_BYTES,
  type LocalPostImage,
} from "@/lib/postApi";

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
  objectPath,
  token,
  onOpen,
}: {
  objectPath: string;
  token: string | null;
  onOpen: () => void;
}) {
  const c = useColors();
  const uri = objectPathToUrl(objectPath);
  if (!uri || !token) {
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
        {!token ? <ActivityIndicator color={c.mutedForeground} /> : null}
      </View>
    );
  }

  const headers = { Authorization: `Bearer ${token}` };

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="imagebutton"
      accessibilityLabel="View photo full screen"
    >
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
    default:
      return "image/jpeg";
  }
}

function inferFileName(asset: ImagePicker.ImagePickerAsset, contentType: string): string {
  if (asset.fileName) return asset.fileName;
  const extFromType = contentType.split("/")[1] ?? "jpg";
  const tail = asset.uri.split("/").pop() ?? `photo.${extFromType}`;
  return tail.includes(".") ? tail : `${tail}.${extFromType}`;
}

export default function WallScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const circleId = Number(params.id);
  const { data: posts, isLoading, refetch, isRefetching } = useCirclePosts(circleId);
  const create = useCreateCirclePost(circleId);
  const upload = useCircleMediaUpload(circleId);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [image, setImage] = useState<LocalPostImage | null>(null);

  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getToken()
      .then((t) => {
        if (alive) setToken(t ?? null);
      })
      .catch(() => {
        if (alive) setToken(null);
      });
    return () => {
      alive = false;
    };
  }, [getToken]);

  const photoItems = useMemo(() => {
    if (!posts || !token)
      return [] as { uri: string; headers: Record<string, string>; postId: number }[];
    const headers = { Authorization: `Bearer ${token}` };
    return posts
      .filter((p) => !!p.imageObjectPath)
      .map((p) => {
        const uri = objectPathToUrl(p.imageObjectPath!)!;
        return { uri, headers, postId: p.id };
      });
  }, [posts, token]);

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const photoIndexByPostId = useMemo(() => {
    const map = new Map<number, number>();
    photoItems.forEach((p, i) => map.set(p.postId, i));
    return map;
  }, [photoItems]);
  const openPhoto = (postId: number) => {
    const idx = photoIndexByPostId.get(postId);
    if (idx !== undefined) setViewerIndex(idx);
  };

  function resetComposer() {
    setTitle("");
    setBody("");
    setImage(null);
  }

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Photo access needed",
        "Allow photo library access in Settings to attach images.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: false,
      exif: false,
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    const contentType = inferContentType(asset);
    if (!contentType.startsWith("image/")) {
      Alert.alert("Unsupported file", "Please pick an image.");
      return;
    }
    const size = asset.fileSize ?? 0;
    if (size > MAX_POST_IMAGE_BYTES) {
      Alert.alert("Image too large", "Photos must be 10 MB or smaller.");
      return;
    }
    setImage({
      uri: asset.uri,
      name: inferFileName(asset, contentType),
      size,
      contentType,
    });
  }

  function submit() {
    if (body.trim().length < 1) {
      Alert.alert("Add a note", "Share what's on your heart.");
      return;
    }

    const finish = (imageObjectPath?: string) => {
      create.mutate(
        { title: title.trim() || undefined, body: body.trim(), imageObjectPath },
        {
          onSuccess: () => {
            resetComposer();
            setOpen(false);
          },
          onError: () => Alert.alert("Couldn't post", "Please try again."),
        },
      );
    };

    if (image) {
      upload.mutate(image, {
        onSuccess: (objectPath) => finish(objectPath),
        onError: () =>
          Alert.alert("Couldn't upload photo", "Please check your connection and try again."),
      });
    } else {
      finish();
    }
  }

  const isBusy = upload.isPending || create.isPending;

  return (
    <>
      <Stack.Screen options={{ title: "Wall" }} />
      <Screen
        contentStyle={{ paddingTop: insets.top + 12 }}
        refreshing={isRefetching}
        onRefresh={refetch}
      >
        <Row justify="space-between" align="center" style={{ marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <AppText variant="h1">Wall</AppText>
            <AppText color={c.mutedForeground} style={{ marginTop: 4 }}>
              Notes, gratitude and shared moments.
            </AppText>
          </View>
          <IconButton icon="edit-3" bg={c.primary} color="#fff" onPress={() => setOpen(true)} />
        </Row>

        {isLoading ? (
          <Skeleton height={150} />
        ) : !posts || posts.length === 0 ? (
          <Empty
            icon="edit-3"
            title="The wall is quiet"
            subtitle="Be the first to share a note."
            action={<Button title="Write something" onPress={() => setOpen(true)} />}
          />
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
                {p.title ? (
                  <AppText variant="title" style={{ marginBottom: 6 }}>
                    {p.title}
                  </AppText>
                ) : null}
                <AppText>{p.body}</AppText>
                {p.imageObjectPath ? (
                  <PostImage
                    objectPath={p.imageObjectPath}
                    token={token}
                    onOpen={() => openPhoto(p.id)}
                  />
                ) : null}
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
            <Field label="Title (optional)">
              <Input
                value={title}
                onChangeText={setTitle}
                placeholder="A short headline"
              />
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

            {image ? (
              <View style={{ marginBottom: 16 }}>
                <View style={{ position: "relative" }}>
                  <Image
                    source={{ uri: image.uri }}
                    style={{
                      width: "100%",
                      aspectRatio: 4 / 3,
                      borderRadius: 16,
                      backgroundColor: c.muted,
                    }}
                    contentFit="cover"
                  />
                  <Pressable
                    onPress={() => setImage(null)}
                    disabled={isBusy}
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      backgroundColor: "rgba(0,0,0,0.55)",
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Feather name="x" size={16} color="#fff" />
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={pickImage}
                disabled={isBusy}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingVertical: 10,
                  marginBottom: 8,
                }}
              >
                <Feather name="image" size={18} color={c.primary} />
                <AppText color={c.primary} weight="medium">
                  Add a photo
                </AppText>
              </Pressable>
            )}

            <Button
              title={upload.isPending ? "Uploading photo…" : "Post to the wall"}
              onPress={submit}
              loading={isBusy}
              icon="send"
              style={{ marginTop: 8 }}
            />
          </KeyboardAwareScrollView>
        </View>
      </Modal>
    </>
  );
}
