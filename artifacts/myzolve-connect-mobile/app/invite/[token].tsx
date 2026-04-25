import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListCirclesQueryKey,
  getPreviewInvitationQueryKey,
  useAcceptInvitation,
  usePreviewInvitation,
} from "@workspace/api-client-react";

import { AppText, Button, Card, Row } from "@/components/UI";
import { PaywallSheet } from "@/components/PaywallSheet";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useColors } from "@/hooks/useColors";
import { CIRCLE_TYPE_LABELS } from "@/lib/circleTypes";

export default function InviteAcceptScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ token: string }>();
  const token = params.token;
  const qc = useQueryClient();
  const accept = useAcceptInvitation();
  const [paywallVisible, setPaywallVisible] = useState(false);

  // Pull a small preview so the user sees who's inviting them and the
  // circle's verified status BEFORE they tap accept. The token is the
  // access secret here — no extra auth scoping needed.
  const preview = usePreviewInvitation(token, {
    query: {
      enabled: !!token,
      retry: false,
      queryKey: getPreviewInvitationQueryKey(token),
    },
  });

  function onAccept() {
    accept.mutate(
      { token },
      {
        onSuccess: (res) => {
          qc.invalidateQueries({ queryKey: getListCirclesQueryKey() });
          if (res?.circleId) {
            router.replace(`/circle/${res.circleId}`);
          } else {
            router.replace("/(tabs)");
          }
        },
        onError: (err: unknown) => {
          // Accepting an invitation is a join path, so the free 2-circle cap
          // applies. Surface the same paywall the create/join flows use
          // instead of the generic expired/used message.
          const status =
            typeof err === "object" && err !== null && "status" in err
              ? (err as { status?: number }).status
              : undefined;
          if (status === 402) {
            setPaywallVisible(true);
            return;
          }
          Alert.alert(
            "Couldn't accept",
            "This invitation may be expired or already used.",
          );
        },
      }
    );
  }

  const data = preview.data;
  const circle = data?.circle;
  const isVerified = circle?.verificationStatus === "verified";
  const isExpiredOrUsed =
    data && (data.status === "expired" || data.status === "revoked" || data.status === "accepted");

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={{
          flex: 1,
          backgroundColor: c.background,
          paddingTop: insets.top + 24,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 24,
          justifyContent: "center",
        }}
      >
        <Card style={{ alignItems: "center", paddingVertical: 36 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: c.primarySoft,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Feather name="mail" size={32} color={c.primary} />
          </View>
          <AppText variant="h2">You&apos;ve been invited</AppText>

          {preview.isLoading ? (
            <ActivityIndicator
              color={c.primary}
              style={{ marginTop: 16 }}
              accessibilityLabel="Loading invitation"
            />
          ) : circle ? (
            <>
              <AppText
                color={c.mutedForeground}
                style={{ textAlign: "center", marginTop: 10, maxWidth: 280 }}
              >
                {data?.invitedBy?.displayName
                  ? `${data.invitedBy.displayName} invited you to join`
                  : "You've been invited to join"}
              </AppText>
              <Row
                align="center"
                gap={6}
                style={{ marginTop: 6, justifyContent: "center" }}
              >
                <AppText
                  variant="title"
                  weight="semibold"
                  style={{ textAlign: "center" }}
                >
                  {circle.name}
                </AppText>
                {isVerified ? <VerifiedBadge size="md" /> : null}
              </Row>
              <AppText
                variant="caption"
                color={c.mutedForeground}
                style={{ marginTop: 4 }}
              >
                {CIRCLE_TYPE_LABELS[circle.circleType] ?? circle.circleType}
              </AppText>
              {circle.description ? (
                <AppText
                  color={c.mutedForeground}
                  style={{
                    textAlign: "center",
                    marginTop: 12,
                    maxWidth: 320,
                    lineHeight: 20,
                  }}
                >
                  {circle.description}
                </AppText>
              ) : null}
              {isExpiredOrUsed ? (
                <AppText
                  color={c.destructive ?? c.mutedForeground}
                  style={{ textAlign: "center", marginTop: 16, maxWidth: 280 }}
                >
                  This invitation is no longer valid.
                </AppText>
              ) : null}
            </>
          ) : (
            <AppText
              color={c.mutedForeground}
              style={{ textAlign: "center", marginTop: 10, maxWidth: 280 }}
            >
              Accept the invitation to join this trusted circle.
            </AppText>
          )}

          <Button
            title="Accept invitation"
            onPress={onAccept}
            loading={accept.isPending}
            disabled={!!isExpiredOrUsed}
            style={{ marginTop: 24, alignSelf: "stretch" }}
          />
          <Row gap={6} style={{ marginTop: 14 }}>
            <Button
              title="Maybe later"
              variant="ghost"
              onPress={() => router.replace("/(tabs)")}
            />
          </Row>
        </Card>
      </View>
      <PaywallSheet
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
      />
    </>
  );
}
