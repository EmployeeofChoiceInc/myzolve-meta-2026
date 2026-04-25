import React from "react";
import { View, type ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";

import { AppText } from "@/components/UI";

type PlusBadgeProps = {
  size?: "sm" | "md";
  variant?: "solid" | "soft";
  style?: ViewStyle;
};

const PLUS_ACCENT = "#B47A2A";
const PLUS_SOFT_BG = "#F5E6CC";
const PLUS_SOLID_BG = "#B47A2A";

export function PlusBadge({
  size = "sm",
  variant = "solid",
  style,
}: PlusBadgeProps) {
  const isSm = size === "sm";
  const bg = variant === "solid" ? PLUS_SOLID_BG : PLUS_SOFT_BG;
  const fg = variant === "solid" ? "#FFFFFF" : PLUS_ACCENT;
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          backgroundColor: bg,
          paddingHorizontal: isSm ? 8 : 10,
          paddingVertical: isSm ? 3 : 4,
          borderRadius: 999,
        },
        style,
      ]}
      accessibilityLabel="MyZolve Connect Plus member"
    >
      <Feather
        name="star"
        size={isSm ? 10 : 12}
        color={fg}
        style={{ marginRight: 4 }}
      />
      <AppText
        weight="semibold"
        color={fg}
        style={{ fontSize: isSm ? 11 : 12, letterSpacing: 0.4 }}
      >
        Plus
      </AppText>
    </View>
  );
}
