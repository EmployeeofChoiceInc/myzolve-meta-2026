import { Feather } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, Image, Linking, Modal, Pressable, Switch, View } from "react-native";
import { useAuth } from "@clerk/expo";
import {
  getGetNotificationPreferencesQueryKey,
  getListCopilotGrantsQueryKey,
  useAcceptCopilotGrant,
  useDeclineCopilotGrant,
  useDeleteMe,
  useGetMe,
  useGetNotificationPreferences,
  useInviteCopilot,
  useListCircleMembers,
  useListCircles,
  useListCopilotGrants,
  useRevokeCopilotGrant,
  useUpdateNotificationPreferences,
  type CopilotGrant,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { AppText, Avatar, Button, Card, Row, Skeleton } from "@/components/UI";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";

const LABELS: Record<string, string> = {
  new_request: "New requests",
  support_received: "Support received",
  repayment_due: "Repayment reminders",
  repayment_received: "Repayments received",
  service_match: "Service matches",
  new_comment: "New comments",
  reaction_received: "Reactions",
  gratitude_received: "Gratitude notes",
  member_joined: "New members",
  circle_update: "Circle updates",
  dispute_opened: "Disputes opened",
  dispute_resolved: "Disputes resolved",
  care_calendar_reminder: "Care calendar reminders",
  copilot_invite_received: "Co-pilot invitations",
  copilot_post_made: "Posts made on your behalf",
};

export default function SettingsScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const router = useRouter();
  const { signOut } = useAuth();
  const { data, isLoading } = useGetNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  const deleteMe = useDeleteMe();
  const [deleting, setDeleting] = useState(false);

  const { data: copilotData, isLoading: copilotLoading } = useListCopilotGrants();
  const accept = useAcceptCopilotGrant();
  const decline = useDeclineCopilotGrant();
  const revoke = useRevokeCopilotGrant();

  const [inviteOpen, setInviteOpen] = useState(false);

  const copilotInvalidate = () =>
    qc.invalidateQueries({ queryKey: getListCopilotGrantsQueryKey() });

  function toggle(notificationType: string, enabled: boolean) {
    update.mutate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { data: { preferences: [{ notificationType: notificationType as any, enabled }] } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetNotificationPreferencesQueryKey() });
        },
      },
    );
  }

  function confirmDelete() {
    Alert.alert(
      "Delete your account?",
      "This permanently deletes your MyZolve Connect account. You'll be signed out everywhere, your messages and notifications will be removed, and your name and profile photo will be wiped from circles you belong to. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: finalConfirmDelete,
        },
      ],
    );
  }

  function finalConfirmDelete() {
    Alert.alert(
      "Are you absolutely sure?",
      "There is no way to recover your account or its data after this.",
      [
        { text: "Keep my account", style: "cancel" },
        {
          text: "Yes, delete forever",
          style: "destructive",
          onPress: doDelete,
        },
      ],
    );
  }

  async function doDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteMe.mutateAsync();
      qc.clear();
      try {
        await signOut();
      } catch {
        // best-effort; the Clerk session is already invalid server-side
      }
      router.replace("/");
    } catch (err: unknown) {
      const e = err as { message?: string };
      Alert.alert(
        "Couldn't delete account",
        e?.message ??
          "Something went wrong. Please try again, or contact support if it keeps failing.",
      );
    } finally {
      setDeleting(false);
    }
  }

  function confirmRevoke(grant: CopilotGrant) {
    Alert.alert(
      "Revoke co-pilot access?",
      `${grant.helperName ?? "This person"} will no longer be able to post on your behalf in ${grant.circleName ?? "this circle"}.`,
      [
        { text: "Keep helping", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: () =>
            revoke.mutate(
              { grantId: grant.id },
              { onSuccess: copilotInvalidate },
            ),
        },
      ],
    );
  }

  function handleAccept(grant: CopilotGrant) {
    accept.mutate(
      { grantId: grant.id },
      {
        onSuccess: copilotInvalidate,
        onError: () =>
          Alert.alert("Couldn't accept", "Please try again in a moment."),
      },
    );
  }

  function handleDecline(grant: CopilotGrant) {
    decline.mutate(
      { grantId: grant.id },
      {
        onSuccess: copilotInvalidate,
        onError: () =>
          Alert.alert("Couldn't decline", "Please try again in a moment."),
      },
    );
  }

  const peopleWhoHelpMe = copilotData?.peopleWhoHelpMe ?? [];
  const peopleIHelp = copilotData?.peopleIHelp ?? [];
  const pendingForMe = peopleIHelp.filter((g) => g.status === "pending");
  const activeForMe = peopleIHelp.filter((g) => g.status === "active");
  const sentByMe = peopleWhoHelpMe.filter(
    (g) => g.status === "active" || g.status === "pending",
  );

  return (
    <>
      <Stack.Screen options={{ title: "Settings" }} />
      <Screen>
        <AppText variant="h1">Settings</AppText>
        <AppText color={c.mutedForeground} style={{ marginTop: 4, marginBottom: 24 }}>
          Decide what you'd like to hear about.
        </AppText>

        {/* CO-PILOT SECTION */}
        <AppText variant="title" style={{ marginBottom: 6 }}>
          Co-pilot helpers
        </AppText>
        <AppText
          variant="caption"
          color={c.mutedForeground}
          style={{ marginBottom: 12 }}
        >
          Let a trusted person post requests, comments, and gratitude on your behalf — every post is clearly attributed.
        </AppText>

        {pendingForMe.length > 0 ? (
          <View style={{ gap: 10, marginBottom: 16 }}>
            {pendingForMe.map((g) => (
              <Card key={g.id}>
                <Row gap={12} align="center" style={{ marginBottom: 12 }}>
                  <Avatar
                    name={g.grantorName ?? "Member"}
                    objectPath={g.grantorAvatarObjectPath}
                    size={40}
                  />
                  <View style={{ flex: 1 }}>
                    <AppText weight="semibold">
                      {g.grantorName ?? "A circle member"}
                    </AppText>
                    <AppText variant="caption" color={c.mutedForeground}>
                      Asked you to help in {g.circleName ?? "their circle"}
                    </AppText>
                  </View>
                </Row>
                <Row gap={8}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Help out"
                      icon="check"
                      size="sm"
                      onPress={() => handleAccept(g)}
                      loading={accept.isPending}
                      testID={`copilot-accept-${g.id}`}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Decline"
                      icon="x"
                      variant="outline"
                      size="sm"
                      onPress={() => handleDecline(g)}
                      loading={decline.isPending}
                      testID={`copilot-decline-${g.id}`}
                    />
                  </View>
                </Row>
              </Card>
            ))}
          </View>
        ) : null}

        <AppText weight="semibold" style={{ marginBottom: 8 }}>
          People who help me
        </AppText>
        {copilotLoading ? (
          <Skeleton height={70} />
        ) : sentByMe.length === 0 ? (
          <Card style={{ marginBottom: 12 }}>
            <AppText variant="caption" color={c.mutedForeground}>
              No co-pilots yet. Invite someone you trust to post for you.
            </AppText>
          </Card>
        ) : (
          <View style={{ gap: 10, marginBottom: 12 }}>
            {sentByMe.map((g) => (
              <Card key={g.id}>
                <Row gap={12} align="center">
                  <Avatar
                    name={g.helperName ?? "Helper"}
                    objectPath={g.helperAvatarObjectPath}
                    size={36}
                  />
                  <View style={{ flex: 1 }}>
                    <AppText weight="semibold">
                      {g.helperName ?? "Helper"}
                    </AppText>
                    <AppText variant="caption" color={c.mutedForeground}>
                      {g.circleName ?? "Circle"} ·{" "}
                      {g.status === "pending" ? "Invitation sent" : "Active"}
                    </AppText>
                  </View>
                  <Pressable
                    onPress={() => confirmRevoke(g)}
                    testID={`copilot-revoke-${g.id}`}
                    hitSlop={8}
                  >
                    <Feather
                      name="x-circle"
                      size={20}
                      color={c.mutedForeground}
                    />
                  </Pressable>
                </Row>
              </Card>
            ))}
          </View>
        )}
        <Button
          title="Invite a co-pilot"
          icon="user-plus"
          variant="outline"
          size="sm"
          onPress={() => setInviteOpen(true)}
          testID="button-invite-copilot"
          style={{ marginBottom: 20 }}
        />

        <AppText weight="semibold" style={{ marginBottom: 8 }}>
          People I help
        </AppText>
        {copilotLoading ? (
          <Skeleton height={70} />
        ) : activeForMe.length === 0 ? (
          <Card style={{ marginBottom: 24 }}>
            <AppText variant="caption" color={c.mutedForeground}>
              No active helping arrangements yet.
            </AppText>
          </Card>
        ) : (
          <View style={{ gap: 10, marginBottom: 24 }}>
            {activeForMe.map((g) => (
              <Card key={g.id}>
                <Row gap={12} align="center">
                  <Avatar
                    name={g.grantorName ?? "Member"}
                    objectPath={g.grantorAvatarObjectPath}
                    size={36}
                  />
                  <View style={{ flex: 1 }}>
                    <AppText weight="semibold">
                      {g.grantorName ?? "Member"}
                    </AppText>
                    <AppText variant="caption" color={c.mutedForeground}>
                      {g.circleName ?? "Circle"}
                    </AppText>
                  </View>
                  <Pressable
                    onPress={() =>
                      Alert.alert(
                        "Stop helping?",
                        `You'll no longer be able to post on behalf of ${g.grantorName ?? "this member"}.`,
                        [
                          { text: "Keep helping", style: "cancel" },
                          {
                            text: "Stop",
                            style: "destructive",
                            onPress: () =>
                              revoke.mutate(
                                { grantId: g.id },
                                { onSuccess: copilotInvalidate },
                              ),
                          },
                        ],
                      )
                    }
                    testID={`copilot-helper-stop-${g.id}`}
                    hitSlop={8}
                  >
                    <Feather
                      name="x-circle"
                      size={20}
                      color={c.mutedForeground}
                    />
                  </Pressable>
                </Row>
              </Card>
            ))}
          </View>
        )}

        <AppText variant="title" style={{ marginBottom: 12 }}>
          Notifications
        </AppText>

        {isLoading ? (
          <Skeleton height={300} />
        ) : (
          <Card style={{ padding: 0 }}>
            {(data ?? []).map((pref, idx) => (
              <Row
                key={pref.notificationType}
                justify="space-between"
                style={{
                  padding: 16,
                  borderBottomWidth: idx === (data?.length ?? 0) - 1 ? 0 : 1,
                  borderBottomColor: c.border,
                }}
              >
                <View style={{ flex: 1, marginRight: 12 }}>
                  <AppText weight="medium">
                    {LABELS[pref.notificationType] ?? pref.notificationType}
                  </AppText>
                </View>
                <Switch
                  value={pref.enabled}
                  onValueChange={(v) => toggle(pref.notificationType, v)}
                  trackColor={{ true: c.primary, false: c.muted }}
                />
              </Row>
            ))}
          </Card>
        )}

        <View style={{ height: 24 }} />
        <Card>
          <Row gap={10}>
            <Feather name="info" size={18} color={c.mutedForeground} />
            <AppText variant="caption" color={c.mutedForeground} style={{ flex: 1 }}>
              MyZolve Connect is private to your circles. We never show your activity publicly.
            </AppText>
          </Row>
        </Card>

        <View style={{ height: 32 }} />
        <AppText variant="title" style={{ marginBottom: 12, color: c.destructive ?? "#b91c1c" }}>
          Danger zone
        </AppText>
        <Card>
          <AppText weight="medium" style={{ marginBottom: 6 }}>
            Delete your account
          </AppText>
          <AppText
            variant="caption"
            color={c.mutedForeground}
            style={{ marginBottom: 14 }}
          >
            Permanently delete your account and remove your personal information
            from MyZolve Connect. This cannot be undone.
          </AppText>
          <Pressable
            testID="button-delete-account"
            onPress={confirmDelete}
            disabled={deleting}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: c.destructive ?? "#b91c1c",
              borderRadius: 12,
              paddingVertical: 14,
              opacity: pressed || deleting ? 0.7 : 1,
            })}
          >
            <Feather name="trash-2" size={18} color="#ffffff" />
            <AppText
              color="#ffffff"
              weight="semibold"
              style={{ marginLeft: 10 }}
            >
              {deleting ? "Deleting…" : "Delete my account"}
            </AppText>
          </Pressable>
        </Card>

        <Pressable
          accessibilityRole="link"
          accessibilityLabel="MyZolve Connect is part of the MyZolve family, opens in browser"
          testID="link-myzolve-family"
          onPress={async () => {
            try {
              await Linking.openURL("https://myzolve.com");
            } catch {
              Alert.alert(
                "Couldn't open MyZolve",
                "Please try again, or visit myzolve.com in your browser.",
              );
            }
          }}
          style={({ pressed }) => ({
            marginTop: 28,
            paddingHorizontal: 4,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Row gap={8} justify="center">
            <Image
              source={require("@/assets/images/myzolve-logo.png")}
              style={{ width: 16, height: 16, borderRadius: 4 }}
              resizeMode="contain"
            />
            <AppText variant="caption" color={c.mutedForeground}>
              MyZolve Connect is part of the MyZolve family
            </AppText>
          </Row>
        </Pressable>
      </Screen>

      <InviteCopilotModal
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={copilotInvalidate}
        existing={sentByMe}
      />
    </>
  );
}

function InviteCopilotModal({
  visible,
  onClose,
  onInvited,
  existing,
}: {
  visible: boolean;
  onClose: () => void;
  onInvited: () => void;
  existing: CopilotGrant[];
}) {
  const c = useColors();
  const { data: me } = useGetMe();
  const { data: circles } = useListCircles();
  const [circleId, setCircleId] = useState<number | null>(null);
  const invite = useInviteCopilot();

  const myCircleId = circleId ?? circles?.[0]?.id ?? null;
  const { data: members, isLoading: membersLoading } = useListCircleMembers(
    myCircleId ?? 0,
  );

  const eligible = useMemo(() => {
    if (!members || !me) return [];
    const blocked = new Set(
      existing
        .filter((g) => g.circleId === myCircleId)
        .map((g) => g.helperUserId),
    );
    return members.filter(
      (m) =>
        m.status === "active" &&
        m.userId &&
        m.userId !== me.id &&
        !blocked.has(m.userId),
    );
  }, [members, me, existing, myCircleId]);

  function handleInvite(helperUserId: number) {
    if (!myCircleId) return;
    invite.mutate(
      { circleId: myCircleId, data: { helperUserId } },
      {
        onSuccess: () => {
          onInvited();
          onClose();
          Alert.alert(
            "Invitation sent",
            "We let them know you'd like their help.",
          );
        },
        onError: () =>
          Alert.alert("Couldn't invite", "Please try again in a moment."),
      },
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
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
          <Pressable onPress={onClose}>
            <AppText color={c.mutedForeground}>Cancel</AppText>
          </Pressable>
          <AppText weight="semibold">Invite a co-pilot</AppText>
          <View style={{ width: 50 }} />
        </Row>

        <View style={{ padding: 20, gap: 14, flex: 1 }}>
          <AppText variant="caption" color={c.mutedForeground}>
            Pick which circle, then choose a trusted member to post on your
            behalf.
          </AppText>

          <AppText weight="semibold">Circle</AppText>
          {!circles || circles.length === 0 ? (
            <Card>
              <AppText variant="caption" color={c.mutedForeground}>
                Join a circle first to invite a co-pilot.
              </AppText>
            </Card>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {circles.map((cir) => {
                const active = (myCircleId ?? circles[0].id) === cir.id;
                return (
                  <Pressable
                    key={cir.id}
                    onPress={() => setCircleId(cir.id)}
                    testID={`copilot-pick-circle-${cir.id}`}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: active ? c.primary : c.muted,
                    }}
                  >
                    <AppText
                      variant="caption"
                      weight="medium"
                      color={active ? "#fff" : c.foreground}
                    >
                      {cir.name}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          )}

          <AppText weight="semibold" style={{ marginTop: 6 }}>
            Member
          </AppText>
          {membersLoading ? (
            <Skeleton height={120} />
          ) : eligible.length === 0 ? (
            <Card>
              <AppText variant="caption" color={c.mutedForeground}>
                No eligible members in this circle yet.
              </AppText>
            </Card>
          ) : (
            <View style={{ gap: 10 }}>
              {eligible.map((m) => (
                <Pressable
                  key={m.id}
                  testID={`copilot-invite-member-${m.userId}`}
                  onPress={() => m.userId && handleInvite(m.userId)}
                  disabled={invite.isPending}
                  style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                >
                  <Card>
                    <Row gap={12} align="center">
                      <Avatar
                        name={m.displayName}
                        objectPath={m.avatarObjectPath}
                        size={36}
                      />
                      <View style={{ flex: 1 }}>
                        <AppText weight="semibold">{m.displayName}</AppText>
                        <AppText
                          variant="caption"
                          color={c.mutedForeground}
                          style={{ textTransform: "capitalize" }}
                        >
                          {m.role}
                        </AppText>
                      </View>
                      <Feather
                        name="user-plus"
                        size={18}
                        color={c.primary}
                      />
                    </Row>
                  </Card>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
