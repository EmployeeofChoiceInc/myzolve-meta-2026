import { Stack, useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";
import { useListCircles } from "@workspace/api-client-react";

import { AppText, Empty, PressableCard, Pill, Row, Skeleton } from "@/components/UI";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";
import { CIRCLE_TYPE_LABELS } from "@/lib/circleTypes";

export default function DiscoverScreen() {
  const c = useColors();
  const router = useRouter();
  const { data, isLoading } = useListCircles();

  return (
    <>
      <Stack.Screen options={{ title: "Discover" }} />
      <Screen>
        <AppText variant="h1">Discover</AppText>
        <AppText color={c.mutedForeground} style={{ marginTop: 4, marginBottom: 20 }}>
          Browse public circles you can ask to join.
        </AppText>

        {isLoading ? (
          <Skeleton height={120} />
        ) : !data || data.length === 0 ? (
          <Empty
            icon="compass"
            title="Nothing to discover yet"
            subtitle="New circles will show here."
          />
        ) : (
          <View style={{ gap: 12 }}>
            {data
              .filter((c) => c.privacyMode !== "private")
              .map((circle) => (
                <PressableCard
                  key={circle.id}
                  onPress={() => router.push(`/circle/${circle.id}`)}
                >
                  <Row justify="space-between" align="flex-start">
                    <Pill label={CIRCLE_TYPE_LABELS[circle.circleType] ?? circle.circleType} />
                    <AppText variant="caption" color={c.mutedForeground}>
                      {circle.privacyMode}
                    </AppText>
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
                </PressableCard>
              ))}
          </View>
        )}
      </Screen>
    </>
  );
}
