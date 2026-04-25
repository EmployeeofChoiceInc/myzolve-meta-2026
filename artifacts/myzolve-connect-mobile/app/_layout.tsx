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
import React, { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useColors } from "@/hooks/useColors";
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const apiBase = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";
const clerkProxyUrl =
  process.env.EXPO_PUBLIC_CLERK_PROXY_URL ||
  (apiBase ? `${apiBase}/api/__clerk` : undefined);

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
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
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
      <Stack.Screen name="onboarding" options={{ title: "Welcome" }} />
      <Stack.Screen name="discover" options={{ title: "Discover" }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
      <Stack.Screen name="plus" options={{ title: "MyZolve Connect Plus" }} />
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
      <Stack.Screen name="request/[id]" options={{ title: "Request" }} />
      <Stack.Screen name="service/[id]" options={{ title: "Service" }} />
      <Stack.Screen name="profile/[userId]" options={{ title: "Profile" }} />
      <Stack.Screen name="messages/[userId]" options={{ title: "" }} />
      <Stack.Screen name="invite/[token]" options={{ title: "Join circle" }} />
      <Stack.Screen name="wrapup/index" options={{ title: "Your week" }} />
      <Stack.Screen name="year-recap" options={{ title: "Year of Care" }} />
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

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
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
                    </KeyboardProvider>
                  </GestureHandlerRootView>
                </CopilotProvider>
              </SubscriptionProvider>
            </AuthBridge>
          </QueryClientProvider>
        </ClerkProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
