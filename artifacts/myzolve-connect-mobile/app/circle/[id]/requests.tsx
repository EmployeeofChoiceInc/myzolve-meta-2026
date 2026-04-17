import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";
import { useListSupportRequests } from "@workspace/api-client-react";

import {
  AppText,
  Button,
  Empty,
  IconButton,
  PressableCard,
  Pill,
  Progress,
  Row,
  Skeleton,
} from "@/components/UI";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";
import {
  STATUS_COLORS,
  URGENCY_COLORS,
  URGENCY_LABELS,
  formatMoney,
} from "@/lib/circleTypes";

export default function RequestsScreen() {
  const c = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const circleId = Number(params.id);
  const { data, isLoading, refetch, isRefetching } = useListSupportRequests(circleId);

  return (
    <>
      <Stack.Screen options={{ title: "Requests" }} />
      <Screen refreshing={isRefetching} onRefresh={refetch}>
        <Row justify="space-between" align="center" style={{ marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <AppText variant="h1">Requests</AppText>
            <AppText color={c.mutedForeground} style={{ marginTop: 4 }}>
              Asks for support in this circle.
            </AppText>
          </View>
          <IconButton
            icon="plus"
            bg={c.primary}
            color="#fff"
            onPress={() => router.push(`/circle/${circleId}/new-request`)}
          />
        </Row>

        {isLoading ? (
          <Skeleton height={140} />
        ) : !data || data.length === 0 ? (
          <Empty
            icon="help-circle"
            title="No requests yet"
            subtitle="Be the first to share a need."
            action={
              <Button
                title="Create a request"
                onPress={() => router.push(`/circle/${circleId}/new-request`)}
              />
            }
          />
        ) : (
          <View style={{ gap: 12 }}>
            {data.map((req) => {
              const pct =
                req.amountRequested > 0
                  ? Math.round(((req.amountFunded ?? 0) / req.amountRequested) * 100)
                  : 0;
              const urg = URGENCY_COLORS[req.urgencyLevel] ?? URGENCY_COLORS.medium;
              const sc = STATUS_COLORS[req.status] ?? STATUS_COLORS.open;
              return (
                <PressableCard
                  key={req.id}
                  onPress={() => router.push(`/request/${req.id}`)}
                  testID={`request-${req.id}`}
                >
                  <Row gap={6} style={{ marginBottom: 8 }}>
                    <Pill label={req.status} bg={sc.bg} fg={sc.fg} />
                    <Pill
                      label={URGENCY_LABELS[req.urgencyLevel] ?? req.urgencyLevel}
                      bg={urg.bg}
                      fg={urg.fg}
                    />
                  </Row>
                  <AppText variant="title">{req.title}</AppText>
                  <AppText variant="caption" color={c.mutedForeground} style={{ marginTop: 2 }}>
                    by {req.createdByName}
                  </AppText>
                  {req.description ? (
                    <AppText
                      color={c.mutedForeground}
                      style={{ marginTop: 6 }}
                      numberOfLines={2}
                    >
                      {req.description}
                    </AppText>
                  ) : null}
                  <View style={{ marginTop: 12 }}>
                    <Progress value={pct} />
                    <Row justify="space-between" style={{ marginTop: 6 }}>
                      <AppText variant="caption" color={c.mutedForeground}>
                        {formatMoney(req.amountFunded, req.currency)} of{" "}
                        {formatMoney(req.amountRequested, req.currency)}
                      </AppText>
                      <AppText variant="caption" color={c.mutedForeground}>
                        {pct}%
                      </AppText>
                    </Row>
                  </View>
                </PressableCard>
              );
            })}
          </View>
        )}
      </Screen>
    </>
  );
}
