import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  getDiscoverCirclesQueryKey,
  getGetCircleQueryKey,
  getListCircleMembersQueryKey,
  getListCirclesQueryKey,
  useGetCircle,
  useListCircleMembers,
  useUpdateCircle,
  useUpdateCircleMember,
} from "@workspace/api-client-react";

import {
  AppText,
  Button,
  Field,
  IconButton,
  Input,
  Row,
  Skeleton,
} from "@/components/UI";
import { PaywallSheet } from "@/components/PaywallSheet";
import { PlusBadge } from "@/components/PlusBadge";
import { RolePickerSheet } from "@/components/RolePickerSheet";
import { useColors } from "@/hooks/useColors";
import { safeBack } from "@/lib/safeBack";
import {
  type AssignableRole,
  type CircleRole,
  ROLE_LABELS,
  rolePillColors,
} from "@/lib/circleRoles";
import { useIsPlus } from "@/lib/revenuecat";

type PrivacyMode = "private" | "hidden" | "open" | "community";

const PRIVACY_OPTIONS: {
  value: PrivacyMode;
  label: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  {
    value: "private",
    label: "Private",
    description: "Invite only. Won't appear in Discover.",
    icon: "lock",
  },
  {
    value: "hidden",
    label: "Hidden",
    description: "Anyone with the link can join. Won't appear in Discover.",
    icon: "eye-off",
  },
  {
    value: "open",
    label: "Open",
    description: "Listed in Discover. Anyone can ask to join.",
    icon: "globe",
  },
  {
    value: "community",
    label: "Community",
    description:
      "Listed in Discover. Best for larger groups — admins review join requests.",
    icon: "users",
  },
];

