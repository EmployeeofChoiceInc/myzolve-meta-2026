import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";

import { AnimatedSplash } from "@/components/AnimatedSplash";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { I18nProvider } from "@/components/I18nProvider";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "react-i18next";
import { CopilotProvider } from "@/lib/copilot";
import {
  configureNotificationHandler,
  registerForPushNotificationsAsync,
  unregisterPushToken,
} from "@/lib/pushNotifications";
import { initializeRevenueCat, SubscriptionProvider } from "@/lib/revenuecat";

configureNotificationHandler();

try {
  initializeRevenueCat();
} catch {
  // Surface as initError via the subscription context; never block app boot.
}

SplashScreen.preventAutoHideAsync();

// Module-scoped flag — true only on the very first mount of the root layout
// (i.e. cold launch from a killed app state). Background → foreground does
// not re-mount _layout, so subsequent app opens skip the animation.
let isColdLaunch = true;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const apiBase = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";
const computedClerkProxyUrl =
  process.env.EXPO_PUBLIC_CLERK_PROXY_URL ||
  (apiBase ? `${apiBase}/api/__clerk` : undefined);

// On web, Clerk requires the proxy URL to be same-origin as the page.
// In our Expo dev setup the page is served from the Expo packager
// origin (`<repl>.expo.janeway.replit.dev`) while the API server
// (which actually serves `/api/__clerk`) lives on a different
// subdomain (`<repl>.janeway.replit.dev`). When Clerk sees a
// cross-origin proxy URL it silently rewrites the script load to the
// current origin, which 404s on the Expo packager. Detect that case
// and skip the proxy so Clerk uses the publishable-key-derived
// frontend API directly (works for dev keys; production keys still
// route through the proxy on iOS / Android).
const pageOrigin =
  Platform.OS === "web" && typeof window !== "undefined"
    ? window.location.origin
    : null;
const clerkProxyUrl =
  computedClerkProxyUrl &&
  pageOrigin &&
  !computedClerkProxyUrl.startsWith(pageOrigin)
    ? undefined
    : computedClerkProxyUrl;

if (apiBase) setBaseUrl(apiBase);

function AuthBridge({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn, userId } = useAuth();
  const qc = useQueryClient();
  const prevUser = useRef<string | null | undefined>(undefined);
  const registeredToken = useRef<string | null>(null);

  useEffect(() => {
    setAuthTokenGetter(async () => {
      try {
        return await getToken();
      } catch {
        return null;
      }
    });
    return () => {
      setAuthTokenGetter(null);
    };
  }, [getToken]);

  useEffect(() => {
    const current = isSignedIn ? userId ?? null : null;
    if (prevUser.current !== undefined && prevUser.current !== current) {
      // User identity changed.  Only WIPE the cache when we're
      // transitioning AWAY from a previous user (sign-out, or
      // switching accounts) — never on a fresh sign-in from a clean
      // slate, because doing so cancels in-flight requests that just
      // started on the post-sign-in landing screen and leaves the UI
      // stuck on its loading skeleton (Apple's 2.1(a) rejection).
      const transitioningFromUser =
        prevUser.current !== undefined && prevUser.current !== null;
      if (transitioningFromUser) {
        qc.clear();
      }
    }
    prevUser.current = current;
  }, [isSignedIn, userId, qc]);

  useEffect(() => {
    if (isSignedIn) {
      let cancelled = false;
      const t = setTimeout(() => {
        if (cancelled) return;
        registerForPushNotificationsAsync()
          .then((result) => {
            if (result) registeredToken.current = result.token;
          })
          .catch(() => {
            // best-effort; ignore failures
          });
      }, 500);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }

    const tokenToClear = registeredToken.current;
    if (tokenToClear) {
      registeredToken.current = null;
      unregisterPushToken(tokenToClear).catch(() => {
        // best-effort; ignore failures
      });
    }
    return undefined;
  }, [isSignedIn, userId]);

  return <>{children}</>;
}

