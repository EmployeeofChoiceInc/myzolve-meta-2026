import React, { useMemo, useState } from "react";
import { Alert, Linking, View } from "react-native";
import { Stack } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
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
import { useIntlLocale } from "@/hooks/useDateLocale";
import {
  REVENUECAT_ENTITLEMENT_IDENTIFIER,
  useSubscription,
} from "@/lib/revenuecat";

function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(locale, {
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
  const { t } = useTranslation();
  const locale = useIntlLocale();
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
  const isAnnual = entitlement?.productIdentifier?.includes("annual");
  const planLabel = isAnnual ? t("plus.yourPlan") + " · " + t("plus.familyPlan") : t("plus.yourPlan");
  const resolvedPlanLabel = isAnnual ? t("plus.familyPlan") : t("plus.soloPlan");
  const renewalLabel = entitlement?.willRenew
    ? t("plus.renewsOn", {
        date: formatDate(entitlement.expirationDate, locale),
        defaultValue: `Renews on ${formatDate(entitlement.expirationDate, locale)}`,
      })
    : entitlement?.expirationDate
      ? t("plus.endsOn", {
          date: formatDate(entitlement.expirationDate, locale),
          defaultValue: `Ends on ${formatDate(entitlement.expirationDate, locale)}`,
        })
      : null;
  const priceLabel = isAnnual
    ? annualPackage?.product.priceString
    : monthlyPackage?.product.priceString;
  const priceSuffix = isAnnual ? t("plus.perYear", { defaultValue: "/year" }) : t("plus.perMonth", { defaultValue: "/month" });

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
        err instanceof Error ? err.message : t("common.errorBody");
      Alert.alert(t("plus.couldntUpdate", { defaultValue: "Couldn't update your plan" }), msg);
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
        err instanceof Error ? err.message : t("common.errorBody");
      Alert.alert(t("plus.couldntUpdate", { defaultValue: "Couldn't update your plan" }), msg);
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
        t("plus.couldntOpenSubs", { defaultValue: "Couldn't open subscription settings" }),
        t("plus.couldntOpenSubsBody", { defaultValue: "Open the App Store app, tap your profile, then Subscriptions." }),
      );
    }
  }

  async function handleRestore() {
    const { success } = await restore();
    if (!success) {
      Alert.alert(
        t("plus.noPurchases", { defaultValue: "No purchases to restore" }),
        t("plus.noPurchasesBody", { defaultValue: "We couldn't find an active Plus subscription on this Apple ID." }),
      );
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: t("navigation.plus") }} />
      <Screen>
        <Row gap={10} align="center">
          <PlusBadge size="md" variant="solid" />
          <AppText variant="h2" accessibilityRole="header">{t("plus.title")}</AppText>
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
              <Feather
                name="gift"
                size={18}
                color={c.primary}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
              <View style={{ flex: 1 }}>
                <AppText weight="semibold">
                  {t("plus.gifterTitle", {
                    name: plusStatus?.gifterName ?? t("plus.aFamilyCircle", { defaultValue: "a family circle" }),
                    defaultValue: `Your Plus is gifted by ${plusStatus?.gifterName ?? "a family circle"}`,
                  })}
                </AppText>
                <AppText
                  variant="caption"
                  color={c.mutedForeground}
                  style={{ marginTop: 2, lineHeight: 18 }}
                >
                  {t("plus.gifterBody", { defaultValue: "You have Plus through their family plan. It stays active as long as their subscription does." })}
                </AppText>
                {plusStatus?.graceUntil ? (
                  <AppText
                    variant="caption"
                    color={c.destructive ?? "#b91c1c"}
                    style={{ marginTop: 6, lineHeight: 18 }}
                  >
                    {t("plus.graceWarning", {
                      date: formatDate(plusStatus.graceUntil, locale),
                      defaultValue: `Heads up: their subscription has lapsed. Your gifted Plus will end on ${formatDate(plusStatus.graceUntil, locale)} unless they renew.`,
                    })}
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
                  <AppText weight="semibold">{resolvedPlanLabel}</AppText>
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
                    {isFamilyPlan ? t("plus.familyPlan") : t("plus.soloPlan")}
                  </AppText>
                  <AppText
                    variant="caption"
                    color={c.mutedForeground}
                    style={{ marginTop: 2, lineHeight: 18 }}
                  >
                    {isFamilyPlan
                      ? t("plus.familyPlanBody", {
                          cap: memberCap,
                          defaultValue: `Up to ${memberCap} people in your family circle get Plus while your subscription is active.`,
                        })
                      : t("plus.switchFamilyHint", { defaultValue: "Switch to a family plan to share Plus with up to 6 people in one of your circles." })}
                  </AppText>
                </View>
                {!isFamilyPlan ? (
                  <Button
                    title={t("plus.useAsFamily", { defaultValue: "Use as family" })}
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
                    {t("plus.familyCircle")}
                  </AppText>
                  {ownedCircles.length === 0 ? (
                    <AppText
                      variant="caption"
                      color={c.mutedForeground}
                      style={{ lineHeight: 18 }}
                    >
                      {t("plus.noOwnedCircles")}
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
                    {t("plus.familyCap", { cap: memberCap })}
                  </AppText>
                  {plusStatus?.familyCircleId ? (
                    <Button
                      title={t("plus.switchToSolo")}
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
                title={t("plus.manageSubscription")}
                icon="external-link"
                variant="outline"
                onPress={openManageSubscription}
                testID="plus-manage"
              />
              <Button
                title={t("plus.restorePurchases")}
                icon="refresh-cw"
                variant="ghost"
                loading={isRestoring}
                onPress={handleRestore}
                testID="plus-restore"
              />
            </View>

            <Card style={{ marginTop: 24 }}>
              <Row gap={10}>
                <Feather
                  name="heart"
                  size={18}
                  color={c.primary}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
                <AppText
                  variant="caption"
                  color={c.mutedForeground}
                  style={{ flex: 1 }}
                >
                  {t("plus.thanksForSupporting")}
                </AppText>
              </Row>
            </Card>
          </>
        ) : !hasDerivedPlus ? (
          <>
            <Card style={{ marginTop: 16 }}>
              <AppText weight="semibold" style={{ marginBottom: 6 }}>
                {t("plus.freePlan")}
              </AppText>
              <AppText
                variant="caption"
                color={c.mutedForeground}
                style={{ lineHeight: 18 }}
              >
                {t("plus.freePlanBody")}
              </AppText>
            </Card>

            <View style={{ marginTop: 16, gap: 10 }}>
              <Button
                title={t("plus.seeWhatsIncluded")}
                icon="star"
                onPress={() => setPaywallOpen(true)}
                testID="plus-open-paywall"
                disabled={!isAvailable || !isReady}
              />
              <Button
                title={t("plus.restorePurchases")}
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
              title={t("plus.getMyOwn")}
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
  const { t } = useTranslation();
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
          {overCap
            ? t("plus.memberCap", { count: memberCount, cap: memberCap })
            : t("common.memberCount", { count: memberCount })}
        </AppText>
      </View>
      <Button
        title={selected ? t("plus.selected") : t("plus.choose")}
        variant={selected ? "ghost" : "outline"}
        onPress={onPress}
        disabled={disabled || selected}
        testID={`plus-family-pick-${name}`}
      />
    </Row>
  );
}
