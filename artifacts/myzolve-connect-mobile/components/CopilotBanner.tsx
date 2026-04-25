import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Avatar, Row } from "@/components/UI";
import { useColors } from "@/hooks/useColors";
import { useCopilot, useCopilotGrantsForCircle } from "@/lib/copilot";

interface Props {
  circleId: number;
  /**
   * When true, the banner respects the safe-area inset at the top.
   * Useful when it sits at the very top of the screen (e.g. inside a
   * circle layout). Defaults to true.
   */
  respectInset?: boolean;
}

/**
 * Persistent, tinted banner that makes it unmistakable when the current
 * user is composing on someone else's behalf. Renders nothing when the
 * user is acting as themself in this circle.
 */
export function CopilotBanner({ circleId, respectInset = true }: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { actingFor, setActingFor } = useCopilot();
  const grants = useCopilotGrantsForCircle(circleId);
  const targetUserId = actingFor[circleId] ?? null;
  const grant = targetUserId
    ? grants.find((g) => g.grantorUserId === targetUserId) ?? null
    : null;

  if (!grant) {
    return null;
  }

  const tone = c.primary;

  return (
    <View
      style={{
        backgroundColor: c.primarySoft,
        borderBottomWidth: 1,
        borderBottomColor: tone,
        paddingTop: respectInset ? insets.top + 6 : 6,
        paddingBottom: 10,
        paddingHorizontal: 16,
      }}
      testID="copilot-active-banner"
    >
      <Row gap={10} align="center">
        <Avatar
          name={grant.grantorName ?? "Member"}
          objectPath={grant.grantorAvatarObjectPath}
          size={28}
        />
        <View style={{ flex: 1 }}>
          <AppText variant="caption" color={tone} weight="semibold">
            Helper mode
          </AppText>
          <AppText variant="caption" color={tone}>
            Posting as {grant.grantorName ?? "this member"} — they'll get
            notified to review.
          </AppText>
        </View>
        <Pressable
          onPress={() => setActingFor(circleId, null)}
          accessibilityLabel="Stop helper mode"
          testID="copilot-banner-exit"
          hitSlop={10}
        >
          <Feather name="x" size={18} color={tone} />
        </Pressable>
      </Row>
    </View>
  );
}
