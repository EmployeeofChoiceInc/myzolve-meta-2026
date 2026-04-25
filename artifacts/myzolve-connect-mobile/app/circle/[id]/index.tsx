import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useGetCircle,
  useGetCircleDashboard,
  useGetCircleStats,
} from "@workspace/api-client-react";

import { AppText, Card, IconButton, Pill, Row, Skeleton } from "@/components/UI";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";
import { CIRCLE_TYPE_LABELS, formatMoney } from "@/lib/circleTypes";
import { safeBack } from "@/lib/safeBack";

const SECTIONS: {
  key: string;
  title: string;
  icon: keyof typeof Feather.glyphMap;
  subtitle: string;
}[] = [
  { key: "requests", title: "Requests", icon: "help-circle", subtitle: "Open asks for help" },
  { key: "services", title: "Services", icon: "tool", subtitle: "Skills offered" },
  { key: "wall", title: "Wall", icon: "edit-3", subtitle: "Notes & gratitude" },
  { key: "calendar", title: "Calendar", icon: "calendar", subtitle: "Birthdays & memorable days" },
  { key: "members", title: "Members", icon: "users", subtitle: "Who's in this circle" },
  { key: "ledger", title: "Ledger", icon: "book-open", subtitle: "Money & support log" },
  { key: "activity", title: "Activity", icon: "activity", subtitle: "Recent happenings" },
];

export default function CircleHomeScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const { data: circle, isLoading, isError } = useGetCircle(id);
  const { data: stats } = useGetCircleStats(id);
  const { data: dashboard } = useGetCircleDashboard(id);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen contentStyle={{ paddingTop: insets.top + 12 }}>
        <Row justify="space-between" align="center" style={{ marginBottom: 16 }}>
          <IconButton icon="arrow-left" onPress={() => safeBack(router)} />
          <Row gap={4} align="center">
            {(circle?.myRole === "owner" || circle?.myRole === "admin") && (
              <IconButton
                icon="settings"
                testID="button-circle-settings"
                onPress={() => router.push(`/circle/${id}/settings`)}
              />
            )}
            <IconButton
              icon="user-plus"
              onPress={() => router.push(`/circle/${id}/members`)}
            />
          </Row>
        </Row>

        {isError ? (
          // Reached when a non-member opens a circle URL they don't
          // have access to — most commonly via Discover, an old push
          // notification, or a stale cached list.  Without this
          // branch the screen used to sit on a skeleton forever
          // because `circle` stayed undefined.
          <Card style={{ paddingVertical: 24, alignItems: "center" }}>
            <Feather name="lock" size={28} color={c.mutedForeground} />
            <AppText weight="semibold" style={{ marginTop: 10 }}>
              This circle isn't available
            </AppText>
            <AppText
              variant="caption"
              color={c.mutedForeground}
              style={{ marginTop: 4, textAlign: "center" }}
            >
              You may not be a member yet, or it may have been removed.
              Browse Discover to find circles you can join.
            </AppText>
          </Card>
        ) : isLoading || !circle ? (
          <Skeleton height={140} />
        ) : (
          <>
            <Pill label={CIRCLE_TYPE_LABELS[circle.circleType] ?? circle.circleType} />
            <AppText variant="h1" style={{ marginTop: 10 }}>
              {circle.name}
            </AppText>
            {circle.description ? (
              <AppText color={c.mutedForeground} style={{ marginTop: 6 }}>
                {circle.description}
              </AppText>
            ) : null}

            {stats && (
              <Row gap={10} style={{ marginTop: 18 }}>
                <Card style={{ flex: 1, alignItems: "center", paddingVertical: 14 }}>
                  <AppText variant="h2" color={c.primary}>
                    {stats.totalMembers}
                  </AppText>
                  <AppText variant="caption" color={c.mutedForeground}>
                    Members
                  </AppText>
                </Card>
                <Card style={{ flex: 1, alignItems: "center", paddingVertical: 14 }}>
                  <AppText variant="h2" color={c.secondary}>
                    {stats.openRequests}
                  </AppText>
                  <AppText variant="caption" color={c.mutedForeground}>
                    Open
                  </AppText>
                </Card>
                <Card style={{ flex: 1, alignItems: "center", paddingVertical: 14 }}>
                  <AppText variant="h2" color={c.accent}>
                    {stats.activeServices}
                  </AppText>
                  <AppText variant="caption" color={c.mutedForeground}>
                    Services
                  </AppText>
                </Card>
              </Row>
            )}

            {stats && (stats.totalSupportGiven > 0 || stats.totalSupportReceived > 0) && (
              <Card style={{ marginTop: 12 }}>
                <Row justify="space-between">
                  <View>
                    <AppText variant="caption" color={c.mutedForeground}>
                      Supported
                    </AppText>
                    <AppText weight="bold" style={{ marginTop: 2 }}>
                      {formatMoney(stats.totalSupportGiven, circle.currency)}
                    </AppText>
                  </View>
                  <View>
                    <AppText variant="caption" color={c.mutedForeground}>
                      Received
                    </AppText>
                    <AppText weight="bold" style={{ marginTop: 2 }}>
                      {formatMoney(stats.totalSupportReceived, circle.currency)}
                    </AppText>
                  </View>
                </Row>
              </Card>
            )}
          </>
        )}

        <View style={{ height: 24 }} />

        <View style={{ gap: 10 }}>
          {SECTIONS.map((s) => {
            let badge: string | null = null;
            if (s.key === "requests" && dashboard) {
              badge = String(dashboard.openRequestsCount);
            } else if (s.key === "services" && dashboard) {
              badge = String(dashboard.activeServices);
            }
            return (
              <Pressable
                key={s.key}
                onPress={() => router.push(`/circle/${id}/${s.key}`)}
                testID={`section-${s.key}`}
                style={({ pressed }) => ({
                  backgroundColor: c.card,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: c.border,
                  padding: 16,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Row gap={14} align="center">
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 21,
                      backgroundColor: c.primarySoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Feather name={s.icon} size={20} color={c.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText weight="semibold">{s.title}</AppText>
                    <AppText variant="caption" color={c.mutedForeground} style={{ marginTop: 2 }}>
                      {s.subtitle}
                    </AppText>
                  </View>
                  {badge && (
                    <View
                      style={{
                        backgroundColor: c.primary,
                        borderRadius: 999,
                        minWidth: 24,
                        paddingHorizontal: 8,
                        height: 24,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <AppText variant="caption" color="#fff" weight="bold">
                        {badge}
                      </AppText>
                    </View>
                  )}
                  <Feather name="chevron-right" size={18} color={c.mutedForeground} />
                </Row>
              </Pressable>
            );
          })}
        </View>
      </Screen>
    </>
  );
}
