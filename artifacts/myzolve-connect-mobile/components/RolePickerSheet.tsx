import React from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { AppText } from "@/components/UI";
import { PlusBadge } from "@/components/PlusBadge";
import { useColors } from "@/hooks/useColors";
import {
  ASSIGNABLE_ROLES,
  type AssignableRole,
  type CircleRole,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  isPlusGatedRole,
  rolePillColors,
} from "@/lib/circleRoles";

type RolePickerSheetProps = {
  visible: boolean;
  memberName: string;
  currentRole: string;
  ownerHasPlus: boolean;
  onClose: () => void;
  onPick: (role: AssignableRole) => void;
  /**
   * Called when the owner taps a Plus-gated role and they don't yet have
   * Plus. Parent should open the paywall.
   */
  onRequestPlus: () => void;
};

export function RolePickerSheet({
  visible,
  memberName,
  currentRole,
  ownerHasPlus,
  onClose,
  onPick,
  onRequestPlus,
}: RolePickerSheetProps) {
  const c = useColors();

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
            testID="role-picker-close"
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
          <AppText variant="h2">Choose a role</AppText>
          <AppText
            color={c.mutedForeground}
            style={{ marginTop: 6, lineHeight: 20 }}
          >
            For {memberName}. Roles let you delegate parts of running your
            circle without giving up ownership.
          </AppText>

          <View style={{ marginTop: 20, gap: 10 }}>
            {ASSIGNABLE_ROLES.map((role) => {
              const isCurrent = role === currentRole;
              const gated = isPlusGatedRole(role);
              const needsPlus = gated && !ownerHasPlus;
              const pill = rolePillColors(role, c);
              return (
                <Pressable
                  key={role}
                  testID={`role-option-${role}`}
                  disabled={isCurrent}
                  onPress={() => {
                    if (needsPlus) {
                      onRequestPlus();
                      return;
                    }
                    onPick(role);
                  }}
                  style={({ pressed }) => ({
                    backgroundColor: isCurrent ? c.primarySoft : c.card,
                    borderColor: isCurrent ? c.primary : c.border,
                    borderWidth: isCurrent ? 2 : 1,
                    borderRadius: 16,
                    padding: 14,
                    opacity: pressed ? 0.92 : isCurrent ? 0.85 : 1,
                  })}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 4,
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: pill.bg,
                        paddingHorizontal: 10,
                        paddingVertical: 3,
                        borderRadius: 999,
                        marginRight: 8,
                      }}
                    >
                      <AppText
                        variant="caption"
                        weight="semibold"
                        color={pill.fg}
                      >
                        {ROLE_LABELS[role]}
                      </AppText>
                    </View>
                    {gated ? (
                      <PlusBadge size="sm" variant="soft" />
                    ) : null}
                    {isCurrent ? (
                      <AppText
                        variant="caption"
                        color={c.mutedForeground}
                        style={{ marginLeft: "auto" }}
                      >
                        Current
                      </AppText>
                    ) : null}
                  </View>
                  <AppText
                    variant="caption"
                    color={c.mutedForeground}
                    style={{ lineHeight: 18 }}
                  >
                    {ROLE_DESCRIPTIONS[role]}
                  </AppText>
                  {needsPlus ? (
                    <AppText
                      variant="caption"
                      color={c.primary}
                      weight="semibold"
                      style={{ marginTop: 6 }}
                    >
                      Tap to unlock with Plus
                    </AppText>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