export default function CircleSettingsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const circleId = Number(params.id);
  const qc = useQueryClient();

  const { data: circle, isLoading } = useGetCircle(circleId);
  const update = useUpdateCircle();
  const isOwner = circle?.myRole === "owner";
  const ownerHasPlus = useIsPlus();

  const { data: members } = useListCircleMembers(circleId);
  const updateMember = useUpdateCircleMember();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>("private");
  const [hydrated, setHydrated] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [pickerFor, setPickerFor] = useState<{
    memberId: number;
    name: string;
    role: string;
  } | null>(null);

  useEffect(() => {
    if (circle && !hydrated) {
      setName(circle.name ?? "");
      setDescription(circle.description ?? "");
      setPrivacyMode((circle.privacyMode as PrivacyMode) ?? "private");
      setHydrated(true);
    }
  }, [circle, hydrated]);

  const isAdmin =
    circle?.myRole === "owner" || circle?.myRole === "admin";

  function openRolePicker(member: { id: number; displayName: string; role: string }) {
    setPickerFor({ memberId: member.id, name: member.displayName, role: member.role });
  }

  function pickRole(role: AssignableRole) {
    if (!pickerFor) return;
    const memberId = pickerFor.memberId;
    setPickerFor(null);
    updateMember.mutate(
      { circleId, memberId, data: { role } },
      {
        onSuccess: () => {
          qc.invalidateQueries({
            queryKey: getListCircleMembersQueryKey(circleId),
          });
        },
        onError: (err: unknown) => {
          // 402 from the API is the server's way of saying "open the paywall".
          // Anything else is a generic failure surface.
          const status =
            typeof err === "object" && err !== null && "status" in err
              ? (err as { status?: number }).status
              : undefined;
          if (status === 402) {
            setPaywallVisible(true);
            return;
          }
          Alert.alert("Couldn't update role", "Please try again in a moment.");
        },
      },
    );
  }

  function submit() {
    if (name.trim().length < 1) {
      Alert.alert("Add a name", "Your circle needs a name.");
      return;
    }
    update.mutate(
      {
        circleId,
        data: {
          name: name.trim(),
          description: description.trim(),
          privacyMode,
        },
      },
      {
        onSuccess: (updated) => {
          qc.setQueryData(getGetCircleQueryKey(circleId), updated);
          qc.invalidateQueries({ queryKey: getGetCircleQueryKey(circleId) });
          qc.invalidateQueries({ queryKey: getListCirclesQueryKey() });
          qc.invalidateQueries({ queryKey: getDiscoverCirclesQueryKey() });
          safeBack(router);
        },
        onError: () =>
          Alert.alert("Couldn't save", "Please try again in a moment."),
      }
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <Row
          justify="space-between"
          align="center"
          style={{
            paddingHorizontal: 16,
            paddingTop: insets.top + 12,
            paddingBottom: 8,
          }}
        >
          <IconButton icon="arrow-left" onPress={() => safeBack(router)} />
          <AppText weight="semibold">Circle Settings</AppText>
          <View style={{ width: 40 }} />
        </Row>

        <KeyboardAwareScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 40,
          }}
          bottomOffset={60}
          keyboardShouldPersistTaps="handled"
        >
          {isLoading || !circle ? (
            <Skeleton height={200} />
          ) : !isAdmin ? (
            <View
              style={{
                backgroundColor: c.card,
                borderColor: c.border,
                borderWidth: 1,
                borderRadius: 16,
                padding: 20,
                alignItems: "center",
              }}
            >
              <Feather name="lock" size={28} color={c.mutedForeground} />
              <AppText
                weight="semibold"
                style={{ marginTop: 10, textAlign: "center" }}
              >
                Admins only
              </AppText>
              <AppText
                color={c.mutedForeground}
                style={{ marginTop: 6, textAlign: "center" }}
              >
                Only the circle&apos;s owner or admins can change these settings.
              </AppText>
            </View>
          ) : (
            <>
              <AppText
                color={c.mutedForeground}
                style={{ marginBottom: 20 }}
              >
                Update your circle&apos;s name, description, and who can find it.
              </AppText>

              <Field label="Circle name">
                <Input
                  value={name}
                  onChangeText={setName}
                  placeholder="Our Family Circle"
                  testID="input-circle-name"
                />
              </Field>

              <Field label="Description (optional)">
                <Input
                  value={description}
                  onChangeText={setDescription}
                  placeholder="A brief description of your circle…"
                  multiline
                  style={{ minHeight: 90, textAlignVertical: "top" }}
                  testID="input-circle-description"
                />
              </Field>

              <Field label="Visibility">
                <AppText
                  variant="caption"
                  color={c.mutedForeground}
                  style={{ marginTop: -6, marginBottom: 10 }}
                >
                  Open and Community circles show up under Profile → Discover so
                  others can find them.
                </AppText>
                <View style={{ gap: 10 }}>
                  {PRIVACY_OPTIONS.map((opt) => {
                    const active = privacyMode === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => setPrivacyMode(opt.value)}
                        testID={`privacy-${opt.value}`}
                        style={({ pressed }) => ({
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 14,
                          padding: 14,
                          borderRadius: 14,
                          borderWidth: 1.5,
                          borderColor: active ? c.primary : c.border,
                          backgroundColor: active ? c.primarySoft : c.card,
                          opacity: pressed ? 0.85 : 1,
                        })}
                      >
                        <View
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 19,
                            backgroundColor: active ? c.primary : c.muted,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Feather
                            name={opt.icon}
                            size={18}
                            color={active ? "#fff" : c.foreground}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <AppText weight="semibold">{opt.label}</AppText>
                          <AppText
                            variant="caption"
                            color={c.mutedForeground}
                            style={{ marginTop: 2 }}
                          >
                            {opt.description}
                          </AppText>
                        </View>
                        {active && (
                          <Feather
                            name="check-circle"
                            size={20}
                            color={c.primary}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </Field>

              <Button
                title="Save changes"
                onPress={submit}
                loading={update.isPending}
                icon="check"
                testID="button-save-settings"
                style={{ marginTop: 8 }}
              />

              {isOwner ? (
                <View style={{ marginTop: 32 }}>
                  <Row align="center" gap={8} style={{ marginBottom: 4 }}>
                    <AppText weight="semibold">Roles</AppText>
                    <PlusBadge size="sm" variant="soft" />
                  </Row>
                  <AppText
                    variant="caption"
                    color={c.mutedForeground}
                    style={{ marginBottom: 12, lineHeight: 18 }}
                  >
                    With Plus you can delegate parts of running your circle —
                    a host to handle members, a treasurer for the ledger, a
                    scribe for the wall.
                  </AppText>
                  {!ownerHasPlus ? (
                    <Pressable
                      onPress={() => setPaywallVisible(true)}
                      testID="roles-upsell"
                      style={({ pressed }) => ({
                        backgroundColor: c.primarySoft,
                        borderColor: c.primary,
                        borderWidth: 1,
                        borderRadius: 14,
                        padding: 14,
                        marginBottom: 12,
                        opacity: pressed ? 0.92 : 1,
                      })}
                    >
                      <Row align="center" justify="space-between">
                        <View style={{ flex: 1, paddingRight: 12 }}>
                          <AppText weight="semibold" color={c.primary}>
                            Unlock sub-roles with Plus
                          </AppText>
                          <AppText
                            variant="caption"
                            color={c.foreground}
                            style={{ marginTop: 2 }}
                          >
                            Tap to learn more about delegating with Plus.
                          </AppText>
                        </View>
                        <Feather name="chevron-right" size={20} color={c.primary} />
                      </Row>
                    </Pressable>
                  ) : null}
                  {/*
                    Role assignment is a Plus-only feature, so the interactive
                    list is hidden entirely from non-Plus owners. They see the
                    upsell card above instead — this keeps the gating obvious
                    and avoids dead taps that just bounce to the paywall.
                  */}
                  <View style={{ gap: 8, opacity: ownerHasPlus ? 1 : 0.5 }} pointerEvents={ownerHasPlus ? "auto" : "none"}>
                    {(members ?? [])
                      .filter((m) => m.status === "active" && m.role !== "owner")
                      .map((m) => {
                        const pill = rolePillColors(m.role, c);
                        return (
                          <Pressable
                            key={m.id}
                            onPress={() => openRolePicker(m)}
                            testID={`role-row-${m.id}`}
                            style={({ pressed }) => ({
                              backgroundColor: c.card,
                              borderColor: c.border,
                              borderWidth: 1,
                              borderRadius: 14,
                              padding: 12,
                              opacity: pressed ? 0.9 : 1,
                            })}
                          >
                            <Row align="center" justify="space-between">
                              <View style={{ flex: 1, paddingRight: 12 }}>
                                <AppText weight="semibold">
                                  {m.displayName}
                                </AppText>
                                <AppText
                                  variant="caption"
                                  color={c.mutedForeground}
                                  style={{ marginTop: 2 }}
                                >
                                  {m.email ?? ""}
                                </AppText>
                              </View>
                              <View
                                style={{
                                  backgroundColor: pill.bg,
                                  paddingHorizontal: 10,
                                  paddingVertical: 4,
                                  borderRadius: 999,
                                  marginRight: 6,
                                }}
                              >
                                <AppText
                                  variant="caption"
                                  weight="semibold"
                                  color={pill.fg}
                                >
                                  {ROLE_LABELS[m.role as CircleRole] ?? m.role}
                                </AppText>
                              </View>
                              <Feather
                                name="chevron-right"
                                size={18}
                                color={c.mutedForeground}
                              />
                            </Row>
                          </Pressable>
                        );
                      })}
                    {members && members.filter((m) => m.status === "active" && m.role !== "owner").length === 0 ? (
                      <AppText
                        variant="caption"
                        color={c.mutedForeground}
                        style={{ marginTop: 4 }}
                      >
                        Invite people to your circle, then come back here to
                        give them a role.
                      </AppText>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </>
          )}
        </KeyboardAwareScrollView>
      </View>
      {pickerFor ? (
        <RolePickerSheet
          visible={!!pickerFor}
          memberName={pickerFor.name}
          currentRole={pickerFor.role}
          ownerHasPlus={ownerHasPlus}
          onClose={() => setPickerFor(null)}
          onPick={pickRole}
          onRequestPlus={() => {
            setPickerFor(null);
            setPaywallVisible(true);
          }}
        />
      ) : null}
      <PaywallSheet
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
      />
    </>
  );
}
