/**
 * Curated palette and constants for the Plus "Custom circle look"
 * customization. The same hex strings are duplicated client-side in
 * the mobile app so the swatches and the server-side validator stay
 * in lockstep.
 *
 * Keep this list short and warm — it's a feature, not a theme editor.
 */
export const CIRCLE_ACCENT_PALETTE = [
  "#D7754D", // Terracotta (default brand orange)
  "#B85C3A", // Burnt sienna
  "#C97B5C", // Clay rose
  "#B47A2A", // Plus gold
  "#8C6A3F", // Acorn
  "#6B9070", // Sage (default brand secondary)
  "#5C8A8A", // Misty teal
  "#7A5A88", // Heather
] as const;

export const MAX_WELCOME_MESSAGE_LEN = 280;

export function isAllowedAccentColor(value: string): boolean {
  return (CIRCLE_ACCENT_PALETTE as readonly string[]).includes(value);
}
