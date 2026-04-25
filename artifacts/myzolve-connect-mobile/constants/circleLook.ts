/**
 * Curated palette and constants for the Plus "Custom circle look" feature.
 * Mirrors `artifacts/api-server/src/lib/circleLook.ts` — keep in sync.
 */
export const CIRCLE_ACCENT_PALETTE: { hex: string; label: string }[] = [
  { hex: "#D7754D", label: "Terracotta" },
  { hex: "#B85C3A", label: "Burnt sienna" },
  { hex: "#C97B5C", label: "Clay rose" },
  { hex: "#B47A2A", label: "Plus gold" },
  { hex: "#8C6A3F", label: "Acorn" },
  { hex: "#6B9070", label: "Sage" },
  { hex: "#5C8A8A", label: "Misty teal" },
  { hex: "#7A5A88", label: "Heather" },
];

export const MAX_WELCOME_MESSAGE_LEN = 280;

export function isAllowedAccentColor(value: string | null | undefined): boolean {
  if (!value) return false;
  return CIRCLE_ACCENT_PALETTE.some((c) => c.hex === value);
}

/**
 * Mix a hex color with white at the given alpha (0..1) to produce a
 * soft tinted background that pairs with the accent on light surfaces.
 * We do this client-side rather than ship a separate "soft" hex per
 * palette entry so adding a new accent only requires one change.
 */
export function softenAccent(hex: string, alpha = 0.18): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  const mix = (channel: number) => Math.round(channel * alpha + 255 * (1 - alpha));
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}
