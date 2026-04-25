import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import * as SecureStore from "expo-secure-store";

import en from "./locales/en.json";
import es from "./locales/es.json";

export type LanguagePreference = "system" | "en" | "es";
export const SUPPORTED_LANGUAGES = ["en", "es"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const STORAGE_KEY = "language_preference";

export function resolveLocale(pref: LanguagePreference): SupportedLanguage {
  if (pref === "en" || pref === "es") return pref;
  // Default to system. expo-localization gives us an array of locale tags
  // (most preferred first); pick the first whose two-letter base code we
  // support, otherwise fall back to English.
  try {
    const locales = Localization.getLocales();
    for (const l of locales) {
      const tag = (l.languageCode ?? "").toLowerCase();
      if ((SUPPORTED_LANGUAGES as readonly string[]).includes(tag)) {
        return tag as SupportedLanguage;
      }
    }
  } catch {
    // SecureStore / expo-localization unavailable on web preview — fall through
  }
  return "en";
}

export async function getStoredLanguagePreference(): Promise<LanguagePreference> {
  try {
    const v = await SecureStore.getItemAsync(STORAGE_KEY);
    if (v === "en" || v === "es" || v === "system") return v;
  } catch {
    // ignore
  }
  return "system";
}

export async function setStoredLanguagePreference(
  pref: LanguagePreference,
): Promise<void> {
  try {
    if (pref === "system") {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
    } else {
      await SecureStore.setItemAsync(STORAGE_KEY, pref);
    }
  } catch {
    // ignore — best effort
  }
  const next = resolveLocale(pref);
  if (i18next.language !== next) {
    await i18next.changeLanguage(next);
  }
}

let initialized = false;
export function initI18n(initial: LanguagePreference = "system") {
  if (initialized) return i18next;
  initialized = true;
  void i18next.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    lng: resolveLocale(initial),
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    returnNull: false,
    react: { useSuspense: false },
  });
  return i18next;
}

// Initialize synchronously with device locale on module load so that
// useTranslation() works before the I18nProvider's useEffect fires.
initI18n("system");

export default i18next;
