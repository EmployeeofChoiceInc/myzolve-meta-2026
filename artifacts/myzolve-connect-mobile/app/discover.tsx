import { Feather } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React from "react";
import { Alert, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getDiscoverCirclesQueryKey,
  useCreateJoinRequest,
  useDiscoverCircles,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

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
import { safeBack } from "@/lib/safeBack";

type DiscoverCircle = {
  id: number;
  name: string;
  isMember: boolean;
  joinRequestStatus?: string | null;
  privacyMode?: string | null;
};

export default function DiscoverScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data, isLoading, refetch, isRefetching } = useDiscoverCircles();
  const joinRequest = useCreateJoinRequest();

  function handleCirclePress(circle: DiscoverCircle) {
    // Members can open the full circle detail.  Non-members would
    // hit the protected /circles/:id endpoint and get a 404, which
    // previously left them staring at a blank skeleton with no way
    // forward — a hard blocker for App Review's reviewer flow.
    if (circle.isMember) {
      router.push(`/circle/${circle.id}`);
      return;
    }
    if (circle.joinRequestStatus === "pending") {
      Alert.alert(
        "Request pending",
        `Your request to join ${circle.name} is waiting for the circle's admin to review it.`,
      );
      return;
    }
    const requiresApproval = circle.privacyMode === "community";
    Alert.alert(
      `Join ${circle.name}?`,
      requiresApproval
        ? "Your request will be reviewed by the circle's admin before you're added."
        : "You'll be added to this circle right away.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: requiresApproval ? "Request to join" : "Join",
          onPress: () => {
            joinRequest.mutate(
              { circleId: circle.id, data: {} },
              {
                onSuccess: () => {
                  qc.invalidateQueries({
                    queryKey: getDiscoverCirclesQueryKey(),
                  });
                  Alert.alert(
                    requiresApproval ? "Request sent" : "Joined",
                    requiresApproval
                      ? `We've let the admin of ${circle.name} know.`
                      : `You're now a member of ${circle.name}.`,
                  );
                },
                onError: () => {
                  Alert.alert(
                    "Couldn't send request",
                    "Please try again in a moment.",
                  );
                },
              },
            );
          },
        },
      ],
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        contentStyle={{ paddingTop: insets.top + 12 }}
        refreshing={isRefetching}
        onRefresh={refetch}
      >
        <Row align="center" gap={6} style={{ marginBottom: 16 }}>
          <IconButton icon="arrow-left" onPress={() => safeBack(router)} />
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
            subtitle="Pull down to refresh. Circles set to Open or Community will show up here once their owners save the change."
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
                  onPress={() => handleCirclePress(circle)}
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
