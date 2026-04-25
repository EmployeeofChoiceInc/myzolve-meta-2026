import { useAuth, useUser } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { hasAcknowledgedOnboarding } from "@/lib/onboardingFlag";
import { hasSeenYearRecap } from "@/lib/yearRecapFlag";
import { useSubscription } from "@/lib/revenuecat";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getListUpcomingCareDatesQueryKey,
  useGetCircleDashboard,
  useListCircles,
  useListSupportRequests,
  useListUpcomingCareDates,
  type CareDate,
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
import { useIntlLocale } from "@/hooks/useDateLocale";
import {
  URGENCY_COLORS,
  useCircleTypeLabel,
  useFormatMoney,
  useUrgencyLabel,
} from "@/lib/circleTypes";

export default function HomeScreen() {
  const { user } = useUser();
  const { isLoaded: authLoaded, isSignedIn, userId } = useAuth();
  const { t } = useTranslation();
  const formatMoney = useFormatMoney();
  const circleLabel = useCircleTypeLabel();
  const urgencyLabel = useUrgencyLabel();
  const locale = useIntlLocale();
  const [onboardingAck, setOnboardingAck] = useState<boolean | undefined>(
    undefined,
  );
  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setOnboardingAck(undefined);
      return;
    }
    hasAcknowledgedOnboarding(userId).then((v) => {
      if (!cancelled) setOnboardingAck(v);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  const authReady = !!authLoaded && !!isSignedIn;
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    data: circles,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useListCircles({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: { enabled: authReady } as any,
  });
  const firstCircle = circles?.[0];
  const dashboardQuery = useGetCircleDashboard(firstCircle?.id ?? 0, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: { enabled: authReady && !!firstCircle } as any,
  });
  const requestsQuery = useListSupportRequests(firstCircle?.id ?? 0, undefined, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: { enabled: authReady && !!firstCircle } as any,
  });
  const upcomingDatesParams = { limit: 3, withinDays: 14 };
  const upcomingDatesQuery = useListUpcomingCareDates(upcomingDatesParams, {
    query: {
      enabled: authReady,
      queryKey: getListUpcomingCareDatesQueryKey(upcomingDatesParams),
    },
  });

  useEffect(() => {
    if (
      !isLoading &&
      circles &&
      circles.length === 0 &&
      onboardingAck === false
    ) {
      router.replace("/onboarding");
    }
  }, [isLoading, circles, router, onboardingAck]);

  const { isPlus } = useSubscription();
  useEffect(() => {
    if (!isPlus || !userId) return;
    if (!circles || circles.length === 0) return;
    const now = new Date();
    if (now.getMonth() !== 0) return;
    const recapYear = now.getFullYear() - 1;
    let cancelled = false;
    hasSeenYearRecap(userId, recapYear).then((seen) => {
      if (cancelled || seen) return;
      router.push(
        `/year-recap?circleId=${circles[0].id}&year=${recapYear}` as never,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [isPlus, userId, circles, router]);

  const greeting = user?.firstName
    ? t("home.greetingNamed", { name: user.firstName })
    : t("home.greetingDefault");
  const dashboard = dashboardQuery.data;
  const openRequests = (requestsQuery.data ?? [])
    .filter((r) => !["completed", "archived", "canceled"].includes(r.status))
    .slice(0, 3);
  const upcomingDates = upcomingDatesQuery.data ?? [];

  return (
    <Screen
      contentStyle={{ paddingTop: insets.top + 12 }}
      refreshing={isRefetching}
      onRefresh={refetch}
    >
      <AppText variant="h1" accessibilityRole="header">{greeting}</AppText>
      <AppText color={c.mutedForeground} style={{ marginTop: 4, marginBottom: 24 }}>
        {t("home.subtitle")}
      </AppText>

      {firstCircle && (
        <Row gap={12} style={{ marginBottom: 24 }}>
          <Button
            title={t("home.askForSupport")}
            icon="plus"
            onPress={() => router.push(`/circle/${firstCircle.id}/new-request`)}
            style={{ flex: 1 }}
          />
          <Button
            title={t("home.offerHelp")}
            icon="heart"
            variant="outline"
            onPress={() => router.push(`/circle/${firstCircle.id}/new-service`)}
            style={{ flex: 1 }}
          />
        </Row>
      )}

      {upcomingDates.length > 0 && (
        <UpcomingDatesCard
          dates={upcomingDates}
          locale={locale}
          onOpenCalendar={(circleId) =>
            router.push(`/circle/${circleId}/calendar`)
          }
          onSendNote={(targetUserId) =>
            router.push(`/messages/${targetUserId}` as never)
          }
        />
      )}

      <AppText variant="title" accessibilityRole="header" style={{ marginBottom: 12 }}>
        {t("home.yourCircles")}
      </AppText>
      {isLoading ? (
        <View style={{ gap: 12 }} accessibilityLabel={t("common.loading")}>
          {[0, 1].map((i) => (
            <View
              key={i}
              style={{
                backgroundColor: c.card,
                borderColor: c.border,
                borderWidth: 1,
                borderRadius: 16,
                padding: 16,
                gap: 10,
              }}
            >
              <Skeleton height={18} width={90} />
              <Skeleton height={20} width={220} />
              <Skeleton height={14} width={80} />
            </View>
          ))}
        </View>
      ) : isError ? (
        <Card
          style={{
            paddingVertical: 24,
            alignItems: "center",
            gap: 8,
          }}
        >
          <Feather
            name="wifi-off"
            size={28}
            color={c.mutedForeground}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          <AppText weight="semibold">{t("common.offlineTitle")}</AppText>
          <AppText
            color={c.mutedForeground}
            variant="caption"
            style={{ textAlign: "center", maxWidth: 280 }}
          >
            {(error as Error | undefined)?.message ?? t("common.offlineBody")}
          </AppText>
          <Button
            title={t("common.tryAgain")}
            variant="outline"
            size="sm"
            onPress={() => refetch()}
            style={{ marginTop: 4 }}
          />
        </Card>
      ) : circles && circles.length > 0 ? (
        <View style={{ gap: 12 }}>
          {circles.slice(0, 4).map((circle) => (
            <PressableCard
              key={circle.id}
              onPress={() => router.push(`/circle/${circle.id}`)}
              testID={`circle-card-${circle.id}`}
              accessibilityLabel={circle.name}
              accessibilityHint={t("common.memberCount", { count: circle.memberCount })}
            >
              <Row justify="space-between" align="flex-start">
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Pill label={circleLabel(circle.circleType)} />
                  <AppText variant="title" style={{ marginTop: 8 }}>
                    {circle.name}
                  </AppText>
                  <AppText color={c.mutedForeground} variant="caption" style={{ marginTop: 4 }}>
                    {t("common.memberCount", { count: circle.memberCount })}
                  </AppText>
                </View>
                <Feather
                  name="chevron-right"
                  size={20}
                  color={c.mutedForeground}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
              </Row>
            </PressableCard>
          ))}
          {circles.length > 4 && (
            <Button
              title={t("home.seeAllCircles", { count: circles.length })}
              variant="ghost"
              onPress={() => router.push("/(tabs)/circles")}
            />
          )}
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <Empty
            icon="users"
            title={t("home.noCirclesTitle")}
            subtitle={t("home.noCirclesSubtitle")}
          />
          <Button
            title={t("home.createFirstCircle")}
            icon="plus"
            onPress={() => router.push("/onboarding")}
            testID="button-home-create-first-circle"
          />
        </View>
      )}

      {firstCircle && (
        <>
          <View style={{ height: 32 }} />
          <Row justify="space-between" style={{ marginBottom: 12 }}>
            <AppText variant="title" accessibilityRole="header">{t("home.openRequests")}</AppText>
            <Button
              title={t("home.seeAll")}
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
                  {t("home.openRequestsLabel")}
                </AppText>
              </Card>
              <Card style={{ flex: 1, alignItems: "center", paddingVertical: 14 }}>
                <AppText variant="h2" color={c.secondary}>
                  {dashboard.activeServices}
                </AppText>
                <AppText variant="caption" color={c.mutedForeground} style={{ marginTop: 2 }}>
                  {t("home.servicesLabel")}
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
                  {t("home.urgentLabel")}
                </AppText>
              </Card>
            </Row>
          )}

          {openRequests.length === 0 ? (
            <Empty
              icon="check-circle"
              title={t("home.allQuietTitle")}
              subtitle={t("home.allQuietSubtitle")}
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
                    accessibilityLabel={req.title}
                    accessibilityHint={`${urgencyLabel(req.urgencyLevel)} · ${formatMoney(req.amountFunded, req.currency)} / ${formatMoney(req.amountRequested, req.currency)}`}
                  >
                    <Row justify="space-between" align="flex-start" style={{ marginBottom: 10 }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <AppText weight="semibold">{req.title}</AppText>
                        <AppText variant="caption" color={c.mutedForeground} style={{ marginTop: 2 }}>
                          {req.createdByName}
                        </AppText>
                      </View>
                      <Pill
                        label={urgencyLabel(req.urgencyLevel)}
                        bg={urg.bg}
                        fg={urg.fg}
                      />
                    </Row>
                    <Progress value={pct} />
                    <Row justify="space-between" style={{ marginTop: 8 }}>
                      <AppText variant="caption" color={c.mutedForeground}>
                        {t("home.supported", { amount: formatMoney(req.amountFunded, req.currency) })}
                      </AppText>
                      <AppText variant="caption" color={c.mutedForeground}>
                        {t("home.goal", { amount: formatMoney(req.amountRequested, req.currency) })}
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
              <AppText variant="title" accessibilityRole="header" style={{ marginBottom: 12 }}>
                {t("home.gentleReminders")}
              </AppText>
              <View style={{ gap: 10 }}>
                {dashboard.pendingRepayments.slice(0, 3).map((r) => (
                  <PressableCard
                    key={r.requestId}
                    onPress={() => router.push(`/request/${r.requestId}`)}
                    accessibilityLabel={r.requestTitle}
                    accessibilityHint={t("home.amountToReturn", { amount: formatMoney(r.amountOwed, r.currency) })}
                    style={{ backgroundColor: c.secondarySoft, borderColor: c.secondarySoft }}
                  >
                    <Row justify="space-between">
                      <View style={{ flex: 1 }}>
                        <AppText weight="semibold">{r.requestTitle}</AppText>
                        <AppText variant="caption" color={c.mutedForeground} style={{ marginTop: 2 }}>
                          {t("home.amountToReturn", { amount: formatMoney(r.amountOwed, r.currency) })}
                        </AppText>
                      </View>
                      <Feather
                        name="arrow-right"
                        size={18}
                        color={c.mutedForeground}
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                      />
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

function formatRelative(iso: string, locale: string, t: (key: string) => string): string {
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10));
  const target = new Date(y, (m ?? 1) - 1, d ?? 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return t("common.today");
  if (days === 1) return t("common.tomorrow");
  return target.toLocaleDateString(locale, { weekday: "long", month: "short", day: "numeric" });
}

function UpcomingDatesCard({
  dates,
  locale,
  onOpenCalendar,
  onSendNote,
}: {
  dates: CareDate[];
  locale: string;
  onOpenCalendar: (circleId: number) => void;
  onSendNote: (targetUserId: number) => void;
}) {
  const c = useColors();
  const { t } = useTranslation();
  return (
    <Card
      style={{
        backgroundColor: c.secondarySoft,
        borderColor: c.secondarySoft,
        marginBottom: 24,
        gap: 10,
      }}
    >
      <Row gap={8} align="center">
        <Feather
          name="calendar"
          size={16}
          color={c.secondary}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <AppText weight="semibold">{t("home.thisWeekInCircles")}</AppText>
      </Row>
      <View style={{ gap: 8 }}>
        {dates.map((d) => (
          <Pressable
            key={d.id}
            onPress={() => onOpenCalendar(d.circleId)}
            accessibilityRole="button"
            accessibilityLabel={d.name}
            accessibilityHint={formatRelative(d.nextOccurrence, locale, t)}
            style={({ pressed }) => ({
              padding: 10,
              borderRadius: 12,
              backgroundColor: c.card,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Row justify="space-between" align="center">
              <View style={{ flex: 1, marginRight: 8 }}>
                <AppText weight="semibold">{d.name}</AppText>
                <AppText variant="caption" color={c.mutedForeground} style={{ marginTop: 2 }}>
                  {formatRelative(d.nextOccurrence, locale, t)}
                  {d.targetUserName ? ` · ${t("home.forUser", { name: d.targetUserName })}` : ""}
                  {d.circleName ? ` · ${d.circleName}` : ""}
                </AppText>
              </View>
              {d.targetUserId ? (
                <Button
                  title={t("home.sendNote")}
                  size="sm"
                  variant="outline"
                  icon="message-circle"
                  onPress={() => onSendNote(d.targetUserId!)}
                />
              ) : (
                <Feather
                  name="chevron-right"
                  size={18}
                  color={c.mutedForeground}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
              )}
            </Row>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}
