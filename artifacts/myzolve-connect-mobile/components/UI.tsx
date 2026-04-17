import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  View,
  ViewProps,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/colors";
import { initialsOf } from "@/lib/circleTypes";

export function Card({
  style,
  children,
  ...rest
}: ViewProps & { children?: React.ReactNode }) {
  const c = useColors();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: c.card,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: c.border,
          padding: 16,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function PressableCard({
  onPress,
  style,
  children,
  testID,
}: {
  onPress?: () => void;
  style?: ViewProps["style"];
  children?: React.ReactNode;
  testID?: string;
}) {
  const c = useColors();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: c.card,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: c.border,
          padding: 16,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

type AppTextProps = TextProps & {
  variant?: "title" | "subtitle" | "body" | "caption" | "label" | "h1" | "h2";
  weight?: "regular" | "medium" | "semibold" | "bold";
  color?: string;
};

const SIZE: Record<NonNullable<AppTextProps["variant"]>, number> = {
  h1: 28,
  h2: 22,
  title: 18,
  subtitle: 16,
  body: 15,
  caption: 12,
  label: 13,
};

export function AppText({
  variant = "body",
  weight,
  color,
  style,
  children,
  ...rest
}: AppTextProps) {
  const c = useColors();
  const w =
    weight ??
    (variant === "h1" || variant === "h2"
      ? "bold"
      : variant === "title"
      ? "semibold"
      : variant === "subtitle"
      ? "semibold"
      : variant === "label"
      ? "medium"
      : "regular");
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: fonts[w],
          fontSize: SIZE[variant],
          color: color ?? c.foreground,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Feather.glyphMap;
  style?: ViewProps["style"];
  size?: "md" | "sm" | "lg";
  testID?: string;
};

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  style,
  size = "md",
  testID,
}: ButtonProps) {
  const c = useColors();
  const palette = {
    primary: { bg: c.primary, fg: c.primaryForeground, border: c.primary },
    secondary: { bg: c.secondary, fg: c.secondaryForeground, border: c.secondary },
    outline: { bg: c.card, fg: c.foreground, border: c.border },
    ghost: { bg: "transparent", fg: c.foreground, border: "transparent" },
    destructive: { bg: c.destructive, fg: "#fff", border: c.destructive },
  }[variant];

  const heights = { sm: 38, md: 48, lg: 56 };
  const fontSize = size === "sm" ? 13 : size === "lg" ? 17 : 15;

  const handlePress = () => {
    if (disabled || loading) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress?.();
  };

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: variant === "outline" ? 1 : 0,
          borderRadius: 999,
          height: heights[size],
          paddingHorizontal: 22,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon ? (
            <Feather name={icon} size={16} color={palette.fg} style={{ marginRight: 8 }} />
          ) : null}
          <Text
            style={{
              color: palette.fg,
              fontFamily: fonts.semibold,
              fontSize,
            }}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  color,
  size = 40,
  bg,
  testID,
}: {
  icon: keyof typeof Feather.glyphMap;
  onPress?: () => void;
  color?: string;
  size?: number;
  bg?: string;
  testID?: string;
}) {
  const c = useColors();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg ?? "transparent",
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Feather name={icon} size={size * 0.5} color={color ?? c.foreground} />
    </Pressable>
  );
}

export function Pill({
  label,
  bg,
  fg,
}: {
  label: string;
  bg?: string;
  fg?: string;
}) {
  const c = useColors();
  return (
    <View
      style={{
        backgroundColor: bg ?? c.primarySoft,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        alignSelf: "flex-start",
      }}
    >
      <Text
        style={{
          color: fg ?? c.primary,
          fontFamily: fonts.medium,
          fontSize: 11,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export function Avatar({
  name,
  uri,
  size = 40,
  bg,
}: {
  name?: string | null;
  uri?: string | null;
  size?: number;
  bg?: string;
}) {
  const c = useColors();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg ?? c.primarySoft,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {uri ? (
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        <ExpoImageWrapper uri={uri} size={size} />
      ) : (
        <Text
          style={{
            color: c.primary,
            fontFamily: fonts.semibold,
            fontSize: size * 0.4,
          }}
        >
          {initialsOf(name)}
        </Text>
      )}
    </View>
  );
}

function ExpoImageWrapper({ uri, size }: { uri: string; size: number }) {
  // Lazy require to avoid SSR issues
  const { Image } = require("expo-image") as typeof import("expo-image");
  return <Image source={{ uri }} style={{ width: size, height: size }} />;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          fontFamily: fonts.medium,
          fontSize: 13,
          color: c.foreground,
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

export function Input(props: TextInputProps) {
  const c = useColors();
  return (
    <TextInput
      placeholderTextColor={c.mutedForeground}
      {...props}
      style={[
        {
          backgroundColor: c.muted,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontFamily: fonts.regular,
          fontSize: 15,
          color: c.foreground,
          minHeight: 48,
        },
        props.multiline ? { minHeight: 96, textAlignVertical: "top" } : null,
        props.style,
      ]}
    />
  );
}

export function Empty({
  icon = "inbox",
  title,
  subtitle,
  action,
}: {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const c = useColors();
  return (
    <View style={{ alignItems: "center", paddingVertical: 48, paddingHorizontal: 24 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: c.muted,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        <Feather name={icon} size={28} color={c.mutedForeground} />
      </View>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: c.foreground }}>
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 14,
            color: c.mutedForeground,
            textAlign: "center",
            marginTop: 6,
            maxWidth: 280,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function Skeleton({
  height = 80,
  width = "100%" as number | "100%",
  radius = 16,
  style,
}: {
  height?: number;
  width?: number | "100%";
  radius?: number;
  style?: ViewProps["style"];
}) {
  const c = useColors();
  return (
    <View
      style={[
        {
          height,
          width: width as never,
          backgroundColor: c.muted,
          borderRadius: radius,
        },
        style,
      ]}
    />
  );
}

export function Divider() {
  const c = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />;
}

export function Row({
  children,
  gap = 8,
  align = "center",
  justify = "flex-start",
  style,
}: {
  children: React.ReactNode;
  gap?: number;
  align?: "flex-start" | "center" | "flex-end" | "stretch";
  justify?: "flex-start" | "center" | "flex-end" | "space-between" | "space-around";
  style?: ViewProps["style"];
}) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: align,
          justifyContent: justify,
          gap,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Progress({ value, color }: { value: number; color?: string }) {
  const c = useColors();
  const v = Math.min(100, Math.max(0, value));
  return (
    <View
      style={{
        height: 6,
        borderRadius: 3,
        backgroundColor: c.muted,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${v}%`,
          height: "100%",
          backgroundColor: color ?? c.primary,
          borderRadius: 3,
        }}
      />
    </View>
  );
}
