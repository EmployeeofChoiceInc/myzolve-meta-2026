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
  normal: "Normal",
  important: "Important",
  urgent: "Urgent",
  emergency: "Emergency",
};

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
