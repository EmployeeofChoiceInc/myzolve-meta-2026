import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { customFetch } from "@workspace/api-client-react";

let configured = false;

export function configureNotificationHandler() {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowAlert: true,
    }),
  });
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#FF231F7C",
  });
}

function getProjectId(): string | undefined {
  const expoConfig = Constants.expoConfig as
    | { extra?: { eas?: { projectId?: string } } }
    | null
    | undefined;
  const easConfig = (Constants as unknown as {
    easConfig?: { projectId?: string };
  }).easConfig;
  return expoConfig?.extra?.eas?.projectId ?? easConfig?.projectId;
}

export interface RegisteredPushToken {
  token: string;
  platform: "ios" | "android" | "web";
}

/**
 * Requests notification permission, retrieves the Expo push token, and
 * registers it with the API server. Safe to call repeatedly.
 * Returns the registered token, or null if permission was denied or the
 * device is unsupported (simulator, web, etc).
 */
export async function registerForPushNotificationsAsync(): Promise<RegisteredPushToken | null> {
  configureNotificationHandler();

  if (Platform.OS === "web") return null;
  if (!Device.isDevice) return null;

  await ensureAndroidChannel();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  const projectId = getProjectId();

  let tokenResult: Notifications.ExpoPushToken;
  try {
    tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
  } catch {
    return null;
  }

  const token = tokenResult.data;
  const platform: "ios" | "android" | "web" =
    Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";

  try {
    await customFetch("/api/device-tokens", {
      method: "POST",
      body: JSON.stringify({ token, platform }),
    });
  } catch {
    return { token, platform };
  }

  return { token, platform };
}

export async function unregisterPushToken(token: string): Promise<void> {
  try {
    await customFetch(`/api/device-tokens/${encodeURIComponent(token)}`, {
      method: "DELETE",
    });
  } catch {
    // ignore
  }
}
