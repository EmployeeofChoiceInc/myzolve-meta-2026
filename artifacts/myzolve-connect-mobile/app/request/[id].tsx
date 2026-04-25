import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { format, formatDistanceToNow } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetRepaymentPlanQueryKey,
  getGetSupportRequestQueryKey,
  getListContributionsQueryKey,
  useCreateContribution,
  useCreateRepaymentPlan,
  useGetMe,
  useGetSupportRequest,
  useListContributions,
} from "@workspace/api-client-react";
import type { CreateRepaymentPlanBodyFrequency } from "@workspace/api-client-react";

import {
  AppText,
  Avatar,
  Button,
  Card,
  Empty,
  Field,
  IconButton,
  Input,
  Pill,
  Progress,
  Row,
  Skeleton,
} from "@/components/UI";
import { CopilotAttribution } from "@/components/CopilotSwitcher";
import { CircleVideoPlayer, VoicePlayer } from "@/components/MediaUI";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@clerk/expo";
import { Image } from "expo-image";
import { safeBack } from "@/lib/safeBack";
import {
  STATUS_COLORS,
  URGENCY_COLORS,
  URGENCY_LABELS,
  formatMoney,
} from "@/lib/circleTypes";
import { useEntityAttachments } from "@/lib/postApi";

const REQ_API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

function reqAttachmentUrl(downloadUrl: string | null | undefined): string | undefined {
  if (!downloadUrl) return undefined;
  return `${REQ_API_BASE}${downloadUrl}`;
}

function RequestAttachmentsBlock({
  circleId,
  requestId,
}: {
  circleId: number;
  requestId: number;
}) {
  const c = useColors();
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getToken()
      .then((t) => alive && setToken(t ?? null))
      .catch(() => alive && setToken(null));
    return () => {
      alive = false;
    };
  }, [getToken]);
  const { data } = useEntityAttachments({
    circleId,
    entityType: "support_request",
    entityId: requestId,
  });
  if (!data || data.length === 0) return null;
  const authHeader = token ? `Bearer ${token}` : null;
  return (
    <Card style={{ marginTop: 12 }}>
      <AppText weight="semibold" style={{ marginBottom: 8 }}>
        Attachments
      </AppText>
      <View style={{ gap: 8 }}>
        {data.map((a) => {
          const uri = reqAttachmentUrl(a.downloadUrl);
          if (!uri) return null;
          if (a.kind === "voice") {
            return (
              <VoicePlayer
                key={a.id}
                uri={uri}
                authHeader={authHeader}
                durationMs={a.durationMs}
              />
            );
          }
          if (a.kind === "video") {
            return <CircleVideoPlayer key={a.id} uri={uri} authHeader={authHeader} />;
          }
          if (token) {
            return (
              <Image
                key={a.id}
                source={{ uri, headers: { Authorization: `Bearer ${token}` } }}
                style={{
                  width: "100%",
                  aspectRatio: 4 / 3,
                  borderRadius: 16,
                  backgroundColor: c.muted,
                }}
                contentFit="cover"
              />
            );
          }
          return null;
        })}
      </View>
    </Card>
  );
}

