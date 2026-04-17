import { Feather } from "@expo/vector-icons";
import { Stack } from "expo-router";
import React from "react";
import { Switch, View } from "react-native";
import {
  getGetNotificationPreferencesQueryKey,
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
};

export default function SettingsScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const { data, isLoading } = useGetNotificationPreferences();
  const update = useUpdateNotificationPreferences();

  function toggle(notificationType: string, enabled: boolean) {
    update.mutate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { data: { preferences: [{ notificationType: notificationType as any, enabled }] } },
      {
        onSuccess: () =>
          qc.invalidateQueries({ queryKey: getGetNotificationPreferencesQueryKey() }),
      }
    );
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
      </Screen>
    </>
  );
}
