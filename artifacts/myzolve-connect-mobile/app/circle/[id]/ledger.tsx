import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import React from "react";
import { View } from "react-native";
import { format } from "date-fns";
import {
  useGetCircle,
  useGetCircleLedgerSummary,
  useGetCircleLedger,
} from "@workspace/api-client-react";

import { AppText, Card, Empty, Row, Skeleton } from "@/components/UI";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";
import { formatMoney } from "@/lib/circleTypes";

const KIND_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  money_given: "arrow-up-right",
  money_received: "arrow-down-left",
  money_repaid: "rotate-ccw",
  service_offered: "tool",
  service_received: "users",
  gift_given: "gift",
  amount_forgiven: "heart",
};

const KIND_LABELS: Record<string, string> = {
  money_given: "Support given",
  money_received: "Support received",
  money_repaid: "Repaid",
  service_offered: "Service offered",
  service_received: "Service received",
  gift_given: "Gift",
  amount_forgiven: "Forgiven",
};

export default function LedgerScreen() {
  const c = useColors();
  const params = useLocalSearchParams<{ id: string }>();
  const circleId = Number(params.id);
  const { data: circle } = useGetCircle(circleId);
  const { data: summary } = useGetCircleLedgerSummary(circleId);
  const { data: entries, isLoading, refetch, isRefetching } = useGetCircleLedger(circleId);

  const currency = circle?.currency ?? "USD";

  return (
    <>
      <Stack.Screen options={{ title: "Ledger" }} />
      <Screen refreshing={isRefetching} onRefresh={refetch}>
        <AppText variant="h1">Ledger</AppText>
        <AppText color={c.mutedForeground} style={{ marginTop: 4, marginBottom: 20 }}>
          A clear, kind record of support flowing through this circle.
        </AppText>

        {summary && (
          <Row gap={10} style={{ marginBottom: 20 }}>
            <Card style={{ flex: 1, padding: 14 }}>
              <AppText variant="caption" color={c.mutedForeground}>
                Given
              </AppText>
              <AppText variant="title" color={c.primary} style={{ marginTop: 4 }}>
                {formatMoney(summary.totalGiven, currency)}
              </AppText>
            </Card>
            <Card style={{ flex: 1, padding: 14 }}>
              <AppText variant="caption" color={c.mutedForeground}>
                Received
              </AppText>
              <AppText variant="title" color={c.secondary} style={{ marginTop: 4 }}>
                {formatMoney(summary.totalReceived, currency)}
              </AppText>
            </Card>
          </Row>
        )}

        {isLoading ? (
          <Skeleton height={200} />
        ) : !entries || entries.length === 0 ? (
          <Empty icon="book-open" title="No entries yet" subtitle="Ledger entries will show here." />
        ) : (
          <View style={{ gap: 10 }}>
            {entries.map((e) => {
              const icon = KIND_ICONS[e.entryKind] ?? "circle";
              const isOut = e.entryKind === "money_given" || e.entryKind === "gift_given";
              return (
                <Card key={e.id}>
                  <Row gap={12} align="flex-start">
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: isOut ? c.primarySoft : c.secondarySoft,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Feather
                        name={icon}
                        size={16}
                        color={isOut ? c.primary : c.secondary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Row justify="space-between">
                        <AppText weight="semibold">
                          {KIND_LABELS[e.entryKind] ?? e.entryKind}
                        </AppText>
                        {e.amount != null && (
                          <AppText weight="bold" color={isOut ? c.primary : c.secondary}>
                            {formatMoney(e.amount, e.currency ?? currency)}
                          </AppText>
                        )}
                      </Row>
                      <AppText variant="caption" color={c.mutedForeground} style={{ marginTop: 4 }}>
                        {e.giverName} → {e.receiverName}
                      </AppText>
                      {e.description ? (
                        <AppText variant="caption" color={c.mutedForeground} style={{ marginTop: 2 }}>
                          {e.description}
                        </AppText>
                      ) : null}
                      <AppText
                        variant="caption"
                        color={c.mutedForeground}
                        style={{ marginTop: 4 }}
                      >
                        {format(new Date(e.date), "MMM d, yyyy")}
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
