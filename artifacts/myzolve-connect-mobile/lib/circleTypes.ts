export const CIRCLE_TYPE_LABELS: Record<string, string> = {
  family: "Family",
  chosen_family: "Chosen Family",
  friends: "Friends",
  caregiving_circle: "Caregiving Circle",
  neighborhood_circle: "Neighborhood",
  other: "Other",
};

export const URGENCY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Urgent",
};

export const URGENCY_COLORS: Record<string, { bg: string; fg: string }> = {
  low: { bg: "#E3EDE2", fg: "#3F6749" },
  medium: { bg: "#F1E5D2", fg: "#7A5226" },
  high: { bg: "#FBE9E0", fg: "#A8421C" },
  critical: { bg: "#FBE5E2", fg: "#902F2C" },
};

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  funded: "Funded",
  in_progress: "In progress",
  completed: "Completed",
  archived: "Archived",
  canceled: "Canceled",
};

export const SERVICE_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  matched: "Matched",
  completed: "Completed",
  closed: "Closed",
};

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

export function initialsOf(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
