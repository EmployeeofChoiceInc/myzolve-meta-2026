import React from "react";
import { View, type ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";

import { AppText } from "@/components/UI";

type VerifiedBadgeProps = {
  size?: "sm" | "md";
  showLabel?: boolean;
  style?: ViewStyle;
};

const VERIFIED_BLUE = "#1D9BF0";
const VERIFIED_SOFT_BG = "#E0F2FE";

/**
 * Small "Verified" chip rendered next to the name of a circle that the
 * MyZolve team has approved as a real-world organization. Visible to
 * everyone, regardless of Plus status — see task #53.
 */
export function VerifiedBadge({
  size = "sm",
  showLabel = false,
  style,
}: VerifiedBadgeProps) {
  const isSm = size === "sm";
  const iconSize = isSm ? 14 : 16;

  if (!showLabel) {
    // Compact icon-only chip — used inline next to circle names.
    return (
      <View
        accessible
        accessibilityLabel="Verified circle"
        accessibilityRole="image"
        style={[
          {
            width: iconSize + 6,
            height: iconSize + 6,
            borderRadius: (iconSize + 6) / 2,
            backgroundColor: VERIFIED_BLUE,
            alignItems: "center",
            justifyContent: "center",
          },
          style,
        ]}
        testID="verified-badge"
      >
        <Feather name="check" size={iconSize - 2} color="#fff" />
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel="Verified circle"
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          backgroundColor: VERIFIED_SOFT_BG,
          paddingHorizontal: isSm ? 8 : 10,
          paddingVertical: isSm ? 3 : 4,
          borderRadius: 999,
        },
        style,
      ]}
      testID="verified-badge"
    >
      <Feather
        name="check-circle"
        size={iconSize - 2}
        color={VERIFIED_BLUE}
        style={{ marginRight: 4 }}
      />
      <AppText
        weight="semibold"
        color={VERIFIED_BLUE}
        style={{ fontSize: isSm ? 11 : 12, letterSpacing: 0.4 }}
      >
        Verified
      </AppText>
    </View>
  );
}
