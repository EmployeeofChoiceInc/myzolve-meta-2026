import React, { useMemo, useState } from "react";
import { Alert, Linking, View } from "react-native";
import { Stack } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  getGetMyPlusStatusQueryKey,
  getListCirclesQueryKey,
  useGetMyPlusStatus,
  useListCircles,
  useUpdateMyPlusPlan,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

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
  const qc = useQueryClient();
  const {
    isPlus: localIsPlus,
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

  const { data: plusStatus } = useGetMyPlusStatus({
    query: { staleTime: 30_000, queryKey: getGetMyPlusStatusQueryKey() },
  });
  const { data: circles } = useListCircles({
    query: { staleTime: 60_000, queryKey: getListCirclesQueryKey() },
  });
  const updatePlan = useUpdateMyPlusPlan();

  const [paywallOpen, setPaywallOpen] = useState(false);

  const hasDirectPlus = localIsPlus || plusStatus?.source === "direct";
  const hasDerivedPlus = !hasDirectPlus && plusStatus?.source === "family";
  const isPlus = hasDirectPlus || hasDerivedPlus;

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

  const planKind = plusStatus?.planKind ?? "solo";
  const isFamilyPlan = hasDirectPlus && planKind === "family";
  const ownedCircles = useMemo(
    () =>
      (circles ?? []).filter((circ) => circ.myRole === "owner"),
    [circles],
  );
  const memberCap = plusStatus?.familyCircleMemberCap ?? 6;

  async function setFamilyCircle(circleId: number | null) {
    try {
      await updatePlan.mutateAsync({
        data: {
          planKind: circleId == null ? "solo" : "family",
          familyCircleId: circleId,
        },
      });
      qc.invalidateQueries({ queryKey: getGetMyPlusStatusQueryKey() });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "We couldn't save that change.";
      Alert.alert("Couldn't update your plan", msg);
    }
  }

  async function switchToFamilyPlan() {
    try {
      await updatePlan.mutateAsync({
        data: { planKind: "family", familyCircleId: null },
      });
      qc.invalidateQueries({ queryKey: getGetMyPlusStatusQueryKey() });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "We couldn't save that change.";
      Alert.alert("Couldn't update your plan", msg);
    }
  }

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

        {hasDerivedPlus ? (
          <Card style={{ marginTop: 16 }} testID="plus-gifter-card">
            <Row gap={10} align="center">
              <Feather name="gift" size={18} color={c.primary} />
              <View style={{ flex: 1 }}>
                <AppText weight="semibold">
                  Your Plus is gifted by{" "}
                  {plusStatus?.gifterName ?? "a family circle"}
                </AppText>
                <AppText
                  variant="caption"
                  color={c.mutedForeground}
                  style={{ marginTop: 2, lineHeight: 18 }}
                >
                  You have Plus through their family plan. It stays active as
                  long as their subscription does.
                </AppText>
                {plusStatus?.graceUntil ? (
                  <AppText
                    variant="caption"
                    color={c.destructive ?? "#b91c1c"}
                    style={{ marginTop: 6, lineHeight: 18 }}
                  >
                    Heads up: their subscription has lapsed. Your gifted Plus
                    will end on {formatDate(plusStatus.graceUntil)} unless they
                    renew.
                  </AppText>
                ) : null}
              </View>
            </Row>
          </Card>
        ) : null}

        {hasDirectPlus ? (
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

            <Card style={{ marginTop: 16 }} testID="plus-family-card">
              <Row justify="space-between" align="center">
                <View style={{ flex: 1 }}>
                  <AppText weight="semibold">
                    {isFamilyPlan ? "Family plan" : "Just-me plan"}
                  </AppText>
                  <AppText
                    variant="caption"
                    color={c.mutedForeground}
                    style={{ marginTop: 2, lineHeight: 18 }}
                  >
                    {isFamilyPlan
                      ? `Up to ${memberCap} people in your family circle get Plus while your subscription is active.`
                      : "Switch to a family plan to share Plus with up to 6 people in one of your circles."}
                  </AppText>
                </View>
                {!isFamilyPlan ? (
                  <Button
                    title="Use as family"
                    variant="outline"
                    onPress={switchToFamilyPlan}
                    loading={updatePlan.isPending}
                    testID="plus-switch-family"
                  />
                ) : null}
              </Row>

              {isFamilyPlan ? (
                <View style={{ marginTop: 14 }}>
                  <AppText weight="semibold" style={{ marginBottom: 6 }}>
                    Family circle
                  </AppText>
                  {ownedCircles.length === 0 ? (
                    <AppText
                      variant="caption"
                      color={c.mutedForeground}
                      style={{ lineHeight: 18 }}
                    >
                      You're not the owner of any circle yet. Create a circle
                      first, then come back here to designate it as your family
                      circle.
                    </AppText>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {ownedCircles.map((circ) => {
                        const selected =
                          plusStatus?.familyCircleId === circ.id;
                        const overCap = circ.memberCount > memberCap;
                        return (
                          <FamilyCircleRow
                            key={circ.id}
                            name={circ.name}
                            memberCount={circ.memberCount}
                            memberCap={memberCap}
                            overCap={overCap}
                            selected={selected}
                            onPress={() => setFamilyCircle(circ.id)}
                            disabled={updatePlan.isPending}
                          />
                        );
                      })}
                    </View>
                  )}
                  <AppText
                    variant="caption"
                    color={c.mutedForeground}
                    style={{ marginTop: 10, lineHeight: 16 }}
                  >
                    Plus is gifted to the first {memberCap} active members
                    (oldest joiners first). Members beyond that won't get Plus
                    automatically.
                  </AppText>
                  {plusStatus?.familyCircleId ? (
                    <Button
                      title="Switch to just-me plan"
                      variant="ghost"
                      onPress={() => setFamilyCircle(null)}
                      loading={updatePlan.isPending}
                      testID="plus-switch-solo"
                      style={{ marginTop: 8 }}
                    />
                  ) : null}
                </View>
              ) : null}
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
        ) : !hasDerivedPlus ? (
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
        ) : (
          <View style={{ marginTop: 16, gap: 10 }}>
            <Button
              title="Get my own Plus"
              icon="star"
              variant="outline"
              onPress={() => setPaywallOpen(true)}
              testID="plus-open-paywall"
              disabled={!isAvailable || !isReady}
            />
          </View>
        )}
      </Screen>

      <PaywallSheet
        visible={paywallOpen}
        onClose={() => setPaywallOpen(false)}
      />
    </>
  );
}

function FamilyCircleRow({
  name,
  memberCount,
  memberCap,
  overCap,
  selected,
  onPress,
  disabled,
}: {
  name: string;
  memberCount: number;
  memberCap: number;
  overCap: boolean;
  selected: boolean;
  onPress: () => void;
  disabled: boolean;
}) {
  const c = useColors();
  return (
    <Row
      justify="space-between"
      align="center"
      style={{
        backgroundColor: selected ? c.primarySoft : c.card,
        borderColor: selected ? c.primary : c.border,
        borderWidth: selected ? 2 : 1,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        <AppText weight="semibold">{name}</AppText>
        <AppText
          variant="caption"
          color={overCap ? c.destructive ?? "#b91c1c" : c.mutedForeground}
          style={{ marginTop: 2 }}
        >
          {memberCount} {memberCount === 1 ? "member" : "members"}
          {overCap ? ` · only first ${memberCap} get Plus` : ""}
        </AppText>
      </View>
      <Button
        title={selected ? "Selected" : "Choose"}
        variant={selected ? "ghost" : "outline"}
        onPress={onPress}
        disabled={disabled || selected}
        testID={`plus-family-pick-${name}`}
      />
    </Row>
  );
}
