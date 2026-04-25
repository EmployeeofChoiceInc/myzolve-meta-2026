import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useListServicePosts } from "@workspace/api-client-react";

import {
  AppText,
  Button,
  Empty,
  IconButton,
  PressableCard,
  Pill,
  Row,
  Skeleton,
} from "@/components/UI";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";
import { formatMoney } from "@/lib/circleTypes";
import { safeBack } from "@/lib/safeBack";

export default function ServicesScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const circleId = Number(params.id);
  const { data, isLoading, refetch, isRefetching } = useListServicePosts(circleId);

  return (
    <>
      <Stack.Screen options={{ title: "Services" }} />
      <Screen
        contentStyle={{ paddingTop: insets.top + 12 }}
        refreshing={isRefetching}
        onRefresh={refetch}
      >
        <Row justify="space-between" align="center" style={{ marginBottom: 16 }}>
          <IconButton icon="arrow-left" onPress={() => safeBack(router)} />
          <IconButton
            icon="plus"
            bg={c.primary}
            color="#fff"
            onPress={() => router.push(`/circle/${circleId}/new-service`)}
          />
        </Row>
        <View style={{ marginBottom: 16 }}>
          <AppText variant="h1">Services</AppText>
          <AppText color={c.mutedForeground} style={{ marginTop: 4 }}>
            Skills, time and care being offered.
          </AppText>
        </View>

        {isLoading ? (
          <Skeleton height={140} />
        ) : !data || data.length === 0 ? (
          <Empty
            icon="tool"
            title="No services yet"
            subtitle="Offer your skills, time, or things you can lend."
            action={
              <Button
                title="Post a service"
                onPress={() => router.push(`/circle/${circleId}/new-service`)}
              />
            }
          />
        ) : (
          <View style={{ gap: 12 }}>
            {data.map((s) => (
              <PressableCard
                key={s.id}
                onPress={() => router.push(`/service/${s.id}`)}
                testID={`service-${s.id}`}
              >
                <Row gap={6} style={{ marginBottom: 8 }}>
                  <Pill label={s.serviceType} />
                  <Pill label={s.exchangePreference} bg={c.secondarySoft} fg={c.secondary} />
                </Row>
                <AppText variant="title">{s.title}</AppText>
                <AppText variant="caption" color={c.mutedForeground} style={{ marginTop: 2 }}>
                  by {s.createdByName}
                </AppText>
                {s.description ? (
                  <AppText
                    color={c.mutedForeground}
                    style={{ marginTop: 6 }}
                    numberOfLines={2}
                  >
                    {s.description}
                  </AppText>
                ) : null}
                <Row gap={12} style={{ marginTop: 10 }}>
                  <Row gap={4}>
                    <Feather name="map-pin" size={12} color={c.mutedForeground} />
                    <AppText variant="caption" color={c.mutedForeground}>
                      {s.locationMode}
                    </AppText>
                  </Row>
                  {s.estimatedValue ? (
                    <AppText variant="caption" color={c.mutedForeground}>
                      ~{formatMoney(s.estimatedValue, "USD")}
                    </AppText>
                  ) : null}
                </Row>
              </PressableCard>
            ))}
          </View>
        )}
      </Screen>
    </>
  );
}
