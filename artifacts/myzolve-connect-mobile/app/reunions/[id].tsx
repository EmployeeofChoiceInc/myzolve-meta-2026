import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Image, Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import {
  AppText,
  Avatar,
  Button,
  Card,
  Field,
  IconButton,
  Input,
  Pill,
  Row,
  Skeleton,
} from "@/components/UI";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";
import { safeBack } from "@/lib/safeBack";
import {
  useCreateSubCircle,
  useOrgHome,
  useRsvpOrgEvent,
  type OrgEvent,
  type OrgEventRsvpAttendee,
  type OrgHomeCircle,
  type OrgMainCircleCareDate,
  type OrgMainCirclePost,
} from "@/lib/orgApi";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

function orgLogoUri(logoUrl: string | null | undefined): string | undefined {
  if (!logoUrl) return undefined;
  return logoUrl.startsWith("http") ? logoUrl : `${API_BASE}${logoUrl}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function initial(name: string | null | undefined): string {
  return (name ?? "?").charAt(0).toUpperCase();
}

function Countdown({ target }: { target: string }) {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) {
    return (
      <Row
        gap={6}
        align="center"
        style={{
          alignSelf: "flex-start",
          backgroundColor: "rgba(255,255,255,0.2)",
          paddingHorizontal: 14,
          paddingVertical: 7,
          borderRadius: 999,
        }}
      >
        <Feather name="star" size={14} color="#fff" />
        <AppText weight="semibold" color="#fff" variant="caption">
          Happening now
        </AppText>
      </Row>
    );
  }
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const parts = [
    { label: days === 1 ? "day" : "days", value: days },
    { label: hours === 1 ? "hour" : "hours", value: hours },
  ];
  return (
    <Row gap={8} align="center">
      {parts.map((p) => (
        <View
          key={p.label}
          style={{
            backgroundColor: "rgba(255,255,255,0.2)",
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 8,
            alignItems: "center",
          }}
        >
          <AppText variant="h2" color="#fff">
            {p.value}
          </AppText>
          <AppText
            variant="caption"
            color="rgba(255,255,255,0.85)"
            style={{ textTransform: "uppercase", letterSpacing: 0.5 }}
          >
            {p.label}
          </AppText>
        </View>
      ))}
      <AppText variant="caption" color="rgba(255,255,255,0.9)">
        until the big day
      </AppText>
    </Row>
  );
}

const RSVP_OPTIONS = [
  { key: "going", label: "Going", icon: "check" },
  { key: "maybe", label: "Maybe", icon: "help-circle" },
  { key: "cant", label: "Can't", icon: "x" },
] as const;

function EventRow({
  ev,
  orgId,
}: {
  ev: OrgEvent;
  orgId: number;
}) {
  const c = useColors();
  const rsvp = useRsvpOrgEvent(orgId);
  const [showAttendees, setShowAttendees] = useState(false);

  function handleRsvp(status: "going" | "maybe" | "cant") {
    rsvp.mutate(
      { eventId: ev.id, status },
      {
        onError: () => Alert.alert("Couldn't save RSVP", "Please try again."),
      },
    );
  }

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 16,
        padding: 14,
        gap: 6,
      }}
    >
      <AppText weight="semibold">{ev.title}</AppText>
      <Row gap={5} align="center">
        <Feather name="calendar" size={13} color={c.primary} />
        <AppText variant="caption" weight="medium" color={c.primary}>
          {formatDateTime(ev.startsAt)}
        </AppText>
      </Row>
      {ev.location ? (
        <Row gap={5} align="center">
          <Feather name="map-pin" size={13} color={c.mutedForeground} />
          <AppText variant="caption" color={c.mutedForeground}>
            {ev.location}
          </AppText>
        </Row>
      ) : null}
      {ev.description ? (
        <AppText variant="caption" color={c.mutedForeground}>
          {ev.description}
        </AppText>
      ) : null}
      <Row gap={8} style={{ marginTop: 6, flexWrap: "wrap" }}>
        {RSVP_OPTIONS.map((opt) => {
          const active = ev.myRsvp === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => handleRsvp(opt.key)}
              disabled={rsvp.isPending}
              testID={`rsvp-${ev.id}-${opt.key}`}
              accessibilityRole="button"
              accessibilityLabel={`${opt.label}, ${ev.rsvpCounts[opt.key]} responding`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: active ? c.primary : c.muted,
                opacity: rsvp.isPending ? 0.6 : 1,
              }}
            >
              <Feather
                name={opt.icon}
                size={13}
                color={active ? "#fff" : c.foreground}
              />
              <AppText
                variant="caption"
                weight="medium"
                color={active ? "#fff" : c.foreground}
              >
                {opt.label}
              </AppText>
              <AppText
                variant="caption"
                color={active ? "rgba(255,255,255,0.8)" : c.mutedForeground}
              >
                {ev.rsvpCounts[opt.key]}
              </AppText>
            </Pressable>
          );
        })}
      </Row>
      {ev.rsvps.length > 0 ? (
        <View style={{ marginTop: 4 }}>
          <Pressable
            onPress={() => setShowAttendees((v) => !v)}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Row gap={5} align="center">
              <Feather
                name={showAttendees ? "chevron-up" : "chevron-down"}
                size={14}
                color={c.mutedForeground}
              />
              <AppText variant="caption" color={c.mutedForeground}>
                {showAttendees ? "Hide who's coming" : "See who's coming"}
              </AppText>
            </Row>
          </Pressable>
          {showAttendees ? (
            <View style={{ marginTop: 8, gap: 10 }}>
              {RSVP_OPTIONS.map((opt) => {
                const people = ev.rsvps.filter(
                  (r: OrgEventRsvpAttendee) => r.status === opt.key,
                );
                if (people.length === 0) return null;
                return (
                  <View key={opt.key} style={{ gap: 6 }}>
                    <AppText
                      variant="caption"
                      weight="medium"
                      color={c.mutedForeground}
                      style={{ textTransform: "uppercase", letterSpacing: 0.5 }}
                    >
                      {opt.label} ({people.length})
                    </AppText>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {people.map((r) => (
                        <Row
                          key={r.userId}
                          gap={6}
                          align="center"
                          style={{
                            backgroundColor: c.muted,
                            borderRadius: 999,
                            paddingLeft: 3,
                            paddingRight: 10,
                            paddingVertical: 3,
                          }}
                        >
                          <Avatar
                            name={r.displayName}
                            objectPath={r.avatarObjectPath}
                            size={22}
                          />
                          <AppText variant="caption">
                            {r.displayName ?? "Member"}
                          </AppText>
                        </Row>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function SectionCard({
  icon,
  title,
  action,
  children,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const c = useColors();
  return (
    <Card style={{ marginTop: 16, gap: 12 }}>
      <Row justify="space-between" align="center">
        <Row gap={8} align="center">
          <Feather name={icon} size={18} color={c.primary} />
          <AppText variant="title">{title}</AppText>
        </Row>
        {action}
      </Row>
      {children}
    </Card>
  );
}

export default function ReunionHomeScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const orgId = Number(params.id);
  const { data, isLoading, isError, refetch, isRefetching } = useOrgHome(orgId);
  const createSubCircle = useCreateSubCircle(orgId);

  const [circleOpen, setCircleOpen] = useState(false);
  const [circleName, setCircleName] = useState("");
  const [circleDesc, setCircleDesc] = useState("");

  function submitSubCircle() {
    if (circleName.trim().length < 2) {
      Alert.alert("Name needed", "Please use at least 2 characters.");
      return;
    }
    createSubCircle.mutate(
      { name: circleName.trim(), description: circleDesc.trim() || null },
      {
        onSuccess: () => {
          setCircleName("");
          setCircleDesc("");
          setCircleOpen(false);
        },
        onError: () =>
          Alert.alert("Couldn't create circle", "Please try again."),
      },
    );
  }

  const org = data?.org;
  const accent = org?.accentColor || c.primary;
  const logoUri = orgLogoUri(org?.logoUrl);
  const canManage = data?.canManage ?? false;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        contentStyle={{ paddingTop: insets.top + 12 }}
        refreshing={isRefetching}
        onRefresh={refetch}
      >
        <Row justify="space-between" align="center" style={{ marginBottom: 14 }}>
          <IconButton icon="arrow-left" onPress={() => safeBack(router)} />
        </Row>

        {isError ? (
          <Card style={{ paddingVertical: 24, alignItems: "center" }}>
            <Feather name="lock" size={28} color={c.mutedForeground} />
            <AppText weight="semibold" style={{ marginTop: 10 }}>
              This space isn't available
            </AppText>
            <AppText
              variant="caption"
              color={c.mutedForeground}
              style={{ marginTop: 4, textAlign: "center", maxWidth: 280 }}
            >
              You may not be a member of this reunion, or it no longer exists.
            </AppText>
          </Card>
        ) : isLoading || !data || !org ? (
          <Skeleton height={180} />
        ) : (
          <>
            {/* Hero */}
            <View
              style={{
                borderRadius: 24,
                overflow: "hidden",
                backgroundColor: accent,
                padding: 20,
                gap: 14,
              }}
            >
              <Row gap={14} align="flex-start">
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    backgroundColor: "rgba(255,255,255,0.2)",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.3)",
                  }}
                >
                  {logoUri ? (
                    <Image
                      source={{ uri: logoUri }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                      accessibilityLabel={`${org.name} logo`}
                    />
                  ) : (
                    <Feather name="briefcase" size={26} color="#fff" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Row gap={8} align="center" style={{ flexWrap: "wrap" }}>
                    <AppText variant="h1" color="#fff" style={{ flexShrink: 1 }}>
                      {org.name}
                    </AppText>
                    {org.comped ? (
                      <Pill
                        label="Complimentary"
                        bg="rgba(255,255,255,0.2)"
                        fg="#fff"
                      />
                    ) : null}
                  </Row>
                  <AppText
                    variant="caption"
                    color="rgba(255,255,255,0.9)"
                    style={{ marginTop: 4 }}
                  >
                    {data.memberCount}{" "}
                    {data.memberCount === 1 ? "member" : "members"} ·{" "}
                    {org.planName}
                  </AppText>
                </View>
                {canManage ? (
                  <View
                    style={{
                      backgroundColor: "rgba(255,255,255,0.2)",
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                    }}
                  >
                    <AppText variant="caption" weight="medium" color="#fff">
                      Admin
                    </AppText>
                  </View>
                ) : null}
              </Row>

              {org.welcomeMessage ? (
                <AppText color="rgba(255,255,255,0.95)" style={{ lineHeight: 22 }}>
                  {org.welcomeMessage}
                </AppText>
              ) : null}

              {org.heroEventDate ? (
                <View style={{ gap: 6 }}>
                  <Countdown target={org.heroEventDate} />
                  <AppText variant="caption" color="rgba(255,255,255,0.85)">
                    {formatLongDate(org.heroEventDate)}
                  </AppText>
                </View>
              ) : null}
            </View>

            {/* Announcements */}
            {data.announcements.length > 0 ? (
              <SectionCard icon="volume-2" title="Announcements">
                <View style={{ gap: 12 }}>
                  {data.announcements.map((a) => (
                    <View key={a.id} style={{ gap: 4 }}>
                      <Row gap={8} align="center">
                        <Avatar
                          name={a.authorName}
                          objectPath={a.authorAvatarObjectPath}
                          size={28}
                        />
                        <View style={{ flex: 1 }}>
                          {a.title ? (
                            <AppText weight="semibold" variant="subtitle">
                              {a.title}
                            </AppText>
                          ) : null}
                          <AppText variant="caption" color={c.mutedForeground}>
                            {a.authorName ?? "Organizer"} ·{" "}
                            {formatDateTime(a.createdAt)}
                          </AppText>
                        </View>
                      </Row>
                      <AppText style={{ lineHeight: 20 }}>{a.body}</AppText>
                    </View>
                  ))}
                </View>
              </SectionCard>
            ) : null}

            {/* Wall preview */}
            <SectionCard
              icon="edit-3"
              title="Wall"
              action={
                <Pressable
                  onPress={() =>
                    router.push(`/circle/${data.mainCircle.id}/wall`)
                  }
                  testID="open-wall"
                  accessibilityRole="button"
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    backgroundColor: c.muted,
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <AppText variant="caption" weight="medium">
                    Open Wall
                  </AppText>
                  <Feather name="arrow-right" size={13} color={c.foreground} />
                </Pressable>
              }
            >
              <AppText variant="caption" color={c.mutedForeground}>
                Everyone in {org.name} ({data.mainCircle.memberCount}{" "}
                {data.mainCircle.memberCount === 1 ? "member" : "members"})
                shares this space.
              </AppText>
              {data.mainCircle.recentPosts.length === 0 ? (
                <AppText variant="caption" color={c.mutedForeground}>
                  No posts yet — open the Wall to share something.
                </AppText>
              ) : (
                <View style={{ gap: 10 }}>
                  {data.mainCircle.recentPosts.map((p: OrgMainCirclePost) => (
                    <Pressable
                      key={p.id}
                      onPress={() =>
                        router.push(`/circle/${data.mainCircle.id}/wall`)
                      }
                      accessibilityRole="button"
                      style={{
                        borderWidth: 1,
                        borderColor: c.border,
                        borderRadius: 14,
                        padding: 12,
                        flexDirection: "row",
                        gap: 10,
                      }}
                    >
                      <Avatar
                        name={p.authorName}
                        objectPath={p.authorAvatarObjectPath}
                        size={36}
                      />
                      <View style={{ flex: 1 }}>
                        <AppText variant="caption" weight="medium">
                          {p.authorName ?? "Someone"}
                        </AppText>
                        {p.title ? (
                          <AppText weight="semibold" numberOfLines={1}>
                            {p.title}
                          </AppText>
                        ) : null}
                        <AppText
                          variant="caption"
                          color={c.mutedForeground}
                          numberOfLines={2}
                        >
                          {p.body}
                        </AppText>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </SectionCard>

            {/* Care Calendar */}
            <SectionCard
              icon="heart"
              title="Care Calendar"
              action={
                <Pressable
                  onPress={() =>
                    router.push(`/circle/${data.mainCircle.id}/calendar`)
                  }
                  accessibilityRole="button"
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    backgroundColor: c.muted,
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <AppText variant="caption" weight="medium">
                    View all
                  </AppText>
                  <Feather name="arrow-right" size={13} color={c.foreground} />
                </Pressable>
              }
            >
              {data.mainCircle.upcomingCareDates.length === 0 ? (
                <AppText variant="caption" color={c.mutedForeground}>
                  No upcoming care dates.
                </AppText>
              ) : (
                <View style={{ gap: 10 }}>
                  {data.mainCircle.upcomingCareDates.map(
                    (d: OrgMainCircleCareDate) => (
                      <Row
                        key={d.id}
                        justify="space-between"
                        align="center"
                        gap={10}
                        style={{
                          borderWidth: 1,
                          borderColor: c.border,
                          borderRadius: 14,
                          padding: 12,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <AppText weight="medium" numberOfLines={1}>
                            {d.name}
                          </AppText>
                          <AppText
                            variant="caption"
                            color={c.mutedForeground}
                            style={{ textTransform: "capitalize" }}
                          >
                            {d.kind}
                          </AppText>
                        </View>
                        <AppText
                          variant="caption"
                          weight="medium"
                          color={c.primary}
                        >
                          {formatLongDate(d.nextOccurrence)}
                        </AppText>
                      </Row>
                    ),
                  )}
                </View>
              )}
            </SectionCard>

            {/* Events with RSVP */}
            <SectionCard icon="calendar" title="Upcoming events">
              {data.events.length === 0 ? (
                <AppText variant="caption" color={c.mutedForeground}>
                  No upcoming events.
                </AppText>
              ) : (
                <View style={{ gap: 12 }}>
                  {data.events.map((ev) => (
                    <EventRow key={ev.id} ev={ev} orgId={orgId} />
                  ))}
                </View>
              )}
            </SectionCard>

            {/* Sub-circles */}
            <SectionCard
              icon="layers"
              title="Circles"
              action={
                canManage ? (
                  <IconButton
                    icon="plus"
                    onPress={() => setCircleOpen(true)}
                    bg={c.primary}
                    color="#fff"
                    size={36}
                    testID="add-subcircle"
                    accessibilityLabel="Add a circle"
                  />
                ) : undefined
              }
            >
              {data.subCircles.length === 0 ? (
                <AppText variant="caption" color={c.mutedForeground}>
                  No circles in this space yet.
                </AppText>
              ) : (
                <View style={{ gap: 10 }}>
                  {data.subCircles.map((sc: OrgHomeCircle) => (
                    <Pressable
                      key={sc.id}
                      onPress={() => router.push(`/circle/${sc.id}`)}
                      testID={`subcircle-${sc.id}`}
                      accessibilityRole="button"
                      style={{
                        borderWidth: 1,
                        borderColor: c.border,
                        borderRadius: 14,
                        padding: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          backgroundColor: sc.accentColor || accent,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <AppText weight="bold" color="#fff">
                          {initial(sc.name)}
                        </AppText>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Row gap={6} align="center">
                          <AppText
                            weight="medium"
                            style={{ flexShrink: 1 }}
                            numberOfLines={1}
                          >
                            {sc.name}
                          </AppText>
                          {!sc.isMember ? <Pill label="Admin" /> : null}
                        </Row>
                        <AppText variant="caption" color={c.mutedForeground}>
                          {sc.memberCount}{" "}
                          {sc.memberCount === 1 ? "member" : "members"}
                        </AppText>
                        {sc.description ? (
                          <AppText
                            variant="caption"
                            color={c.mutedForeground}
                            numberOfLines={2}
                          >
                            {sc.description}
                          </AppText>
                        ) : null}
                      </View>
                      <Feather
                        name="chevron-right"
                        size={18}
                        color={c.mutedForeground}
                      />
                    </Pressable>
                  ))}
                </View>
              )}
            </SectionCard>

            {/* People */}
            <SectionCard icon="users" title={`People (${data.memberCount})`}>
              {data.members.length === 0 ? (
                <AppText variant="caption" color={c.mutedForeground}>
                  No members yet.
                </AppText>
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                  {data.members.map((mm) => (
                    <View
                      key={mm.userId}
                      style={{ alignItems: "center", width: 64 }}
                    >
                      <Avatar
                        name={mm.displayName}
                        objectPath={mm.avatarObjectPath}
                        size={44}
                      />
                      <AppText
                        variant="caption"
                        color={c.mutedForeground}
                        numberOfLines={1}
                        style={{ marginTop: 4, maxWidth: 64, textAlign: "center" }}
                      >
                        {mm.displayName ?? "Member"}
                      </AppText>
                    </View>
                  ))}
                </View>
              )}
            </SectionCard>
          </>
        )}
      </Screen>

      <Modal
        visible={circleOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCircleOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: c.background }}>
          <Row
            justify="space-between"
            style={{
              paddingHorizontal: 20,
              paddingTop: 20,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: c.border,
            }}
          >
            <Pressable onPress={() => setCircleOpen(false)}>
              <AppText color={c.mutedForeground}>Cancel</AppText>
            </Pressable>
            <AppText weight="semibold">New circle</AppText>
            <View style={{ width: 50 }} />
          </Row>
          <KeyboardAwareScrollView
            contentContainerStyle={{ padding: 20 }}
            bottomOffset={40}
            keyboardShouldPersistTaps="handled"
          >
            <Field label="Circle name">
              <Input
                value={circleName}
                onChangeText={setCircleName}
                placeholder="e.g. Planning Committee"
                testID="input-subcircle-name"
              />
            </Field>
            <Field label="Description (optional)">
              <Input
                value={circleDesc}
                onChangeText={setCircleDesc}
                placeholder="What's this circle for?"
                multiline
                testID="input-subcircle-description"
              />
            </Field>
            <Button
              title="Create circle"
              onPress={submitSubCircle}
              loading={createSubCircle.isPending}
              testID="button-submit-subcircle"
              style={{ marginTop: 16 }}
            />
          </KeyboardAwareScrollView>
        </View>
      </Modal>
    </>
  );
}
