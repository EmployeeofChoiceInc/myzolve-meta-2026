import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetLatestWrapupQueryKey,
  getListWrapupsQueryKey,
  useGetLatestWrapup,
  useListWrapups,
  useMarkWrapupRead,
  type Wrapup,
  type WrapupContent,
  type WrapupMoment,
} from "@workspace/api-client-react";

import {
  AppText,
  Avatar,
  Card,
  Empty,
  PressableCard,
  Row,
  Skeleton,
} from "@/components/UI";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";

type Kind = "weekly" | "monthly";

const MOMENT_ICON: Record<WrapupMoment["kind"], keyof typeof Feather.glyphMap> = {
  request_fulfilled: "check-circle",
  gratitude_received: "gift",
  gratitude_sent: "send",
  top_comment: "message-square",
  reaction_received: "heart",
};

function parseKind(raw: unknown): Kind {
  if (raw === "monthly" || (Array.isArray(raw) && raw[0] === "monthly")) {
    return "monthly";
  }
  return "weekly";
}

export default function WrapupScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind = parseKind(params.kind);
  const router = useRouter();
  const c = useColors();
  const qc = useQueryClient();
  const { t } = useTranslation();

  const latestQuery = useGetLatestWrapup({ kind });
  const pastQuery = useListWrapups({ kind, limit: 6 });
  const markRead = useMarkWrapupRead();

  const wrapup = latestQuery.data ?? null;
  const past = (pastQuery.data ?? []).filter((w) => w.id !== wrapup?.id);

  useEffect(() => {
    if (!wrapup || wrapup.readAt) return;
    markRead.mutate(
      { wrapupId: wrapup.id },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetLatestWrapupQueryKey({ kind }) });
          qc.invalidateQueries({ queryKey: getListWrapupsQueryKey() });
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrapup?.id]);

  const refreshing =
    latestQuery.isRefetching || pastQuery.isRefetching;
  function refetch() {
    latestQuery.refetch();
    pastQuery.refetch();
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: kind === "monthly" ? t("navigation.yourMonth") : t("navigation.yourWeek"),
        }}
      />
      <Screen refreshing={refreshing} onRefresh={refetch}>
        <Row gap={8} style={{ marginBottom: 16 }}>
          <KindToggle
            label={t("wrapup.thisWeek")}
            active={kind === "weekly"}
            onPress={() => router.replace("/wrapup")}
          />
          <KindToggle
            label={t("wrapup.thisMonth")}
            active={kind === "monthly"}
            onPress={() => router.replace("/wrapup?kind=monthly")}
          />
        </Row>

        {latestQuery.isLoading ? (
          <View style={{ gap: 12 }} accessibilityLabel={t("common.loading")}>
            <Skeleton height={120} />
            <Skeleton height={80} />
            <Skeleton height={80} />
          </View>
        ) : !wrapup ? (
          <EmptyWrapupCard kind={kind} />
        ) : (
          <WrapupBody wrapup={wrapup} />
        )}

        {past.length > 0 && (
          <>
            <View style={{ height: 24 }} />
            <AppText variant="title" accessibilityRole="header" style={{ marginBottom: 10 }}>
              {t("wrapup.pastWrapups")}
            </AppText>
            <View style={{ gap: 8 }}>
              {past.map((w) => (
                <PastWrapupRow key={w.id} wrapup={w} />
              ))}
            </View>
          </>
        )}

        <View style={{ height: 32 }} />
        <Card>
          <Row gap={10}>
            <Feather
              name="info"
              size={18}
              color={c.mutedForeground}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
            <AppText
              variant="caption"
              color={c.mutedForeground}
              style={{ flex: 1 }}
            >
              {t("wrapup.privacyNote")}
            </AppText>
          </Row>
        </Card>
      </Screen>
    </>
  );
}

