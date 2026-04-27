import { useAuth } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import { useTranslation } from "react-i18next";

import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/colors";

export default function TabsLayout() {
  const c = useColors();
  const { t } = useTranslation();
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/sign-in" />;

  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.mutedForeground,
        headerShown: false,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: c.card,
          borderTopColor: c.border,
          borderTopWidth: 1,
          ...(isWeb ? { height: 84 } : {}),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          tabBarIcon: ({ color, size }) => <Feather name="home" size={size} color={color} />,
          tabBarAccessibilityLabel: t("tabs.home"),
        }}
      />
      <Tabs.Screen
        name="circles"
        options={{
          title: t("tabs.circles"),
          tabBarIcon: ({ color, size }) => <Feather name="users" size={size} color={color} />,
          tabBarAccessibilityLabel: t("tabs.circles"),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t("tabs.messages"),
          tabBarIcon: ({ color, size }) => <Feather name="message-circle" size={size} color={color} />,
          tabBarAccessibilityLabel: t("tabs.messages"),
        }}
      />
      <Tabs.Screen
        name="find-people"
        options={{
          title: "Find",
          tabBarIcon: ({ color, size }) => <Feather name="user-plus" size={size} color={color} />,
          tabBarAccessibilityLabel: "Find people",
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t("tabs.alerts"),
          tabBarIcon: ({ color, size }) => <Feather name="bell" size={size} color={color} />,
          tabBarAccessibilityLabel: t("tabs.alerts"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />,
          tabBarAccessibilityLabel: t("tabs.profile"),
        }}
      />
    </Tabs>
  );
}
