import { useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Avatar, Empty, PressableCard, Row, Skeleton } from "@/components/UI";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";
import { useMessageInbox } from "@/lib/messageApi";
import { formatDistanceToNow } from "date-fns";

export default function MessagesScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useMessageInbox();

  return (
    <Screen
      contentStyle={{ paddingTop: insets.top + 12 }}
      refreshing={isRefetching}
      onRefresh={refetch}
    >
      <AppText variant="h1">Messages</AppText>
      <AppText color={c.mutedForeground} style={{ marginTop: 4, marginBottom: 20 }}>
        Quiet, one-on-one notes with your circle.
      </AppText>

      {isLoading ? (
        <View style={{ gap: 12 }}>
          <Skeleton height={72} />
          <Skeleton height={72} />
          <Skeleton height={72} />
        </View>
      ) : !data || data.length === 0 ? (
        <Empty
          icon="message-circle"
          title="No messages yet"
          subtitle="Open a member's profile to start a conversation."
        />
      ) : (
        <View style={{ gap: 10 }}>
          {data.map((thread) => {
            const unread = thread.unreadCount > 0;
            return (
              <PressableCard
                key={thread.partnerId}
                onPress={() => router.push(`/messages/${thread.partnerId}`)}
              >
                <Row gap={12} align="center">
                  <Avatar
                    name={thread.partnerName}
                    objectPath={thread.partnerAvatarObjectPath}
                    size={44}
                  />
                  <View style={{ flex: 1 }}>
                    <Row justify="space-between" align="center">
                      <AppText weight={unread ? "bold" : "semibold"} numberOfLines={1}>
                        {thread.partnerName}
                      </AppText>
                      <AppText variant="caption" color={c.mutedForeground}>
                        {formatDistanceToNow(new Date(thread.lastMessage.createdAt), {
                          addSuffix: false,
                        })}
                      </AppText>
                    </Row>
                    <AppText
                      variant="caption"
                      color={unread ? c.foreground : c.mutedForeground}
                      numberOfLines={1}
                      style={{ marginTop: 2 }}
                    >
                      {thread.lastMessage.body}
                    </AppText>
                  </View>
                  {unread && (
                    <View
                      style={{
                        backgroundColor: c.primary,
                        borderRadius: 999,
                        minWidth: 22,
                        height: 22,
                        paddingHorizontal: 6,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <AppText variant="caption" color="#fff" weight="bold">
                        {thread.unreadCount}
                      </AppText>
                    </View>
                  )}
                </Row>
              </PressableCard>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
