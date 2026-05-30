import React, { useEffect, useMemo, useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  View,
  type ModalProps,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import {
  getGetMeQueryKey,
  getGetMyPlusStatusQueryKey,
  useUpdateMyPlusPlan,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { AppText, Button } from "@/components/UI";
import { PlusBadge } from "@/components/PlusBadge";
import { useColors } from "@/hooks/useColors";
import { useSubscription } from "@/lib/revenuecat";

type PaywallSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSubscribed?: () => void;
};

const VALUE_PROPS: { icon: keyof typeof Feather.glyphMap; title: string; body: string }[] = [
  {
    icon: "users",
    title: "Bigger circles",
    body: "Add more loved ones — no member limit on Plus.",
  },
  {
    icon: "book-open",
    title: "Care Ledger Pro",
    body: "Track gifts, loans, and shifts with rich history and exports.",
  },
  {
    icon: "heart",
    title: "Voice & video moments",
    body: "Send richer updates with photos, voice notes, and short videos.",
  },
  {
    icon: "shield",
    title: "Verified circle",
    body: "A small badge that lets your circle know you're invested.",
  },
];

type PlanKind = "solo" | "family";
const FAMILY_MEMBER_CAP = 6;

export function PaywallSheet({
  visible,
  onClose,
  onSubscribed,
}: PaywallSheetProps) {
  const c = useColors();
  const qc = useQueryClient();
  const updatePlan = useUpdateMyPlusPlan();
  const {
    isReady,
    isAvailable,
    initError,
    monthlyPackage,
    annualPackage,
    purchase,
    restore,
    isPurchasing,
    isRestoring,
    lastError,
  } = useSubscription();

  const [selected, setSelected] = useState<"monthly" | "annual">("annual");
  const [planKind, setPlanKind] = useState<PlanKind>("solo");

  const annualSavings = useMemo(() => {
    const m = monthlyPackage?.product.price;
    const a = annualPackage?.product.price;
    if (!m || !a) return null;
    const yearly = m * 12;
    if (yearly <= a) return null;
    const pct = Math.round(((yearly - a) / yearly) * 100);
    return pct >= 5 ? pct : null;
  }, [monthlyPackage, annualPackage]);

  useEffect(() => {
    if (!visible) return;
    if (annualPackage && !monthlyPackage) setSelected("annual");
    if (monthlyPackage && !annualPackage) setSelected("monthly");
  }, [visible, monthlyPackage, annualPackage]);

  const [pendingNotice, setPendingNotice] = useState<string | null>(null);

  async function handlePurchase() {
    const pkg = selected === "annual" ? annualPackage : monthlyPackage;
    if (!pkg) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setPendingNotice(null);
    const { success, cancelled, pending } = await purchase(pkg);
    if (success) {
      // Persist the chosen plan kind. We don't pass familyCircleId yet —
      // designating the family circle happens in Settings → Plus, where
      // the user can browse their owned circles. The server defaults
      // family-plan subscribers to no circle until they pick one.
      try {
        await updatePlan.mutateAsync({
          data: { planKind, familyCircleId: null },
        });
      } catch {
        // Non-fatal — the user can change plan kind from the Plus screen.
      }
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
      qc.invalidateQueries({ queryKey: getGetMyPlusStatusQueryKey() });
      onSubscribed?.();
      onClose();
    } else if (pending) {
      setPendingNotice(
        "Your purchase is waiting for approval. We'll unlock Plus as soon as it's confirmed — no need to do anything else.",
      );
    } else if (!cancelled) {
      // Error is shown inline via lastError below.
    }
  }

  async function handleRestore() {
    const { success } = await restore();
    if (success) {
      onSubscribed?.();
      onClose();
    }
  }

  const onRequestClose: ModalProps["onRequestClose"] = () => onClose();

  const monthlyPriceLabel = monthlyPackage?.product.priceString ?? "—";
  const annualPriceLabel = annualPackage?.product.priceString ?? "—";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onRequestClose}
    >
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "flex-end",
            paddingTop: 12,
            paddingHorizontal: 16,
          }}
        >
          <Pressable
            onPress={onClose}
            hitSlop={12}
            testID="paywall-close"
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: c.muted,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Feather name="x" size={18} color={c.foreground} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 8,
            paddingBottom: 32,
          }}
        >
          <PlusBadge size="md" variant="solid" />
          <AppText variant="h1" style={{ marginTop: 12 }}>
            MyZolve Connect Plus
          </AppText>
          <AppText
            color={c.mutedForeground}
            style={{ marginTop: 6, lineHeight: 22 }}
          >
            Get the warmest version of Connect — bigger circles, richer moments,
            and tools made for the people who keep showing up.
          </AppText>

          <View style={{ marginTop: 24, gap: 14 }}>
            {VALUE_PROPS.map((v) => (
              <View
                key={v.title}
                style={{ flexDirection: "row", alignItems: "flex-start" }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: c.primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                  }}
                >
                  <Feather name={v.icon} size={16} color={c.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText weight="semibold">{v.title}</AppText>
                  <AppText
                    variant="caption"
                    color={c.mutedForeground}
                    style={{ marginTop: 2, lineHeight: 18 }}
                  >
                    {v.body}
                  </AppText>
                </View>
              </View>
            ))}
          </View>

          <View style={{ marginTop: 28 }}>
            <AppText weight="semibold" style={{ marginBottom: 8 }}>
              Who is this for?
            </AppText>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <PlanKindChip
                title="Just me"
                subtitle="Plus for you"
                icon="user"
                selected={planKind === "solo"}
                onPress={() => setPlanKind("solo")}
                testID="paywall-plankind-solo"
              />
              <PlanKindChip
                title="My family"
                subtitle={`Up to ${FAMILY_MEMBER_CAP} people in one circle`}
                icon="users"
                selected={planKind === "family"}
                onPress={() => setPlanKind("family")}
                testID="paywall-plankind-family"
              />
            </View>
            {planKind === "family" ? (
              <AppText
                variant="caption"
                color={c.mutedForeground}
                style={{ marginTop: 8, lineHeight: 16 }}
              >
                After you subscribe, pick which of your circles is your
                family circle in Settings → Plus. Up to {FAMILY_MEMBER_CAP}{" "}
                members get Plus while your subscription is active.
              </AppText>
            ) : null}
          </View>

          <View style={{ marginTop: 18, gap: 12 }}>
            {annualPackage ? (
              <PlanCard
                selected={selected === "annual"}
                onPress={() => setSelected("annual")}
                title="Annual"
                priceLabel={annualPriceLabel}
                priceSuffix="/year"
                badge={annualSavings ? `Save ${annualSavings}%` : "Best value"}
                testID="paywall-plan-annual"
              />
            ) : null}
            {monthlyPackage ? (
              <PlanCard
                selected={selected === "monthly"}
                onPress={() => setSelected("monthly")}
                title="Monthly"
                priceLabel={monthlyPriceLabel}
                priceSuffix="/month"
                testID="paywall-plan-monthly"
              />
            ) : null}
          </View>

          {!isAvailable && initError ? (
            <AppText
              variant="caption"
              color={c.destructive ?? "#b91c1c"}
              style={{ marginTop: 16 }}
            >
              {initError}
            </AppText>
          ) : null}

          {!isReady && isAvailable ? (
            <AppText
              variant="caption"
              color={c.mutedForeground}
              style={{ marginTop: 16, textAlign: "center" }}
            >
              Loading plans…
            </AppText>
          ) : null}

          {lastError ? (
            <AppText
              variant="caption"
              color={c.destructive ?? "#b91c1c"}
              style={{ marginTop: 12, textAlign: "center" }}
            >
              {lastError}
            </AppText>
          ) : null}

          {pendingNotice ? (
            <AppText
              variant="caption"
              color={c.mutedForeground}
              style={{ marginTop: 12, textAlign: "center" }}
            >
              {pendingNotice}
            </AppText>
          ) : null}

          <View style={{ marginTop: 24 }}>
            <Button
              title={
                selected === "annual"
                  ? `Start Plus — ${annualPriceLabel}/year`
                  : `Start Plus — ${monthlyPriceLabel}/month`
              }
              onPress={handlePurchase}
              loading={isPurchasing}
              disabled={
                !isAvailable ||
                !isReady ||
                (selected === "annual" ? !annualPackage : !monthlyPackage)
              }
              testID="paywall-subscribe"
            />
          </View>

          <Pressable
            onPress={handleRestore}
            disabled={isRestoring || !isAvailable}
            style={{ marginTop: 16, alignSelf: "center", padding: 6 }}
            testID="paywall-restore"
          >
            <AppText
              weight="semibold"
              color={c.primary}
              style={{ opacity: isRestoring || !isAvailable ? 0.5 : 1 }}
            >
              {isRestoring ? "Restoring…" : "Restore purchases"}
            </AppText>
          </Pressable>

          <AppText
            variant="caption"
            color={c.mutedForeground}
            style={{ marginTop: 18, textAlign: "center", lineHeight: 16 }}
          >
            Payment is charged to your Apple ID at confirmation of purchase. The
            subscription auto-renews for the same price and period unless cancelled
            at least 24 hours before the end of the current period. Manage or cancel
            anytime in your App Store subscription settings.
          </AppText>

          <View
            style={{
              marginTop: 12,
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              gap: 14,
            }}
          >
            <Pressable
              onPress={() =>
                Linking.openURL("https://connect.myzolve.com/terms")
              }
              testID="paywall-terms"
            >
              <AppText variant="caption" color={c.primary} weight="semibold">
                Terms of Use
              </AppText>
            </Pressable>
            <AppText variant="caption" color={c.mutedForeground}>
              •
            </AppText>
            <Pressable
              onPress={() =>
                Linking.openURL("https://connect.myzolve.com/privacy")
              }
              testID="paywall-privacy"
            >
              <AppText variant="caption" color={c.primary} weight="semibold">
                Privacy Policy
              </AppText>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function PlanKindChip({
  title,
  subtitle,
  icon,
  selected,
  onPress,
  testID,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: selected ? c.primarySoft : c.card,
        borderColor: selected ? c.primary : c.border,
        borderWidth: selected ? 2 : 1,
        borderRadius: 16,
        padding: 12,
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
        <Feather
          name={icon}
          size={16}
          color={selected ? c.primary : c.mutedForeground}
          style={{ marginRight: 8 }}
        />
        <AppText weight="semibold">{title}</AppText>
      </View>
      <AppText variant="caption" color={c.mutedForeground} style={{ lineHeight: 16 }}>
        {subtitle}
      </AppText>
    </Pressable>
  );
}

