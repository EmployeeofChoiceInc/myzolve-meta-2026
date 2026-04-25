import React, { useEffect, useState } from "react";
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
import { useAuth } from "@clerk/expo";

import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/colors";
import { initialsOf } from "@/lib/circleTypes";

const AVATAR_API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

function avatarObjectPathToUrl(objectPath: string | null | undefined): string | undefined {
  if (!objectPath) return undefined;
  const stripped = objectPath.startsWith("/objects/")
    ? objectPath.slice("/objects/".length)
    : objectPath;
  return `${AVATAR_API_BASE}/api/storage/user-media/${stripped}`;
}

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
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = "button",
}: {
  onPress?: () => void;
  style?: ViewProps["style"];
  children?: React.ReactNode;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: "button" | "link" | "summary";
}) {
  const c = useColors();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
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
  // Allow Dynamic Type but cap so massive XXXL settings don't break
  // tightly-spaced layouts (cards, tab bar, pill labels). 1.6× covers
  // up to iOS XXL while keeping rows from collapsing.
  const cap = variant === "caption" || variant === "label" ? 1.5 : 1.6;
  return (
    <Text
      maxFontSizeMultiplier={cap}
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
  /** Override the default screen-reader label (defaults to `title`). */
  accessibilityLabel?: string;
  /** Optional supplementary hint for screen readers. */
  accessibilityHint?: string;
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
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const c = useColors();
  const palette = {
    primary: { bg: c.primary, fg: c.primaryForeground, border: c.primary },
    secondary: { bg: c.secondary, fg: c.secondaryForeground, border: c.secondary },
    outline: { bg: c.card, fg: c.foreground, border: c.border },
    ghost: { bg: "transparent", fg: c.foreground, border: "transparent" },
    destructive: { bg: c.destructive, fg: "#fff", border: c.destructive },
  }[variant];

  // Apple HIG / Material Design require 44pt minimum tappable target.
  // Bump "sm" through hitSlop instead of changing visual height so designs
  // stay tight while screen readers + finger users still hit reliably.
  const heights = { sm: 38, md: 48, lg: 56 };
  const fontSize = size === "sm" ? 13 : size === "lg" ? 17 : 15;
  const hitSlop = size === "sm" ? 6 : 0;

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
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      hitSlop={hitSlop}
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
            <Feather
              name={icon}
              size={16}
              color={palette.fg}
              style={{ marginRight: 8 }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          ) : null}
          <Text
            maxFontSizeMultiplier={1.6}
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
  accessibilityLabel,
  accessibilityHint,
}: {
  icon: keyof typeof Feather.glyphMap;
  onPress?: () => void;
  color?: string;
  size?: number;
  bg?: string;
  testID?: string;
  /** Required for accessibility — describe what the button does. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const c = useColors();
  // Pad hit slop so any visual size below 44pt still meets the
  // platform's recommended 44x44 tappable target.
  const hitSlop = size < 44 ? Math.ceil((44 - size) / 2) : 0;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? icon}
      accessibilityHint={accessibilityHint}
      hitSlop={hitSlop}
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
      <Feather
        name={icon}
        size={size * 0.5}
        color={color ?? c.foreground}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
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
  objectPath,
  size = 40,
  bg,
}: {
  name?: string | null;
  uri?: string | null;
  objectPath?: string | null;
  size?: number;
  bg?: string;
}) {
  const c = useColors();
  const resolvedUri = uri ?? avatarObjectPathToUrl(objectPath);
  const needsAuth = !uri && !!objectPath;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
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
      {resolvedUri ? (
        needsAuth ? (
          <AuthedAvatarImage uri={resolvedUri} size={size} fallbackName={name} />
        ) : (
          <ExpoImageWrapper uri={resolvedUri} size={size} />
        )
      ) : (
        <AvatarInitials name={name} size={size} />
      )}
    </View>
  );
}

function AvatarInitials({ name, size }: { name?: string | null; size: number }) {
  const c = useColors();
  return (
    <Text
      style={{
        color: c.primary,
        fontFamily: fonts.semibold,
        fontSize: size * 0.4,
      }}
    >
      {initialsOf(name)}
    </Text>
  );
}

function ExpoImageWrapper({ uri, size }: { uri: string; size: number }) {
  // Lazy require to avoid SSR issues
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Image } = require("expo-image") as typeof import("expo-image");
  return <Image source={{ uri }} style={{ width: size, height: size }} />;
}

function AuthedAvatarImage({
  uri,
  size,
  fallbackName,
}: {
  uri: string;
  size: number;
  fallbackName?: string | null;
}) {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getToken()
      .then((t) => {
        if (alive) setToken(t ?? null);
      })
      .catch(() => {
        if (alive) setToken(null);
      });
    return () => {
      alive = false;
    };
  }, [getToken]);

  if (!token) {
    return <AvatarInitials name={fallbackName} size={size} />;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Image } = require("expo-image") as typeof import("expo-image");
  return (
    <Image
      source={{ uri, headers: { Authorization: `Bearer ${token}` } }}
      style={{ width: size, height: size }}
    />
  );
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
