import { useUser } from "@clerk/clerk-expo";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useGetCircleDashboard,
  useListCircles,
  useListSupportRequests,
} from "@workspace/api-client-react";

import {
  AppText,
  Button,
  Card,
  Empty,
  PressableCard,
  Pill,
  Progress,
  Row,
  Skeleton,
} from "@/components/UI";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";
import {
  CIRCLE_TYPE_LABELS,
  URGENCY_COLORS,
  URGENCY_LABELS,
  formatMoney,
} from "@/lib/circleTypes";

export default function HomeScreen() {
  const { user } = useUser();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: circles, isLoading, refetch, isRefetching } = useListCircles();
  const firstCircle = circles?.[0];
  const dashboardQuery = useGetCircleDashboard(firstCircle?.id ?? 0, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: { enabled: !!firstCircle } as any,
  });
  const requestsQuery = useListSupportRequests(firstCircle?.id ?? 0, undefined, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: { enabled: !!firstCircle } as any,
  });

  useEffect(() => {
    if (!isLoading && circles && circles.length === 0) {
      router.replace("/onboarding");
    }
  }, [isLoading, circles, router]);

  const greeting = user?.firstName ? `Hi, ${user.firstName}.` : "Welcome home.";
  const dashboard = dashboardQuery.data;
  const openRequests = (requestsQuery.data ?? [])
    .filter((r) => !["completed", "archived", "canceled"].includes(r.status))
    .slice(0, 3);

  return (
    <Screen
      contentStyle={{ paddingTop: insets.top + 12 }}
      refreshing={isRefetching}
      onRefresh={refetch}
    >
      <AppText variant="h1">{greeting}</AppText>
      <AppText color={c.mutedForeground} style={{ marginTop: 4, marginBottom: 24 }}>
        Latest from your trusted circles.
      </AppText>

      {firstCircle && (
        <Row gap={12} style={{ marginBottom: 24 }}>
          <Button
            title="Ask for support"
            icon="plus"
            onPress={() => router.push(`/circle/${firstCircle.id}/new-request`)}
            style={{ flex: 1 }}
          />
          <Button
            title="Offer help"
            icon="heart"
            variant="outline"
            onPress={() => router.push(`/circle/${firstCircle.id}/new-service`)}
            style={{ flex: 1 }}
          />
        </Row>
      )}

      <AppText variant="title" style={{ marginBottom: 12 }}>
        Your circles
      </AppText>
      {isLoading ? (
        <Skeleton height={120} />
      ) : circles && circles.length > 0 ? (
        <View style={{ gap: 12 }}>
          {circles.slice(0, 4).map((circle) => (
            <PressableCard
              key={circle.id}
              onPress={() => router.push(`/circle/${circle.id}`)}
              testID={`circle-card-${circle.id}`}
            >
              <Row justify="space-between" align="flex-start">
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Pill label={CIRCLE_TYPE_LABELS[circle.circleType] ?? circle.circleType} />
                  <AppText variant="title" style={{ marginTop: 8 }}>
                    {circle.name}
                  </AppText>
                  <AppText color={c.mutedForeground} variant="caption" style={{ marginTop: 4 }}>
                    {circle.memberCount} member{circle.memberCount !== 1 ? "s" : ""}
                  </AppText>
                </View>
                <Feather name="chevron-right" size={20} color={c.mutedForeground} />
              </Row>
            </PressableCard>
          ))}
          {circles.length > 4 && (
            <Button
              title={`See all ${circles.length} circles`}
              variant="ghost"
              onPress={() => router.push("/(tabs)/circles")}
            />
          )}
        </View>
      ) : (
        <Empty
          icon="users"
          title="No circles yet"
          subtitle="Create one to share support with the people you trust."
        />
      )}

      {firstCircle && (
        <>
          <View style={{ height: 32 }} />
          <Row justify="space-between" style={{ marginBottom: 12 }}>
            <AppText variant="title">Open requests</AppText>
            <Button
              title="See all"
              variant="ghost"
              size="sm"
              onPress={() => router.push(`/circle/${firstCircle.id}/requests`)}
            />
          </Row>

          {dashboard && (
            <Row gap={10} style={{ marginBottom: 16 }}>
              <Card style={{ flex: 1, alignItems: "center", paddingVertical: 14 }}>
                <AppText variant="h2" color={c.primary}>
                  {dashboard.openRequestsCount}
                </AppText>
                <AppText variant="caption" color={c.mutedForeground} style={{ marginTop: 2 }}>
                  Open
                </AppText>
              </Card>
              <Card style={{ flex: 1, alignItems: "center", paddingVertical: 14 }}>
                <AppText variant="h2" color={c.secondary}>
                  {dashboard.activeServices}
                </AppText>
                <AppText variant="caption" color={c.mutedForeground} style={{ marginTop: 2 }}>
                  Services
                </AppText>
              </Card>
              <Card style={{ flex: 1, alignItems: "center", paddingVertical: 14 }}>
                <AppText
                  variant="h2"
                  color={dashboard.urgentRequestsCount > 0 ? c.warning : c.mutedForeground}
                >
                  {dashboard.urgentRequestsCount}
                </AppText>
                <AppText variant="caption" color={c.mutedForeground} style={{ marginTop: 2 }}>
                  Urgent
                </AppText>
              </Card>
            </Row>
          )}

          {openRequests.length === 0 ? (
            <Empty
              icon="check-circle"
              title="All quiet here"
              subtitle="No open requests right now."
            />
          ) : (
            <View style={{ gap: 12 }}>
              {openRequests.map((req) => {
                const pct =
                  req.amountRequested > 0
                    ? Math.round(((req.amountFunded ?? 0) / req.amountRequested) * 100)
                    : 0;
                const urg = URGENCY_COLORS[req.urgencyLevel] ?? URGENCY_COLORS.normal;
                return (
                  <PressableCard
                    key={req.id}
                    onPress={() => router.push(`/request/${req.id}`)}
                  >
                    <Row justify="space-between" align="flex-start" style={{ marginBottom: 10 }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <AppText weight="semibold">{req.title}</AppText>
                        <AppText variant="caption" color={c.mutedForeground} style={{ marginTop: 2 }}>
                          {req.createdByName}
                        </AppText>
                      </View>
                      <Pill
                        label={URGENCY_LABELS[req.urgencyLevel] ?? req.urgencyLevel}
                        bg={urg.bg}
                        fg={urg.fg}
                      />
                    </Row>
                    <Progress value={pct} />
                    <Row justify="space-between" style={{ marginTop: 8 }}>
                      <AppText variant="caption" color={c.mutedForeground}>
                        {formatMoney(req.amountFunded, req.currency)} supported
                      </AppText>
                      <AppText variant="caption" color={c.mutedForeground}>
                        Goal {formatMoney(req.amountRequested, req.currency)}
                      </AppText>
                    </Row>
                  </PressableCard>
                );
              })}
            </View>
          )}

          {dashboard && dashboard.pendingRepayments.length > 0 && (
            <>
              <View style={{ height: 32 }} />
              <AppText variant="title" style={{ marginBottom: 12 }}>
                Gentle reminders
              </AppText>
              <View style={{ gap: 10 }}>
                {dashboard.pendingRepayments.slice(0, 3).map((r) => (
                  <PressableCard
                    key={r.requestId}
                    onPress={() => router.push(`/request/${r.requestId}`)}
                    style={{ backgroundColor: c.secondarySoft, borderColor: c.secondarySoft }}
                  >
                    <Row justify="space-between">
                      <View style={{ flex: 1 }}>
                        <AppText weight="semibold">{r.requestTitle}</AppText>
                        <AppText variant="caption" color={c.mutedForeground} style={{ marginTop: 2 }}>
                          {formatMoney(r.amountOwed, r.currency)} to return
                        </AppText>
                      </View>
                      <Feather name="arrow-right" size={18} color={c.mutedForeground} />
                    </Row>
                  </PressableCard>
                ))}
              </View>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
