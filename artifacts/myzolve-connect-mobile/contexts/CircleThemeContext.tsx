import React, { createContext, useContext, useMemo } from "react";

import { isAllowedAccentColor, softenAccent } from "@/constants/circleLook";

interface CircleThemeValue {
  accent: string | null;
  accentSoft: string | null;
}

const CircleThemeContext = createContext<CircleThemeValue>({
  accent: null,
  accentSoft: null,
});

export function CircleThemeProvider({
  accentColor,
  children,
}: {
  accentColor: string | null | undefined;
  children: React.ReactNode;
}) {
  const value = useMemo<CircleThemeValue>(() => {
    if (!accentColor || !isAllowedAccentColor(accentColor)) {
      return { accent: null, accentSoft: null };
    }
    return { accent: accentColor, accentSoft: softenAccent(accentColor) };
  }, [accentColor]);

  return (
    <CircleThemeContext.Provider value={value}>
      {children}
    </CircleThemeContext.Provider>
  );
}

export function useCircleTheme(): CircleThemeValue {
  return useContext(CircleThemeContext);
}
