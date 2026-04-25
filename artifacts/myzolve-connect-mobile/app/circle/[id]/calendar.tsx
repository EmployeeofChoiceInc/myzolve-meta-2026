import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListCareDatesQueryKey,
  getListUpcomingCareDatesQueryKey,
  useCreateCareDate,
  useDeleteCareDate,
  useListCareDates,
  useListCircleMembers,
  useUpdateCareDate,
  type CareDate,
  type CreateCareDateBodyKind,
} from "@workspace/api-client-react";

import {
  AppText,
  Button,
  Card,
  Empty,
  Field,
  IconButton,
  Input,
  Pill,
  PressableCard,
  Row,
  Skeleton,
} from "@/components/UI";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";
import { safeBack } from "@/lib/safeBack";

const KIND_OPTIONS: { value: CreateCareDateBodyKind; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: "birthday", label: "Birthday", icon: "gift" },
  { value: "anniversary", label: "Anniversary", icon: "heart" },
  { value: "memorial", label: "Remembrance", icon: "moon" },
  { value: "appointment", label: "Appointment", icon: "clock" },
  { value: "other", label: "Other", icon: "calendar" },
];

const KIND_LABEL: Record<string, string> = Object.fromEntries(
  KIND_OPTIONS.map((k) => [k.value, k.label]),
);

