import { Stack, useLocalSearchParams } from "expo-router";
import React from "react";
import { View } from "react-native";

import { CopilotBanner } from "@/components/CopilotBanner";
import { useColors } from "@/hooks/useColors";

export default function CircleLayout() {
  const c = useColors();
  const params = useLocalSearchParams<{ id: string }>();
  const circleId = Number(params.id);
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {Number.isFinite(circleId) ? (
        <CopilotBanner circleId={circleId} />
      ) : null}
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </View>
  );
}
