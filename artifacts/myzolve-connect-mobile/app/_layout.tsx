import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
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
import { tokenCache } from "@/lib/clerkTokenCache";
import { useColors } from "@/hooks/useColors";
import {
  configureNotificationHandler,
  registerForPushNotificationsAsync,
  unregisterPushToken,
} from "@/lib/pushNotifications";

configureNotificationHandler();

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
      qc.clear();
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
      <Stack.Screen name="circle/[id]/index" options={{ title: "" }} />
      <Stack.Screen name="circle/[id]/requests" options={{ title: "Requests" }} />
      <Stack.Screen name="circle/[id]/services" options={{ title: "Services" }} />
      <Stack.Screen name="circle/[id]/members" options={{ title: "Members" }} />
      <Stack.Screen name="circle/[id]/activity" options={{ title: "Activity" }} />
      <Stack.Screen name="circle/[id]/ledger" options={{ title: "Ledger" }} />
      <Stack.Screen name="circle/[id]/wall" options={{ title: "Wall" }} />
      <Stack.Screen name="circle/[id]/new-request" options={{ title: "New request", presentation: "modal" }} />
      <Stack.Screen name="circle/[id]/new-service" options={{ title: "New service", presentation: "modal" }} />
      <Stack.Screen name="request/[id]" options={{ title: "Request" }} />
      <Stack.Screen name="service/[id]" options={{ title: "Service" }} />
      <Stack.Screen name="profile/[userId]" options={{ title: "Profile" }} />
      <Stack.Screen name="messages/[userId]" options={{ title: "" }} />
      <Stack.Screen name="invite/[token]" options={{ title: "Join circle" }} />
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
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <StatusBar style="dark" />
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </AuthBridge>
          </QueryClientProvider>
        </ClerkProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