export default function RequestDetailScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ id: string }>();
  const requestId = Number(params.id);

  const { data: req, isLoading } = useGetSupportRequest(requestId);
  const { data: contributions } = useListContributions(requestId);
  const { data: me } = useGetMe();
  const contribute = useCreateContribution();
  const createPlan = useCreateRepaymentPlan();

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const [planOpen, setPlanOpen] = useState(false);
  const [planTotal, setPlanTotal] = useState("");
  const [planFrequency, setPlanFrequency] =
    useState<CreateRepaymentPlanBodyFrequency>("monthly");
  const [planInstallments, setPlanInstallments] = useState("");
  const [planInstallmentAmount, setPlanInstallmentAmount] = useState("");
  const [planStartDate, setPlanStartDate] = useState("");
  const [planNotes, setPlanNotes] = useState("");

  const isOwner = !!me && !!req && me.id === req.createdByUserId;
  const existingPlan = req?.repaymentPlan ?? null;

  function openPlanModal() {
    const remainingAmount = req
      ? Math.max(
          0,
          (req.amountRequested ?? 0) - (req.amountFunded ?? 0)
        )
      : 0;
    setPlanTotal(
      req?.amountFunded && req.amountFunded > 0
        ? String(req.amountFunded)
        : remainingAmount > 0
        ? String(req?.amountRequested ?? "")
        : ""
    );
    setPlanFrequency("monthly");
    setPlanInstallments("");
    setPlanInstallmentAmount("");
    setPlanStartDate("");
    setPlanNotes("");
    setPlanOpen(true);
  }

  function submitPlan() {
    const total = Number(planTotal);
    if (!Number.isFinite(total) || total <= 0) {
      Alert.alert("Check the amount", "Please enter a positive total.");
      return;
    }
    const installmentAmount = planInstallmentAmount
      ? Number(planInstallmentAmount)
      : undefined;
    if (
      installmentAmount !== undefined &&
      (!Number.isFinite(installmentAmount) || installmentAmount <= 0)
    ) {
      Alert.alert("Check installment", "Installment must be a positive number.");
      return;
    }
    const numberOfInstallments = planInstallments
      ? Number(planInstallments)
      : undefined;
    if (
      numberOfInstallments !== undefined &&
      (!Number.isInteger(numberOfInstallments) || numberOfInstallments <= 0)
    ) {
      Alert.alert(
        "Check installments",
        "Number of installments must be a positive whole number."
      );
      return;
    }
    let startDateIso: string | undefined;
    const trimmedStart = planStartDate.trim();
    if (trimmedStart) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedStart)) {
        Alert.alert("Check start date", "Use the format YYYY-MM-DD.");
        return;
      }
      const parsed = new Date(`${trimmedStart}T00:00:00.000Z`);
      if (Number.isNaN(parsed.getTime())) {
        Alert.alert("Check start date", "That date doesn't look right.");
        return;
      }
      startDateIso = parsed.toISOString();
    }
    createPlan.mutate(
      {
        requestId,
        data: {
          totalAmount: total,
          frequency: planFrequency,
          ...(installmentAmount !== undefined && { installmentAmount }),
          ...(numberOfInstallments !== undefined && { numberOfInstallments }),
          ...(startDateIso && { startDate: startDateIso }),
          ...(planNotes.trim() && { flexibleNotes: planNotes.trim() }),
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetSupportRequestQueryKey(requestId) });
          qc.invalidateQueries({ queryKey: getGetRepaymentPlanQueryKey(requestId) });
          setPlanOpen(false);
          Alert.alert(
            "Plan created",
            "Your repayment plan has been set up."
          );
        },
        onError: () =>
          Alert.alert("Couldn't save plan", "Please try again in a moment."),
      }
    );
  }

  function submit() {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      Alert.alert("Check the amount", "Please enter a positive number.");
      return;
    }
    contribute.mutate(
      {
        requestId,
        data: { amount: amt, note: note.trim() || undefined, currency: "USD" },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetSupportRequestQueryKey(requestId) });
          qc.invalidateQueries({ queryKey: getListContributionsQueryKey(requestId) });
          setOpen(false);
          setAmount("");
          setNote("");
          Alert.alert("Thank you", "Your support has been recorded.");
        },
        onError: () => Alert.alert("Couldn't contribute", "Please try again."),
      }
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
          <View style={{ width: 40 }} />
        </Row>

        <KeyboardAwareScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        >
          {isLoading || !req ? (
            <Skeleton height={300} />
          ) : (
            <>
              <Row gap={6} style={{ marginBottom: 10 }}>
                <Pill
                  label={req.status}
                  bg={STATUS_COLORS[req.status]?.bg ?? c.muted}
                  fg={STATUS_COLORS[req.status]?.fg ?? c.foreground}
                />
                <Pill
                  label={URGENCY_LABELS[req.urgencyLevel] ?? req.urgencyLevel}
                  bg={URGENCY_COLORS[req.urgencyLevel]?.bg ?? c.muted}
                  fg={URGENCY_COLORS[req.urgencyLevel]?.fg ?? c.foreground}
                />
                <Pill label={req.requestType} />
              </Row>
              <AppText variant="h1">{req.title}</AppText>
              <Row gap={10} align="center" style={{ marginTop: 12 }}>
                <Avatar name={req.createdByName} size={36} />
                <View style={{ flex: 1 }}>
                  <AppText weight="medium">{req.createdByName}</AppText>
                  <AppText variant="caption" color={c.mutedForeground}>
                    {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
                  </AppText>
                </View>
              </Row>
              {req.actingForUserId && req.actingForName ? (
                <CopilotAttribution
                  helperName={req.createdByName}
                  forName={req.actingForName}
                  review={req.copilotReview}
                />
              ) : null}

              {req.description ? (
                <Card style={{ marginTop: 16 }}>
                  <AppText>{req.description}</AppText>
                </Card>
              ) : null}

              <RequestAttachmentsBlock circleId={req.circleId} requestId={req.id} />

              <Card style={{ marginTop: 12 }}>
                <Row justify="space-between" style={{ marginBottom: 10 }}>
                  <AppText weight="semibold">Progress</AppText>
                  <AppText weight="bold" color={c.primary}>
                    {req.amountRequested > 0
                      ? Math.round(((req.amountFunded ?? 0) / req.amountRequested) * 100)
                      : 0}
                    %
                  </AppText>
                </Row>
                <Progress
                  value={
                    req.amountRequested > 0
                      ? ((req.amountFunded ?? 0) / req.amountRequested) * 100
                      : 0
                  }
                />
                <Row justify="space-between" style={{ marginTop: 10 }}>
                  <View>
                    <AppText variant="caption" color={c.mutedForeground}>
                      Supported
                    </AppText>
                    <AppText weight="bold" style={{ marginTop: 2 }}>
                      {formatMoney(req.amountFunded, req.currency)}
                    </AppText>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <AppText variant="caption" color={c.mutedForeground}>
                      Goal
                    </AppText>
                    <AppText weight="bold" style={{ marginTop: 2 }}>
                      {formatMoney(req.amountRequested, req.currency)}
                    </AppText>
                  </View>
                </Row>
              </Card>

              {!isOwner &&
                req.status !== "completed" &&
                req.status !== "canceled" && (
                  <Button
                    title="Offer support"
                    icon="heart"
                    onPress={() => setOpen(true)}
                    style={{ marginTop: 16 }}
                    testID="button-offer-support"
                  />
                )}

              {isOwner && req.repaymentExpected && (
                <Card style={{ marginTop: 16 }}>
                  <Row justify="space-between" align="center" style={{ marginBottom: 8 }}>
                    <AppText weight="semibold">Repayment plan</AppText>
                    {existingPlan ? (
                      <Pill label={existingPlan.status} />
                    ) : null}
                  </Row>
                  {existingPlan ? (
                    <>
                      <Row justify="space-between" style={{ marginTop: 6 }}>
                        <AppText variant="caption" color={c.mutedForeground}>
                          Total
                        </AppText>
                        <AppText weight="semibold">
                          {formatMoney(existingPlan.totalAmount, req.currency)}
                        </AppText>
                      </Row>
                      <Row justify="space-between" style={{ marginTop: 6 }}>
                        <AppText variant="caption" color={c.mutedForeground}>
                          Frequency
                        </AppText>
                        <AppText weight="semibold" style={{ textTransform: "capitalize" }}>
                          {existingPlan.frequency.replace("_", " ")}
                        </AppText>
                      </Row>
                      {existingPlan.installmentAmount ? (
                        <Row justify="space-between" style={{ marginTop: 6 }}>
                          <AppText variant="caption" color={c.mutedForeground}>
                            Per installment
                          </AppText>
                          <AppText weight="semibold">
                            {formatMoney(existingPlan.installmentAmount, req.currency)}
                          </AppText>
                        </Row>
                      ) : null}
                      {existingPlan.numberOfInstallments ? (
                        <Row justify="space-between" style={{ marginTop: 6 }}>
                          <AppText variant="caption" color={c.mutedForeground}>
                            Installments
                          </AppText>
                          <AppText weight="semibold">
                            {existingPlan.numberOfInstallments}
                          </AppText>
                        </Row>
                      ) : null}
                      {existingPlan.nextDueDate ? (
                        <Row justify="space-between" style={{ marginTop: 6 }}>
                          <AppText variant="caption" color={c.mutedForeground}>
                            Next due
                          </AppText>
                          <AppText weight="semibold">
                            {format(new Date(existingPlan.nextDueDate), "MMM d, yyyy")}
                          </AppText>
                        </Row>
                      ) : null}
                      {existingPlan.flexibleNotes ? (
                        <AppText style={{ marginTop: 10 }}>
                          {existingPlan.flexibleNotes}
                        </AppText>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <AppText color={c.mutedForeground}>
                        No plan yet. Set up a schedule to return the support.
                      </AppText>
                      <Button
                        title="Set up repayment plan"
                        icon="calendar"
                        variant="outline"
                        onPress={openPlanModal}
                        style={{ marginTop: 12 }}
                        testID="button-setup-repayment-plan"
                      />
                    </>
                  )}
                </Card>
              )}

              <View style={{ height: 24 }} />
              <AppText variant="title" style={{ marginBottom: 12 }}>
                Supporters
              </AppText>
              {!contributions || contributions.length === 0 ? (
                <Empty
                  icon="heart"
                  title="Be the first to help"
                  subtitle="No one has contributed yet."
                />
              ) : (
                <View style={{ gap: 10 }}>
                  {contributions.map((ct) => (
                    <Card key={ct.id}>
                      <Row gap={10} align="center">
                        <Avatar name={ct.contributorName} size={36} />
                        <View style={{ flex: 1 }}>
                          <AppText weight="semibold">{ct.contributorName}</AppText>
                          <AppText variant="caption" color={c.mutedForeground}>
                            {format(new Date(ct.createdAt), "MMM d, yyyy")}
                          </AppText>
                          {ct.note ? (
                            <AppText style={{ marginTop: 6 }}>{ct.note}</AppText>
                          ) : null}
                        </View>
                        <AppText weight="bold" color={c.primary}>
                          {formatMoney(ct.amount, ct.currency)}
                        </AppText>
                      </Row>
                    </Card>
                  ))}
                </View>
              )}
            </>
          )}
        </KeyboardAwareScrollView>
      </View>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: c.background }}>
          <Row
            justify="space-between"
            style={{
              paddingHorizontal: 20,
              paddingTop: 20,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: c.border,
            }}
          >
            <Pressable onPress={() => setOpen(false)}>
              <AppText color={c.mutedForeground}>Cancel</AppText>
            </Pressable>
            <AppText weight="semibold">Offer support</AppText>
            <View style={{ width: 50 }} />
          </Row>
          <KeyboardAwareScrollView
            contentContainerStyle={{ padding: 20 }}
            bottomOffset={40}
            keyboardShouldPersistTaps="handled"
          >
            <Field label="Amount (USD)">
              <Input
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="0"
                testID="input-contribution-amount"
              />
            </Field>
            <Field label="Note (optional)">
              <Input
                value={note}
                onChangeText={setNote}
                placeholder="Add a kind word…"
                multiline
                style={{ minHeight: 80, textAlignVertical: "top" }}
              />
            </Field>
            <Button
              title="Send support"
              icon="heart"
              onPress={submit}
              loading={contribute.isPending}
              testID="button-submit-contribution"
              style={{ marginTop: 8 }}
            />
            <Row gap={8} style={{ marginTop: 12 }}>
              <Feather name="info" size={14} color={c.mutedForeground} />
              <AppText variant="caption" color={c.mutedForeground} style={{ flex: 1 }}>
                Recording your support — actual money exchange happens privately.
              </AppText>
            </Row>
          </KeyboardAwareScrollView>
        </View>
      </Modal>

      <Modal
        visible={planOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPlanOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: c.background }}>
          <Row
            justify="space-between"
            style={{
              paddingHorizontal: 20,
              paddingTop: 20,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: c.border,
            }}
          >
            <Pressable onPress={() => setPlanOpen(false)}>
              <AppText color={c.mutedForeground}>Cancel</AppText>
            </Pressable>
            <AppText weight="semibold">Repayment plan</AppText>
            <View style={{ width: 50 }} />
          </Row>
          <KeyboardAwareScrollView
            contentContainerStyle={{ padding: 20 }}
            bottomOffset={40}
            keyboardShouldPersistTaps="handled"
          >
            <Field label="Total amount (USD)">
              <Input
                value={planTotal}
                onChangeText={setPlanTotal}
                keyboardType="numeric"
                placeholder="0"
                testID="input-plan-total"
              />
            </Field>
            <Field label="Frequency">
              <View style={{ gap: 8 }}>
                {(
                  [
                    { value: "one_time", label: "One time" },
                    { value: "weekly", label: "Weekly" },
                    { value: "biweekly", label: "Every two weeks" },
                    { value: "monthly", label: "Monthly" },
                    { value: "custom", label: "Custom / flexible" },
                  ] as { value: CreateRepaymentPlanBodyFrequency; label: string }[]
                ).map((f) => {
                  const active = planFrequency === f.value;
                  return (
                    <Pressable
                      key={f.value}
                      onPress={() => setPlanFrequency(f.value)}
                      testID={`plan-frequency-${f.value}`}
                      style={({ pressed }) => ({
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: active ? c.primary : c.border,
                        backgroundColor: active ? c.primarySoft : c.card,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        opacity: pressed ? 0.85 : 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      })}
                    >
                      <AppText
                        weight={active ? "semibold" : "regular"}
                        color={active ? c.primary : c.foreground}
                      >
                        {f.label}
                      </AppText>
                      {active ? (
                        <Feather name="check" size={16} color={c.primary} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </Field>
            {planFrequency !== "one_time" && planFrequency !== "custom" ? (
              <>
                <Field label="Installment amount (optional)">
                  <Input
                    value={planInstallmentAmount}
                    onChangeText={setPlanInstallmentAmount}
                    keyboardType="numeric"
                    placeholder="0"
                    testID="input-plan-installment-amount"
                  />
                </Field>
                <Field label="Number of installments (optional)">
                  <Input
                    value={planInstallments}
                    onChangeText={setPlanInstallments}
                    keyboardType="number-pad"
                    placeholder="e.g. 6"
                    testID="input-plan-installments"
                  />
                </Field>
              </>
            ) : null}
            <Field label="Start date (optional, YYYY-MM-DD)">
              <Input
                value={planStartDate}
                onChangeText={setPlanStartDate}
                placeholder="2026-05-01"
                autoCapitalize="none"
                testID="input-plan-start-date"
              />
            </Field>
            <Field label="Notes (optional)">
              <Input
                value={planNotes}
                onChangeText={setPlanNotes}
                placeholder="Anything your supporters should know…"
                multiline
                style={{ minHeight: 80, textAlignVertical: "top" }}
                testID="input-plan-notes"
              />
            </Field>
            <Button
              title="Create plan"
              icon="calendar"
              onPress={submitPlan}
              loading={createPlan.isPending}
              testID="button-submit-repayment-plan"
              style={{ marginTop: 8 }}
            />
          </KeyboardAwareScrollView>
        </View>
      </Modal>
    </>
  );
}
