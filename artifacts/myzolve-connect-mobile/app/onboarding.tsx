import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getListCirclesQueryKey,
  useCreateCircle,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { AppText, Button, Field, Input, Row } from "@/components/UI";
import { useColors } from "@/hooks/useColors";
import { CIRCLE_TYPE_LABELS } from "@/lib/circleTypes";
import { setOnboardingAcknowledged } from "@/lib/onboardingFlag";

const TYPES = Object.entries(CIRCLE_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export default function OnboardingScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { userId } = useAuth();
  const create = useCreateCircle();
  const [name, setName] = useState("");
  const [type, setType] = useState("chosen_family");

  async function skip() {
    // Persist that this user has seen and acknowledged onboarding so
    // the Home screen no longer auto-redirects them back here.
    await setOnboardingAcknowledged(userId);
    router.replace("/(tabs)");
  }

  function submit() {
    if (name.trim().length < 2) {
      Alert.alert("A name helps", "Give your circle a name to begin.");
      return;
    }
    create.mutate(
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { name: name.trim(), circleType: type as any, currency: "USD" },
      },
      {
        onSuccess: async (newCircle) => {
          await setOnboardingAcknowledged(userId);
          qc.invalidateQueries({ queryKey: getListCirclesQueryKey() });
          router.replace(`/circle/${newCircle.id}`);
        },
        onError: () => Alert.alert("Couldn't create", "Please try again."),
      }
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <KeyboardAwareScrollView
        bottomOffset={40}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: insets.top + 32,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
          flexGrow: 1,
        }}
      >
        <AppText variant="h1">Welcome.</AppText>
        <AppText color={c.mutedForeground} style={{ marginTop: 6, marginBottom: 32 }}>
          MyZolve Connect is a private, warm space for the people you trust.
          Let's start your first circle.
        </AppText>

        <Field label="Circle name">
          <Input
            value={name}
            onChangeText={setName}
            placeholder="e.g. The Village"
            testID="input-name"
            autoFocus
          />
        </Field>

        <Field label="What kind of circle is this?">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {TYPES.map((t) => {
              const active = type === t.value;
              return (
                <Pressable
                  key={t.value}
                  onPress={() => setType(t.value)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 999,
                    backgroundColor: active ? c.primary : c.muted,
                  }}
                >
                  <AppText
                    color={active ? "#fff" : c.foreground}
                    weight="medium"
                    variant="caption"
                  >
                    {t.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <View style={{ flex: 1 }} />

        <Row gap={10} style={{ marginTop: 24 }}>
          <Button
            title="Skip for now"
            variant="ghost"
            onPress={skip}
            style={{ flex: 1 }}
            testID="button-onboarding-skip"
          />
          <Button
            title="Create circle"
            onPress={submit}
            loading={create.isPending}
            style={{ flex: 1.4 }}
            testID="button-onboarding-create"
          />
        </Row>
      </KeyboardAwareScrollView>
    </View>
  );
}