function KindToggle({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        alignItems: "center",
        backgroundColor: active ? c.primary : c.muted,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <AppText
        weight="semibold"
        color={active ? c.primaryForeground : c.foreground}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

function EmptyWrapupCard({ kind }: { kind: Kind }) {
  const c = useColors();
  const { t } = useTranslation();
  return (
    <Card style={{ alignItems: "center", paddingVertical: 28, gap: 8 }}>
      <Feather
        name="coffee"
        size={28}
        color={c.mutedForeground}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <AppText weight="semibold">{t("wrapup.noWrapupYet")}</AppText>
      <AppText
        color={c.mutedForeground}
        variant="caption"
        style={{ textAlign: "center", maxWidth: 260 }}
      >
        {kind === "weekly"
          ? t("wrapup.weeklyComing")
          : t("wrapup.monthlyComing")}
      </AppText>
    </Card>
  );
}

function WrapupBody({ wrapup }: { wrapup: Wrapup }) {
  const c = useColors();
  const { t } = useTranslation();
  const content = wrapup.content as WrapupContent;

  return (
    <View>
      <Card
        style={{
          backgroundColor: c.primarySoft,
          borderColor: c.primarySoft,
          gap: 6,
        }}
      >
        <AppText
          variant="caption"
          color={c.primary}
          weight="semibold"
          style={{ letterSpacing: 0.5 }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {content.periodLabel.toUpperCase()}
        </AppText>
        <AppText variant="h1" accessibilityRole="header" style={{ marginTop: 4 }}>
          {content.greeting}
        </AppText>
        <AppText color={c.mutedForeground} style={{ marginTop: 4 }}>
          {t("wrapup.shortLookBack")}
        </AppText>
        <Row gap={20} style={{ marginTop: 14 }}>
          <View
            accessibilityLabel={`${warmCount(content.supportGiven, t)} ${t("wrapup.given")}`}
          >
            <AppText variant="h2" color={c.primary}>
              {warmCount(content.supportGiven, t)}
            </AppText>
            <AppText variant="caption" color={c.mutedForeground}>
              {acts(content.supportGiven, "given", t)}
            </AppText>
          </View>
          <View
            accessibilityLabel={`${warmCount(content.supportReceived, t)} ${t("wrapup.received")}`}
          >
            <AppText variant="h2" color={c.secondary}>
              {warmCount(content.supportReceived, t)}
            </AppText>
            <AppText variant="caption" color={c.mutedForeground}>
              {acts(content.supportReceived, "received", t)}
            </AppText>
          </View>
        </Row>
      </Card>

      {content.topMoments.length > 0 && (
        <>
          <View style={{ height: 20 }} />
          <AppText variant="title" accessibilityRole="header" style={{ marginBottom: 10 }}>
            {t("wrapup.topMoments")}
          </AppText>
          <View style={{ gap: 10 }}>
            {content.topMoments.map((m, i) => (
              <MomentCard key={i} moment={m} />
            ))}
          </View>
        </>
      )}

      {content.exchangedWith.length > 0 && (
        <>
          <View style={{ height: 20 }} />
          <AppText variant="title" accessibilityRole="header" style={{ marginBottom: 10 }}>
            {t("wrapup.exchangedWith")}
          </AppText>
          <Card>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
              {content.exchangedWith.map((p, i) => (
                <View
                  key={`${p.userId ?? "x"}-${i}`}
                  style={{ alignItems: "center", width: 64 }}
                >
                  <Avatar
                    name={p.name}
                    objectPath={p.avatarObjectPath ?? undefined}
                    size={48}
                  />
                  <AppText
                    variant="caption"
                    style={{ marginTop: 6, textAlign: "center" }}
                    numberOfLines={1}
                  >
                    {firstName(p.name)}
                  </AppText>
                </View>
              ))}
            </View>
          </Card>
        </>
      )}

      <View style={{ height: 20 }} />
      <Card
        style={{
          backgroundColor: c.secondarySoft,
          borderColor: c.secondarySoft,
        }}
      >
        <Row gap={10} align="flex-start">
          <Feather
            name="feather"
            size={18}
            color={c.secondary}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          <View style={{ flex: 1 }}>
            <AppText
              variant="caption"
              color={c.secondary}
              weight="semibold"
              style={{ letterSpacing: 0.5 }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {t("wrapup.forTheWeekAhead")}
            </AppText>
            <AppText style={{ marginTop: 4 }}>{content.prompt}</AppText>
          </View>
        </Row>
      </Card>
    </View>
  );
}

function MomentCard({ moment }: { moment: WrapupMoment }) {
  const c = useColors();
  const { t } = useTranslation();
  const icon = MOMENT_ICON[moment.kind] ?? "star";
  const momentLabel = t(`wrapup.moments.${moment.kind}`, { defaultValue: t("wrapup.moments.default") });
  return (
    <Card>
      <Row gap={12} align="flex-start">
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: c.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather name={icon} size={18} color={c.accentForeground} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText
            variant="caption"
            color={c.mutedForeground}
            weight="medium"
            style={{ marginBottom: 2 }}
          >
            {momentLabel}
            {moment.circleName ? ` · ${moment.circleName}` : ""}
          </AppText>
          <AppText weight="semibold">{moment.headline}</AppText>
          {moment.detail ? (
            <AppText
              color={c.mutedForeground}
              variant="caption"
              style={{ marginTop: 4 }}
            >
              "{moment.detail}"
            </AppText>
          ) : null}
        </View>
      </Row>
    </Card>
  );
}

function PastWrapupRow({ wrapup }: { wrapup: Wrapup }) {
  const c = useColors();
  const { t } = useTranslation();
  const content = wrapup.content as WrapupContent;
  return (
    <PressableCard
      onPress={() => undefined}
      accessibilityLabel={content.periodLabel}
      accessibilityHint={`${warmCount(content.supportGiven, t)} ${t("wrapup.given")} · ${warmCount(content.supportReceived, t)} ${t("wrapup.received")}`}
    >
      <Row justify="space-between" align="center">
        <View style={{ flex: 1 }}>
          <AppText weight="semibold">{content.periodLabel}</AppText>
          <AppText
            variant="caption"
            color={c.mutedForeground}
            style={{ marginTop: 2 }}
          >
            {warmCount(content.supportGiven, t)}{" "}
            {acts(content.supportGiven, "given", t)} ·{" "}
            {warmCount(content.supportReceived, t)}{" "}
            {acts(content.supportReceived, "received", t)}
          </AppText>
        </View>
        <Feather
          name={wrapup.readAt ? "check" : "circle"}
          size={18}
          color={c.mutedForeground}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </Row>
    </PressableCard>
  );
}

type TFn = (key: string, opts?: Record<string, unknown>) => string;

function warmCount(n: number, t: TFn): string {
  if (n === 0) return t("wrapup.quietWeek", { defaultValue: "A quiet week" });
  if (n === 1) return t("wrapup.oneAct", { defaultValue: "1 act of care" });
  return t("wrapup.manyActs", { count: n, defaultValue: `${n} acts of care` });
}

function acts(n: number, suffix: "given" | "received", t: TFn): string {
  if (n === 0) return t("wrapup.thisTime", { defaultValue: "this time" });
  return t(`wrapup.${suffix}`, { defaultValue: suffix });
}

function firstName(name: string): string {
  return name.split(/\s+/)[0] || name;
}
