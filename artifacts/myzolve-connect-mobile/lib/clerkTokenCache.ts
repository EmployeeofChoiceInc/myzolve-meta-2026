import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

interface TokenCache {
  getToken: (key: string) => Promise<string | null>;
  saveToken: (key: string, token: string) => Promise<void>;
  clearToken?: (key: string) => Promise<void>;
}

const createTokenCache = (): TokenCache => {
  return {
    getToken: async (key: string) => {
      try {
        if (Platform.OS === "web") {
          if (typeof window === "undefined") return null;
          return window.localStorage.getItem(key);
        }
        return await SecureStore.getItemAsync(key);
      } catch {
        return null;
      }
    },
    saveToken: async (key: string, token: string) => {
      try {
        if (Platform.OS === "web") {
          if (typeof window === "undefined") return;
          window.localStorage.setItem(key, token);
          return;
        }
        await SecureStore.setItemAsync(key, token);
      } catch {
        // ignore
      }
    },
  };
};

export const tokenCache = createTokenCache();
