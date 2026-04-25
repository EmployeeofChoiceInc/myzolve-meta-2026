import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format } from "date-fns";
import {
  getGetCircleLedgerProQueryKey,
  getGetCircleLedgerProYearsQueryKey,
  useCreateCircleLedgerExport,
  useGetCircle,
  useGetCircleLedger,
  useGetCircleLedgerPro,
  useGetCircleLedgerProYears,
  useGetCircleLedgerSummary,
} from "@workspace/api-client-react";

import { AppText, Button, Card, Empty, IconButton, Row, Skeleton } from "@/components/UI";
import { LedgerProView } from "@/components/LedgerProView";
import { PaywallSheet } from "@/components/PaywallSheet";
import { PlusBadge } from "@/components/PlusBadge";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";
import { formatMoney } from "@/lib/circleTypes";
import { downloadAndShareExport } from "@/lib/downloadExport";
import { useSubscription } from "@/lib/revenuecat";
import { safeBack } from "@/lib/safeBack";

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

type Mode = "list" | "pro";

export default function LedgerScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const circleId = Number(params.id);
  const { isPlus } = useSubscription();
  const [mode, setMode] = useState<Mode>(isPlus ? "pro" : "list");
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [exportingYear, setExportingYear] = useState<number | null>(null);

  const { data: circle } = useGetCircle(circleId);
  const { data: summary } = useGetCircleLedgerSummary(circleId);
  const { data: entries, isLoading, refetch, isRefetching } = useGetCircleLedger(circleId);

  const yearsEnabled = isPlus && !!circleId;
  const yearsQuery = useGetCircleLedgerProYears(circleId, {
    query: {
      enabled: yearsEnabled,
      queryKey: getGetCircleLedgerProYearsQueryKey(circleId),
    },
  });
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const effectiveYear =
    selectedYear ?? yearsQuery.data?.defaultYear ?? new Date().getFullYear();

  const proEnabled = isPlus && mode === "pro" && !!circleId;
  const proQuery = useGetCircleLedgerPro(
    circleId,
    { year: effectiveYear },
    {
      query: {
        enabled: proEnabled,
        queryKey: getGetCircleLedgerProQueryKey(circleId, { year: effectiveYear }),
      },
    },
  );

  const exportMut = useCreateCircleLedgerExport();

  const currency = circle?.currency ?? "USD";

  async function handleExport(year: number) {
    setExportingYear(year);
    try {
      const result = await exportMut.mutateAsync({
        circleId,
        data: { year },
      });
      await downloadAndShareExport({
        pdfUrl: result.pdfUrl,
        csvUrl: result.csvUrl,
        year: result.year,
      });
    } catch {
      // Surfaces silently — the user can re-tap. We could swap in a toast
      // later, but failing loud-but-recoverable is the right default.
    } finally {
      setExportingYear(null);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Ledger" }} />
      <Screen
        contentStyle={{ paddingTop: insets.top + 12 }}
        refreshing={isRefetching}
        onRefresh={refetch}
      >
        <Row align="center" style={{ marginBottom: 16 }}>
          <IconButton icon="arrow-left" onPress={() => safeBack(router)} />
        </Row>
        <AppText variant="h1">Ledger</AppText>
        <AppText color={c.mutedForeground} style={{ marginTop: 4, marginBottom: 16 }}>
          A clear, kind record of support flowing through this circle.
        </AppText>

        {isPlus ? (
          <ModeToggle mode={mode} onChange={setMode} />
        ) : (
          <PlusUpsellCard onPress={() => setPaywallOpen(true)} />
        )}

        {mode === "pro" && isPlus ? (
          proQuery.isLoading || yearsQuery.isLoading ? (
            <Skeleton height={400} />
          ) : proQuery.data ? (
            <LedgerProView
              data={proQuery.data}
              years={yearsQuery.data?.years ?? [proQuery.data.year]}
              onYearChange={setSelectedYear}
              onExport={() => handleExport(proQuery.data!.year)}
              exportingYear={exportingYear}
            />
          ) : (
            <Empty
              icon="alert-circle"
              title="Couldn't load your ledger"
              subtitle="Pull down to retry."
            />
          )
        ) : (
          <>
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
          </>
        )}
      </Screen>
      <PaywallSheet
        visible={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        onSubscribed={() => {
          setPaywallOpen(false);
          setMode("pro");
        }}
      />
    </>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const c = useColors();
  return (
    <Row
      style={{
        backgroundColor: c.muted,
        borderRadius: 999,
        padding: 4,
        marginBottom: 16,
      }}
    >
      {(
        [
          { id: "list", label: "Activity" },
          { id: "pro", label: "Pro view", showBadge: true },
        ] as { id: Mode; label: string; showBadge?: boolean }[]
      ).map((opt) => {
        const selected = mode === opt.id;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            testID={`ledger-toggle-${opt.id}`}
            style={({ pressed }) => ({
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: selected ? c.card : "transparent",
              opacity: pressed ? 0.85 : 1,
              borderWidth: selected ? 1 : 0,
              borderColor: c.border,
            })}
          >
            <AppText
              weight="semibold"
              color={selected ? c.foreground : c.mutedForeground}
              style={{ fontSize: 13 }}
            >
              {opt.label}
            </AppText>
            {opt.showBadge ? <PlusBadge size="sm" variant="soft" /> : null}
          </Pressable>
        );
      })}
    </Row>
  );
}

function PlusUpsellCard({ onPress }: { onPress: () => void }) {
  const c = useColors();
  return (
    <Card
      style={{
        marginBottom: 16,
        backgroundColor: c.primarySoft,
        borderColor: c.primary,
      }}
    >
      <Row gap={12} align="flex-start">
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: c.card,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather name="bar-chart-2" size={18} color={c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Row gap={8} align="center" style={{ marginBottom: 4 }}>
            <AppText weight="semibold">Care Ledger Pro</AppText>
            <PlusBadge size="sm" variant="solid" />
          </Row>
          <AppText variant="caption" color={c.mutedForeground} style={{ lineHeight: 18 }}>
            See month-by-month bars, your top supporters, and your year recap —
            and download a beautifully formatted PDF + CSV any time.
          </AppText>
          <Button
            title="Try Plus"
            size="sm"
            onPress={onPress}
            testID="ledger-pro-upsell"
            style={{ marginTop: 12, alignSelf: "flex-start" }}
          />
        </View>
      </Row>
    </Card>
  );
}
