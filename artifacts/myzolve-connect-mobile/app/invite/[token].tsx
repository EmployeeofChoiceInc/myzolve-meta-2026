import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListCirclesQueryKey,
  useAcceptInvitation,
} from "@workspace/api-client-react";

import { AppText, Button, Card, Row } from "@/components/UI";
import { PaywallSheet } from "@/components/PaywallSheet";
import { useColors } from "@/hooks/useColors";

export default function InviteAcceptScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ token: string }>();
  const token = params.token;
  const qc = useQueryClient();
  const accept = useAcceptInvitation();
  const [paywallVisible, setPaywallVisible] = useState(false);

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
          <AppText variant="h2">You've been invited</AppText>
          <AppText
            color={c.mutedForeground}
            style={{ textAlign: "center", marginTop: 10, maxWidth: 280 }}
          >
            Accept the invitation to join this trusted circle.
          </AppText>
          <Button
            title="Accept invitation"
            onPress={onAccept}
            loading={accept.isPending}
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
