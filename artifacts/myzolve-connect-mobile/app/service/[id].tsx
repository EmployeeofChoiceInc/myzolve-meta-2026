import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatDistanceToNow } from "date-fns";
import { useGetServicePost } from "@workspace/api-client-react";

import {
  AppText,
  Avatar,
  Card,
  IconButton,
  Pill,
  Row,
  Skeleton,
} from "@/components/UI";
import { useColors } from "@/hooks/useColors";
import { formatMoney } from "@/lib/circleTypes";
import { safeBack } from "@/lib/safeBack";

export default function ServiceDetailScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const { data: service, isLoading } = useGetServicePost(id);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <Row
          justify="space-between"
          align="center"
          style={{ paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 8 }}
        >
          <IconButton icon="arrow-left" onPress={() => safeBack(router)} />
          <View style={{ width: 40 }} />
        </Row>

        <View style={{ padding: 20 }}>
          {isLoading || !service ? (
            <Skeleton height={300} />
          ) : (
            <>
              <Row gap={6} style={{ marginBottom: 10 }}>
                <Pill label={service.serviceType} />
                <Pill label={service.exchangePreference} bg={c.secondarySoft} fg={c.secondary} />
                <Pill label={service.status} />
              </Row>
              <AppText variant="h1">{service.title}</AppText>

              <Row gap={10} align="center" style={{ marginTop: 12 }}>
                <Avatar name={service.createdByName} size={36} />
                <View>
                  <AppText weight="medium">{service.createdByName}</AppText>
                  <AppText variant="caption" color={c.mutedForeground}>
                    {formatDistanceToNow(new Date(service.createdAt), { addSuffix: true })}
                  </AppText>
                </View>
              </Row>

              {service.description ? (
                <Card style={{ marginTop: 16 }}>
                  <AppText>{service.description}</AppText>
                </Card>
              ) : null}

              <Card style={{ marginTop: 12 }}>
                <Row gap={20}>
                  <View style={{ flex: 1 }}>
                    <Row gap={6} align="center">
                      <Feather name="map-pin" size={14} color={c.mutedForeground} />
                      <AppText variant="caption" color={c.mutedForeground}>
                        Location
                      </AppText>
                    </Row>
                    <AppText weight="medium" style={{ marginTop: 4 }}>
                      {service.locationMode}
                    </AppText>
                  </View>
                  {service.estimatedValue ? (
                    <View style={{ flex: 1 }}>
                      <Row gap={6} align="center">
                        <Feather name="tag" size={14} color={c.mutedForeground} />
                        <AppText variant="caption" color={c.mutedForeground}>
                          Estimated value
                        </AppText>
                      </Row>
                      <AppText weight="medium" style={{ marginTop: 4 }}>
                        {formatMoney(service.estimatedValue, "USD")}
                      </AppText>
                    </View>
                  ) : null}
                </Row>
                {service.availability ? (
                  <View style={{ marginTop: 12 }}>
                    <Row gap={6} align="center">
                      <Feather name="clock" size={14} color={c.mutedForeground} />
                      <AppText variant="caption" color={c.mutedForeground}>
                        Availability
                      </AppText>
                    </Row>
                    <AppText style={{ marginTop: 4 }}>{service.availability}</AppText>
                  </View>
                ) : null}
              </Card>
            </>
          )}
        </View>
      </View>
    </>
  );
}
