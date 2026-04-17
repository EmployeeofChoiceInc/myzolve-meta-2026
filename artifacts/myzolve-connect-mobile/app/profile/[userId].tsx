import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { format } from "date-fns";

import {
  AppText,
  Avatar,
  Button,
  Card,
  IconButton,
  Row,
  Skeleton,
} from "@/components/UI";
import { useColors } from "@/hooks/useColors";
import { useUserProfile } from "@/lib/postApi";

export default function ProfileDetailScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ userId: string }>();
  const userId = Number(params.userId);
  const { data: profile, isLoading } = useUserProfile(userId);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <Row
          justify="space-between"
          align="center"
          style={{ paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 8 }}
        >
          <IconButton icon="arrow-left" onPress={() => router.back()} />
          <View style={{ width: 40 }} />
        </Row>

        <View style={{ padding: 20 }}>
          {isLoading || !profile ? (
            <Skeleton height={240} />
          ) : (
            <>
              <View style={{ alignItems: "center", marginBottom: 20 }}>
                <Avatar name={profile.displayName} size={88} />
                <AppText variant="h1" style={{ marginTop: 12 }}>
                  {profile.displayName}
                </AppText>
                {profile.location ? (
                  <Row gap={4} align="center" style={{ marginTop: 6 }}>
                    <Feather name="map-pin" size={14} color={c.mutedForeground} />
                    <AppText variant="caption" color={c.mutedForeground}>
                      {profile.location}
                    </AppText>
                  </Row>
                ) : null}
              </View>

              {profile.bio ? (
                <Card style={{ marginBottom: 12 }}>
                  <AppText>{profile.bio}</AppText>
                </Card>
              ) : null}

              <Card style={{ marginBottom: 12 }}>
                <Row gap={6} align="center" style={{ marginBottom: 6 }}>
                  <Feather name="users" size={14} color={c.mutedForeground} />
                  <AppText variant="caption" color={c.mutedForeground}>
                    Shared circles ({profile.commonCircleCount})
                  </AppText>
                </Row>
                {profile.sharedCircles.length === 0 ? (
                  <AppText color={c.mutedForeground}>No shared circles</AppText>
                ) : (
                  <View style={{ gap: 6, marginTop: 6 }}>
                    {profile.sharedCircles.map((sc) => (
                      <AppText key={sc.id}>· {sc.name}</AppText>
                    ))}
                  </View>
                )}
              </Card>

              <Card style={{ marginBottom: 16 }}>
                <Row gap={6} align="center">
                  <Feather name="calendar" size={14} color={c.mutedForeground} />
                  <AppText variant="caption" color={c.mutedForeground}>
                    Member since {format(new Date(profile.memberSince), "MMM yyyy")}
                  </AppText>
                </Row>
              </Card>

              <Button
                title="Send a message"
                icon="message-circle"
                onPress={() => router.push(`/messages/${profile.id}`)}
              />
            </>
          )}
        </View>
      </View>
    </>
  );
}