function PlanCard({
  selected,
  onPress,
  title,
  priceLabel,
  priceSuffix,
  badge,
  testID,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  priceLabel: string;
  priceSuffix: string;
  badge?: string;
  testID?: string;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        backgroundColor: selected ? c.primarySoft : c.card,
        borderColor: selected ? c.primary : c.border,
        borderWidth: selected ? 2 : 1,
        borderRadius: 18,
        padding: 16,
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 2,
            borderColor: selected ? c.primary : c.border,
            backgroundColor: selected ? c.primary : "transparent",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          {selected ? (
            <Feather name="check" size={12} color={c.primaryForeground} />
          ) : null}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <AppText weight="semibold">{title}</AppText>
            {badge ? (
              <View
                style={{
                  marginLeft: 8,
                  backgroundColor: c.secondarySoft,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 999,
                }}
              >
                <AppText
                  variant="caption"
                  color={c.secondary}
                  weight="semibold"
                >
                  {badge}
                </AppText>
              </View>
            ) : null}
          </View>
          <AppText variant="caption" color={c.mutedForeground} style={{ marginTop: 2 }}>
            Auto-renews until cancelled
          </AppText>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <AppText weight="bold">{priceLabel}</AppText>
          <AppText variant="caption" color={c.mutedForeground}>
            {priceSuffix}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}
