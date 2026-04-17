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
  useCreateCircleInvitation,
  useListCircleInvitations,
  useListCircleMembers,
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

export default function MembersScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const circleId = Number(params.id);
  const qc = useQueryClient();
  const { data: members, isLoading } = useListCircleMembers(circleId);
  const { data: invitations } = useListCircleInvitations(circleId);
  const invite = useCreateCircleInvitation();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");

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
          <IconButton icon="arrow-left" onPress={() => router.back()} />
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

        {isLoading ? (
          <Skeleton height={120} />
        ) : !members || members.length === 0 ? (
          <Empty icon="users" title="No members yet" />
        ) : (
          <View style={{ gap: 10 }}>
            {members.map((m) => (
              <PressableCard
                key={m.id}
                onPress={() => m.userId && router.push(`/profile/${m.userId}`)}
              >
                <Row gap={12} align="center">
                  <Avatar name={m.displayName} size={44} />
                  <View style={{ flex: 1 }}>
                    <AppText weight="semibold">{m.displayName}</AppText>
                    {m.email ? (
                      <AppText variant="caption" color={c.mutedForeground} numberOfLines={1}>
                        {m.email}
                      </AppText>
                    ) : null}
                  </View>
                  <Pill
                    label={m.role}
                    bg={m.role === "owner" ? c.primarySoft : c.muted}
                    fg={m.role === "owner" ? c.primary : c.foreground}
                  />
                </Row>
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
                    <Pill label={inv.role} />
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
