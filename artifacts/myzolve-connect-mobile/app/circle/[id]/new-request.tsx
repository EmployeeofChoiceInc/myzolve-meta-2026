import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListSupportRequestsQueryKey,
  useCreateSupportRequest,
} from "@workspace/api-client-react";

import { AppText, Button, Field, IconButton, Input, Row } from "@/components/UI";
import { CopilotSwitcher } from "@/components/CopilotSwitcher";
import { useColors } from "@/hooks/useColors";
import { useActingForInCircle } from "@/lib/copilot";
import { safeBack } from "@/lib/safeBack";

const URGENCIES: { value: string; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "important", label: "Important" },
  { value: "urgent", label: "Urgent" },
];

const TYPES: { value: string; label: string }[] = [
  { value: "money", label: "Money" },
  { value: "service", label: "Service" },
  { value: "emergency", label: "Emergency" },
];

export default function NewRequestScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const circleId = Number(params.id);
  const qc = useQueryClient();
  const create = useCreateSupportRequest();
  const actingForUserId = useActingForInCircle(circleId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [requestType, setRequestType] = useState("money");
  const [urgency, setUrgency] = useState("normal");

  function submit() {
    if (title.trim().length < 3) {
      Alert.alert("Add a title", "Give your request a short, clear title.");
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0) {
      Alert.alert("Check the amount", "Please use a number for the amount.");
      return;
    }
    create.mutate(
      {
        circleId,
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          amountRequested: amt,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          requestType: requestType as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          urgencyLevel: urgency as any,
          currency: "USD",
          ...(actingForUserId ? { actingForUserId } : {}),
        },
      },
      {
        onSuccess: (newReq) => {
          qc.invalidateQueries({ queryKey: getListSupportRequestsQueryKey(circleId) });
          router.replace(`/request/${newReq.id}`);
        },
        onError: () => Alert.alert("Couldn't create", "Please try again."),
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
          <AppText weight="semibold">Ask for support</AppText>
          <View style={{ width: 40 }} />
        </Row>
        <KeyboardAwareScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
          bottomOffset={60}
          keyboardShouldPersistTaps="handled"
        >
          <AppText color={c.mutedForeground} style={{ marginBottom: 20 }}>
            Share what would help. Your circle is here for you.
          </AppText>

          <CopilotSwitcher circleId={circleId} testID="new-request-copilot-switcher" />

          <Field label="Title">
            <Input
              value={title}
              onChangeText={setTitle}
              placeholder="What do you need help with?"
              testID="input-title"
            />
          </Field>

          <Field label="Type">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {TYPES.map((t) => {
                const active = requestType === t.value;
                return (
                  <Pressable
                    key={t.value}
                    onPress={() => setRequestType(t.value)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: active ? c.primary : c.muted,
                    }}
                  >
                    <AppText
                      variant="caption"
                      color={active ? "#fff" : c.foreground}
                      weight="medium"
                    >
                      {t.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <Field label="Amount needed (USD)">
            <Input
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0"
              testID="input-amount"
            />
          </Field>

          <Field label="Urgency">
            <View style={{ flexDirection: "row", gap: 8 }}>
              {URGENCIES.map((u) => {
                const active = urgency === u.value;
                return (
                  <Pressable
                    key={u.value}
                    onPress={() => setUrgency(u.value)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 12,
                      backgroundColor: active ? c.primary : c.muted,
                      alignItems: "center",
                    }}
                  >
                    <AppText
                      variant="caption"
                      color={active ? "#fff" : c.foreground}
                      weight="medium"
                    >
                      {u.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <Field label="Tell us more (optional)">
            <Input
              value={description}
              onChangeText={setDescription}
              placeholder="Share any context that helps your circle understand…"
              multiline
              style={{ minHeight: 100, textAlignVertical: "top" }}
            />
          </Field>

          <Button
            title="Post request"
            onPress={submit}
            loading={create.isPending}
            icon="send"
            testID="button-submit-request"
            style={{ marginTop: 8 }}
          />
        </KeyboardAwareScrollView>
      </View>
    </>
  );
}
