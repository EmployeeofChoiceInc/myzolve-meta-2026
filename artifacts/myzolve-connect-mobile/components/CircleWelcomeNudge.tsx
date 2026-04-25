import React from "react";
import { View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useGetCircle } from "@workspace/api-client-react";

import { AppText, Row } from "@/components/UI";
import { useColors } from "@/hooks/useColors";

/**
 * Renders a small accent-tinted greeting using the circle's
 * Plus-customized welcome message. Used inside empty states so a
 * brand-new circle still has a friendly "from your owner" voice.
 *
 * Returns null when the circle has no welcome message — empty states
 * will then look the same as for non-Plus circles.
 */
export function CircleWelcomeNudge({ circleId }: { circleId: number }) {
  const c = useColors();
  const { data: circle } = useGetCircle(circleId);
  const message = circle?.welcomeMessage?.trim();
  if (!message) return null;
  return (
    <View
      testID="welcome-nudge"
      style={{
        backgroundColor: c.primarySoft,
        borderColor: c.primary,
        borderWidth: 1,
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
      }}
    >
      <Row align="center" gap={8} style={{ marginBottom: 4 }}>
        <Feather name="message-circle" size={14} color={c.primary} />
        <AppText weight="semibold" color={c.primary} variant="caption">
          Welcome from this circle
        </AppText>
      </Row>
      <AppText style={{ lineHeight: 20 }}>{message}</AppText>
    </View>
  );
}
