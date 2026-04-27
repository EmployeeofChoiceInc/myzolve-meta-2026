import { Feather } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  getListMyUserConnectionsQueryKey,
  getListNotificationsQueryKey,
  useAcceptUserConnection,
  useDeclineUserConnection,
  useListMyUserConnections,
  useRemoveUserConnection,
  type UserConnection,
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

type Tab = "accepted" | "incoming" | "outgoing";

export default function ConnectionsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const accepted = useListMyUserConnections({ status: "accepted", direction: "both" });
  const incoming = useListMyUserConnections({ status: "pending", direction: "incoming" });
  const outgoing = useListMyUserConnections({ status: "pending", direction: "outgoing" });

  const initialTab: Tab = (incoming.data?.length ?? 0) > 0 ? "incoming" : "accepted";
  const [tab, setTab] = useState<Tab>(initialTab);

  const acceptMut = useAcceptUserConnection();
  const declineMut = useDeclineUserConnection();
  const removeMut = useRemoveUserConnection();
  const [busyId, setBusyId] = useState<number | null>(null);

  function refresh() {
    qc.invalidateQueries({ queryKey: getListMyUserConnectionsQueryKey() });
    qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
  }

  function doAccept(id: number) {
    setBusyId(id);
    acceptMut.mutate(
      { connectionId: id },
      {
        onSuccess: () => { refresh(); setBusyId(null); },
        onError: () => { setBusyId(null); Alert.alert("Couldn't accept", "Try again."); },
      },
    );
  }

  function doDecline(id: number) {
    setBusyId(id);
    declineMut.mutate(
      { connectionId: id },
      {
        onSuccess: () => { refresh(); setBusyId(null); },
        onError: () => { setBusyId(null); Alert.alert("Couldn't decline", "Try again."); },
      },
    );
  }

  function doRemove(id: number, kind: "cancel" | "disconnect") {
    Alert.alert(
      kind === "cancel" ? "Cancel request?" : "Disconnect?",
      kind === "cancel"
        ? "You can send a new request later."
        : "You can reconnect any time.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: kind === "cancel" ? "Cancel request" : "Disconnect",
          style: "destructive",
          onPress: () => {
            setBusyId(id);
            removeMut.mutate(
              { connectionId: id },
              {
                onSuccess: () => { refresh(); setBusyId(null); },
                onError: () => { setBusyId(null); Alert.alert("Couldn't update", "Try again."); },
              },
            );
          },
        },
      ],
    );
  }

  const list =
    tab === "accepted" ? accepted.data
      : tab === "incoming" ? incoming.data
      : outgoing.data;
  const loading =
    tab === "accepted" ? accepted.isLoading
      : tab === "incoming" ? incoming.isLoading
      : outgoing.isLoading;

  const counts = {
    accepted: accepted.data?.length ?? 0,
    incoming: incoming.data?.length ?? 0,
    outgoing: outgoing.data?.length ?? 0,
  };

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
          <AppText weight="semibold">Connections</AppText>
          <IconButton
            icon="user-plus"
            onPress={() => router.push("/find-people")}
            accessibilityLabel="Find people"
            testID="button-find-people"
          />
        </Row>

        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Row gap={6}>
            <TabPill
              label={`Connected${counts.accepted ? ` (${counts.accepted})` : ""}`}
              active={tab === "accepted"}
              onPress={() => setTab("accepted")}
              testID="tab-connected"
            />
            <TabPill
              label={`Incoming${counts.incoming ? ` (${counts.incoming})` : ""}`}
              active={tab === "incoming"}
              onPress={() => setTab("incoming")}
              testID="tab-incoming"
            />
            <TabPill
              label={`Sent${counts.outgoing ? ` (${counts.outgoing})` : ""}`}
              active={tab === "outgoing"}
              onPress={() => setTab("outgoing")}
              testID="tab-outgoing"
            />
          </Row>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 }}>
          {loading ? (
            <View style={{ gap: 10 }}>
              <Skeleton height={80} />
              <Skeleton height={80} />
            </View>
          ) : !list || list.length === 0 ? (
            <Card>
              <AppText color={c.mutedForeground}>
                {tab === "accepted"
                  ? "Connect with people across all your circles in one place."
                  : tab === "incoming"
                    ? "No requests waiting on you right now."
                    : "You haven't sent any pending requests."}
              </AppText>
            </Card>
          ) : (
            <View style={{ gap: 10 }}>
              {list.map((conn) => (
                <ConnectionRow
                  key={conn.id}
                  conn={conn}
                  busy={busyId === conn.id}
                  primary={tab}
                  onOpen={() => router.push(`/profile/${conn.otherUser.id}`)}
                  onMessage={() => router.push(`/messages/${conn.otherUser.id}`)}
                  onAccept={() => doAccept(conn.id)}
                  onDecline={() => doDecline(conn.id)}
                  onRemove={() => doRemove(conn.id, tab === "outgoing" ? "cancel" : "disconnect")}
                />
              ))}
            </View>
          )}
        </View>
      </View>
    </>
  );
}

