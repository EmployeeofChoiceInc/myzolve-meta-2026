/**
 * Org seat-pack plan catalog.
 *
 * Each plan maps to a Stripe Product (created by the seed-org-products
 * script, identified by `metadata.orgPlan`). The price is created alongside
 * the product. We never hardcode Stripe price IDs here — at checkout time we
 * resolve the live price for the plan from the synced `stripe.prices` table
 * by joining on the product's `metadata.orgPlan`.
 *
 *   - reunion: one-time purchase, fixed 25-seat pool. For family/class
 *     reunions and alumni groups. No renewal.
 *   - erg: annual subscription, per-seat. The admin chooses how many seats
 *     (quantity). Seat pool == subscription quantity. For corporate ERGs.
 */
export type OrgBillingType = "one_time" | "annual";

export interface OrgPlan {
  id: string;
  name: string;
  description: string;
  billingType: OrgBillingType;
  // For one-time packs: the fixed seat count. For per-seat annual plans the
  // seat count is chosen at checkout (quantity), so this is the minimum.
  seats: number;
  // True when the buyer picks a seat count at checkout (per-seat pricing).
  perSeat: boolean;
  minSeats: number;
  maxSeats: number;
  // Amount in cents and currency, used only for the seed script + display
  // fallback. The live amount always comes from Stripe.
  unitAmount: number;
  currency: string;
}

export const ORG_PLANS: Record<string, OrgPlan> = {
  reunion: {
    id: "reunion",
    name: "Reunion",
    description:
      "A one-time 25-seat pool for family reunions, class reunions, and alumni groups.",
    billingType: "one_time",
    seats: 25,
    perSeat: false,
    minSeats: 25,
    maxSeats: 25,
    unitAmount: 9900, // $99 one-time for 25 seats
    currency: "usd",
  },
  erg: {
    id: "erg",
    name: "ERG",
    description:
      "An annual per-seat plan for corporate Employee Resource Groups. Choose your seat count and resize anytime.",
    billingType: "annual",
    seats: 100,
    perSeat: true,
    minSeats: 10,
    maxSeats: 1000,
    unitAmount: 1200, // $12 / seat / year
    currency: "usd",
  },
};

export function getOrgPlan(planId: string | null | undefined): OrgPlan | null {
  if (!planId) return null;
  return ORG_PLANS[planId] ?? null;
}
