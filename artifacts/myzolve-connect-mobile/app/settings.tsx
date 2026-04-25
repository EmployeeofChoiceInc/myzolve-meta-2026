import { Feather } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Image, Linking, Pressable, Switch, View } from "react-native";
import { useAuth } from "@clerk/expo";
import {
  getGetNotificationPreferencesQueryKey,
  useDeleteMe,
  useGetNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { AppText, Card, Row, Skeleton } from "@/components/UI";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";

const LABELS: Record<string, string> = {
  new_request: "New requests",
  support_received: "Support received",
  repayment_due: "Repayment reminders",
  repayment_received: "Repayments received",
  service_match: "Service matches",
  new_comment: "New comments",
  reaction_received: "Reactions",
  gratitude_received: "Gratitude notes",
  member_joined: "New members",
  circle_update: "Circle updates",
  dispute_opened: "Disputes opened",
  dispute_resolved: "Disputes resolved",
  care_calendar_reminder: "Care calendar reminders",
};

export default function SettingsScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const router = useRouter();
  const { signOut } = useAuth();
  const { data, isLoading } = useGetNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  const deleteMe = useDeleteMe();
  const [deleting, setDeleting] = useState(false);

  function toggle(notificationType: string, enabled: boolean) {
    update.mutate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { data: { preferences: [{ notificationType: notificationType as any, enabled }] } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetNotificationPreferencesQueryKey() });
        },
      },
    );
  }

  function confirmDelete() {
    Alert.alert(
      "Delete your account?",
      "This permanently deletes your MyZolve Connect account. You'll be signed out everywhere, your messages and notifications will be removed, and your name and profile photo will be wiped from circles you belong to. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: finalConfirmDelete,
        },
      ],
    );
  }

  function finalConfirmDelete() {
    Alert.alert(
      "Are you absolutely sure?",
      "There is no way to recover your account or its data after this.",
      [
        { text: "Keep my account", style: "cancel" },
        {
          text: "Yes, delete forever",
          style: "destructive",
          onPress: doDelete,
        },
      ],
    );
  }

  async function doDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteMe.mutateAsync();
      qc.clear();
      try {
        await signOut();
      } catch {
        // best-effort; the Clerk session is already invalid server-side
      }
      router.replace("/");
    } catch (err: unknown) {
      const e = err as { message?: string };
      Alert.alert(
        "Couldn't delete account",
        e?.message ??
          "Something went wrong. Please try again, or contact support if it keeps failing.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Settings" }} />
      <Screen>
        <AppText variant="h1">Settings</AppText>
        <AppText color={c.mutedForeground} style={{ marginTop: 4, marginBottom: 24 }}>
          Decide what you'd like to hear about.
        </AppText>

        <AppText variant="title" style={{ marginBottom: 12 }}>
          Notifications
        </AppText>

        {isLoading ? (
          <Skeleton height={300} />
        ) : (
          <Card style={{ padding: 0 }}>
            {(data ?? []).map((pref, idx) => (
              <Row
                key={pref.notificationType}
                justify="space-between"
                style={{
                  padding: 16,
                  borderBottomWidth: idx === (data?.length ?? 0) - 1 ? 0 : 1,
                  borderBottomColor: c.border,
                }}
              >
                <View style={{ flex: 1, marginRight: 12 }}>
                  <AppText weight="medium">
                    {LABELS[pref.notificationType] ?? pref.notificationType}
                  </AppText>
                </View>
                <Switch
                  value={pref.enabled}
                  onValueChange={(v) => toggle(pref.notificationType, v)}
                  trackColor={{ true: c.primary, false: c.muted }}
                />
              </Row>
            ))}
          </Card>
        )}

        <View style={{ height: 24 }} />
        <Card>
          <Row gap={10}>
            <Feather name="info" size={18} color={c.mutedForeground} />
            <AppText variant="caption" color={c.mutedForeground} style={{ flex: 1 }}>
              MyZolve Connect is private to your circles. We never show your activity publicly.
            </AppText>
          </Row>
        </Card>

        <View style={{ height: 32 }} />
        <AppText variant="title" style={{ marginBottom: 12, color: c.destructive ?? "#b91c1c" }}>
          Danger zone
        </AppText>
        <Card>
          <AppText weight="medium" style={{ marginBottom: 6 }}>
            Delete your account
          </AppText>
          <AppText
            variant="caption"
            color={c.mutedForeground}
            style={{ marginBottom: 14 }}
          >
            Permanently delete your account and remove your personal information
            from MyZolve Connect. This cannot be undone.
          </AppText>
          <Pressable
            testID="button-delete-account"
            onPress={confirmDelete}
            disabled={deleting}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: c.destructive ?? "#b91c1c",
              borderRadius: 12,
              paddingVertical: 14,
              opacity: pressed || deleting ? 0.7 : 1,
            })}
          >
            <Feather name="trash-2" size={18} color="#ffffff" />
            <AppText
              color="#ffffff"
              weight="semibold"
              style={{ marginLeft: 10 }}
            >
              {deleting ? "Deleting…" : "Delete my account"}
            </AppText>
          </Pressable>
        </Card>

        <Pressable
          accessibilityRole="link"
          accessibilityLabel="MyZolve Connect is part of the MyZolve family, opens in browser"
          testID="link-myzolve-family"
          onPress={async () => {
            try {
              await Linking.openURL("https://myzolve.com");
            } catch {
              Alert.alert(
                "Couldn't open MyZolve",
                "Please try again, or visit myzolve.com in your browser.",
              );
            }
          }}
          style={({ pressed }) => ({
            marginTop: 28,
            paddingHorizontal: 4,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Row gap={8} justify="center">
            <Image
              source={require("@/assets/images/myzolve-logo.png")}
              style={{ width: 16, height: 16, borderRadius: 4 }}
              resizeMode="contain"
            />
            <AppText variant="caption" color={c.mutedForeground}>
              MyZolve Connect is part of the MyZolve family
            </AppText>
          </Row>
        </Pressable>
      </Screen>
    </>
  );
}
