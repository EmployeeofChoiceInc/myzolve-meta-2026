import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
import { useAuth } from "@clerk/expo";
import Constants from "expo-constants";
import Purchases, {
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesError,
  type PurchasesOffering,
  type PurchasesOfferings,
  type PurchasesPackage,
} from "react-native-purchases";
import {
  getGetMyPlusStatusQueryKey,
  useGetMyPlusStatus,
} from "@workspace/api-client-react";

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "plus";

function getRevenueCatApiKey(): string | null {
  // Pick the key for the current runtime. Only the relevant key is required —
  // a build deployed to a single platform shouldn't be blocked by missing keys
  // for other platforms.
  if (
    __DEV__ ||
    Platform.OS === "web" ||
    Constants.executionEnvironment === "storeClient"
  ) {
    return REVENUECAT_TEST_API_KEY ?? null;
  }
  if (Platform.OS === "ios") return REVENUECAT_IOS_API_KEY ?? null;
  if (Platform.OS === "android") return REVENUECAT_ANDROID_API_KEY ?? null;
  return REVENUECAT_TEST_API_KEY ?? null;
}

let initialized = false;
let initError: string | null = null;

export function initializeRevenueCat() {
  if (initialized) return;
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    initError =
      "RevenueCat public API keys are not configured. Plus subscriptions are unavailable.";
    return;
  }
  try {
    Purchases.setLogLevel(
      __DEV__ ? Purchases.LOG_LEVEL.DEBUG : Purchases.LOG_LEVEL.WARN,
    );
    Purchases.configure({ apiKey });
    initialized = true;
  } catch (err) {
    initError = err instanceof Error ? err.message : "Unknown error";
  }
}

type SubscriptionContextValue = {
  isReady: boolean;
  isAvailable: boolean;
  initError: string | null;

  isPlus: boolean;
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOfferings | null;
  currentOffering: PurchasesOffering | null;

  monthlyPackage: PurchasesPackage | null;
  annualPackage: PurchasesPackage | null;

  isPurchasing: boolean;
  isRestoring: boolean;
  lastError: string | null;

  refresh: () => Promise<void>;
  purchase: (pkg: PurchasesPackage) => Promise<{
    success: boolean;
    cancelled: boolean;
    pending: boolean;
  }>;
  restore: () => Promise<{ success: boolean }>;
  managementUrl: string | null;
};

const Context = createContext<SubscriptionContextValue | null>(null);

