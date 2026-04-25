import { Stack, useLocalSearchParams } from "expo-router";
import React from "react";
import { View } from "react-native";
import { useGetCircle } from "@workspace/api-client-react";

import { CopilotBanner } from "@/components/CopilotBanner";
import { CircleThemeProvider } from "@/contexts/CircleThemeContext";
import { useColors } from "@/hooks/useColors";

function CircleChrome({ circleId }: { circleId: number | null }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {circleId !== null ? <CopilotBanner circleId={circleId} /> : null}
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </View>
  );
}

export default function CircleLayout() {
  const params = useLocalSearchParams<{ id: string }>();
  const circleId = Number(params.id);
  const valid = Number.isFinite(circleId);
  // Read the circle so the accent can flow through every screen under
  // /circle/[id]/*. The query is cached, so child screens that also
  // call useGetCircle don't re-fetch.
  const { data: circle } = useGetCircle(valid ? circleId : 0, {
    query: { queryKey: [`/api/circles/${circleId}`], enabled: valid },
  });
  return (
    <CircleThemeProvider accentColor={circle?.accentColor ?? null}>
      <CircleChrome circleId={valid ? circleId : null} />
    </CircleThemeProvider>
  );
}
