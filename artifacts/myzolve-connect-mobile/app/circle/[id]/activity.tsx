import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatDistanceToNow } from "date-fns";
import { useGetCircleActivity } from "@workspace/api-client-react";

import { AppText, Card, Empty, IconButton, Row, Skeleton } from "@/components/UI";
import { CircleWelcomeNudge } from "@/components/CircleWelcomeNudge";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";
import { safeBack } from "@/lib/safeBack";

const ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  member_joined: "user-plus",
  member_invited: "mail",
  request_posted: "help-circle",
  support_offered: "heart",
  request_funded: "check-circle",
  request_completed: "check",
  repayment_marked: "dollar-sign",
  service_posted: "tool",
  service_matched: "users",
  service_completed: "check",
};

export default function ActivityScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const circleId = Number(params.id);
  const { data, isLoading, refetch, isRefetching } = useGetCircleActivity(circleId);

  return (
    <>
      <Stack.Screen options={{ title: "Activity" }} />
      <Screen
        contentStyle={{ paddingTop: insets.top + 12 }}
        refreshing={isRefetching}
        onRefresh={refetch}
      >
        <Row align="center" style={{ marginBottom: 16 }}>
          <IconButton icon="arrow-left" onPress={() => safeBack(router)} />
        </Row>
        <AppText variant="h1">Activity</AppText>
        <AppText color={c.mutedForeground} style={{ marginTop: 4, marginBottom: 20 }}>
          What's happened in this circle lately.
        </AppText>

        {isLoading ? (
          <Skeleton height={300} />
        ) : !data || data.length === 0 ? (
          <View>
            <CircleWelcomeNudge circleId={circleId} />
            <Empty icon="activity" title="Nothing yet" subtitle="Activity will show here." />
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {data.map((a) => {
              const icon = ICONS[a.activityType] ?? "circle";
              return (
                <Card key={a.id}>
                  <Row gap={12} align="flex-start">
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: c.primarySoft,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Feather name={icon} size={16} color={c.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText weight="medium">{a.summaryText}</AppText>
                      <AppText
                        variant="caption"
                        color={c.mutedForeground}
                        style={{ marginTop: 4 }}
                      >
                        {a.actorName} •{" "}
                        {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                      </AppText>
                    </View>
                  </Row>
                </Card>
              );
            })}
          </View>
        )}
      </Screen>
    </>
  );
}
