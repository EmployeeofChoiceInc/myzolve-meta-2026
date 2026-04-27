import { Feather } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getListMyUserConnectionsQueryKey,
  searchUsers,
  useRequestUserConnection,
} from "@workspace/api-client-react";

import {
  AppText,
  Avatar,
  Button,
  Card,
  IconButton,
  Input,
  Pill,
  Row,
  Skeleton,
} from "@/components/UI";
import { useColors } from "@/hooks/useColors";
import { safeBack } from "@/lib/safeBack";

export default function FindPeopleScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const hasQuery = trimmed.length >= 2;
  const { data: results, isLoading, isFetching } = useQuery({
    queryKey: ["users-search", trimmed],
    queryFn: () => searchUsers({ q: trimmed }),
    enabled: hasQuery,
  });
  const requestConn = useRequestUserConnection();
  const [pendingId, setPendingId] = useState<number | null>(null);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["users-search"] });
    qc.invalidateQueries({ queryKey: getListMyUserConnectionsQueryKey() });
  }

  function connect(receiverUserId: number, name: string) {
    setPendingId(receiverUserId);
    requestConn.mutate(
      { data: { receiverUserId } },
      {
        onSuccess: () => {
          invalidate();
          setPendingId(null);
          Alert.alert("Request sent", `${name} will see your request soon.`);
        },
        onError: () => {
          setPendingId(null);
          Alert.alert("Couldn't send", "Please try again in a moment.");
        },
      },
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
          <AppText weight="semibold">Find people</AppText>
          <View style={{ width: 40 }} />
        </Row>

        <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 }}>
          <AppText color={c.mutedForeground} style={{ marginBottom: 12 }}>
            Search by name, exact email, or exact phone number to send a connection request.
          </AppText>
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Try a name, email, or phone…"
            autoCapitalize="none"
            autoCorrect={false}
            testID="input-find-people"
          />
        </View>

        <View style={{ paddingHorizontal: 20, paddingBottom: 32 }}>
          {!hasQuery ? (
            <Card>
              <AppText color={c.mutedForeground}>
                Type at least two characters to start searching.
              </AppText>
            </Card>
          ) : isLoading || isFetching ? (
            <View style={{ gap: 10 }}>
              <Skeleton height={72} />
              <Skeleton height={72} />
            </View>
          ) : !results || results.length === 0 ? (
            <Card>
              <AppText weight="semibold" style={{ marginBottom: 4 }}>
                No matches yet
              </AppText>
              <AppText variant="caption" color={c.mutedForeground}>
                Phone numbers only show up for people who've turned on phone discoverability.
              </AppText>
            </Card>
          ) : (
            <View style={{ gap: 10 }}>
              {results.map((u) => {
                const conn = u.connection ?? null;
                const busy = pendingId === u.id;
                return (
                  <Pressable
                    key={u.id}
                    onPress={() => router.push(`/profile/${u.id}`)}
                    testID={`find-row-${u.id}`}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Card>
                      <Row gap={12} align="center">
                        <Avatar
                          name={u.displayName}
                          objectPath={u.avatarObjectPath}
                          size={44}
                        />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <AppText weight="semibold" numberOfLines={1}>
                            {u.displayName}
                            {u.pronouns ? (
                              <AppText variant="caption" color={c.mutedForeground}>
                                {"  "}({u.pronouns})
                              </AppText>
                            ) : null}
                          </AppText>
                          {u.location ? (
                            <Row gap={4} align="center" style={{ marginTop: 2 }}>
                              <Feather name="map-pin" size={11} color={c.mutedForeground} />
                              <AppText variant="caption" color={c.mutedForeground} numberOfLines={1}>
                                {u.location}
                              </AppText>
                            </Row>
                          ) : null}
                        </View>
                        {!conn ? (
                          <Button
                            title="Connect"
                            icon="user-plus"
                            size="sm"
                            onPress={() => connect(u.id, u.firstName ?? u.displayName)}
                            loading={busy}
                            disabled={!!pendingId}
                            testID={`button-connect-${u.id}`}
                          />
                        ) : conn.status === "pending" && conn.direction === "outgoing" ? (
                          <Pill label="Pending" />
                        ) : conn.status === "pending" && conn.direction === "incoming" ? (
                          <Pill label="Awaiting you" />
                        ) : conn.status === "accepted" ? (
                          <Pill label="Connected" />
                        ) : null}
                      </Row>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </View>
    </>
  );
}
