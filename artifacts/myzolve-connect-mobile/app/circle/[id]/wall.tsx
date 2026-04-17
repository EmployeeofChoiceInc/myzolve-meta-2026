import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Alert, Modal, Pressable, View } from "react-native";
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
import { useColors } from "@/hooks/useColors";
import { useCirclePosts, useCreateCirclePost } from "@/lib/postApi";

export default function WallScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const circleId = Number(params.id);
  const { data: posts, isLoading, refetch, isRefetching } = useCirclePosts(circleId);
  const create = useCreateCirclePost(circleId);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  function submit() {
    if (body.trim().length < 1) {
      Alert.alert("Add a note", "Share what's on your heart.");
      return;
    }
    create.mutate(
      { title: title.trim() || undefined, body: body.trim() },
      {
        onSuccess: () => {
          setTitle("");
          setBody("");
          setOpen(false);
        },
        onError: () => Alert.alert("Couldn't post", "Please try again."),
      }
    );
  }

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
                  <Avatar name={p.authorName} size={36} />
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
              </Card>
            ))}
          </View>
        )}
      </Screen>

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
            <Pressable onPress={() => setOpen(false)}>
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
            <Button
              title="Post to the wall"
              onPress={submit}
              loading={create.isPending}
              icon="send"
              style={{ marginTop: 8 }}
            />
            <Row gap={8} style={{ marginTop: 12 }}>
              <Feather name="info" size={14} color={c.mutedForeground} />
              <AppText variant="caption" color={c.mutedForeground} style={{ flex: 1 }}>
                Image uploads are coming to mobile soon.
              </AppText>
            </Row>
          </KeyboardAwareScrollView>
        </View>
      </Modal>
    </>
  );
}
