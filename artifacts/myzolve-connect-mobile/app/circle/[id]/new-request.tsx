import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListSupportRequestsQueryKey,
  useCreateSupportRequest,
  type CreateSupportRequestBodyRequestType,
  type CreateSupportRequestBodyUrgencyLevel,
} from "@workspace/api-client-react";

import { AppText, Button, Field, IconButton, Input, Row } from "@/components/UI";
import { CopilotSwitcher } from "@/components/CopilotSwitcher";
import { VoicePlayer, VoiceRecorder } from "@/components/MediaUI";
import { PaywallSheet } from "@/components/PaywallSheet";
import { useColors } from "@/hooks/useColors";
import { useActingForInCircle } from "@/lib/copilot";
import { useSubscription } from "@/lib/revenuecat";
import {
  type AttachmentTarget,
  PlusRequiredError,
  recordEntityAttachment,
  uploadCircleMediaToStorage,
} from "@/lib/postApi";
import { safeBack } from "@/lib/safeBack";

const URGENCIES: { value: CreateSupportRequestBodyUrgencyLevel; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "important", label: "Important" },
  { value: "urgent", label: "Urgent" },
];

const TYPES: { value: CreateSupportRequestBodyRequestType; label: string }[] = [
  { value: "money", label: "Money" },
  { value: "service", label: "Service" },
  { value: "emergency", label: "Emergency" },
];

interface PendingVoice {
  uri: string;
  durationMs: number;
  mimeType: string;
  fileName: string;
}

export default function NewRequestScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const circleId = Number(params.id);
  const qc = useQueryClient();
  const create = useCreateSupportRequest();
  const actingForUserId = useActingForInCircle(circleId);
  const { isPlus } = useSubscription();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [requestType, setRequestType] = useState<CreateSupportRequestBodyRequestType>("money");
  const [urgency, setUrgency] = useState<CreateSupportRequestBodyUrgencyLevel>("normal");
  const [voice, setVoice] = useState<PendingVoice | null>(null);
  const [recording, setRecording] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  function startVoice() {
    if (!isPlus) {
      setPaywallOpen(true);
      return;
    }
    setRecording(true);
  }

  async function submit() {
    if (title.trim().length < 3) {
      Alert.alert("Add a title", "Give your request a short, clear title.");
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0) {
      Alert.alert("Check the amount", "Please use a number for the amount.");
      return;
    }
    if (recording) {
      Alert.alert("Finish recording", "Stop or cancel the voice note before posting.");
      return;
    }
    setBusy(true);
    // Upload voice to object storage BEFORE creating the request so an
    // upload failure doesn't leave behind an orphan request that the user
    // believes failed to create.
    let voiceObjectPath: string | null = null;
    if (voice) {
      try {
        voiceObjectPath = await uploadCircleMediaToStorage(circleId, {
          uri: voice.uri,
          name: voice.fileName,
          size: 0,
          contentType: voice.mimeType,
          kind: "voice",
          durationMs: voice.durationMs,
        });
      } catch (err) {
        setBusy(false);
        if (err instanceof PlusRequiredError) {
          setPaywallOpen(true);
        } else {
          Alert.alert("Couldn't create", "Please try again.");
        }
        return;
      }
    }

    let newReq: Awaited<ReturnType<typeof create.mutateAsync>>;
    try {
      newReq = await create.mutateAsync({
        circleId,
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          amountRequested: amt,
          requestType,
          urgencyLevel: urgency,
          currency: "USD",
          ...(actingForUserId ? { actingForUserId } : {}),
        },
      });
    } catch (err) {
      setBusy(false);
      if (err instanceof PlusRequiredError) {
        setPaywallOpen(true);
      } else {
        Alert.alert("Couldn't create", "Please try again.");
      }
      return;
    }

    let attachmentFailedPlus = false;
    let attachmentFailed = false;
    if (voice && voiceObjectPath) {
      try {
        const target: AttachmentTarget = {
          circleId,
          entityType: "support_request",
          entityId: newReq.id,
        };
        await recordEntityAttachment(target, {
          kind: "voice",
          fileName: voice.fileName,
          mimeType: voice.mimeType,
          durationMs: voice.durationMs,
          storageKey: voiceObjectPath,
        });
      } catch (err) {
        attachmentFailed = true;
        if (err instanceof PlusRequiredError) attachmentFailedPlus = true;
      }
    }

    qc.invalidateQueries({ queryKey: getListSupportRequestsQueryKey(circleId) });
    setBusy(false);
    router.replace(`/request/${newReq.id}`);
    if (attachmentFailed) {
      if (attachmentFailedPlus) {
        setPaywallOpen(true);
      } else {
        Alert.alert(
          "Created, but the voice note didn't attach",
          "Your request is live. You can add the voice note from the request screen.",
        );
      }
    }
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

          <Field label="Voice note (optional)">
            {voice ? (
              <View>
                <VoicePlayer uri={voice.uri} durationMs={voice.durationMs} />
                <Pressable
                  onPress={() => setVoice(null)}
                  disabled={busy}
                  style={{ alignSelf: "flex-start", marginTop: 6, padding: 4 }}
                >
                  <AppText variant="caption" color={c.destructive}>
                    Remove voice note
                  </AppText>
                </Pressable>
              </View>
            ) : recording ? (
              <VoiceRecorder
                testID="request-voice-recorder"
                onComplete={(v) => {
                  setVoice(v);
                  setRecording(false);
                }}
                onCancel={() => setRecording(false)}
              />
            ) : (
              <Pressable
                onPress={startVoice}
                disabled={busy}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingVertical: 10,
                }}
                testID="request-add-voice"
              >
                <Feather name="mic" size={18} color={c.primary} />
                <AppText color={c.primary} weight="medium">
                  Add voice note{!isPlus ? " · Plus" : ""}
                </AppText>
              </Pressable>
            )}
          </Field>

          <Button
            title="Post request"
            onPress={submit}
            loading={busy || create.isPending}
            icon="send"
            testID="button-submit-request"
            style={{ marginTop: 8 }}
          />
        </KeyboardAwareScrollView>
      </View>
      <PaywallSheet
        visible={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        onSubscribed={() => setPaywallOpen(false)}
      />
    </>
  );
}
