import { useAuth, useUser } from "@clerk/clerk-expo";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Alert, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetMe } from "@workspace/api-client-react";

import { AppText, Avatar, Card, Row } from "@/components/UI";
import { Screen } from "@/components/Screen";
import { useColors } from "@/hooks/useColors";

export default function ProfileScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useAuth();
  const { data: me } = useGetMe();

  const items: {
    icon: keyof typeof Feather.glyphMap;
    label: string;
    onPress: () => void;
    danger?: boolean;
  }[] = [
    { icon: "compass", label: "Discover", onPress: () => router.push("/discover") },
    { icon: "settings", label: "Settings", onPress: () => router.push("/settings") },
    {
      icon: "user",
      label: "Edit profile",
      onPress: () => router.push("/profile/edit"),
    },
    {
      icon: "log-out",
      label: "Sign out",
      danger: true,
      onPress: () => {
        Alert.alert("Sign out?", "You can sign back in any time.", [
          { text: "Cancel", style: "cancel" },
          {
            text: "Sign out",
            style: "destructive",
            onPress: async () => {
              await signOut();
              router.replace("/sign-in");
            },
          },
        ]);
      },
    },
  ];

  return (
    <Screen contentStyle={{ paddingTop: insets.top + 12 }}>
      <AppText variant="h1">Profile</AppText>
      <AppText color={c.mutedForeground} style={{ marginTop: 4, marginBottom: 24 }}>
        Your account and preferences.
      </AppText>

      <Card style={{ marginBottom: 16 }}>
        <Row gap={14}>
          <Avatar
            name={me?.displayName ?? user?.firstName ?? user?.emailAddresses[0]?.emailAddress}
            objectPath={me?.avatarObjectPath}
            size={64}
          />
          <View style={{ flex: 1 }}>
            <AppText variant="title">
              {me?.displayName ?? user?.firstName ?? "There"}
            </AppText>
            <AppText variant="caption" color={c.mutedForeground} style={{ marginTop: 4 }}>
              {me?.email ?? user?.emailAddresses[0]?.emailAddress}
            </AppText>
          </View>
        </Row>
      </Card>

      <View style={{ gap: 8 }}>
        {items.map((item) => (
          <Pressable
            key={item.label}
            onPress={item.onPress}
            testID={`profile-row-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            style={({ pressed }) => ({
              backgroundColor: c.card,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: c.border,
              padding: 16,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Row gap={14}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: item.danger ? c.destructiveSoft : c.muted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather
                  name={item.icon}
                  size={18}
                  color={item.danger ? c.destructive : c.foreground}
                />
              </View>
              <AppText
                weight="medium"
                color={item.danger ? c.destructive : c.foreground}
                style={{ flex: 1 }}
              >
                {item.label}
              </AppText>
              <Feather name="chevron-right" size={18} color={c.mutedForeground} />
            </Row>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
