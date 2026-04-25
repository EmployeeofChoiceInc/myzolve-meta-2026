import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
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

export default function YearRecapScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const { isPlus } = useSubscription();
  const { t } = useTranslation();

  const params = useLocalSearchParams<{ circleId?: string; year?: string }>();
  const queryCircleId = params.circleId ? Number(params.circleId) : null;
  const queryYear = params.year ? Number(params.year) : null;

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
      <Stack.Screen options={{ title: t("navigation.yearOfCare") }} />
      <Screen contentStyle={{ paddingTop: insets.top + 12 }}>
        <Row align="center" justify="space-between" style={{ marginBottom: 16 }}>
          <IconButton
            icon="arrow-left"
            accessibilityLabel={t("a11y.backButton")}
            onPress={() => safeBack(router)}
          />
          <PlusBadge size="sm" variant="soft" />
        </Row>

        <AppText variant="h1" accessibilityRole="header">{t("yearRecap.title")}</AppText>
        <AppText
          color={c.mutedForeground}
          style={{ marginTop: 4, marginBottom: 20 }}
        >
          {t("yearRecap.subtitle")}
        </AppText>

        {!isPlus ? (
          <PlusGate onUpgrade={() => router.push("/plus" as never)} />
        ) : !circleId ? (
          <Empty
            icon="users"
            title={t("yearRecap.noCircle")}
            subtitle={t("yearRecap.noCircleSubtitle")}
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
            title={t("yearRecap.couldntBuild")}
            subtitle={t("yearRecap.pullToRetry")}
          />
        )}
      </Screen>
    </>
  );
}

function PlusGate({ onUpgrade }: { onUpgrade: () => void }) {
  const c = useColors();
  const { t } = useTranslation();
  return (
    <Card style={{ backgroundColor: c.primarySoft, borderColor: c.primary }}>
      <Row gap={12} align="flex-start">
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
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
          <AppText weight="semibold">{t("yearRecap.plusGateTitle")}</AppText>
          <AppText
            variant="caption"
            color={c.mutedForeground}
            style={{ marginTop: 4, lineHeight: 18 }}
          >
            {t("yearRecap.plusGateBody")}
          </AppText>
          <Pressable
            onPress={onUpgrade}
            accessibilityRole="button"
            accessibilityLabel={t("yearRecap.seePlus")}
            hitSlop={8}
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
              {t("yearRecap.seePlus")}
            </AppText>
          </Pressable>
        </View>
      </Row>
    </Card>
  );
}