function RootLayoutNav() {
  const c = useColors();
  const { t } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerBackTitle: t("common.back"),
        headerStyle: { backgroundColor: c.background },
        headerTintColor: c.foreground,
        headerTitleStyle: { fontFamily: "PlusJakartaSans_600SemiBold" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: c.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="sign-up" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="onboarding" options={{ title: t("navigation.welcome") }} />
      <Stack.Screen name="discover" options={{ title: t("navigation.discover") }} />
      <Stack.Screen name="settings" options={{ title: t("navigation.settings") }} />
      <Stack.Screen name="plus" options={{ title: t("navigation.plus") }} />
      {/*
        circle/[id] has its own _layout.tsx (a nested Stack), so from
        this outer Stack's perspective the entire folder is a single
        screen named "circle/[id]" — NOT "circle/[id]/index".  The
        previous per-subscreen registrations here never matched and
        the outer Stack fell back to its default header, which showed
        the literal route name "circle/[id]" as the title (visible at
        the top of every circle detail screenshot).  Registering the
        folder once and hiding the parent header lets each subscreen
        draw its own custom header (which they all already do).
      */}
      <Stack.Screen name="circle/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="request/[id]" options={{ title: t("navigation.request") }} />
      <Stack.Screen name="service/[id]" options={{ title: t("navigation.service") }} />
      <Stack.Screen name="profile/[userId]" options={{ title: t("tabs.profile") }} />
      <Stack.Screen name="connections" options={{ headerShown: false }} />
      <Stack.Screen name="messages/[userId]" options={{ title: "" }} />
      <Stack.Screen name="invite/[token]" options={{ title: t("navigation.joinCircle") }} />
      <Stack.Screen name="wrapup/index" options={{ title: t("navigation.yourWeek") }} />
      <Stack.Screen name="year-recap" options={{ title: t("navigation.yearOfCare") }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  // Cold-launch only: first mount captures the flag, then flips it so
  // future re-mounts within the same process won't re-play the animation.
  const [showAnimatedSplash] = useState(() => isColdLaunch);
  const [splashFinished, setSplashFinished] = useState(!isColdLaunch);
  useEffect(() => {
    isColdLaunch = false;
  }, []);

  // Hide the native iOS/Android splash ONLY after the JS-side
  // AnimatedSplash has been laid out (or, when we're not playing it,
  // as soon as fonts are ready).  Hiding the native splash before the
  // animated overlay is on screen creates a flash of the underlying
  // app and makes the heart→leaves animation invisible — users only
  // see the native launch image (the app icon) "freeze" and then the
  // app appears with no animation in between.
  //
  // We track whether the native splash has actually been hidden
  // (separately from "layout seen") so the safety fallback can retry
  // if hideAsync ever rejects with a real error.
  const nativeSplashHiddenRef = useRef(false);
  const hideNativeSplashSafely = useCallback(() => {
    if (nativeSplashHiddenRef.current) return;
    SplashScreen.hideAsync()
      .then(() => {
        nativeSplashHiddenRef.current = true;
      })
      .catch((err) => {
        // hideAsync throws when already hidden — treat as success.
        const msg = String((err as Error)?.message ?? err);
        if (/already hidden|no .*splash/i.test(msg)) {
          nativeSplashHiddenRef.current = true;
        }
        // Otherwise leave the flag false so the safety fallback can retry.
      });
  }, []);

  useEffect(() => {
    if (!(fontsLoaded || fontError)) return;
    if (showAnimatedSplash) {
      // Wait for AnimatedSplash's onLayout to call hideNativeSplashSafely.
      // Fallback: if the native splash isn't hidden within 3s (well
      // over the ~1.65s nominal animation), hide anyway so the user
      // is never stuck on the native splash.
      const t = setTimeout(() => {
        if (!nativeSplashHiddenRef.current) hideNativeSplashSafely();
      }, 3000);
      return () => clearTimeout(t);
    }
    hideNativeSplashSafely();
    return undefined;
  }, [fontsLoaded, fontError, showAnimatedSplash, hideNativeSplashSafely]);

  const handleAnimatedSplashLayout = useCallback(() => {
    hideNativeSplashSafely();
  }, [hideNativeSplashSafely]);

  const handleSplashComplete = useCallback(() => {
    setSplashFinished(true);
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <I18nProvider>
          <ClerkProvider
            publishableKey={publishableKey}
            proxyUrl={clerkProxyUrl}
            tokenCache={tokenCache}
          >
            <QueryClientProvider client={queryClient}>
              <AuthBridge>
                <SubscriptionProvider>
                  <CopilotProvider>
                    <GestureHandlerRootView style={{ flex: 1 }}>
                      <KeyboardProvider>
                        <StatusBar style="dark" />
                        <RootLayoutNav />
                        {showAnimatedSplash && !splashFinished ? (
                          <AnimatedSplash
                            onComplete={handleSplashComplete}
                            onLayout={handleAnimatedSplashLayout}
                          />
                        ) : null}
                      </KeyboardProvider>
                    </GestureHandlerRootView>
                  </CopilotProvider>
                </SubscriptionProvider>
              </AuthBridge>
            </QueryClientProvider>
          </ClerkProvider>
        </I18nProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
