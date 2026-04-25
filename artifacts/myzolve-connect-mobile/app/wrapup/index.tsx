import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { Pressable, View } from "react-native";
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

const MOMENT_LABEL: Record<WrapupMoment["kind"], string> = {
  request_fulfilled: "A request was answered",
  gratitude_received: "A thank-you came your way",
  gratitude_sent: "You sent a thank-you",
  top_comment: "A note you wrote landed",
  reaction_received: "Someone reacted to you",
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

  const latestQuery = useGetLatestWrapup({ kind });
  const pastQuery = useListWrapups({ kind, limit: 6 });
  const markRead = useMarkWrapupRead();

  const wrapup = latestQuery.data ?? null;
  const past = (pastQuery.data ?? []).filter((w) => w.id !== wrapup?.id);

  // Mark the latest wrap-up as read once it is on screen.
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
        options={{ title: kind === "monthly" ? "Your month" : "Your week" }}
      />
      <Screen refreshing={refreshing} onRefresh={refetch}>
        <Row gap={8} style={{ marginBottom: 16 }}>
          <KindToggle
            label="This week"
            active={kind === "weekly"}
            onPress={() => router.replace("/wrapup")}
          />
          <KindToggle
            label="This month"
            active={kind === "monthly"}
            onPress={() => router.replace("/wrapup?kind=monthly")}
          />
        </Row>

        {latestQuery.isLoading ? (
          <View style={{ gap: 12 }}>
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
            <AppText variant="title" style={{ marginBottom: 10 }}>
              Past wrap-ups
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
            <Feather name="info" size={18} color={c.mutedForeground} />
            <AppText
              variant="caption"
              color={c.mutedForeground}
              style={{ flex: 1 }}
            >
              We collect this quietly in the background — only you can see it.
              You can turn weekly or monthly wrap-ups off anytime in Settings.
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
  return (
    <Card style={{ alignItems: "center", paddingVertical: 28, gap: 8 }}>
      <Feather name="coffee" size={28} color={c.mutedForeground} />
      <AppText weight="semibold">No wrap-up yet</AppText>
      <AppText
        color={c.mutedForeground}
        variant="caption"
        style={{ textAlign: "center", maxWidth: 260 }}
      >
        {kind === "weekly"
          ? "Your first weekly wrap-up will arrive on Sunday morning."
          : "Your first monthly wrap-up will arrive on the 1st of the month."}
      </AppText>
    </Card>
  );
}

function WrapupBody({ wrapup }: { wrapup: Wrapup }) {
  const c = useColors();
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
        >
          {content.periodLabel.toUpperCase()}
        </AppText>
        <AppText variant="h1" style={{ marginTop: 4 }}>
          {content.greeting}
        </AppText>
        <AppText color={c.mutedForeground} style={{ marginTop: 4 }}>
          A short look back at the care you shared.
        </AppText>
        <Row gap={20} style={{ marginTop: 14 }}>
          <View>
            <AppText variant="h2" color={c.primary}>
              {warmCount(content.supportGiven)}
            </AppText>
            <AppText variant="caption" color={c.mutedForeground}>
              {acts(content.supportGiven, "given")}
            </AppText>
          </View>
          <View>
            <AppText variant="h2" color={c.secondary}>
              {warmCount(content.supportReceived)}
            </AppText>
            <AppText variant="caption" color={c.mutedForeground}>
              {acts(content.supportReceived, "received")}
            </AppText>
          </View>
        </Row>
      </Card>

      {content.topMoments.length > 0 && (
        <>
          <View style={{ height: 20 }} />
          <AppText variant="title" style={{ marginBottom: 10 }}>
            Top moments
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
          <AppText variant="title" style={{ marginBottom: 10 }}>
            People you exchanged care with
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
          <Feather name="feather" size={18} color={c.secondary} />
          <View style={{ flex: 1 }}>
            <AppText
              variant="caption"
              color={c.secondary}
              weight="semibold"
              style={{ letterSpacing: 0.5 }}
            >
              FOR THE WEEK AHEAD
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
  const icon = MOMENT_ICON[moment.kind] ?? "star";
  return (
    <Card>
      <Row gap={12} align="flex-start">
        <View
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
            {MOMENT_LABEL[moment.kind] ?? "A moment"}
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
  const content = wrapup.content as WrapupContent;
  return (
    <PressableCard onPress={() => undefined}>
      <Row justify="space-between" align="center">
        <View style={{ flex: 1 }}>
          <AppText weight="semibold">{content.periodLabel}</AppText>
          <AppText
            variant="caption"
            color={c.mutedForeground}
            style={{ marginTop: 2 }}
          >
            {warmCount(content.supportGiven)}{" "}
            {acts(content.supportGiven, "given")} ·{" "}
            {warmCount(content.supportReceived)}{" "}
            {acts(content.supportReceived, "received")}
          </AppText>
        </View>
        <Feather
          name={wrapup.readAt ? "check" : "circle"}
          size={18}
          color={c.mutedForeground}
        />
      </Row>
    </PressableCard>
  );
}

function warmCount(n: number): string {
  // Per the design brief, soft phrasing instead of "+8" or "score".
  if (n === 0) return "A quiet week";
  if (n === 1) return "1 act of care";
  return `${n} acts of care`;
}

function acts(n: number, suffix: "given" | "received"): string {
  if (n === 0) return suffix === "given" ? "this time" : "this time";
  return suffix;
}

function firstName(name: string): string {
  return name.split(/\s+/)[0] || name;
}