function TabPill({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: active ? c.primary : c.muted,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <AppText
        weight="semibold"
        color={active ? "#fff" : c.foreground}
        style={{ fontSize: 13 }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

function ConnectionRow({
  conn,
  busy,
  primary,
  onOpen,
  onMessage,
  onAccept,
  onDecline,
  onRemove,
}: {
  conn: UserConnection;
  busy: boolean;
  primary: Tab;
  onOpen: () => void;
  onMessage: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onRemove: () => void;
}) {
  const c = useColors();
  return (
    <Card>
      <Pressable onPress={onOpen} testID={`connection-row-${conn.id}`}>
        <Row gap={12} align="center" style={{ marginBottom: 12 }}>
          <Avatar
            name={conn.otherUser.displayName}
            objectPath={conn.otherUser.avatarObjectPath}
            size={44}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText weight="semibold" numberOfLines={1}>
              {conn.otherUser.displayName}
              {conn.otherUser.pronouns ? (
                <AppText variant="caption" color={c.mutedForeground}>
                  {"  "}({conn.otherUser.pronouns})
                </AppText>
              ) : null}
            </AppText>
            {conn.message ? (
              <AppText
                variant="caption"
                color={c.mutedForeground}
                numberOfLines={2}
                style={{ marginTop: 2 }}
              >
                "{conn.message}"
              </AppText>
            ) : null}
            <AppText variant="caption" color={c.mutedForeground} style={{ marginTop: 2 }}>
              {format(new Date(conn.createdAt), "MMM d, yyyy")}
            </AppText>
          </View>
        </Row>
      </Pressable>
      {primary === "incoming" ? (
        <Row gap={8}>
          <View style={{ flex: 1 }}>
            <Button
              title="Accept"
              icon="check"
              size="sm"
              onPress={onAccept}
              loading={busy}
              disabled={busy}
              testID={`button-accept-${conn.id}`}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="Decline"
              icon="x"
              variant="outline"
              size="sm"
              onPress={onDecline}
              loading={busy}
              disabled={busy}
              testID={`button-decline-${conn.id}`}
            />
          </View>
        </Row>
      ) : primary === "outgoing" ? (
        <Row gap={8} align="center">
          <Pill label="Pending" />
          <View style={{ flex: 1 }} />
          <Button
            title="Cancel"
            variant="ghost"
            size="sm"
            onPress={onRemove}
            loading={busy}
            disabled={busy}
            testID={`button-cancel-${conn.id}`}
          />
        </Row>
      ) : (
        <Row gap={8}>
          <View style={{ flex: 1 }}>
            <Button
              title="Message"
              icon="message-circle"
              variant="outline"
              size="sm"
              onPress={onMessage}
              testID={`button-message-${conn.id}`}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="Disconnect"
              variant="ghost"
              size="sm"
              onPress={onRemove}
              loading={busy}
              disabled={busy}
              testID={`button-disconnect-${conn.id}`}
            />
          </View>
        </Row>
      )}
    </Card>
  );
}
