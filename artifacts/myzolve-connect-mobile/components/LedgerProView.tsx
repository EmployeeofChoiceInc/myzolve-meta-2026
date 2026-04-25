import React from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle, Line, Polyline } from "react-native-svg";

import { AppText, Card, Row } from "@/components/UI";
import { useColors } from "@/hooks/useColors";
import { formatMoney } from "@/lib/circleTypes";
import type { LedgerProView as LedgerProViewData } from "@workspace/api-client-react";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

type Props = {
  data: LedgerProViewData;
  years: number[];
  onYearChange: (year: number) => void;
  onExport: () => void;
  exportingYear: number | null;
};

export function LedgerProView({
  data,
  years,
  onYearChange,
  onExport,
  exportingYear,
}: Props) {
  const c = useColors();
  const isExportingThis = exportingYear === data.year;

  return (
    <View>
      {/* Year selector — horizontal pill row */}
      {years.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 4, marginBottom: 12 }}
        >
          {years.map((y) => {
            const selected = y === data.year;
            return (
              <Pressable
                key={y}
                onPress={() => onYearChange(y)}
                testID={`ledger-pro-year-${y}`}
                style={({ pressed }) => ({
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: selected ? c.primary : c.muted,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <AppText
                  weight="semibold"
                  color={selected ? c.primaryForeground : c.foreground}
                  style={{ fontSize: 13 }}
                >
                  {y}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {/* Soft headline + totals */}
      <Card style={{ marginBottom: 16 }}>
        <AppText color={c.mutedForeground} style={{ marginBottom: 12 }}>
          {data.softMessage}
        </AppText>
        <Row gap={10}>
          <View style={{ flex: 1 }}>
            <AppText variant="caption" color={c.mutedForeground}>
              You gave
            </AppText>
            <AppText variant="title" color={c.primary} style={{ marginTop: 4 }}>
              {formatMoney(data.totalGiven, data.currency)}
            </AppText>
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="caption" color={c.mutedForeground}>
              You received
            </AppText>
            <AppText variant="title" color={c.secondary} style={{ marginTop: 4 }}>
              {formatMoney(data.totalReceived, data.currency)}
            </AppText>
          </View>
        </Row>
        <Row gap={10} style={{ marginTop: 12 }}>
          <View style={{ flex: 1 }}>
            <AppText variant="caption" color={c.mutedForeground}>
              Repaid
            </AppText>
            <AppText weight="semibold" style={{ marginTop: 4 }}>
              {formatMoney(data.totalRepaid, data.currency)}
            </AppText>
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="caption" color={c.mutedForeground}>
              Forgiven
            </AppText>
            <AppText weight="semibold" style={{ marginTop: 4 }}>
              {formatMoney(data.totalForgiven, data.currency)}
            </AppText>
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="caption" color={c.mutedForeground}>
              Entries
            </AppText>
            <AppText weight="semibold" style={{ marginTop: 4 }}>
              {data.entryCount}
            </AppText>
          </View>
        </Row>
      </Card>

      {/* Monthly bars */}
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="center" style={{ marginBottom: 6 }}>
          <AppText weight="semibold">Month by month</AppText>
          <Row gap={10} align="center">
            <LegendDot color={c.primary} label="Given" />
            <LegendDot color={c.secondary} label="Received" />
          </Row>
        </Row>
        <MonthlyBars
          months={data.months}
          givenColor={c.primary}
          receivedColor={c.secondary}
          axisColor={c.mutedForeground}
        />
      </Card>

      {/* Running balance trend */}
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="center" style={{ marginBottom: 6 }}>
          <AppText weight="semibold">Running balance</AppText>
          <AppText variant="caption" color={c.mutedForeground}>
            Net give vs receive over the year
          </AppText>
        </Row>
        <BalanceTrend
          months={data.months}
          currency={data.currency}
          lineColor={c.primary}
          axisColor={c.mutedForeground}
          mutedColor={c.muted}
        />
      </Card>

      {/* Top supported / supporters */}
      <Card style={{ marginBottom: 16 }}>
        <AppText weight="semibold" style={{ marginBottom: 10 }}>
          You supported the most
        </AppText>
        <PeopleList
          people={data.topSupported}
          currency={data.currency}
          accent={c.primary}
          emptyText="No outgoing support logged this year yet."
        />
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <AppText weight="semibold" style={{ marginBottom: 10 }}>
          They showed up for you
        </AppText>
        <PeopleList
          people={data.topSupporters}
          currency={data.currency}
          accent={c.secondary}
          emptyText="No incoming support logged this year yet."
        />
      </Card>

      {/* Export action */}
      <Pressable
        onPress={onExport}
        disabled={isExportingThis}
        testID="ledger-pro-export"
        style={({ pressed }) => ({
          backgroundColor: c.primary,
          opacity: pressed || isExportingThis ? 0.9 : 1,
          borderRadius: 14,
          paddingVertical: 14,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
        })}
      >
        {isExportingThis ? (
          <ActivityIndicator color={c.primaryForeground} />
        ) : (
          <Feather name="download" size={16} color={c.primaryForeground} />
        )}
        <AppText weight="semibold" color={c.primaryForeground}>
          {isExportingThis ? "Preparing your recap…" : `Download ${data.year} recap`}
        </AppText>
      </Pressable>
      <AppText
        variant="caption"
        color={c.mutedForeground}
        style={{ marginTop: 8, textAlign: "center" }}
      >
        We'll generate a PDF + CSV, save them to your device, and let you share them.
      </AppText>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const c = useColors();
  return (
    <Row gap={6} align="center">
      <View
        style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }}
      />
      <AppText variant="caption" color={c.mutedForeground}>
        {label}
      </AppText>
    </Row>
  );
}

function MonthlyBars({
  months,
  givenColor,
  receivedColor,
  axisColor,
}: {
  months: LedgerProViewData["months"];
  givenColor: string;
  receivedColor: string;
  axisColor: string;
}) {
  const max = Math.max(
    1,
    ...months.flatMap((m) => [m.given, m.received]),
  );
  const HEIGHT = 120;
  return (
    <View style={{ marginTop: 8 }}>
      <Row gap={4} align="flex-end" style={{ height: HEIGHT }}>
        {months.map((m, i) => {
          const givenH = (m.given / max) * (HEIGHT - 4);
          const receivedH = (m.received / max) * (HEIGHT - 4);
          return (
            <View
              key={i}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "flex-end",
                justifyContent: "center",
                gap: 2,
              }}
              testID={`ledger-pro-month-${m.month}`}
            >
              <View
                style={{
                  flex: 1,
                  maxWidth: 8,
                  height: Math.max(givenH, m.given > 0 ? 2 : 0),
                  backgroundColor: givenColor,
                  borderRadius: 2,
                }}
              />
              <View
                style={{
                  flex: 1,
                  maxWidth: 8,
                  height: Math.max(receivedH, m.received > 0 ? 2 : 0),
                  backgroundColor: receivedColor,
                  borderRadius: 2,
                }}
              />
            </View>
          );
        })}
      </Row>
      <Row gap={4} style={{ marginTop: 6 }}>
        {MONTH_LABELS.map((label) => (
          <View key={label} style={{ flex: 1, alignItems: "center" }}>
            <AppText variant="caption" color={axisColor} style={{ fontSize: 10 }}>
              {label}
            </AppText>
          </View>
        ))}
      </Row>
    </View>
  );
}

function BalanceTrend({
  months,
  currency,
  lineColor,
  axisColor,
  mutedColor,
}: {
  months: LedgerProViewData["months"];
  currency: string;
  lineColor: string;
  axisColor: string;
  mutedColor: string;
}) {
  const c = useColors();
  const W = 320;
  const H = 110;
  const PAD_X = 6;
  const PAD_Y = 12;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y * 2;

  // Use absolute max so positive and negative balances share a centered axis.
  const absMax = Math.max(1, ...months.map((m) => Math.abs(m.balance)));

  const x = (i: number) => PAD_X + (i / 11) * innerW;
  const y = (val: number) => PAD_Y + innerH / 2 - (val / absMax) * (innerH / 2);

  const points = months.map((m, i) => `${x(i)},${y(m.balance)}`).join(" ");
  const last = months[months.length - 1];
  const peak = months.reduce(
    (acc, m) => (Math.abs(m.balance) > Math.abs(acc.balance) ? m : acc),
    months[0],
  );

  return (
    <View style={{ marginTop: 8 }}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* Zero line */}
        <Line
          x1={PAD_X}
          y1={PAD_Y + innerH / 2}
          x2={W - PAD_X}
          y2={PAD_Y + innerH / 2}
          stroke={mutedColor}
          strokeWidth={1}
          strokeDasharray="3,3"
        />
        <Polyline
          points={points}
          fill="none"
          stroke={lineColor}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {months.map((m, i) => (
          <Circle
            key={`bp-${i}`}
            cx={x(i)}
            cy={y(m.balance)}
            r={2.5}
            fill={lineColor}
          />
        ))}
      </Svg>
      <Row gap={4} style={{ marginTop: 4 }}>
        {MONTH_LABELS.map((label) => (
          <View key={`bl-${label}`} style={{ flex: 1, alignItems: "center" }}>
            <AppText variant="caption" color={axisColor} style={{ fontSize: 10 }}>
              {label}
            </AppText>
          </View>
        ))}
      </Row>
      <Row justify="space-between" style={{ marginTop: 8 }}>
        <View>
          <AppText variant="caption" color={c.mutedForeground}>
            Year-end balance
          </AppText>
          <AppText weight="semibold" color={lineColor}>
            {formatMoney(last?.balance ?? 0, currency)}
          </AppText>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <AppText variant="caption" color={c.mutedForeground}>
            Peak ({MONTH_LABELS[(peak?.month ?? 1) - 1]})
          </AppText>
          <AppText weight="semibold">
            {formatMoney(peak?.balance ?? 0, currency)}
          </AppText>
        </View>
      </Row>
    </View>
  );
}

function PeopleList({
  people,
  currency,
  accent,
  emptyText,
}: {
  people: LedgerProViewData["topSupported"];
  currency: string;
  accent: string;
  emptyText: string;
}) {
  const c = useColors();
  if (people.length === 0) {
    return (
      <AppText variant="caption" color={c.mutedForeground}>
        {emptyText}
      </AppText>
    );
  }
  return (
    <View style={{ gap: 10 }}>
      {people.map((p, i) => (
        <Row
          key={`${p.userId ?? "n"}-${p.name}-${i}`}
          justify="space-between"
          align="center"
        >
          <Row gap={10} align="center" style={{ flex: 1 }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: c.muted,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AppText weight="semibold" style={{ fontSize: 12 }} color={accent}>
                {p.name.slice(0, 1).toUpperCase()}
              </AppText>
            </View>
            <View style={{ flex: 1 }}>
              <AppText weight="semibold" numberOfLines={1}>
                {p.name}
              </AppText>
              <AppText variant="caption" color={c.mutedForeground}>
                {p.count} {p.count === 1 ? "time" : "times"}
              </AppText>
            </View>
          </Row>
          <AppText weight="semibold" color={accent}>
            {formatMoney(p.amount, currency)}
          </AppText>
        </Row>
      ))}
    </View>
  );
}
