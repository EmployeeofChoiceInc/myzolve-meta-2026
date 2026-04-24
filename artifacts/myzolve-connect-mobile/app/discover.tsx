import { Feather } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDiscoverCircles } from "@workspace/api-client-react";

import {
  AppText,
  Empty,
  IconButton,
  Pill,
  PressableCard,
  Row,
  Skeleton,
} from "@/components/UI";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";
import { CIRCLE_TYPE_LABELS } from "@/lib/circleTypes";

export default function DiscoverScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useDiscoverCircles();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen contentStyle={{ paddingTop: insets.top + 12 }}>
        <Row align="center" gap={6} style={{ marginBottom: 16 }}>
          <IconButton icon="arrow-left" onPress={() => router.back()} />
        </Row>
        <AppText variant="h1">Discover</AppText>
        <AppText color={c.mutedForeground} style={{ marginTop: 4, marginBottom: 20 }}>
          Browse circles others have opened up to the community.
        </AppText>

        {isLoading ? (
          <View style={{ gap: 12 }}>
            <Skeleton height={120} />
            <Skeleton height={120} />
          </View>
        ) : !data || data.length === 0 ? (
          <Empty
            icon="compass"
            title="Nothing to discover yet"
            subtitle="When people open up their circles, they'll show up here."
          />
        ) : (
          <View style={{ gap: 12 }}>
            {data.map((circle) => {
              const status =
                circle.isMember
                  ? { label: "Member", bg: c.primarySoft, fg: c.primary }
                  : circle.joinRequestStatus === "pending"
                    ? {
                        label: "Request pending",
                        bg: c.secondarySoft,
                        fg: c.secondary,
                      }
                    : null;
              return (
                <PressableCard
                  key={circle.id}
                  onPress={() => router.push(`/circle/${circle.id}`)}
                  testID={`discover-circle-${circle.id}`}
                >
                  <Row justify="space-between" align="flex-start">
                    <Pill
                      label={CIRCLE_TYPE_LABELS[circle.circleType] ?? circle.circleType}
                    />
                    {status && <Pill label={status.label} bg={status.bg} fg={status.fg} />}
                  </Row>
                  <AppText variant="title" style={{ marginTop: 10 }}>
                    {circle.name}
                  </AppText>
                  <AppText
                    variant="caption"
                    color={c.mutedForeground}
                    style={{ marginTop: 4 }}
                  >
                    Created by {circle.creatorName}
                  </AppText>
                  {circle.description ? (
                    <AppText
                      color={c.mutedForeground}
                      style={{ marginTop: 8 }}
                      numberOfLines={3}
                    >
                      {circle.description}
                    </AppText>
                  ) : null}
                  <Row gap={6} align="center" style={{ marginTop: 10 }}>
                    <Feather name="users" size={13} color={c.mutedForeground} />
                    <AppText variant="caption" color={c.mutedForeground}>
                      {circle.memberCount}{" "}
                      {circle.memberCount === 1 ? "member" : "members"}
                    </AppText>
                    {circle.privacyMode === "community" ? (
                      <>
                        <AppText variant="caption" color={c.mutedForeground}>
                          •
                        </AppText>
                        <AppText variant="caption" color={c.mutedForeground}>
                          Admin reviews requests
                        </AppText>
                      </>
                    ) : null}
                  </Row>
                </PressableCard>
              );
            })}
          </View>
        )}
      </Screen>
    </>
  );
}
