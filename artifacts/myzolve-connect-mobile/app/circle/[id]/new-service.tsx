import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListServicePostsQueryKey,
  useCreateServicePost,
} from "@workspace/api-client-react";

import { AppText, Button, Field, IconButton, Input, Row } from "@/components/UI";
import { useColors } from "@/hooks/useColors";

const SERVICE_TYPES: { value: string; label: string }[] = [
  { value: "offer", label: "I'm offering" },
  { value: "request", label: "I need" },
];

const LOCATIONS = [
  { value: "in_person", label: "In person" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
];

const EXCHANGES = [
  { value: "free", label: "Free" },
  { value: "barter", label: "Barter" },
  { value: "paid_later", label: "Pay later" },
  { value: "open_to_discuss", label: "Open" },
];

export default function NewServiceScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const circleId = Number(params.id);
  const qc = useQueryClient();
  const create = useCreateServicePost();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [serviceType, setServiceType] = useState("offer");
  const [locationMode, setLocationMode] = useState("in_person");
  const [exchangePreference, setExchangePreference] = useState("free");

  function submit() {
    if (title.trim().length < 3) {
      Alert.alert("Add a title", "Give your service a short, clear title.");
      return;
    }
    create.mutate(
      {
        circleId,
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          serviceType: serviceType as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          locationMode: locationMode as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          exchangePreference: exchangePreference as any,
        },
      },
      {
        onSuccess: (post) => {
          qc.invalidateQueries({ queryKey: getListServicePostsQueryKey(circleId) });
          router.replace(`/service/${post.id}`);
        },
        onError: () => Alert.alert("Couldn't post", "Please try again."),
      }
    );
  }

  function chips(
    items: { value: string; label: string }[],
    value: string,
    onChange: (v: string) => void
  ) {
    return (
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {items.map((t) => {
          const active = value === t.value;
          return (
            <Pressable
              key={t.value}
              onPress={() => onChange(t.value)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: active ? c.primary : c.muted,
              }}
            >
              <AppText
                variant="caption"
                color={active ? "#fff" : c.foreground}
                weight="medium"
              >
                {t.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <Row
          justify="space-between"
          align="center"
          style={{ paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 8 }}
        >
          <IconButton icon="arrow-left" onPress={() => router.back()} />
          <AppText weight="semibold">Offer help</AppText>
          <View style={{ width: 40 }} />
        </Row>
        <KeyboardAwareScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
          bottomOffset={60}
          keyboardShouldPersistTaps="handled"
        >
          <AppText color={c.mutedForeground} style={{ marginBottom: 20 }}>
            Share a skill, time, or thing you can offer your circle.
          </AppText>

          <Field label="Type">{chips(SERVICE_TYPES, serviceType, setServiceType)}</Field>

          <Field label="Title">
            <Input
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Babysitting on weekends"
              testID="input-service-title"
            />
          </Field>

          <Field label="Location">{chips(LOCATIONS, locationMode, setLocationMode)}</Field>

          <Field label="Exchange">
            {chips(EXCHANGES, exchangePreference, setExchangePreference)}
          </Field>

          <Field label="Tell your circle more (optional)">
            <Input
              value={description}
              onChangeText={setDescription}
              placeholder="Describe what you're offering and any details…"
              multiline
              style={{ minHeight: 100, textAlignVertical: "top" }}
            />
          </Field>

          <Button
            title="Post service"
            onPress={submit}
            loading={create.isPending}
            icon="send"
            style={{ marginTop: 8 }}
          />
        </KeyboardAwareScrollView>
      </View>
    </>
  );
}
