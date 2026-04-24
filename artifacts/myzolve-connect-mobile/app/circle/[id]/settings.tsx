import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  getDiscoverCirclesQueryKey,
  getGetCircleQueryKey,
  getListCirclesQueryKey,
  useGetCircle,
  useUpdateCircle,
} from "@workspace/api-client-react";

import {
  AppText,
  Button,
  Field,
  IconButton,
  Input,
  Row,
  Skeleton,
} from "@/components/UI";
import { useColors } from "@/hooks/useColors";

type PrivacyMode = "private" | "hidden" | "open" | "community";

const PRIVACY_OPTIONS: {
  value: PrivacyMode;
  label: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  {
    value: "private",
    label: "Private",
    description: "Invite-only. Not searchable.",
    icon: "lock",
  },
  {
    value: "hidden",
    label: "Hidden",
    description: "Link-only. Not searchable.",
    icon: "eye-off",
  },
  {
    value: "open",
    label: "Open",
    description: "Anyone can find and request to join.",
    icon: "globe",
  },
  {
    value: "community",
    label: "Community",
    description: "Discoverable. Admins review join requests.",
    icon: "users",
  },
];

export default function CircleSettingsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const circleId = Number(params.id);
  const qc = useQueryClient();

  const { data: circle, isLoading } = useGetCircle(circleId);
  const update = useUpdateCircle();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>("private");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (circle && !hydrated) {
      setName(circle.name ?? "");
      setDescription(circle.description ?? "");
      setPrivacyMode((circle.privacyMode as PrivacyMode) ?? "private");
      setHydrated(true);
    }
  }, [circle, hydrated]);

  const isAdmin =
    circle?.myRole === "owner" || circle?.myRole === "admin";

  function submit() {
    if (name.trim().length < 1) {
      Alert.alert("Add a name", "Your circle needs a name.");
      return;
    }
    update.mutate(
      {
        circleId,
        data: {
          name: name.trim(),
          description: description.trim(),
          privacyMode,
        },
      },
      {
        onSuccess: (updated) => {
          qc.setQueryData(getGetCircleQueryKey(circleId), updated);
          qc.invalidateQueries({ queryKey: getGetCircleQueryKey(circleId) });
          qc.invalidateQueries({ queryKey: getListCirclesQueryKey() });
          qc.invalidateQueries({ queryKey: getDiscoverCirclesQueryKey() });
          router.back();
        },
        onError: () =>
          Alert.alert("Couldn't save", "Please try again in a moment."),
      }
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <Row
          justify="space-between"
          align="center"
          style={{
            paddingHorizontal: 16,
            paddingTop: insets.top + 12,
            paddingBottom: 8,
          }}
        >
          <IconButton icon="arrow-left" onPress={() => router.back()} />
          <AppText weight="semibold">Circle Settings</AppText>
          <View style={{ width: 40 }} />
        </Row>

        <KeyboardAwareScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 40,
          }}
          bottomOffset={60}
          keyboardShouldPersistTaps="handled"
        >
          {isLoading || !circle ? (
            <Skeleton height={200} />
          ) : !isAdmin ? (
            <View
              style={{
                backgroundColor: c.card,
                borderColor: c.border,
                borderWidth: 1,
                borderRadius: 16,
                padding: 20,
                alignItems: "center",
              }}
            >
              <Feather name="lock" size={28} color={c.mutedForeground} />
              <AppText
                weight="semibold"
                style={{ marginTop: 10, textAlign: "center" }}
              >
                Admins only
              </AppText>
              <AppText
                color={c.mutedForeground}
                style={{ marginTop: 6, textAlign: "center" }}
              >
                Only the circle&apos;s owner or admins can change these settings.
              </AppText>
            </View>
          ) : (
            <>
              <AppText
                color={c.mutedForeground}
                style={{ marginBottom: 20 }}
              >
                Update your circle&apos;s name, description, and who can find it.
              </AppText>

              <Field label="Circle name">
                <Input
                  value={name}
                  onChangeText={setName}
                  placeholder="Our Family Circle"
                  testID="input-circle-name"
                />
              </Field>

              <Field label="Description (optional)">
                <Input
                  value={description}
                  onChangeText={setDescription}
                  placeholder="A brief description of your circle…"
                  multiline
                  style={{ minHeight: 90, textAlignVertical: "top" }}
                  testID="input-circle-description"
                />
              </Field>

              <Field label="Visibility">
                <View style={{ gap: 10 }}>
                  {PRIVACY_OPTIONS.map((opt) => {
                    const active = privacyMode === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => setPrivacyMode(opt.value)}
                        testID={`privacy-${opt.value}`}
                        style={({ pressed }) => ({
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 14,
                          padding: 14,
                          borderRadius: 14,
                          borderWidth: 1.5,
                          borderColor: active ? c.primary : c.border,
                          backgroundColor: active ? c.primarySoft : c.card,
                          opacity: pressed ? 0.85 : 1,
                        })}
                      >
                        <View
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 19,
                            backgroundColor: active ? c.primary : c.muted,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Feather
                            name={opt.icon}
                            size={18}
                            color={active ? "#fff" : c.foreground}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <AppText weight="semibold">{opt.label}</AppText>
                          <AppText
                            variant="caption"
                            color={c.mutedForeground}
                            style={{ marginTop: 2 }}
                          >
                            {opt.description}
                          </AppText>
                        </View>
                        {active && (
                          <Feather
                            name="check-circle"
                            size={20}
                            color={c.primary}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </Field>

              <Button
                title="Save changes"
                onPress={submit}
                loading={update.isPending}
                icon="check"
                testID="button-save-settings"
                style={{ marginTop: 8 }}
              />
            </>
          )}
        </KeyboardAwareScrollView>
      </View>
    </>
  );
}
