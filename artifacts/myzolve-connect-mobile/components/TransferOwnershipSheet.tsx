import React, { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { AppText, Button } from "@/components/UI";
import { useColors } from "@/hooks/useColors";

type TransferMember = {
  id: number;
  userId: number | null;
  displayName: string;
  email: string | null;
};

type DemoteRole = "admin" | "member";

type TransferOwnershipSheetProps = {
  visible: boolean;
  members: TransferMember[];
  loading: boolean;
  onClose: () => void;
  onConfirm: (newOwnerUserId: number, demoteToRole: DemoteRole) => void;
};

export function TransferOwnershipSheet({
  visible,
  members,
  loading,
  onClose,
  onConfirm,
}: TransferOwnershipSheetProps) {
  const c = useColors();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [demoteToRole, setDemoteToRole] = useState<DemoteRole>("admin");

  // Reset transient selection whenever the sheet is reopened so a prior
  // pick doesn't linger after cancel/close.
  React.useEffect(() => {
    if (visible) {
      setSelectedUserId(null);
      setDemoteToRole("admin");
    }
  }, [visible]);

  const selectedMember =
    selectedUserId != null
      ? members.find((m) => m.userId === selectedUserId) ?? null
      : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
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
            testID="transfer-owner-close"
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
          <AppText variant="h2">Transfer ownership</AppText>
          <AppText
            color={c.mutedForeground}
            style={{ marginTop: 6, lineHeight: 20 }}
          >
            Hand this circle over to another member. They&apos;ll get full
            control, and you&apos;ll step down to the role you choose below.
            This can&apos;t be undone by you afterwards.
          </AppText>

          <AppText weight="semibold" style={{ marginTop: 24, marginBottom: 10 }}>
            New owner
          </AppText>
          {members.length === 0 ? (
            <AppText variant="caption" color={c.mutedForeground}>
              There&apos;s no one to transfer to yet. Invite another member
              first, then come back here.
            </AppText>
          ) : (
            <View style={{ gap: 10 }}>
              {members.map((m) => {
                const active = m.userId === selectedUserId;
                return (
                  <Pressable
                    key={m.id}
                    testID={`transfer-member-${m.id}`}
                    onPress={() =>
                      m.userId != null && setSelectedUserId(m.userId)
                    }
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      backgroundColor: active ? c.primarySoft : c.card,
                      borderColor: active ? c.primary : c.border,
                      borderWidth: active ? 2 : 1,
                      borderRadius: 16,
                      padding: 14,
                      opacity: pressed ? 0.92 : 1,
                    })}
                  >
                    <View style={{ flex: 1 }}>
                      <AppText weight="semibold">{m.displayName}</AppText>
                      {m.email ? (
                        <AppText
                          variant="caption"
                          color={c.mutedForeground}
                          style={{ marginTop: 2 }}
                        >
                          {m.email}
                        </AppText>
                      ) : null}
                    </View>
                    {active ? (
                      <Feather
                        name="check-circle"
                        size={20}
                        color={c.primary}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}

          <AppText weight="semibold" style={{ marginTop: 24, marginBottom: 10 }}>
            Your role after transfer
          </AppText>
          <View style={{ gap: 10 }}>
            {(
              [
                {
                  value: "admin" as const,
                  label: "Admin",
                  description:
                    "Keep full management access — manage members, roles, and settings.",
                },
                {
                  value: "member" as const,
                  label: "Member",
                  description:
                    "Step back to a standard member with no management access.",
                },
              ]
            ).map((opt) => {
              const active = demoteToRole === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  testID={`transfer-demote-${opt.value}`}
                  onPress={() => setDemoteToRole(opt.value)}
                  style={({ pressed }) => ({
                    backgroundColor: active ? c.primarySoft : c.card,
                    borderColor: active ? c.primary : c.border,
                    borderWidth: active ? 2 : 1,
                    borderRadius: 16,
                    padding: 14,
                    opacity: pressed ? 0.92 : 1,
                  })}
                >
                  <Row label={opt.label} active={active} color={c.primary} />
                  <AppText
                    variant="caption"
                    color={c.mutedForeground}
                    style={{ marginTop: 4, lineHeight: 18 }}
                  >
                    {opt.description}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          <View style={{ marginTop: 28, gap: 10 }}>
            <Button
              title={
                selectedMember
                  ? `Transfer to ${selectedMember.displayName}`
                  : "Transfer ownership"
              }
              testID="transfer-owner-confirm"
              loading={loading}
              disabled={selectedUserId == null || loading}
              onPress={() => {
                if (selectedUserId != null) {
                  onConfirm(selectedUserId, demoteToRole);
                }
              }}
            />
            <Button
              title="Cancel"
              variant="ghost"
              onPress={onClose}
              disabled={loading}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Row({
  label,
  active,
  color,
}: {
  label: string;
  active: boolean;
  color: string;
}) {
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
    >
      <AppText weight="semibold">{label}</AppText>
      {active ? <Feather name="check" size={16} color={color} /> : null}
    </View>
  );
}
