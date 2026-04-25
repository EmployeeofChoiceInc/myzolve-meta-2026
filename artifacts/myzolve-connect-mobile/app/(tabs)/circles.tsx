import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import {
  getListCirclesQueryKey,
  useCreateCircle,
  useListCircles,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import {
  AppText,
  Button,
  Card,
  Empty,
  Field,
  IconButton,
  Input,
  PressableCard,
  Pill,
  Row,
  Skeleton,
} from "@/components/UI";
import { Screen } from "@/components/Screen";
import { PaywallSheet } from "@/components/PaywallSheet";
import { useColors } from "@/hooks/useColors";
import { CIRCLE_TYPE_LABELS } from "@/lib/circleTypes";

const TYPES = Object.entries(CIRCLE_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export default function CirclesScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: circles, isLoading, refetch, isRefetching } = useListCircles();
  const createCircle = useCreateCircle();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<string>("chosen_family");
  const [paywallVisible, setPaywallVisible] = useState(false);

  function submit() {
    if (name.trim().length < 2) {
      Alert.alert("Name needed", "Please use at least 2 characters.");
      return;
    }
    createCircle.mutate(
      {
        data: {
          name: name.trim(),
          description: description.trim() || undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          circleType: type as any,
          currency: "USD",
        },
      },
      {
        onSuccess: (newCircle) => {
          qc.invalidateQueries({ queryKey: getListCirclesQueryKey() });
          setOpen(false);
          setName("");
          setDescription("");
          setType("chosen_family");
          router.push(`/circle/${newCircle.id}`);
        },
        onError: (err: unknown) => {
          // 402 means the free 2-circle cap was hit. Close the create sheet
          // and pop the paywall so the user has a clear path forward.
          const status =
            typeof err === "object" && err !== null && "status" in err
              ? (err as { status?: number }).status
              : undefined;
          if (status === 402) {
            setOpen(false);
            setPaywallVisible(true);
            return;
          }
          Alert.alert("Couldn't create circle", "Please try again.");
        },
      }
    );
  }

  return (
    <>
      <Screen
        contentStyle={{ paddingTop: insets.top + 12 }}
        refreshing={isRefetching}
        onRefresh={refetch}
      >
        <Row justify="space-between" align="center" style={{ marginBottom: 18 }}>
          <View style={{ flex: 1 }}>
            <AppText variant="h1">My Circles</AppText>
            <AppText color={c.mutedForeground} style={{ marginTop: 4 }}>
              The trusted groups you support.
            </AppText>
          </View>
          <IconButton
            icon="plus"
            onPress={() => setOpen(true)}
            bg={c.primary}
            color="#fff"
            size={44}
            testID="button-create-circle"
          />
        </Row>

        <Pressable
          onPress={() => router.push("/discover")}
          testID="link-discover"
          style={({ pressed }) => ({
            backgroundColor: c.card,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: c.border,
            padding: 14,
            marginBottom: 16,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Row gap={12} align="center">
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: c.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="compass" size={18} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText weight="semibold">Discover circles</AppText>
              <AppText
                variant="caption"
                color={c.mutedForeground}
                style={{ marginTop: 2 }}
              >
                Find open and community circles to join.
              </AppText>
            </View>
            <Feather name="chevron-right" size={18} color={c.mutedForeground} />
          </Row>
        </Pressable>

        {isLoading ? (
          <View style={{ gap: 12 }}>
            <Skeleton height={120} />
            <Skeleton height={120} />
          </View>
        ) : !circles || circles.length === 0 ? (
          <Card style={{ paddingVertical: 32, alignItems: "center" }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: c.primarySoft,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <Feather name="heart" size={28} color={c.primary} />
            </View>
            <AppText variant="title">You're not in any circles yet</AppText>
            <AppText
              color={c.mutedForeground}
              style={{ textAlign: "center", marginTop: 6, marginBottom: 18, maxWidth: 280 }}
            >
              Start a warm space for the people you trust.
            </AppText>
            <Button title="Create your first circle" onPress={() => setOpen(true)} />
          </Card>
        ) : (
          <View style={{ gap: 12 }}>
            {circles.map((circle) => (
              <PressableCard
                key={circle.id}
                onPress={() => router.push(`/circle/${circle.id}`)}
                testID={`circle-${circle.id}`}
              >
                <Row justify="space-between" align="flex-start">
                  <Pill label={CIRCLE_TYPE_LABELS[circle.circleType] ?? circle.circleType} />
                  {circle.myRole && (
                    <AppText variant="caption" color={c.mutedForeground}>
                      {circle.myRole}
                    </AppText>
                  )}
                </Row>
                <AppText variant="title" style={{ marginTop: 10 }}>
                  {circle.name}
                </AppText>
                {circle.description ? (
                  <AppText
                    color={c.mutedForeground}
                    style={{ marginTop: 6 }}
                    numberOfLines={2}
                  >
                    {circle.description}
                  </AppText>
                ) : null}
                <Row gap={6} style={{ marginTop: 12 }}>
                  <Feather name="users" size={14} color={c.mutedForeground} />
                  <AppText variant="caption" color={c.mutedForeground}>
                    {circle.memberCount} member{circle.memberCount !== 1 ? "s" : ""}
                  </AppText>
                </Row>
              </PressableCard>
            ))}
          </View>
        )}
      </Screen>

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
            <AppText weight="semibold">New circle</AppText>
            <View style={{ width: 50 }} />
          </Row>
          <KeyboardAwareScrollView
            contentContainerStyle={{ padding: 20 }}
            bottomOffset={40}
            keyboardShouldPersistTaps="handled"
          >
            <Field label="Circle name">
              <Input
                value={name}
                onChangeText={setName}
                placeholder="e.g. The Village, Chosen Family"
                testID="input-name"
              />
            </Field>
            <Field label="Type">
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {TYPES.map((t) => {
                  const active = type === t.value;
                  return (
                    <Pressable
                      key={t.value}
                      onPress={() => setType(t.value)}
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
            <Field label="Description (optional)">
              <Input
                value={description}
                onChangeText={setDescription}
                placeholder="What brings this circle together?"
                multiline
                testID="input-description"
              />
            </Field>
            <Button
              title="Create circle"
              onPress={submit}
              loading={createCircle.isPending}
              testID="button-submit-circle"
              style={{ marginTop: 16 }}
            />
          </KeyboardAwareScrollView>
        </View>
      </Modal>
      <PaywallSheet
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
      />
    </>
  );
}
