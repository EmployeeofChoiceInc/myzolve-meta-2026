import { Feather } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React from "react";
import { Image, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppText,
  Card,
  IconButton,
  Pill,
  PressableCard,
  Row,
  Skeleton,
} from "@/components/UI";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";
import { useMyOrgs, type MyOrg } from "@/lib/orgApi";
import { safeBack } from "@/lib/safeBack";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

function orgLogoUri(logoUrl: string | null | undefined): string | undefined {
  if (!logoUrl) return undefined;
  return logoUrl.startsWith("http") ? logoUrl : `${API_BASE}${logoUrl}`;
}

function ReunionCard({ org }: { org: MyOrg }) {
  const c = useColors();
  const router = useRouter();
  const accent = org.accentColor || c.primary;
  const uri = orgLogoUri(org.logoUrl);
  return (
    <PressableCard
      onPress={() => router.push(`/reunions/${org.id}`)}
      testID={`reunion-${org.id}`}
    >
      <Row gap={14} align="center">
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: c.primarySoft,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            borderWidth: 1,
            borderColor: accent,
          }}
        >
          {uri ? (
            <Image
              source={{ uri }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
              accessibilityLabel={`${org.name} logo`}
            />
          ) : (
            <Feather name="briefcase" size={22} color={accent} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Row gap={8} align="center">
            <AppText weight="semibold" style={{ flexShrink: 1 }} numberOfLines={1}>
              {org.name}
            </AppText>
            <Pill label={org.comped ? "Complimentary" : org.status} />
          </Row>
          <Row gap={5} align="center" style={{ marginTop: 4 }}>
            <Feather name="users" size={13} color={c.mutedForeground} />
            <AppText variant="caption" color={c.mutedForeground}>
              {org.seatsUsed ?? 0}
              {org.seatLimit > 0 ? ` / ${org.seatLimit}` : ""} seats · {org.planName}
            </AppText>
          </Row>
        </View>
        <Feather name="chevron-right" size={18} color={c.mutedForeground} />
      </Row>
    </PressableCard>
  );
}

export default function ReunionsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useMyOrgs();
  const orgs = data?.orgs ?? [];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        contentStyle={{ paddingTop: insets.top + 12 }}
        refreshing={isRefetching}
        onRefresh={refetch}
      >
        <Row align="center" gap={8} style={{ marginBottom: 18 }}>
          <IconButton icon="arrow-left" onPress={() => safeBack(router)} />
          <View style={{ flex: 1 }}>
            <AppText variant="h1">Your reunions</AppText>
            <AppText color={c.mutedForeground} style={{ marginTop: 4 }}>
              The group spaces you belong to.
            </AppText>
          </View>
        </Row>

        {isLoading ? (
          <View style={{ gap: 12 }}>
            <Skeleton height={80} />
            <Skeleton height={80} />
          </View>
        ) : orgs.length === 0 ? (
          <Card style={{ paddingVertical: 32, alignItems: "center" }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: c.primarySoft,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <Feather name="briefcase" size={28} color={c.primary} />
            </View>
            <AppText variant="title">No reunions yet</AppText>
            <AppText
              color={c.mutedForeground}
              style={{
                textAlign: "center",
                marginTop: 6,
                maxWidth: 280,
              }}
            >
              When you join a reunion or organization, its shared space will
              appear here.
            </AppText>
          </Card>
        ) : (
          <View style={{ gap: 12 }}>
            {orgs.map((org) => (
              <ReunionCard key={org.id} org={org} />
            ))}
          </View>
        )}
      </Screen>
    </>
  );
}
