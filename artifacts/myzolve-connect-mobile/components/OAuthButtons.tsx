import React, { useCallback, useEffect, useState } from "react";
import { Alert, Platform, Pressable, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { useSSO } from "@clerk/expo";
import { useRouter } from "expo-router";
import { Feather, FontAwesome } from "@expo/vector-icons";

import { AppText } from "@/components/UI";
import { useColors } from "@/hooks/useColors";

WebBrowser.maybeCompleteAuthSession();

function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

type OAuthStrategy = "oauth_google" | "oauth_apple";

export function OAuthButtons() {
  useWarmUpBrowser();
  const { startSSOFlow } = useSSO();
  const router = useRouter();
  const c = useColors();
  const [busy, setBusy] = useState<OAuthStrategy | null>(null);

  const onProvider = useCallback(
    async (strategy: OAuthStrategy) => {
      if (busy) return;
      setBusy(strategy);
      try {
        const redirectUrl = AuthSession.makeRedirectUri({
          scheme: "myzolve-connect-mobile",
        });
        const result = await startSSOFlow({ strategy, redirectUrl });
        const { createdSessionId, setActive } = result;

        if (createdSessionId && setActive) {
          await setActive({
            session: createdSessionId,
            navigate: ({ session }) => {
              if (session?.currentTask) return;
              router.replace("/(tabs)");
            },
          });
        }
        // If no createdSessionId, the flow needs additional steps (e.g. MFA
        // or missing requirements). For now, surface a generic message —
        // this is rare for first-party Google / Apple sign-in.
      } catch (err: unknown) {
        const e = err as { message?: string };
        // User cancelling the in-app browser is not an error worth alerting.
        if (
          e?.message?.toLowerCase().includes("cancel") ||
          e?.message?.toLowerCase().includes("dismiss")
        ) {
          return;
        }
        Alert.alert(
          "Couldn't sign in",
          e?.message ?? "Please try again, or use email and password."
        );
      } finally {
        setBusy(null);
      }
    },
    [busy, router, startSSOFlow]
  );

  const showApple = Platform.OS === "ios";

  return (
    <View style={{ marginTop: 8, marginBottom: 16 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginVertical: 8,
        }}
      >
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
        <AppText
          variant="caption"
          color={c.mutedForeground}
          style={{ marginHorizontal: 12 }}
        >
          or continue with
        </AppText>
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
      </View>

      {showApple && (
        <Pressable
          testID="button-oauth-apple"
          onPress={() => onProvider("oauth_apple")}
          disabled={busy !== null}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#000000",
            borderRadius: 12,
            paddingVertical: 14,
            marginBottom: 10,
            opacity: pressed || busy === "oauth_apple" ? 0.7 : 1,
          })}
        >
          <FontAwesome name="apple" size={20} color="#ffffff" />
          <AppText
            color="#ffffff"
            weight="semibold"
            style={{ marginLeft: 10 }}
          >
            {busy === "oauth_apple" ? "Signing in…" : "Continue with Apple"}
          </AppText>
        </Pressable>
      )}

      <Pressable
        testID="button-oauth-google"
        onPress={() => onProvider("oauth_google")}
        disabled={busy !== null}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: c.background,
          borderColor: c.border,
          borderWidth: 1,
          borderRadius: 12,
          paddingVertical: 14,
          opacity: pressed || busy === "oauth_google" ? 0.7 : 1,
        })}
      >
        <Feather name="chrome" size={18} color={c.foreground} />
        <AppText
          color={c.foreground}
          weight="semibold"
          style={{ marginLeft: 10 }}
        >
          {busy === "oauth_google" ? "Signing in…" : "Continue with Google"}
        </AppText>
      </Pressable>
    </View>
  );
}
