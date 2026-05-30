import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useAuth } from "@clerk/expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getGetCircleQueryKey,
  useDismissCircleWelcome,
  useGetCircle,
  useGetCircleDashboard,
  useGetCircleStats,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { Image } from "react-native";
import { AppText, Card, IconButton, Pill, Row, Skeleton } from "@/components/UI";
import { Screen } from "@/components/Screen";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useColors } from "@/hooks/useColors";
import { CIRCLE_TYPE_LABELS, formatMoney } from "@/lib/circleTypes";
import { safeBack } from "@/lib/safeBack";

function orgLogoUri(logoUrl: string | null | undefined): string | undefined {
  if (!logoUrl) return undefined;
  return logoUrl.startsWith("http") ? logoUrl : `${API_BASE}${logoUrl}`;
}

function OrgBadge({
  name,
  logoUrl,
  color,
}: {
  name: string;
  logoUrl: string | null | undefined;
  color: string;
}) {
  const uri = orgLogoUri(logoUrl);
  return (
    <Row align="center" gap={6} style={{ marginBottom: 8 }}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: 20, height: 20, borderRadius: 4 }}
          resizeMode="contain"
          accessibilityLabel={`${name} logo`}
        />
      ) : (
        <Feather name="briefcase" size={14} color={color} />
      )}
      <AppText variant="caption" weight="semibold" style={{ color }}>
        {name}
      </AppText>
    </Row>
  );
}

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

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

function bannerObjectPathToUrl(objectPath: string | null | undefined) {
  if (!objectPath) return undefined;
  const stripped = objectPath.startsWith("/objects/")
    ? objectPath.slice("/objects/".length)
    : objectPath;
  return `${API_BASE}/api/storage/user-media/${stripped}`;
}

function CircleBannerImage({ uri }: { uri: string }) {
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

  if (!token) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Image } = require("expo-image") as typeof import("expo-image");
  return (
    <Image
      source={{ uri, headers: { Authorization: `Bearer ${token}` } }}
      style={{ width: "100%", height: "100%" }}
      contentFit="cover"
      testID="circle-banner-image"
    />
  );
}

export default function CircleHomeScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const { data: circle, isLoading, isError } = useGetCircle(id);
  const { data: stats } = useGetCircleStats(id);
  const { data: dashboard } = useGetCircleDashboard(id);

  const qc = useQueryClient();
  const dismissWelcome = useDismissCircleWelcome();

  const bannerUrl = bannerObjectPathToUrl(circle?.bannerObjectPath ?? null);

  function handleDismissWelcome() {
    if (!circle) return;
    // Optimistic: hide the card immediately by patching the cache.
    qc.setQueryData(getGetCircleQueryKey(id), {
      ...circle,
      showWelcomeCard: false,
    });
    dismissWelcome.mutate(
      { circleId: id },
      {
        onError: () => {
          // Roll back to whatever the server says.
          qc.invalidateQueries({ queryKey: getGetCircleQueryKey(id) });
        },
      },
    );
  }

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
            {bannerUrl ? (
              <View
                testID="circle-banner"
                style={{
                  borderRadius: 18,
                  overflow: "hidden",
                  minHeight: 180,
                  justifyContent: "flex-end",
                  backgroundColor: c.primarySoft,
                }}
              >
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  }}
                >
                  <CircleBannerImage uri={bannerUrl} />
                </View>
                {/* Dark scrim so the title stays legible over any banner. */}
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0,0,0,0.35)",
                  }}
                />
                <View style={{ padding: 16 }}>
                  {circle.orgId && circle.orgName ? (
                    <OrgBadge
                      name={circle.orgName}
                      logoUrl={circle.orgLogoUrl}
                      color="#fff"
                    />
                  ) : null}
                  <Pill
                    label={CIRCLE_TYPE_LABELS[circle.circleType] ?? circle.circleType}
                    bg="rgba(255,255,255,0.2)"
                    fg="#fff"
                  />
                  <Row align="center" gap={8} style={{ marginTop: 10 }}>
                    <AppText
                      variant="h1"
                      style={{ color: "#fff", flexShrink: 1 }}
                    >
                      {circle.name}
                    </AppText>
                    {circle.verificationStatus === "verified" ? (
                      <VerifiedBadge size="md" />
                    ) : null}
                  </Row>
                  {circle.description ? (
                    <AppText
                      color="rgba(255,255,255,0.9)"
                      style={{ marginTop: 6 }}
                    >
                      {circle.description}
                    </AppText>
                  ) : null}
                </View>
              </View>
            ) : (
              <>
                {circle.orgId && circle.orgName ? (
                  <OrgBadge
                    name={circle.orgName}
                    logoUrl={circle.orgLogoUrl}
                    color={circle.orgAccentColor || c.primary}
                  />
                ) : null}
                <Pill label={CIRCLE_TYPE_LABELS[circle.circleType] ?? circle.circleType} />
                <Row align="center" gap={8} style={{ marginTop: 10 }}>
                  <AppText variant="h1" style={{ color: c.primary, flexShrink: 1 }}>
                    {circle.name}
                  </AppText>
                  {circle.verificationStatus === "verified" ? (
                    <VerifiedBadge size="md" />
                  ) : null}
                </Row>
                {circle.description ? (
                  <AppText color={c.mutedForeground} style={{ marginTop: 6 }}>
                    {circle.description}
                  </AppText>
                ) : null}
              </>
            )}

            {circle.showWelcomeCard && circle.welcomeMessage ? (
              <Card
                testID="welcome-card"
                style={{
                  marginTop: 16,
                  backgroundColor: c.primarySoft,
                  borderColor: c.primary,
                }}
              >
                <Row justify="space-between" align="center" style={{ marginBottom: 6 }}>
                  <Row align="center" gap={8}>
                    <Feather name="heart" size={16} color={c.primary} />
                    <AppText weight="semibold" color={c.primary}>
                      A note from your circle
                    </AppText>
                  </Row>
                  <Pressable
                    onPress={handleDismissWelcome}
                    testID="welcome-dismiss"
                    hitSlop={10}
                  >
                    <Feather name="x" size={18} color={c.primary} />
                  </Pressable>
                </Row>
                <AppText style={{ lineHeight: 20 }}>{circle.welcomeMessage}</AppText>
              </Card>
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
