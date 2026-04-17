import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { format } from "date-fns";
import { useGetMe } from "@workspace/api-client-react";

import { AppText, Avatar, IconButton, Row, Skeleton } from "@/components/UI";
import { useColors } from "@/hooks/useColors";
import {
  useMarkThreadRead,
  useMessageThread,
  useSendMessage,
} from "@/lib/messageApi";

export default function MessageThreadScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ userId: string }>();
  const partnerId = Number(params.userId);

  const { data: me } = useGetMe();
  const { data, isLoading } = useMessageThread(partnerId);
  const send = useSendMessage(partnerId);
  const markRead = useMarkThreadRead();

  const [text, setText] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (partnerId) markRead.mutate(partnerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [data?.messages.length]);

  function submit() {
    const body = text.trim();
    if (!body) return;
    send.mutate(body, {
      onSuccess: () => setText(""),
    });
  }

  const partner = data?.partner;
  const messages = data?.messages ?? [];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1, backgroundColor: c.background }}
      >
        <Row
          gap={10}
          align="center"
          style={{
            paddingHorizontal: 12,
            paddingTop: insets.top + 12,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: c.border,
          }}
        >
          <IconButton icon="arrow-left" onPress={() => router.back()} />
          {partner && (
            <Pressable
              onPress={() => router.push(`/profile/${partner.id}`)}
              style={{ flex: 1 }}
            >
              <Row gap={10} align="center">
                <Avatar
                  name={partner.displayName}
                  objectPath={partner.avatarObjectPath}
                  size={36}
                />
                <View style={{ flex: 1 }}>
                  <AppText weight="semibold" numberOfLines={1}>
                    {partner.displayName}
                  </AppText>
                </View>
              </Row>
            </Pressable>
          )}
        </Row>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {isLoading ? (
            <Skeleton height={80} />
          ) : messages.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <Feather name="message-circle" size={36} color={c.mutedForeground} />
              <AppText weight="medium" style={{ marginTop: 12 }}>
                No messages yet
              </AppText>
              <AppText variant="caption" color={c.mutedForeground} style={{ marginTop: 4 }}>
                Say hello to start the conversation.
              </AppText>
            </View>
          ) : (
            messages.map((msg) => {
              const mine = msg.senderUserId === me?.id;
              return (
                <View
                  key={msg.id}
                  style={{
                    alignSelf: mine ? "flex-end" : "flex-start",
                    backgroundColor: mine ? c.primary : c.muted,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 18,
                    borderBottomRightRadius: mine ? 4 : 18,
                    borderBottomLeftRadius: mine ? 18 : 4,
                    maxWidth: "80%",
                  }}
                >
                  <AppText color={mine ? "#fff" : c.foreground}>{msg.body}</AppText>
                  <AppText
                    variant="caption"
                    color={mine ? "rgba(255,255,255,0.8)" : c.mutedForeground}
                    style={{ marginTop: 2, fontSize: 10 }}
                  >
                    {format(new Date(msg.createdAt), "h:mm a")}
                  </AppText>
                </View>
              );
            })
          )}
        </ScrollView>

        <Row
          gap={8}
          align="center"
          style={{
            padding: 12,
            paddingBottom: insets.bottom + 12,
            borderTopWidth: 1,
            borderTopColor: c.border,
            backgroundColor: c.card,
          }}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Write a message…"
            placeholderTextColor={c.mutedForeground}
            multiline
            style={{
              flex: 1,
              backgroundColor: c.muted,
              borderRadius: 22,
              paddingHorizontal: 16,
              paddingVertical: 10,
              fontSize: 15,
              color: c.foreground,
              maxHeight: 120,
              fontFamily: "PlusJakartaSans_400Regular",
            }}
            testID="input-message"
          />
          <Pressable
            onPress={submit}
            disabled={!text.trim() || send.isPending}
            testID="button-send"
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: text.trim() ? c.primary : c.muted,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="send" size={18} color={text.trim() ? "#fff" : c.mutedForeground} />
          </Pressable>
        </Row>
      </KeyboardAvoidingView>
    </>
  );
}
