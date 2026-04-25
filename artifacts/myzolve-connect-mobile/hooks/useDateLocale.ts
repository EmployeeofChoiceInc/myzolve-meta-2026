import { enUS, es } from "date-fns/locale";
import { useTranslation } from "react-i18next";

/**
 * Returns the date-fns Locale matching the current i18next language.
 * Use with formatDistanceToNow / format etc. so dates speak the user's
 * language.
 */
export function useDateLocale() {
  const { i18n } = useTranslation();
  return i18n.language?.startsWith("es") ? es : enUS;
}

/**
 * Returns the BCP-47 locale tag for the current language, suitable for
 * Intl.NumberFormat / Intl.DateTimeFormat / toLocaleDateString.
 */
export function useIntlLocale(): string {
  const { i18n } = useTranslation();
  return i18n.language?.startsWith("es") ? "es" : "en-US";
}
