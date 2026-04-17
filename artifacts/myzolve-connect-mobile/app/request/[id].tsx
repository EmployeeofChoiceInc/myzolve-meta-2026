import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { format, formatDistanceToNow } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetSupportRequestQueryKey,
  getListContributionsQueryKey,
  useCreateContribution,
  useGetSupportRequest,
  useListContributions,
} from "@workspace/api-client-react";

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
import { useColors } from "@/hooks/useColors";
import {
  STATUS_COLORS,
  URGENCY_COLORS,
  URGENCY_LABELS,
  formatMoney,
} from "@/lib/circleTypes";

export default function RequestDetailScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ id: string }>();
  const requestId = Number(params.id);

  const { data: req, isLoading } = useGetSupportRequest(requestId);
  const { data: contributions } = useListContributions(requestId);
  const contribute = useCreateContribution();

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

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
          <IconButton icon="arrow-left" onPress={() => router.back()} />
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
                <View>
                  <AppText weight="medium">{req.createdByName}</AppText>
                  <AppText variant="caption" color={c.mutedForeground}>
                    {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
                  </AppText>
                </View>
              </Row>

              {req.description ? (
                <Card style={{ marginTop: 16 }}>
                  <AppText>{req.description}</AppText>
                </Card>
              ) : null}

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

              {req.status !== "completed" && req.status !== "canceled" && (
                <Button
                  title="Offer support"
                  icon="heart"
                  onPress={() => setOpen(true)}
                  style={{ marginTop: 16 }}
                  testID="button-offer-support"
                />
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
    </>
  );
}
