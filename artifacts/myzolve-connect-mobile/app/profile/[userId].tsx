import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetUserPublicProfileQueryKey,
  getListMyUserConnectionsQueryKey,
  getListMyUserBlocksQueryKey,
  getListNotificationsQueryKey,
  useAcceptUserConnection,
  useBlockUser,
  useDeclineUserConnection,
  useGetMe,
  useGetUserPublicProfile,
  useRemoveUserConnection,
  useRequestUserConnection,
  useUnblockUser,
} from "@workspace/api-client-react";

import {
  AppText,
  Avatar,
  Button,
  Card,
  IconButton,
  Pill,
  Row,
  Skeleton,
} from "@/components/UI";
import { useColors } from "@/hooks/useColors";
import { safeBack } from "@/lib/safeBack";

export default function ProfileDetailScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ userId: string }>();
  const userId = Number(params.userId);
  const { data: me } = useGetMe();
  const { data: profile, isLoading } = useGetUserPublicProfile(userId);
  const isMe = me?.id === userId;

  const requestConn = useRequestUserConnection();
  const acceptConn = useAcceptUserConnection();
  const declineConn = useDeclineUserConnection();
  const removeConn = useRemoveUserConnection();
  const blockMut = useBlockUser();
  const unblockMut = useUnblockUser();
  const [busyAction, setBusyAction] = useState<string | null>(null);

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: getGetUserPublicProfileQueryKey(userId) });
    qc.invalidateQueries({ queryKey: getListMyUserConnectionsQueryKey() });
    qc.invalidateQueries({ queryKey: getListMyUserBlocksQueryKey() });
    qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
  }

  function handleConnect() {
    setBusyAction("connect");
    requestConn.mutate(
      { data: { receiverUserId: userId } },
      {
        onSuccess: () => {
          invalidateAll();
          setBusyAction(null);
          Alert.alert(
            "Request sent",
            `${profile?.firstName ?? profile?.displayName ?? "They"} will see your request soon.`,
          );
        },
        onError: () => {
          setBusyAction(null);
          Alert.alert(
            "Couldn't send request",
            "Please try again in a moment.",
          );
        },
      },
    );
  }

  function handleAccept() {
    if (!profile?.connection || profile.connection.status !== "pending") return;
    setBusyAction("accept");
    acceptConn.mutate(
      { connectionId: profile.connection.id },
      {
        onSuccess: () => {
          invalidateAll();
          setBusyAction(null);
        },
        onError: () => {
          setBusyAction(null);
          Alert.alert("Couldn't accept", "Please try again.");
        },
      },
    );
  }

  function handleDecline() {
    if (!profile?.connection || profile.connection.status !== "pending") return;
    setBusyAction("decline");
    declineConn.mutate(
      { connectionId: profile.connection.id },
      {
        onSuccess: () => {
          invalidateAll();
          setBusyAction(null);
        },
        onError: () => {
          setBusyAction(null);
          Alert.alert("Couldn't decline", "Please try again.");
        },
      },
    );
  }

  function handleRemove() {
    if (!profile?.connection) return;
    Alert.alert(
      profile.connection.status === "accepted"
        ? "Disconnect?"
        : "Cancel request?",
      profile.connection.status === "accepted"
        ? "You can reconnect any time."
        : "You can send a new request later.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: profile.connection.status === "accepted" ? "Disconnect" : "Cancel request",
          style: "destructive",
          onPress: () => {
            setBusyAction("remove");
            removeConn.mutate(
              { connectionId: profile.connection!.id },
              {
                onSuccess: () => {
                  invalidateAll();
                  setBusyAction(null);
                },
                onError: () => {
                  setBusyAction(null);
                  Alert.alert("Couldn't update", "Please try again.");
                },
              },
            );
          },
        },
      ],
    );
  }

  function handleBlock() {
    Alert.alert(
      `Block ${profile?.firstName ?? profile?.displayName ?? "this person"}?`,
      "They won't be able to message you, comment on your posts, or see your profile. Any existing connection will be removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () => {
            setBusyAction("block");
            blockMut.mutate(
              { userId },
              {
                onSuccess: () => {
                  invalidateAll();
                  setBusyAction(null);
                },
                onError: () => {
                  setBusyAction(null);
                  Alert.alert("Couldn't block", "Please try again.");
                },
              },
            );
          },
        },
      ],
    );
  }

  function handleUnblock() {
    Alert.alert(
      "Unblock?",
      "They'll be able to find your profile and contact you again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          onPress: () => {
            setBusyAction("unblock");
            unblockMut.mutate(
              { userId },
              {
                onSuccess: () => {
                  invalidateAll();
                  setBusyAction(null);
                },
                onError: () => {
                  setBusyAction(null);
                  Alert.alert("Couldn't unblock", "Please try again.");
                },
              },
            );
          },
        },
      ],
    );
  }

  function showMoreMenu() {
    Alert.alert(
      profile?.displayName ?? "Profile",
      undefined,
      [
        { text: "Block", style: "destructive", onPress: handleBlock },
        { text: "Cancel", style: "cancel" },
      ],
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <Row
          justify="space-between"
          align="center"
          style={{ paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 8 }}
        >
          <IconButton icon="arrow-left" onPress={() => safeBack(router)} />
          {isLoading || !profile || isMe ? (
            <View style={{ width: 40 }} />
          ) : (
            <IconButton
              icon="more-horizontal"
              onPress={showMoreMenu}
              accessibilityLabel="More actions"
              testID="button-profile-menu"
            />
          )}
        </Row>

        <View style={{ padding: 20 }}>
          {isLoading || !profile ? (
            <Skeleton height={240} />
          ) : (
            <>
              <View style={{ alignItems: "center", marginBottom: 20 }}>
                <Avatar
                  name={profile.displayName}
                  objectPath={profile.avatarObjectPath}
                  size={88}
                />
                <AppText variant="h1" style={{ marginTop: 12 }}>
                  {profile.displayName}
                </AppText>
                {profile.pronouns ? (
                  <AppText variant="caption" color={c.mutedForeground} style={{ marginTop: 4 }}>
                    {profile.pronouns}
                  </AppText>
                ) : null}
                {profile.location ? (
                  <Row gap={4} align="center" style={{ marginTop: 6 }}>
                    <Feather name="map-pin" size={14} color={c.mutedForeground} />
                    <AppText variant="caption" color={c.mutedForeground}>
                      {profile.location}
                    </AppText>
                  </Row>
                ) : null}
              </View>

              {!isMe && profile.connection?.status === "pending" && profile.connection.direction === "incoming" ? (
                <Card style={{ marginBottom: 12, backgroundColor: c.primarySoft, borderColor: "transparent" }}>
                  <AppText weight="semibold" style={{ marginBottom: 8 }}>
                    {profile.firstName ?? profile.displayName} wants to connect
                  </AppText>
                  <Row gap={8}>
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Accept"
                        icon="check"
                        size="sm"
                        onPress={handleAccept}
                        loading={busyAction === "accept"}
                        disabled={!!busyAction}
                        testID="button-accept-request"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Decline"
                        icon="x"
                        variant="outline"
                        size="sm"
                        onPress={handleDecline}
                        loading={busyAction === "decline"}
                        disabled={!!busyAction}
                        testID="button-decline-request"
                      />
                    </View>
                  </Row>
                </Card>
              ) : null}

              {!isMe ? (
                <Row gap={8} style={{ marginBottom: 12 }}>
                  {!profile.connection ? (
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Connect"
                        icon="user-plus"
                        onPress={handleConnect}
                        loading={busyAction === "connect"}
                        disabled={!!busyAction}
                        testID="button-connect"
                      />
                    </View>
                  ) : profile.connection.status === "pending" && profile.connection.direction === "outgoing" ? (
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Pending — cancel"
                        icon="clock"
                        variant="outline"
                        onPress={handleRemove}
                        loading={busyAction === "remove"}
                        disabled={!!busyAction}
                        testID="button-cancel-request"
                      />
                    </View>
                  ) : profile.connection.status === "accepted" ? (
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Connected"
                        icon="check"
                        variant="outline"
                        onPress={handleRemove}
                        disabled={!!busyAction}
                        testID="button-connected"
                      />
                    </View>
                  ) : null}
                  {profile.canMessage ? (
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Message"
                        icon="message-circle"
                        variant="outline"
                        onPress={() => router.push(`/messages/${profile.id}`)}
                        testID="button-message"
                      />
                    </View>
                  ) : null}
                </Row>
              ) : null}

              {profile.bio ? (
                <Card style={{ marginBottom: 12 }}>
                  <AppText>{profile.bio}</AppText>
                </Card>
              ) : null}

              <Card style={{ marginBottom: 12 }}>
                <Row gap={6} align="center" style={{ marginBottom: 6 }}>
                  <Feather name="users" size={14} color={c.mutedForeground} />
                  <AppText variant="caption" color={c.mutedForeground}>
                    Circles
                  </AppText>
                </Row>
                {profile.sharedCircles.length === 0 ? (
                  <AppText color={c.mutedForeground}>
                    No circles to show.
                  </AppText>
                ) : (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                    {profile.sharedCircles.map((sc) => (
                      <Pill
                        key={sc.id}
                        label={sc.isShared ? `${sc.name} · shared` : sc.name}
                        bg={sc.isShared ? c.primarySoft : c.muted}
                        fg={sc.isShared ? c.primary : c.foreground}
                      />
                    ))}
                  </View>
                )}
              </Card>

              {profile.memberSince ? (
                <Card style={{ marginBottom: 16 }}>
                  <Row gap={6} align="center">
                    <Feather name="calendar" size={14} color={c.mutedForeground} />
                    <AppText variant="caption" color={c.mutedForeground}>
                      Member since {format(new Date(profile.memberSince), "MMM yyyy")}
                    </AppText>
                  </Row>
                </Card>
              ) : null}

              {!isMe ? (
                <Pressable
                  onPress={handleUnblock}
                  testID={`button-unblock-from-profile-${userId}`}
                  style={{ alignItems: "center", marginTop: 4, padding: 10, opacity: 0 }}
                  pointerEvents="none"
                >
                  <AppText variant="caption" color={c.mutedForeground}>
                    Hidden unblock anchor
                  </AppText>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </View>
    </>
  );
}
