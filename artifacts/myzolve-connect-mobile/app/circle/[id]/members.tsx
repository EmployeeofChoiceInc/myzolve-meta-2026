import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListCircleInvitationsQueryKey,
  getListCircleMembersQueryKey,
  getSearchCircleSkillsQueryKey,
  useCreateCircleInvitation,
  useListCircleInvitations,
  useListCircleMembers,
  useSearchCircleSkills,
} from "@workspace/api-client-react";

import {
  AppText,
  Avatar,
  Button,
  Empty,
  Field,
  IconButton,
  Input,
  PressableCard,
  Pill,
  Row,
  Skeleton,
} from "@/components/UI";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";
import { safeBack } from "@/lib/safeBack";
import {
  type CircleRole,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  rolePillColors,
} from "@/lib/circleRoles";

export default function MembersScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const circleId = Number(params.id);
  const qc = useQueryClient();
  const { data: members, isLoading } = useListCircleMembers(circleId);
  const [searchTerm, setSearchTerm] = useState("");
  const normalizedSearch = searchTerm.trim();
  const {
    data: searchResults,
    isLoading: searchLoading,
    isError: searchError,
  } = useSearchCircleSkills(
    circleId,
    { q: normalizedSearch },
    {
      query: {
        enabled: circleId > 0 && normalizedSearch.length > 0,
        queryKey: getSearchCircleSkillsQueryKey(circleId, { q: normalizedSearch }),
      },
    },
  );
  const memberList = members ?? [];
  const visibleMembers = normalizedSearch ? searchResults ?? [] : memberList;
  const totalSkills = memberList.reduce(
    (total, member) => total + (member.skills?.length ?? 0),
    0,
  );
  const totalResources = memberList.reduce(
    (total, member) => total + (member.resources?.length ?? 0),
    0,
  );
  const { data: invitations } = useListCircleInvitations(circleId);
  const invite = useCreateCircleInvitation();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [explainedRoleId, setExplainedRoleId] = useState<number | null>(null);

  function toggleRoleExplainer(memberId: number) {
    setExplainedRoleId((prev) => (prev === memberId ? null : memberId));
  }

  function send() {
    if (!email.trim()) {
      Alert.alert("Email needed", "Add an email address to send the invitation.");
      return;
    }
    invite.mutate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { circleId, data: { invitedEmail: email.trim(), role: "member" as any } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListCircleInvitationsQueryKey(circleId) });
          qc.invalidateQueries({ queryKey: getListCircleMembersQueryKey(circleId) });
          setEmail("");
          setOpen(false);
          Alert.alert("Invitation sent", "They'll get a warm welcome shortly.");
        },
        onError: () => Alert.alert("Couldn't invite", "Please try again."),
      }
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Members" }} />
      <Screen contentStyle={{ paddingTop: insets.top + 12 }}>
        <Row justify="space-between" align="center" style={{ marginBottom: 16 }}>
          <IconButton icon="arrow-left" onPress={() => safeBack(router)} />
          <IconButton
            icon="user-plus"
            bg={c.primary}
            color="#fff"
            onPress={() => setOpen(true)}
          />
        </Row>

        <AppText variant="h1">Members</AppText>
        <AppText color={c.mutedForeground} style={{ marginTop: 4, marginBottom: 20 }}>
          The people who make this circle.
        </AppText>
        <AppText
          variant="caption"
          color={c.mutedForeground}
          style={{ marginBottom: 12 }}
          testID="circle-capacity-summary"
        >
          {totalSkills} skills · {totalResources} resources across members
        </AppText>
        <Field label="Search skills and resources">
          <Input
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Try “first aid” or “truck”"
            maxLength={100}
            testID="input-circle-capacity-search"
          />
        </Field>

        {isLoading ? (
          <Skeleton height={120} />
        ) : normalizedSearch && searchLoading ? (
          <AppText color={c.mutedForeground}>Searching this circle…</AppText>
        ) : normalizedSearch && searchError ? (
          <AppText color={c.destructive}>Could not search this circle right now.</AppText>
        ) : visibleMembers.length === 0 ? (
          <Empty
            icon={normalizedSearch ? "search" : "users"}
            title={normalizedSearch ? "No matching skills or resources" : "No members yet"}
          />
        ) : (
          <View style={{ gap: 10 }}>
            {visibleMembers.map((m) => (
              <PressableCard
                key={m.id}
                onPress={() =>
                  m.userId && router.push(`/profile/${m.userId}?circleId=${circleId}`)
                }
              >
                <Row gap={12} align="center">
                  <Avatar
                    name={m.displayName}
                    objectPath={m.avatarObjectPath}
                    size={44}
                  />
                  <View style={{ flex: 1 }}>
                    <AppText weight="semibold">{m.displayName}</AppText>
                    {m.email ? (
                      <AppText variant="caption" color={c.mutedForeground} numberOfLines={1}>
                        {m.email}
                      </AppText>
                    ) : null}
                  </View>
                  {(() => {
                    const pill = rolePillColors(m.role, c);
                    return (
                      <Pressable
                        onPress={() => toggleRoleExplainer(m.id)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`${ROLE_LABELS[m.role as CircleRole] ?? m.role} role`}
                        accessibilityHint="Shows what this role can do"
                      >
                        <Pill
                          label={ROLE_LABELS[m.role as CircleRole] ?? m.role}
                          bg={pill.bg}
                          fg={pill.fg}
                        />
                      </Pressable>
                    );
                  })()}
                </Row>
                {((m.skills?.length ?? 0) > 0 || (m.resources?.length ?? 0) > 0) ? (
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 6,
                      marginTop: 12,
                    }}
                  >
                    {m.skills?.map((skill) => (
                      <Pill
                        key={`skill-${skill.id}`}
                        label={`Skill · ${skill.label}`}
                        bg={c.primarySoft}
                        fg={c.primary}
                      />
                    ))}
                    {m.resources?.map((resource) => (
                      <Pill
                        key={`resource-${resource.id}`}
                        label={`Resource · ${resource.label}${resource.isAvailable ? "" : " · unavailable"}`}
                        bg={resource.isAvailable ? c.primarySoft : c.muted}
                        fg={resource.isAvailable ? c.primary : c.mutedForeground}
                      />
                    ))}
                  </View>
                ) : null}
                {explainedRoleId === m.id &&
                ROLE_DESCRIPTIONS[m.role as CircleRole] ? (
                  <View
                    style={{
                      marginTop: 10,
                      paddingTop: 10,
                      borderTopWidth: 1,
                      borderTopColor: c.border,
                    }}
                  >
                    <AppText variant="caption" color={c.mutedForeground}>
                      {ROLE_LABELS[m.role as CircleRole] ?? m.role} —{" "}
                      {ROLE_DESCRIPTIONS[m.role as CircleRole]}
                    </AppText>
                  </View>
                ) : null}
              </PressableCard>
            ))}
          </View>
        )}

        {invitations && invitations.length > 0 && (
          <>
            <View style={{ height: 28 }} />
            <AppText variant="title" style={{ marginBottom: 10 }}>
              Pending invitations
            </AppText>
            <View style={{ gap: 8 }}>
              {invitations
                .filter((inv) => inv.status === "pending")
                .map((inv) => (
                  <Row
                    key={inv.id}
                    justify="space-between"
                    style={{
                      padding: 14,
                      backgroundColor: c.card,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: c.border,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Row gap={8} align="center">
                        <Feather name="mail" size={14} color={c.mutedForeground} />
                        <AppText weight="medium" numberOfLines={1}>
                          {inv.invitedEmail ?? "—"}
                        </AppText>
                      </Row>
                    </View>
                    {(() => {
                      const pill = rolePillColors(inv.role, c);
                      return (
                        <Pill
                          label={ROLE_LABELS[inv.role as CircleRole] ?? inv.role}
                          bg={pill.bg}
                          fg={pill.fg}
                        />
                      );
                    })()}
                  </Row>
                ))}
            </View>
          </>
        )}
      </Screen>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
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
            <Pressable onPress={() => setOpen(false)}>
              <AppText color={c.mutedForeground}>Cancel</AppText>
            </Pressable>
            <AppText weight="semibold">Invite a member</AppText>
            <View style={{ width: 50 }} />
          </Row>
          <KeyboardAwareScrollView
            contentContainerStyle={{ padding: 20 }}
            bottomOffset={40}
            keyboardShouldPersistTaps="handled"
          >
            <Field label="Email">
              <Input
                value={email}
                onChangeText={setEmail}
                placeholder="friend@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </Field>
            <Button
              title="Send invitation"
              onPress={send}
              loading={invite.isPending}
              style={{ marginTop: 8 }}
            />
          </KeyboardAwareScrollView>
        </View>
      </Modal>
    </>
  );
}
