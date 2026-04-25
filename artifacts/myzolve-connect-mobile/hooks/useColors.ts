import { colors } from "@/constants/colors";
import { useCircleTheme } from "@/contexts/CircleThemeContext";

export function useColors() {
  const { accent, accentSoft } = useCircleTheme();
  const base = { ...colors.light, radius: colors.radius };
  if (accent && accentSoft) {
    return { ...base, primary: accent, primarySoft: accentSoft };
  }
  return base;
}
