import React from "react";
import { View, ScrollView, RefreshControl, ViewProps, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  style,
  contentStyle,
  noPadding,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  style?: ViewProps["style"];
  contentStyle?: ViewProps["style"];
  noPadding?: boolean;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const webBottom = Platform.OS === "web" ? 100 : 24;

  if (!scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor: c.background }, style]}>
        <View
          style={[
            {
              flex: 1,
              paddingHorizontal: noPadding ? 0 : 20,
              paddingTop: noPadding ? 0 : 16,
              paddingBottom: noPadding ? 0 : insets.bottom + webBottom,
            },
            contentStyle,
          ]}
        >
          {children}
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: c.background }, style]}
      contentContainerStyle={[
        {
          paddingHorizontal: noPadding ? 0 : 20,
          paddingTop: noPadding ? 0 : 16,
          paddingBottom: insets.bottom + webBottom,
        },
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={c.primary}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}
