import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Alert, Image, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMeQueryKey,
  getListCirclesQueryKey,
  getPreviewOrgInviteQueryKey,
  useAcceptOrgInvite,
  usePreviewOrgInvite,
} from "@workspace/api-client-react";

import { AppText, Button, Card, Row } from "@/components/UI";
import { useColors } from "@/hooks/useColors";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

function orgLogoUri(logoUrl: string | null | undefined): string | undefined {
  if (!logoUrl) return undefined;
  return logoUrl.startsWith("http") ? logoUrl : `${API_BASE}${logoUrl}`;
}

export default function OrgInviteAcceptScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ token: string }>();
  const token = params.token;
  const qc = useQueryClient();
  const accept = useAcceptOrgInvite();

  // Public preview so the invitee sees the org (name + branding) before they
  // accept. The token is the access secret — no extra auth scoping needed.
  const preview = usePreviewOrgInvite(token, {
    query: {
      enabled: !!token,
      retry: false,
      queryKey: getPreviewOrgInviteQueryKey(token),
    },
  });

  function onAccept() {
    accept.mutate(
      { token },
      {
        onSuccess: () => {
          // Joining an org grants Plus and may org-brand the member's circles,
          // so refresh both the profile and the circle list.
          qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
          qc.invalidateQueries({ queryKey: getListCirclesQueryKey() });
          router.replace("/(tabs)");
        },
        onError: () => {
          Alert.alert(
            "Couldn't accept",
            "This invitation may be expired, already used, or sent to a different email address.",
          );
        },
      },
    );
  }

  const data = preview.data;
  const org = data?.org;
  const accent = org?.accentColor || c.primary;
  const isInvalid = data && !data.valid;
  const logoUri = orgLogoUri(org?.logoUrl);

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
          {logoUri ? (
            <Image
              source={{ uri: logoUri }}
              style={{
                width: 72,
                height: 72,
                borderRadius: 16,
                marginBottom: 16,
              }}
              resizeMode="contain"
              accessibilityLabel={`${org?.name ?? "Organization"} logo`}
            />
          ) : (
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
              <Feather name="briefcase" size={32} color={accent} />
            </View>
          )}
          <AppText variant="h2">You&apos;ve been invited</AppText>

          {preview.isLoading ? (
            <ActivityIndicator
              color={c.primary}
              style={{ marginTop: 16 }}
              accessibilityLabel="Loading invitation"
            />
          ) : org ? (
            <>
              <AppText
                color={c.mutedForeground}
                style={{ textAlign: "center", marginTop: 10, maxWidth: 280 }}
              >
                You&apos;ve been invited to join
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
                  {org.name}
                </AppText>
              </Row>
              <AppText
                variant="caption"
                color={c.mutedForeground}
                style={{ textAlign: "center", marginTop: 8, maxWidth: 280 }}
              >
                Joining gives you MyZolve Plus while you&apos;re a member.
              </AppText>
              {isInvalid ? (
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
              Accept the invitation to join this organization.
            </AppText>
          )}

          <Button
            title="Accept invitation"
            onPress={onAccept}
            loading={accept.isPending}
            disabled={!!isInvalid || !org}
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
    </>
  );
}
