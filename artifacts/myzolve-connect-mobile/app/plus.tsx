import React, { useState } from "react";
import { Alert, Linking, View } from "react-native";
import { Stack } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { AppText, Button, Card, Row } from "@/components/UI";
import { Screen } from "@/components/Screen";
import { PlusBadge } from "@/components/PlusBadge";
import { PaywallSheet } from "@/components/PaywallSheet";
import { useColors } from "@/hooks/useColors";
import {
  REVENUECAT_ENTITLEMENT_IDENTIFIER,
  useSubscription,
} from "@/lib/revenuecat";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function PlusScreen() {
  const c = useColors();
  const {
    isPlus,
    isReady,
    isAvailable,
    initError,
    customerInfo,
    monthlyPackage,
    annualPackage,
    restore,
    isRestoring,
    managementUrl,
  } = useSubscription();
  const [paywallOpen, setPaywallOpen] = useState(false);

  const entitlement =
    customerInfo?.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER];
  const renewalLabel = entitlement?.willRenew
    ? `Renews on ${formatDate(entitlement.expirationDate)}`
    : entitlement?.expirationDate
      ? `Ends on ${formatDate(entitlement.expirationDate)}`
      : null;

  const isAnnual = entitlement?.productIdentifier?.includes("annual");
  const planLabel = isAnnual ? "Annual plan" : "Monthly plan";
  const priceLabel = isAnnual
    ? annualPackage?.product.priceString
    : monthlyPackage?.product.priceString;
  const priceSuffix = isAnnual ? "/year" : "/month";

  async function openManageSubscription() {
    if (managementUrl) {
      try {
        await Linking.openURL(managementUrl);
        return;
      } catch {
        // fall through
      }
    }
    const fallback = "https://apps.apple.com/account/subscriptions";
    try {
      await Linking.openURL(fallback);
    } catch {
      Alert.alert(
        "Couldn't open subscription settings",
        "Open the App Store app, tap your profile, then Subscriptions.",
      );
    }
  }

  async function handleRestore() {
    const { success } = await restore();
    if (!success) {
      Alert.alert(
        "No purchases to restore",
        "We couldn't find an active Plus subscription on this Apple ID.",
      );
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "MyZolve Connect Plus" }} />
      <Screen>
        <Row gap={10} align="center">
          <PlusBadge size="md" variant="solid" />
          <AppText variant="h2">MyZolve Connect Plus</AppText>
        </Row>

        {!isAvailable && initError ? (
          <Card style={{ marginTop: 16 }}>
            <AppText variant="caption" color={c.destructive ?? "#b91c1c"}>
              {initError}
            </AppText>
          </Card>
        ) : null}

        {isPlus ? (
          <>
            <Card style={{ marginTop: 16 }}>
              <Row justify="space-between" align="center">
                <View style={{ flex: 1 }}>
                  <AppText weight="semibold">{planLabel}</AppText>
                  {renewalLabel ? (
                    <AppText
                      variant="caption"
                      color={c.mutedForeground}
                      style={{ marginTop: 2 }}
                    >
                      {renewalLabel}
                    </AppText>
                  ) : null}
                </View>
                {priceLabel ? (
                  <View style={{ alignItems: "flex-end" }}>
                    <AppText weight="bold">{priceLabel}</AppText>
                    <AppText variant="caption" color={c.mutedForeground}>
                      {priceSuffix}
                    </AppText>
                  </View>
                ) : null}
              </Row>
            </Card>

            <View style={{ marginTop: 16, gap: 10 }}>
              <Button
                title="Manage subscription"
                icon="external-link"
                variant="outline"
                onPress={openManageSubscription}
                testID="plus-manage"
              />
              <Button
                title="Restore purchases"
                icon="refresh-cw"
                variant="ghost"
                loading={isRestoring}
                onPress={handleRestore}
                testID="plus-restore"
              />
            </View>

            <Card style={{ marginTop: 24 }}>
              <Row gap={10}>
                <Feather name="heart" size={18} color={c.primary} />
                <AppText
                  variant="caption"
                  color={c.mutedForeground}
                  style={{ flex: 1 }}
                >
                  Thanks for being a Plus member. Your support keeps Connect
                  warm and ad-free for the people who keep showing up.
                </AppText>
              </Row>
            </Card>
          </>
        ) : (
          <>
            <Card style={{ marginTop: 16 }}>
              <AppText weight="semibold" style={{ marginBottom: 6 }}>
                You're on the free plan
              </AppText>
              <AppText
                variant="caption"
                color={c.mutedForeground}
                style={{ lineHeight: 18 }}
              >
                Plus unlocks bigger circles, richer moments, and tools made for
                the people who keep showing up.
              </AppText>
            </Card>

            <View style={{ marginTop: 16, gap: 10 }}>
              <Button
                title="See what's included"
                icon="star"
                onPress={() => setPaywallOpen(true)}
                testID="plus-open-paywall"
                disabled={!isAvailable || !isReady}
              />
              <Button
                title="Restore purchases"
                icon="refresh-cw"
                variant="ghost"
                loading={isRestoring}
                onPress={handleRestore}
                testID="plus-restore"
              />
            </View>
          </>
        )}
      </Screen>

      <PaywallSheet
        visible={paywallOpen}
        onClose={() => setPaywallOpen(false)}
      />
    </>
  );
}
