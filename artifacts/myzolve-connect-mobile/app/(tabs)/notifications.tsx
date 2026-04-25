import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getListNotificationsQueryKey,
  useListNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useReviewCopilotPost,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

import { AppText, Button, Empty, Row, Skeleton } from "@/components/UI";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";

const ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  new_request: "alert-circle",
  support_received: "heart",
  repayment_due: "clock",
  repayment_received: "check-circle",
  service_match: "users",
  new_comment: "message-square",
  reaction_received: "smile",
  gratitude_received: "gift",
  member_joined: "user-plus",
  circle_update: "bell",
  dispute_opened: "alert-triangle",
  dispute_resolved: "check",
  copilot_invite_received: "user-plus",
  copilot_post_made: "user-check",
};

const COPILOT_ENTITY_TYPES = new Set([
  "support_request",
  "comment",
  "gratitude_note",
  "circle_post",
]);

type CopilotEntityType =
  | "support_request"
  | "comment"
  | "gratitude_note"
  | "circle_post";

export default function NotificationsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { data, isLoading, refetch, isRefetching } = useListNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const review = useReviewCopilotPost();
  const [reviewing, setReviewing] = useState<{
    id: number;
    decision: "approved" | "flagged";
  } | null>(null);

  function handleTap(n: {
    id: number;
    targetEntityType?: string | null;
    targetEntityId?: number | null;
    notificationType: string;
  }) {
    markRead.mutate(
      { notificationId: n.id },
      {
        onSuccess: () => qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() }),
      }
    );
    if (n.notificationType === "copilot_invite_received") {
      router.push("/settings");
      return;
    }
    if (n.targetEntityType === "support_request" && n.targetEntityId) {
      router.push(`/request/${n.targetEntityId}`);
    } else if (n.targetEntityType === "service_post" && n.targetEntityId) {
      router.push(`/service/${n.targetEntityId}`);
    } else if (n.targetEntityType === "circle" && n.targetEntityId) {
      router.push(`/circle/${n.targetEntityId}`);
    } else if (
      n.targetEntityType === "circle_post" &&
      n.targetEntityId
    ) {
      // Wall posts don't have a per-post detail page yet; fall through to the
      // notification card actions which let the grantor approve/flag inline.
    }
  }

  function submitReview(
    notificationId: number,
    entityType: CopilotEntityType,
    entityId: number,
    decision: "approved" | "flagged",
  ) {
    setReviewing({ id: notificationId, decision });
    review.mutate(
      { entityType, entityId, data: { review: decision } },
      {
        onSuccess: () => {
          markRead.mutate({ notificationId });
          qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
          setReviewing(null);
          Alert.alert(
            decision === "approved" ? "Approved" : "Flagged",
            decision === "approved"
              ? "Thanks — the post stays as-is."
              : "Got it — your circle admin will be able to review the flagged post.",
          );
        },
        onError: () => {
          setReviewing(null);
          Alert.alert("Couldn't save review", "Please try again in a moment.");
        },
      },
    );
  }

  return (
    <Screen
      contentStyle={{ paddingTop: insets.top + 12 }}
      refreshing={isRefetching}
      onRefresh={refetch}
    >
      <Row justify="space-between" align="center" style={{ marginBottom: 18 }}>
        <View style={{ flex: 1 }}>
          <AppText variant="h1">Alerts</AppText>
          <AppText color={c.mutedForeground} style={{ marginTop: 4 }}>
            What's new in your circles.
          </AppText>
        </View>
        {data && data.unreadCount > 0 && (
          <Pressable
            onPress={() =>
              markAll.mutate(undefined, {
                onSuccess: () => qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() }),
              })
            }
          >
            <AppText color={c.primary} weight="semibold">
              Mark all read
            </AppText>
          </Pressable>
        )}
      </Row>

      {isLoading ? (
        <View style={{ gap: 10 }}>
          <Skeleton height={72} />
          <Skeleton height={72} />
        </View>
      ) : !data || data.notifications.length === 0 ? (
        <Empty icon="bell" title="All caught up" subtitle="No new notifications." />
      ) : (
        <View style={{ gap: 10 }}>
          {data.notifications.map((n) => {
            const icon = ICONS[n.notificationType] ?? "bell";
            const isCopilotPost =
              n.notificationType === "copilot_post_made" &&
              !!n.targetEntityType &&
              COPILOT_ENTITY_TYPES.has(n.targetEntityType) &&
              !!n.targetEntityId;
            const isReviewing = reviewing?.id === n.id;
            return (
              <Pressable
                key={n.id}
                onPress={() => handleTap(n)}
                style={({ pressed }) => ({
                  backgroundColor: n.isRead ? c.card : c.primarySoft,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: n.isRead ? c.border : "transparent",
                  padding: 14,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Row gap={12} align="flex-start">
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: n.isRead ? c.muted : c.primary,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Feather
                      name={icon}
                      size={16}
                      color={n.isRead ? c.mutedForeground : "#fff"}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText weight={n.isRead ? "medium" : "bold"}>{n.title}</AppText>
                    <AppText
                      variant="caption"
                      color={c.mutedForeground}
                      style={{ marginTop: 2 }}
                    >
                      {n.body}
                    </AppText>
                    <AppText variant="caption" color={c.mutedForeground} style={{ marginTop: 6 }}>
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </AppText>
                    {isCopilotPost ? (
                      <Row gap={8} style={{ marginTop: 12 }}>
                        <Button
                          title="Looks good"
                          icon="check"
                          variant="outline"
                          size="sm"
                          loading={isReviewing && reviewing?.decision === "approved"}
                          disabled={isReviewing}
                          testID={`copilot-approve-${n.id}`}
                          onPress={() =>
                            submitReview(
                              n.id,
                              n.targetEntityType as CopilotEntityType,
                              n.targetEntityId!,
                              "approved",
                            )
                          }
                        />
                        <Button
                          title="Flag"
                          icon="flag"
                          variant="outline"
                          size="sm"
                          loading={isReviewing && reviewing?.decision === "flagged"}
                          disabled={isReviewing}
                          testID={`copilot-flag-${n.id}`}
                          onPress={() =>
                            submitReview(
                              n.id,
                              n.targetEntityType as CopilotEntityType,
                              n.targetEntityId!,
                              "flagged",
                            )
                          }
                        />
                      </Row>
                    ) : null}
                  </View>
                </Row>
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
