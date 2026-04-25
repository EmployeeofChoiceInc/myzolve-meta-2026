import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getGetCircleLedgerProQueryKey,
  getGetCircleLedgerProYearsQueryKey,
  getListCirclesQueryKey,
  useCreateCircleLedgerExport,
  useGetCircleLedgerPro,
  useGetCircleLedgerProYears,
  useListCircles,
} from "@workspace/api-client-react";

import { AppText, Card, Empty, IconButton, Row, Skeleton } from "@/components/UI";
import { LedgerProView } from "@/components/LedgerProView";
import { PlusBadge } from "@/components/PlusBadge";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";
import { downloadAndShareExport } from "@/lib/downloadExport";
import { useSubscription } from "@/lib/revenuecat";
import { safeBack } from "@/lib/safeBack";
import { markYearRecapSeen } from "@/lib/yearRecapFlag";

// Plus-only year recap; free members see an upsell prompt instead.
export default function YearRecapScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const { isPlus } = useSubscription();

  const params = useLocalSearchParams<{ circleId?: string; year?: string }>();
  const queryCircleId = params.circleId ? Number(params.circleId) : null;
  const queryYear = params.year ? Number(params.year) : null;

  // Default to the previous calendar year — the recap is a look back at
  // the year that just ended, not the one in progress.
  const defaultYear = useMemo(() => {
    if (queryYear) return queryYear;
    const now = new Date();
    return now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  }, [queryYear]);

  const circlesQuery = useListCircles({
    query: { enabled: isPlus, queryKey: getListCirclesQueryKey() },
  });
  const circleId =
    queryCircleId ??
    circlesQuery.data?.[0]?.id ??
    null;

  const yearsCircleId = circleId ?? 0;
  const yearsQuery = useGetCircleLedgerProYears(yearsCircleId, {
    query: {
      enabled: isPlus && !!circleId,
      queryKey: getGetCircleLedgerProYearsQueryKey(yearsCircleId),
    },
  });

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const effectiveYear =
    selectedYear ?? queryYear ?? yearsQuery.data?.defaultYear ?? defaultYear;

  const proCircleId = circleId ?? 0;
  const proQuery = useGetCircleLedgerPro(
    proCircleId,
    { year: effectiveYear },
    {
      query: {
        enabled: isPlus && !!circleId,
        queryKey: getGetCircleLedgerProQueryKey(proCircleId, { year: effectiveYear }),
      },
    },
  );

  // Mark this year as "seen" the moment the screen renders for a Plus
  // member so the Jan auto-present logic doesn't fire again this year.
  useEffect(() => {
    if (isPlus) {
      markYearRecapSeen(userId, effectiveYear);
    }
  }, [isPlus, userId, effectiveYear]);

  const exportMut = useCreateCircleLedgerExport();
  const [exportingYear, setExportingYear] = useState<number | null>(null);

  async function handleExport(year: number) {
    if (!circleId) return;
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
      // Silent — user can re-tap.
    } finally {
      setExportingYear(null);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Year of Care" }} />
      <Screen contentStyle={{ paddingTop: insets.top + 12 }}>
        <Row align="center" justify="space-between" style={{ marginBottom: 16 }}>
          <IconButton icon="arrow-left" onPress={() => safeBack(router)} />
          <PlusBadge size="sm" variant="soft" />
        </Row>

        <AppText variant="h1">Year of Care</AppText>
        <AppText
          color={c.mutedForeground}
          style={{ marginTop: 4, marginBottom: 20 }}
        >
          A warm look back at the support that flowed through your circle.
        </AppText>

        {!isPlus ? (
          <PlusGate onUpgrade={() => router.push("/plus" as never)} />
        ) : !circleId ? (
          <Empty
            icon="users"
            title="No circle yet"
            subtitle="Create or join a circle to see your year recap."
          />
        ) : proQuery.isLoading || yearsQuery.isLoading ? (
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
            title="Couldn't build your recap"
            subtitle="Pull down to retry."
          />
        )}
      </Screen>
    </>
  );
}

function PlusGate({ onUpgrade }: { onUpgrade: () => void }) {
  const c = useColors();
  return (
    <Card style={{ backgroundColor: c.primarySoft, borderColor: c.primary }}>
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
          <Feather name="gift" size={18} color={c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText weight="semibold">Year recap is a Plus moment</AppText>
          <AppText
            variant="caption"
            color={c.mutedForeground}
            style={{ marginTop: 4, lineHeight: 18 }}
          >
            Look back on the support, the gifts, and the quiet acts of care that
            shaped your year — with a downloadable PDF you can keep or share.
          </AppText>
          <Pressable
            onPress={onUpgrade}
            style={({ pressed }) => ({
              marginTop: 12,
              alignSelf: "flex-start",
              backgroundColor: c.primary,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 999,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <AppText weight="semibold" color={c.primaryForeground}>
              See Plus
            </AppText>
          </Pressable>
        </View>
      </Row>
    </Card>
  );
}
