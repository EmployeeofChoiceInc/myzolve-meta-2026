import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { useIntlLocale } from "@/hooks/useDateLocale";

export const CIRCLE_TYPE_KEYS = [
  "family",
  "chosen_family",
  "friends",
  "caregiving_circle",
  "neighborhood_circle",
  "other",
] as const;

/**
 * Plain English labels — kept for legacy callers (notifications, push
 * payloads, server-rendered things) that aren't inside a React tree
 * and so can't use the `useCircleTypeLabel` hook.
 */
export const CIRCLE_TYPE_LABELS: Record<string, string> = {
  family: "Family",
  chosen_family: "Chosen Family",
  friends: "Friends",
  caregiving_circle: "Caregiving Circle",
  neighborhood_circle: "Neighborhood",
  other: "Other",
};

/** Hook returning a translator for circle-type keys. */
export function useCircleTypeLabel(): (key?: string | null) => string {
  const { t } = useTranslation();
  return useCallback(
    (key?: string | null) => {
      if (!key) return "";
      return t(`circleTypes.${key}`, { defaultValue: CIRCLE_TYPE_LABELS[key] ?? key });
    },
    [t],
  );
}

export const URGENCY_LABELS: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  important: "Important",
  urgent: "Urgent",
  emergency: "Emergency",
};

export function useUrgencyLabel(): (key?: string | null) => string {
  const { t } = useTranslation();
  return useCallback(
    (key?: string | null) => {
      if (!key) return "";
      return t(`urgency.${key}`, { defaultValue: URGENCY_LABELS[key] ?? key });
    },
    [t],
  );
}

export const URGENCY_COLORS: Record<string, { bg: string; fg: string }> = {
  low: { bg: "#E3EDE2", fg: "#3F6749" },
  normal: { bg: "#EAEEF3", fg: "#3D5266" },
  important: { bg: "#F1E5D2", fg: "#7A5226" },
  urgent: { bg: "#FBE9E0", fg: "#A8421C" },
  emergency: { bg: "#FBE5E2", fg: "#902F2C" },
};

export const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  draft: { bg: "#EEEDEA", fg: "#5C5953" },
  open: { bg: "#EAEEF3", fg: "#3D5266" },
  partial: { bg: "#F1E5D2", fg: "#7A5226" },
  funded: { bg: "#E3EDE2", fg: "#3F6749" },
  in_progress: { bg: "#E3EDE2", fg: "#3F6749" },
  completed: { bg: "#DDE7DC", fg: "#2F5237" },
  archived: { bg: "#EEEDEA", fg: "#5C5953" },
  canceled: { bg: "#F4DCD9", fg: "#80302D" },
  expired: { bg: "#F4DCD9", fg: "#80302D" },
};

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  partial: "Partial",
  funded: "Funded",
  in_progress: "In progress",
  completed: "Completed",
  archived: "Archived",
  canceled: "Canceled",
};

export function useRequestStatusLabel(): (key?: string | null) => string {
  const { t } = useTranslation();
  return useCallback(
    (key?: string | null) => {
      if (!key) return "";
      return t(`requestStatus.${key}`, {
        defaultValue: REQUEST_STATUS_LABELS[key] ?? key,
      });
    },
    [t],
  );
}

export const SERVICE_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  matched: "Matched",
  completed: "Completed",
  closed: "Closed",
};

export function useServiceStatusLabel(): (key?: string | null) => string {
  const { t } = useTranslation();
  return useCallback(
    (key?: string | null) => {
      if (!key) return "";
      return t(`serviceStatus.${key}`, {
        defaultValue: SERVICE_STATUS_LABELS[key] ?? key,
      });
    },
    [t],
  );
}

/**
 * Locale-unaware shim used by code paths that don't have a React render
 * context (e.g. push-notification body building). Prefer
 * `useFormatMoney` inside React components for locale-aware output.
 */
export function formatMoney(value?: number | null, currency = "USD"): string {
  const amount = value ?? 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${amount}`;
  }
}

/** React hook returning a locale-aware money formatter. */
export function useFormatMoney(): (
  value?: number | null,
  currency?: string,
) => string {
  const locale = useIntlLocale();
  return useCallback(
    (value, currency = "USD") => {
      const amount = value ?? 0;
      try {
        return new Intl.NumberFormat(locale, {
          style: "currency",
          currency,
          maximumFractionDigits: 0,
        }).format(amount);
      } catch {
        return `$${amount}`;
      }
    },
    [locale],
  );
}

export function initialsOf(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