function pickPackages(offering: PurchasesOffering | null) {
  if (!offering) return { monthly: null, annual: null };
  const monthly =
    offering.monthly ??
    offering.availablePackages.find((p) => p.identifier === "$rc_monthly") ??
    null;
  const annual =
    offering.annual ??
    offering.availablePackages.find((p) => p.identifier === "$rc_annual") ??
    null;
  return { monthly, annual };
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, userId } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const isAvailable = initialized;
  const lastIdentified = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!initialized) return;
    try {
      const [info, offs] = await Promise.all([
        Purchases.getCustomerInfo(),
        Purchases.getOfferings(),
      ]);
      setCustomerInfo(info);
      setOfferings(offs);
    } catch (err) {
      const e = err as PurchasesError;
      setLastError(e?.message ?? "Couldn't load subscription info");
    }
  }, []);

  // Identify the current Clerk user with RevenueCat so the entitlement
  // travels with the user across reinstalls and devices.
  useEffect(() => {
    if (!initialized) {
      setIsReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (isSignedIn && userId) {
          if (lastIdentified.current !== userId) {
            const { customerInfo: info } = await Purchases.logIn(userId);
            lastIdentified.current = userId;
            if (!cancelled) setCustomerInfo(info);
          }
        } else if (lastIdentified.current) {
          await Purchases.logOut();
          lastIdentified.current = null;
          if (!cancelled) setCustomerInfo(null);
        }
        if (!cancelled) {
          await refresh();
          setIsReady(true);
        }
      } catch (err) {
        const e = err as PurchasesError;
        if (!cancelled) {
          setLastError(e?.message ?? "Couldn't sync subscription");
          setIsReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, userId, refresh]);

  // Keep entitlement listener live & re-sync when app comes to foreground.
  useEffect(() => {
    if (!initialized) return;
    const sub = Purchases.addCustomerInfoUpdateListener((info) => {
      setCustomerInfo(info);
    });
    const onAppState = (state: AppStateStatus) => {
      if (state === "active") {
        refresh();
      }
    };
    const stateSub = AppState.addEventListener("change", onAppState);
    return () => {
      try {
        // RN purchases listener removal: returns void
        // (older versions return a function; handle both)
        // @ts-expect-error - back-compat for sdk variants
        if (typeof sub === "function") sub();
        // @ts-expect-error - back-compat for sdk variants
        else if (sub && typeof sub.remove === "function") sub.remove();
        else Purchases.removeCustomerInfoUpdateListener(sub as never);
      } catch {
        // best-effort
      }
      stateSub.remove();
    };
  }, [refresh]);

  const purchase = useCallback(async (pkg: PurchasesPackage) => {
    if (!initialized) {
      return { success: false, cancelled: false, pending: false };
    }
    setIsPurchasing(true);
    setLastError(null);
    try {
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(info);
      const isActive =
        info.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] !==
        undefined;
      return { success: isActive, cancelled: false, pending: false };
    } catch (err) {
      const e = err as PurchasesError & { userCancelled?: boolean };
      if (e?.userCancelled) {
        return { success: false, cancelled: true, pending: false };
      }
      // iOS "Ask to Buy" parental approval and similar deferred flows surface
      // as PAYMENT_PENDING_ERROR. The purchase isn't a failure — it just needs
      // approval before access is granted.
      if (e?.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
        return { success: false, cancelled: false, pending: true };
      }
      setLastError(e?.message ?? "Purchase failed");
      return { success: false, cancelled: false, pending: false };
    } finally {
      setIsPurchasing(false);
    }
  }, []);

  const restore = useCallback(async () => {
    if (!initialized) return { success: false };
    setIsRestoring(true);
    setLastError(null);
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      const isActive =
        info.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] !==
        undefined;
      return { success: isActive };
    } catch (err) {
      const e = err as PurchasesError;
      setLastError(e?.message ?? "Couldn't restore purchases");
      return { success: false };
    } finally {
      setIsRestoring(false);
    }
  }, []);

  const value = useMemo<SubscriptionContextValue>(() => {
    const currentOffering = offerings?.current ?? null;
    const { monthly, annual } = pickPackages(currentOffering);
    const isPlus =
      customerInfo?.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] !==
      undefined;
    const managementUrl = customerInfo?.managementURL ?? null;
    return {
      isReady,
      isAvailable,
      initError,
      isPlus,
      customerInfo,
      offerings,
      currentOffering,
      monthlyPackage: monthly,
      annualPackage: annual,
      isPurchasing,
      isRestoring,
      lastError,
      refresh,
      purchase,
      restore,
      managementUrl,
    };
  }, [
    isReady,
    isAvailable,
    customerInfo,
    offerings,
    isPurchasing,
    isRestoring,
    lastError,
    refresh,
    purchase,
    restore,
  ]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(Context);
  if (!ctx) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return ctx;
}

/**
 * Client-side gating only. For any gated mutation, use the server-side
 * `isPlus(userId)` helper instead — RevenueCat is the source of truth.
 *
 * Unions the local RevenueCat entitlement with the server-reported
 * /me/plus-status payload so that *derived* recipients of a family-plan
 * subscription see Plus in the UI even though they never purchased anything
 * locally.
 */
export function useIsPlus(): boolean {
  const { isPlus } = useSubscription();
  const { data } = useGetMyPlusStatus({
    query: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      queryKey: getGetMyPlusStatusQueryKey(),
    },
  });
  return Boolean(isPlus || data?.isPlus);
}
