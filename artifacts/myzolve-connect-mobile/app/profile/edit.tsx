import { Feather } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  customFetch,
  getGetMeQueryKey,
  useGetMe,
} from "@workspace/api-client-react";

import {
  AppText,
  Button,
  Field,
  IconButton,
  Input,
  Row,
} from "@/components/UI";
import { useColors } from "@/hooks/useColors";

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "London (GMT)" },
];

type ProfileUpdatePayload = {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  timezone?: string;
  bio?: string;
  location?: string;
};

type MeResponse = {
  id: number;
  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
  timezone?: string | null;
  bio?: string | null;
  location?: string | null;
};

export default function EditProfileScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: me, isLoading } = useGetMe();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (me && !initialized) {
      setFirstName(me.firstName ?? "");
      setLastName(me.lastName ?? "");
      setDisplayName(me.displayName ?? "");
      setTimezone(me.timezone ?? "UTC");
      setBio((me as MeResponse).bio ?? "");
      setLocation((me as MeResponse).location ?? "");
      setInitialized(true);
    }
  }, [me, initialized]);

  const updateMe = useMutation({
    mutationFn: (data: ProfileUpdatePayload) =>
      customFetch<MeResponse>("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (updated) => {
      qc.setQueryData(getGetMeQueryKey(), updated);
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
    },
  });

  function submit() {
    const trimmedDisplay = displayName.trim();
    if (trimmedDisplay.length < 2) {
      Alert.alert(
        "Display name too short",
        "Your display name must be at least 2 characters."
      );
      return;
    }
    const payload: ProfileUpdatePayload = {
      displayName: trimmedDisplay,
      timezone,
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
      bio: bio.trim() || undefined,
      location: location.trim() || undefined,
    };
    updateMe.mutate(payload, {
      onSuccess: () => {
        Alert.alert("Profile updated", "Your changes have been saved.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      },
      onError: () => {
        Alert.alert("Couldn't save", "Please try again in a moment.");
      },
    });
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
          <AppText weight="semibold">Edit profile</AppText>
          <View style={{ width: 40 }} />
        </Row>

        <KeyboardAwareScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 40,
          }}
          bottomOffset={40}
          keyboardShouldPersistTaps="handled"
        >
          {isLoading && !initialized ? (
            <AppText color={c.mutedForeground}>Loading…</AppText>
          ) : (
            <>
              <Field label="Display name">
                <Input
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="How others see you"
                  testID="input-display-name"
                />
              </Field>

              <Field label="First name (optional)">
                <Input
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Jane"
                  testID="input-first-name"
                />
              </Field>

              <Field label="Last name (optional)">
                <Input
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Doe"
                  testID="input-last-name"
                />
              </Field>

              <Field label="Timezone">
                <View style={{ gap: 8 }}>
                  {TIMEZONES.map((tz) => {
                    const active = timezone === tz.value;
                    return (
                      <Pressable
                        key={tz.value}
                        onPress={() => setTimezone(tz.value)}
                        testID={`timezone-${tz.value}`}
                        style={({ pressed }) => ({
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: active ? c.primary : c.border,
                          backgroundColor: active ? c.primarySoft : c.card,
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                          opacity: pressed ? 0.85 : 1,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        })}
                      >
                        <AppText
                          weight={active ? "semibold" : "regular"}
                          color={active ? c.primary : c.foreground}
                        >
                          {tz.label}
                        </AppText>
                        {active ? (
                          <Feather name="check" size={16} color={c.primary} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </Field>

              <Field label="Bio (optional)">
                <Input
                  value={bio}
                  onChangeText={setBio}
                  placeholder="A little about yourself…"
                  multiline
                  maxLength={500}
                  style={{ minHeight: 96, textAlignVertical: "top" }}
                  testID="input-bio"
                />
              </Field>

              <Field label="Location (optional)">
                <Input
                  value={location}
                  onChangeText={setLocation}
                  placeholder="City, Country"
                  maxLength={200}
                  testID="input-location"
                />
              </Field>

              <Button
                title="Save changes"
                icon="check"
                onPress={submit}
                loading={updateMe.isPending}
                testID="button-save-profile"
                style={{ marginTop: 8 }}
              />
            </>
          )}
        </KeyboardAwareScrollView>
      </View>
    </>
  );
}
