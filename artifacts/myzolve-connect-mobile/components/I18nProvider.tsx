import i18next from "i18next";
import React, { createContext, useContext, useEffect, useState } from "react";

import {
  getStoredLanguagePreference,
  resolveLocale,
  setStoredLanguagePreference,
  type LanguagePreference,
  type SupportedLanguage,
} from "@/lib/i18n";

type Ctx = {
  pref: LanguagePreference;
  resolved: SupportedLanguage;
  setPref: (p: LanguagePreference) => Promise<void>;
  ready: boolean;
};

const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPrefState] = useState<LanguagePreference>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getStoredLanguagePreference();
      // i18next is already initialized at module load with the device locale.
      // Now apply the user's stored preference if it differs.
      const resolved = resolveLocale(stored);
      if (i18next.language !== resolved) {
        await i18next.changeLanguage(resolved);
      }
      if (!cancelled) {
        setPrefState(stored);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setPref = async (next: LanguagePreference) => {
    await setStoredLanguagePreference(next);
    setPrefState(next);
  };

  const resolved = resolveLocale(pref);

  return (
    <I18nCtx.Provider value={{ pref, resolved, setPref, ready }}>
      {children}
    </I18nCtx.Provider>
  );
}

export function useLanguagePreference(): Ctx {
  const v = useContext(I18nCtx);
  if (!v) {
    throw new Error(
      "useLanguagePreference must be used inside <I18nProvider />",
    );
  }
  return v;
}