function formatLong(iso: string): string {
  // iso = YYYY-MM-DD; build a Date in local time so the day doesn't shift.
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10));
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function monthLabel(iso: string): string {
  const [y, m] = iso.split("-").map((s) => parseInt(s, 10));
  const date = new Date(y, (m ?? 1) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function todayIso(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function daysUntil(iso: string): number {
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10));
  const target = new Date(y, (m ?? 1) - 1, d ?? 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map((n) => parseInt(n, 10));
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

interface FormState {
  name: string;
  eventDate: string;
  kind: CreateCareDateBodyKind;
  note: string;
  isAnnual: boolean;
  targetUserId: number | null;
}

const EMPTY_FORM: FormState = {
  name: "",
  eventDate: "",
  kind: "other",
  note: "",
  isAnnual: false,
  targetUserId: null,
};

export default function CircleCalendarScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const circleId = Number(params.id);
  const qc = useQueryClient();

  const { data: dates, isLoading } = useListCareDates(circleId);
  const { data: members } = useListCircleMembers(circleId);

  const [editing, setEditing] = useState<CareDate | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const createMut = useCreateCareDate();
  const updateMut = useUpdateCareDate();
  const deleteMut = useDeleteCareDate();

  const today = todayIso();
  const upcoming = useMemo(() => {
    if (!dates) return [];
    return dates.filter((d) => d.nextOccurrence >= today);
  }, [dates, today]);
  const past = useMemo(() => {
    if (!dates) return [];
    return dates.filter((d) => d.nextOccurrence < today);
  }, [dates, today]);

  const grouped = useMemo(() => {
    const groups: { label: string; items: CareDate[] }[] = [];
    let currentLabel = "";
    for (const d of upcoming) {
      const lbl = monthLabel(d.nextOccurrence);
      if (lbl !== currentLabel) {
        groups.push({ label: lbl, items: [] });
        currentLabel = lbl;
      }
      groups[groups.length - 1].items.push(d);
    }
    return groups;
  }, [upcoming]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(d: CareDate) {
    setEditing(d);
    setForm({
      name: d.name,
      eventDate: d.eventDate,
      kind: (d.kind as CreateCareDateBodyKind) ?? "other",
      note: d.note ?? "",
      isAnnual: d.isAnnual,
      targetUserId: d.targetUserId ?? null,
    });
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  function save() {
    const name = form.name.trim();
    if (!name) {
      Alert.alert("Add a name", "What's this date for? e.g. \"Mom's birthday\".");
      return;
    }
    if (!isValidIsoDate(form.eventDate)) {
      Alert.alert("Check the date", "Use the format YYYY-MM-DD, like 1972-04-30.");
      return;
    }
    const note = form.note.trim();
    const payload = {
      name,
      eventDate: form.eventDate,
      kind: form.kind,
      note: note ? note : undefined,
      isAnnual: form.isAnnual,
      targetUserId: form.targetUserId ?? undefined,
    };

    const onSuccess = () => {
      qc.invalidateQueries({ queryKey: getListCareDatesQueryKey(circleId) });
      qc.invalidateQueries({ queryKey: getListUpcomingCareDatesQueryKey() });
      close();
    };
    const onError = () =>
      Alert.alert("Couldn't save", "Please try again in a moment.");

    if (editing) {
      updateMut.mutate(
        { circleId, careDateId: editing.id, data: payload },
        { onSuccess, onError },
      );
    } else {
      createMut.mutate({ circleId, data: payload }, { onSuccess, onError });
    }
  }

  function confirmDelete(d: CareDate) {
    Alert.alert(
      "Delete this date?",
      `"${d.name}" will be removed from the calendar.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteMut.mutate(
              { circleId, careDateId: d.id },
              {
                onSuccess: () => {
                  qc.invalidateQueries({ queryKey: getListCareDatesQueryKey(circleId) });
                  qc.invalidateQueries({ queryKey: getListUpcomingCareDatesQueryKey() });
                  close();
                },
                onError: () => Alert.alert("Couldn't delete", "Please try again."),
              },
            );
          },
        },
      ],
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Calendar" }} />
      <Screen contentStyle={{ paddingTop: insets.top + 12 }}>
        <Row justify="space-between" align="center" style={{ marginBottom: 16 }}>
          <IconButton icon="arrow-left" onPress={() => safeBack(router)} />
          <IconButton
            icon="plus"
            bg={c.primary}
            color="#fff"
            testID="button-add-care-date"
            onPress={openAdd}
          />
        </Row>

        <AppText variant="h1">Care calendar</AppText>
        <AppText color={c.mutedForeground} style={{ marginTop: 4, marginBottom: 20 }}>
          The days that matter to your circle, kept close.
        </AppText>

        {isLoading ? (
          <View style={{ gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={72} />
            ))}
          </View>
        ) : (dates?.length ?? 0) === 0 ? (
          <Card style={{ paddingVertical: 28, alignItems: "center", gap: 10 }}>
            <Feather name="calendar" size={28} color={c.mutedForeground} />
            <AppText weight="semibold">A gentle place for the days that matter.</AppText>
            <AppText
              variant="caption"
              color={c.mutedForeground}
              style={{ textAlign: "center", maxWidth: 280 }}
            >
              Add a birthday, anniversary, surgery date, or remembrance day —
              we'll quietly remind you the day before.
            </AppText>
            <Button
              title="Add the first date"
              icon="plus"
              onPress={openAdd}
              style={{ marginTop: 6 }}
            />
          </Card>
        ) : (
          <View style={{ gap: 18 }}>
            {grouped.map((g) => (
              <View key={g.label} style={{ gap: 10 }}>
                <AppText variant="caption" color={c.mutedForeground} weight="semibold">
                  {g.label.toUpperCase()}
                </AppText>
                {g.items.map((d) => (
                  <CareDateRow
                    key={d.id}
                    item={d}
                    onPress={() => openEdit(d)}
                  />
                ))}
              </View>
            ))}

            {past.length > 0 && (
              <View style={{ gap: 10, marginTop: 8 }}>
                <AppText variant="caption" color={c.mutedForeground} weight="semibold">
                  PAST
                </AppText>
                {past.map((d) => (
                  <CareDateRow key={d.id} item={d} onPress={() => openEdit(d)} muted />
                ))}
              </View>
            )}
          </View>
        )}
      </Screen>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
        onRequestClose={close}
      >
        <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top }}>
          <Row justify="space-between" align="center" style={{ padding: 16 }}>
            <IconButton icon="x" onPress={close} />
            <AppText weight="semibold">{editing ? "Edit date" : "New date"}</AppText>
            <View style={{ width: 40 }} />
          </Row>
          <KeyboardAwareScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            <Field label="What is this date?">
              <Input
                placeholder="e.g. Mom's birthday, Surgery anniversary"
                value={form.name}
                onChangeText={(t) => setForm({ ...form, name: t })}
                testID="input-care-date-name"
              />
            </Field>
            <Field label="Date (YYYY-MM-DD)">
              <Input
                placeholder="1972-04-30"
                value={form.eventDate}
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={(t) => setForm({ ...form, eventDate: t })}
                testID="input-care-date-date"
              />
            </Field>
            <Field label="Kind">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {KIND_OPTIONS.map((opt) => {
                  const selected = form.kind === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setForm({ ...form, kind: opt.value })}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: selected ? c.primary : c.border,
                        backgroundColor: selected ? c.primarySoft : c.card,
                      }}
                    >
                      <Feather
                        name={opt.icon}
                        size={14}
                        color={selected ? c.primary : c.mutedForeground}
                      />
                      <AppText
                        variant="caption"
                        color={selected ? c.primary : c.foreground}
                        weight={selected ? "semibold" : "medium"}
                      >
                        {opt.label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Field>
            <Field label="Repeats every year?">
              <Row justify="space-between" align="center">
                <AppText variant="caption" color={c.mutedForeground} style={{ flex: 1 }}>
                  Birthdays and anniversaries usually repeat. One-time events
                  (a surgery, an appointment) don't.
                </AppText>
                <Switch
                  value={form.isAnnual}
                  onValueChange={(v) => setForm({ ...form, isAnnual: v })}
                  trackColor={{ true: c.primary, false: c.muted }}
                />
              </Row>
            </Field>
            {(members?.length ?? 0) > 0 && (
              <Field label="This is for (optional)">
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  <Pressable
                    onPress={() => setForm({ ...form, targetUserId: null })}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: form.targetUserId === null ? c.primary : c.border,
                      backgroundColor: form.targetUserId === null ? c.primarySoft : c.card,
                    }}
                  >
                    <AppText variant="caption" weight="medium">
                      Nobody specific
                    </AppText>
                  </Pressable>
                  {(members ?? [])
                    .filter((m) => m.userId != null && m.status === "active")
                    .map((m) => {
                      const selected = form.targetUserId === m.userId;
                      return (
                        <Pressable
                          key={m.id}
                          onPress={() =>
                            setForm({ ...form, targetUserId: m.userId ?? null })
                          }
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: selected ? c.primary : c.border,
                            backgroundColor: selected ? c.primarySoft : c.card,
                          }}
                        >
                          <AppText
                            variant="caption"
                            color={selected ? c.primary : c.foreground}
                            weight={selected ? "semibold" : "medium"}
                          >
                            {m.displayName}
                          </AppText>
                        </Pressable>
                      );
                    })}
                </ScrollView>
              </Field>
            )}
            <Field label="A short note (optional)">
              <Input
                placeholder="Anything you want to remember"
                value={form.note}
                multiline
                numberOfLines={3}
                onChangeText={(t) => setForm({ ...form, note: t })}
                style={{ minHeight: 80, textAlignVertical: "top" }}
              />
            </Field>

            <View style={{ height: 12 }} />
            <Button
              title={editing ? "Save changes" : "Add to calendar"}
              icon="check"
              onPress={save}
              loading={createMut.isPending || updateMut.isPending}
              testID="button-save-care-date"
            />
            {editing && (
              <Button
                title="Delete this date"
                icon="trash-2"
                variant="ghost"
                onPress={() => confirmDelete(editing)}
                loading={deleteMut.isPending}
              />
            )}
          </KeyboardAwareScrollView>
        </View>
      </Modal>
    </>
  );
}

function CareDateRow({
  item,
  onPress,
  muted = false,
}: {
  item: CareDate;
  onPress: () => void;
  muted?: boolean;
}) {
  const c = useColors();
  const days = daysUntil(item.nextOccurrence);
  const subtitle =
    days < 0
      ? formatLong(item.nextOccurrence)
      : days === 0
      ? `Today · ${formatLong(item.nextOccurrence)}`
      : days === 1
      ? `Tomorrow · ${formatLong(item.nextOccurrence)}`
      : `In ${days} days · ${formatLong(item.nextOccurrence)}`;

  return (
    <PressableCard onPress={onPress} style={muted ? { opacity: 0.6 } : undefined}>
      <Row justify="space-between" align="center">
        <View style={{ flex: 1, marginRight: 8 }}>
          <Row gap={6} align="center" style={{ marginBottom: 4 }}>
            <Pill label={KIND_LABEL[item.kind] ?? item.kind} />
            {item.isAnnual && <Pill label="Yearly" />}
          </Row>
          <AppText weight="semibold">{item.name}</AppText>
          <AppText variant="caption" color={c.mutedForeground} style={{ marginTop: 2 }}>
            {subtitle}
          </AppText>
          {item.targetUserName && (
            <AppText variant="caption" color={c.mutedForeground} style={{ marginTop: 2 }}>
              For {item.targetUserName}
            </AppText>
          )}
        </View>
        <Feather name="chevron-right" size={18} color={c.mutedForeground} />
      </Row>
    </PressableCard>
  );
}
