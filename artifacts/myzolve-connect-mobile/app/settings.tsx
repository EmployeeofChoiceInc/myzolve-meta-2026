import { Feather } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, Image, Linking, Modal, Pressable, Switch, View } from "react-native";
import { useAuth } from "@clerk/expo";
import { useTranslation } from "react-i18next";
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
import { I18nProvider, useLanguagePreference } from "@/components/I18nProvider";
import { PaywallSheet } from "@/components/PaywallSheet";
import { PlusBadge } from "@/components/PlusBadge";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";
import { useSubscription } from "@/lib/revenuecat";
import type { LanguagePreference } from "@/lib/i18n";

export default function SettingsScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const router = useRouter();
  const { signOut } = useAuth();
  const { t } = useTranslation();
  const { data, isLoading } = useGetNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  const deleteMe = useDeleteMe();
  const [deleting, setDeleting] = useState(false);

  const { data: copilotData, isLoading: copilotLoading } = useListCopilotGrants();
  const accept = useAcceptCopilotGrant();
  const decline = useDeclineCopilotGrant();
  const revoke = useRevokeCopilotGrant();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const { isPlus, isAvailable, initError } = useSubscription();

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
      t("settings.confirmDeleteTitle"),
      t("settings.confirmDeleteBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("settings.confirmDeleteAction"),
          style: "destructive",
          onPress: finalConfirmDelete,
        },
      ],
    );
  }

  function finalConfirmDelete() {
    Alert.alert(
      t("settings.absolutelySureTitle"),
      t("settings.absolutelySureBody"),
      [
        { text: t("settings.keepMyAccount"), style: "cancel" },
        {
          text: t("settings.deleteForever"),
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
        t("settings.couldntDeleteTitle"),
        e?.message ?? t("settings.couldntDeleteBody"),
      );
    } finally {
      setDeleting(false);
    }
  }

  function confirmRevoke(grant: CopilotGrant) {
    Alert.alert(
      t("settings.revokeAccess"),
      t("settings.revokeAccessBody", {
        name: grant.helperName ?? t("settings.thisPerson"),
        circle: grant.circleName ?? t("settings.thisCircle"),
      }),
      [
        { text: t("settings.keepHelping"), style: "cancel" },
        {
          text: t("settings.revoke"),
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
          Alert.alert(t("settings.couldntAccept"), t("settings.tryAgainShort")),
      },
    );
  }

  function handleDecline(grant: CopilotGrant) {
    decline.mutate(
      { grantId: grant.id },
      {
        onSuccess: copilotInvalidate,
        onError: () =>
          Alert.alert(t("settings.couldntDecline"), t("settings.tryAgainShort")),
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
      <Stack.Screen options={{ title: t("settings.title") }} />
      <Screen>
        <AppText variant="h1" accessibilityRole="header">{t("settings.title")}</AppText>
        <AppText color={c.mutedForeground} style={{ marginTop: 4, marginBottom: 24 }}>
          {t("settings.subtitle")}
        </AppText>

        {/* PLUS SECTION */}
        <Pressable
          testID="settings-plus-row"
          accessibilityRole="button"
          accessibilityLabel={t("settings.plusTitle")}
          onPress={() => {
            if (isPlus) {
              router.push("/plus");
            } else if (isAvailable) {
              setPaywallOpen(true);
            } else {
              router.push("/plus");
            }
          }}
          style={({ pressed }) => ({
            opacity: pressed ? 0.85 : 1,
            marginBottom: 20,
          })}
        >
          <Card>
            <Row gap={12} align="center">
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: c.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather name="star" size={18} color={c.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Row gap={8} align="center">
                  <AppText weight="semibold">{t("settings.plusTitle")}</AppText>
                  {isPlus ? <PlusBadge size="sm" variant="solid" /> : null}
                </Row>
                <AppText
                  variant="caption"
                  color={c.mutedForeground}
                  style={{ marginTop: 2 }}
                >
                  {isPlus
                    ? t("settings.manageSubscription")
                    : !isAvailable
                      ? initError ?? t("settings.subsUnavailable")
                      : t("settings.plusPitch")}
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
          </Card>
        </Pressable>

        {/* LANGUAGE SECTION */}
        <AppText variant="title" accessibilityRole="header" style={{ marginBottom: 6 }}>
          {t("settings.languageSection")}
        </AppText>
        <AppText
          variant="caption"
          color={c.mutedForeground}
          style={{ marginBottom: 12 }}
        >
          {t("settings.languageHelp")}
        </AppText>
        <LanguagePicker />
        <View style={{ height: 24 }} />

        {/* CO-PILOT SECTION */}
        <AppText variant="title" accessibilityRole="header" style={{ marginBottom: 6 }}>
          {t("settings.copilotSection")}
        </AppText>
        <AppText
          variant="caption"
          color={c.mutedForeground}
          style={{ marginBottom: 12 }}
        >
          {t("settings.copilotHelp")}
        </AppText>

        {pendingForMe.length > 0 ? (
          <View style={{ gap: 10, marginBottom: 16 }}>
            {pendingForMe.map((g) => (
              <Card key={g.id}>
                <Row gap={12} align="center" style={{ marginBottom: 12 }}>
                  <Avatar
                    name={g.grantorName ?? t("settings.member")}
                    objectPath={g.grantorAvatarObjectPath}
                    size={40}
                  />
                  <View style={{ flex: 1 }}>
                    <AppText weight="semibold">
                      {g.grantorName ?? t("settings.aCircleMember")}
                    </AppText>
                    <AppText variant="caption" color={c.mutedForeground}>
                      {t("settings.asked2helpIn", { circle: g.circleName ?? t("settings.theirCircle") })}
                    </AppText>
                  </View>
                </Row>
                <Row gap={8}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title={t("settings.helpOut")}
                      icon="check"
                      size="sm"
                      onPress={() => handleAccept(g)}
                      loading={accept.isPending}
                      testID={`copilot-accept-${g.id}`}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title={t("settings.decline")}
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
          {t("settings.peopleWhoHelpMe")}
        </AppText>
        {copilotLoading ? (
          <Skeleton height={70} />
        ) : sentByMe.length === 0 ? (
          <Card style={{ marginBottom: 12 }}>
            <AppText variant="caption" color={c.mutedForeground}>
              {t("settings.noCopilotsYet")}
            </AppText>
          </Card>
        ) : (
          <View style={{ gap: 10, marginBottom: 12 }}>
            {sentByMe.map((g) => (
              <Card key={g.id}>
                <Row gap={12} align="center">
                  <Avatar
                    name={g.helperName ?? t("settings.helper")}
                    objectPath={g.helperAvatarObjectPath}
                    size={36}
                  />
                  <View style={{ flex: 1 }}>
                    <AppText weight="semibold">
                      {g.helperName ?? t("settings.helper")}
                    </AppText>
                    <AppText variant="caption" color={c.mutedForeground}>
                      {g.circleName ?? t("settings.circle")} ·{" "}
                      {g.status === "pending" ? t("settings.invitationSent") : t("settings.active")}
                    </AppText>
                  </View>
                  <Pressable
                    onPress={() => confirmRevoke(g)}
                    testID={`copilot-revoke-${g.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={t("settings.revoke")}
                    hitSlop={12}
                  >
                    <Feather
                      name="x-circle"
                      size={20}
                      color={c.mutedForeground}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    />
                  </Pressable>
                </Row>
              </Card>
            ))}
          </View>
        )}
        <Button
          title={t("settings.inviteCopilot")}
          icon="user-plus"
          variant="outline"
          size="sm"
          onPress={() => setInviteOpen(true)}
          testID="button-invite-copilot"
          style={{ marginBottom: 20 }}
        />

        <AppText weight="semibold" style={{ marginBottom: 8 }}>
          {t("settings.peopleIHelp")}
        </AppText>
        {copilotLoading ? (
          <Skeleton height={70} />
        ) : activeForMe.length === 0 ? (
          <Card style={{ marginBottom: 24 }}>
            <AppText variant="caption" color={c.mutedForeground}>
              {t("settings.noActiveHelping")}
            </AppText>
          </Card>
        ) : (
          <View style={{ gap: 10, marginBottom: 24 }}>
            {activeForMe.map((g) => (
              <Card key={g.id}>
                <Row gap={12} align="center">
                  <Avatar
                    name={g.grantorName ?? t("settings.member")}
                    objectPath={g.grantorAvatarObjectPath}
                    size={36}
                  />
                  <View style={{ flex: 1 }}>
                    <AppText weight="semibold">
                      {g.grantorName ?? t("settings.member")}
                    </AppText>
                    <AppText variant="caption" color={c.mutedForeground}>
                      {g.circleName ?? t("settings.circle")}
                    </AppText>
                  </View>
                  <Pressable
                    onPress={() =>
                      Alert.alert(
                        t("settings.stopHelping"),
                        t("settings.stopHelpingBody", {
                          name: g.grantorName ?? t("settings.stopHelpingThisMember"),
                        }),
                        [
                          { text: t("settings.keepHelping"), style: "cancel" },
                          {
                            text: t("settings.stop"),
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
                    accessibilityRole="button"
                    accessibilityLabel={t("settings.stop")}
                    hitSlop={12}
                  >
                    <Feather
                      name="x-circle"
                      size={20}
                      color={c.mutedForeground}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    />
                  </Pressable>
                </Row>
              </Card>
            ))}
          </View>
        )}

        <AppText variant="title" accessibilityRole="header" style={{ marginBottom: 12 }}>
          {t("settings.notifications")}
        </AppText>

        {isLoading ? (
          <Skeleton height={300} />
        ) : (
          <Card style={{ padding: 0 }}>
            {(data ?? []).map((pref, idx) => {
              const label = t(`notificationLabels.${pref.notificationType}`, {
                defaultValue: pref.notificationType,
              });
              return (
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
                    <AppText weight="medium">{label}</AppText>
                  </View>
                  <Switch
                    value={pref.enabled}
                    onValueChange={(v) => toggle(pref.notificationType, v)}
                    accessibilityLabel={label}
                    trackColor={{ true: c.primary, false: c.muted }}
                  />
                </Row>
              );
            })}
          </Card>
        )}

        <View style={{ height: 24 }} />
        <Card>
          <Row gap={10}>
            <Feather
              name="info"
              size={18}
              color={c.mutedForeground}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
            <AppText variant="caption" color={c.mutedForeground} style={{ flex: 1 }}>
              {t("settings.privacyNote")}
            </AppText>
          </Row>
        </Card>

        <View style={{ height: 32 }} />
        <AppText variant="title" accessibilityRole="header" style={{ marginBottom: 12, color: c.destructive ?? "#b91c1c" }}>
          {t("settings.dangerZone")}
        </AppText>
        <Card>
          <AppText weight="medium" style={{ marginBottom: 6 }}>
            {t("settings.deleteAccount")}
          </AppText>
          <AppText
            variant="caption"
            color={c.mutedForeground}
            style={{ marginBottom: 14 }}
          >
            {t("settings.deleteAccountBody")}
          </AppText>
          <Pressable
            testID="button-delete-account"
            onPress={confirmDelete}
            disabled={deleting}
            accessibilityRole="button"
            accessibilityLabel={t("settings.deleteMyAccount")}
            accessibilityState={{ disabled: deleting, busy: deleting }}
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
            <Feather
              name="trash-2"
              size={18}
              color="#ffffff"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
            <AppText
              color="#ffffff"
              weight="semibold"
              style={{ marginLeft: 10 }}
            >
              {deleting ? t("settings.deleting") : t("settings.deleteMyAccount")}
            </AppText>
          </Pressable>
        </Card>

        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t("settings.myzolveFamilyA11y")}
          testID="link-myzolve-family"
          onPress={async () => {
            try {
              await Linking.openURL("https://myzolve.com");
            } catch {
              Alert.alert(
                t("settings.couldntOpenMyzolve"),
                t("settings.couldntOpenMyzolveBody"),
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
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
            <AppText variant="caption" color={c.mutedForeground}>
              {t("settings.myzolveFamily")}
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

      <PaywallSheet
        visible={paywallOpen}
        onClose={() => setPaywallOpen(false)}
      />
    </>
  );
}

function LanguagePicker() {
  const c = useColors();
  const { t } = useTranslation();
  const { pref, setPref } = useLanguagePreference();

  const options: { value: LanguagePreference; label: string }[] = [
    { value: "system", label: t("settings.language_system") },
    { value: "en", label: t("settings.language_en") },
    { value: "es", label: t("settings.language_es") },
  ];

  return (
    <Card style={{ padding: 0 }}>
      {options.map((opt, idx) => {
        const active = pref === opt.value;
        return (
          <Pressable
            key={opt.value}
            testID={`language-option-${opt.value}`}
            onPress={() => setPref(opt.value)}
            accessibilityRole="radio"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: active, checked: active }}
            style={({ pressed }) => ({
              padding: 16,
              borderBottomWidth: idx === options.length - 1 ? 0 : 1,
              borderBottomColor: c.border,
              opacity: pressed ? 0.85 : 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            })}
          >
            <AppText weight={active ? "semibold" : "regular"}>
              {opt.label}
            </AppText>
            {active ? (
              <Feather
                name="check"
                size={18}
                color={c.primary}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
            ) : null}
          </Pressable>
        );
      })}
    </Card>
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
  const { t } = useTranslation();
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
            t("settings.invitationSent"),
            t("settings.invitationSentBody"),
          );
        },
        onError: () =>
          Alert.alert(t("settings.couldntInvite"), t("settings.tryAgainShort")),
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
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("common.cancel")}
            hitSlop={10}
          >
            <AppText color={c.mutedForeground}>{t("common.cancel")}</AppText>
          </Pressable>
          <AppText weight="semibold" accessibilityRole="header">{t("settings.inviteCopilot")}</AppText>
          <View style={{ width: 50 }} />
        </Row>

        <View style={{ padding: 20, gap: 14, flex: 1 }}>
          <AppText variant="caption" color={c.mutedForeground}>
            {t("settings.pickCircleHelp")}
          </AppText>

          <AppText weight="semibold">{t("settings.circle")}</AppText>
          {!circles || circles.length === 0 ? (
            <Card>
              <AppText variant="caption" color={c.mutedForeground}>
                {t("settings.joinCircleFirst")}
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
                    accessibilityRole="button"
                    accessibilityLabel={cir.name}
                    accessibilityState={{ selected: active }}
                    testID={`copilot-pick-circle-${cir.id}`}
                    hitSlop={4}
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
            {t("settings.member")}
          </AppText>
          {membersLoading ? (
            <Skeleton height={120} />
          ) : eligible.length === 0 ? (
            <Card>
              <AppText variant="caption" color={c.mutedForeground}>
                {t("settings.noEligibleMembers")}
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
                  accessibilityRole="button"
                  accessibilityLabel={m.displayName}
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
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
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

// Re-export so tests don't accidentally import from a deep path.
export { I18nProvider };
