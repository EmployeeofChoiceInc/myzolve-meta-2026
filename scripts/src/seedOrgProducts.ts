/**
 * Seed Stripe products + prices for the Enterprise "Org" seat-pack plans.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run seed:org-products
 *
 * Idempotent: products are matched by `metadata.orgPlan`. If a product for a
 * plan already exists it is reused; a price is only created when none active
 * matches the expected amount/interval. Requires the Stripe integration to be
 * connected (run from the Replit environment).
 *
 * NOTE: keep this catalog in sync with
 * artifacts/api-server/src/lib/orgPlans.ts (the runtime source of truth).
 */
import Stripe from "stripe";

type Plan = {
  id: string;
  name: string;
  description: string;
  billingType: "one_time" | "annual";
  unitAmount: number;
  currency: string;
};

const PLANS: Plan[] = [
  {
    id: "reunion",
    name: "MyZolve Connect — Reunion (25 seats)",
    description:
      "One-time 25-seat pool for family reunions, class reunions, and alumni groups.",
    billingType: "one_time",
    unitAmount: 9900,
    currency: "usd",
  },
  {
    id: "erg",
    name: "MyZolve Connect — ERG (per seat / year)",
    description:
      "Annual per-seat plan for corporate Employee Resource Groups.",
    billingType: "annual",
    unitAmount: 1200,
    currency: "usd",
  },
];

async function getStripeSecretKey(): Promise<string> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;
  if (!hostname || !xReplitToken) {
    throw new Error(
      "Missing Replit connector env vars. Run inside the Replit environment with Stripe connected.",
    );
  }
  const resp = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
    { headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken } },
  );
  if (!resp.ok) {
    throw new Error(`Failed to fetch Stripe credentials: ${resp.status}`);
  }
  const data = (await resp.json()) as {
    items?: Array<{ settings?: { secret_key?: string } }>;
  };
  const key = data.items?.[0]?.settings?.secret_key;
  if (!key) throw new Error("Stripe not connected or missing secret key.");
  return key;
}

async function main() {
  const stripe = new Stripe(await getStripeSecretKey());

  for (const plan of PLANS) {
    // Find or create the product by metadata.orgPlan.
    const search = await stripe.products.search({
      query: `metadata['orgPlan']:'${plan.id}'`,
      limit: 1,
    });
    let product = search.data[0];
    if (!product) {
      product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
        metadata: { orgPlan: plan.id, billing: plan.billingType },
      });
      console.log(`Created product ${product.id} for plan "${plan.id}"`);
    } else {
      console.log(`Reusing product ${product.id} for plan "${plan.id}"`);
    }

    // Look for an existing active price that matches.
    const prices = await stripe.prices.list({
      product: product.id,
      active: true,
      limit: 100,
    });
    const wantRecurring = plan.billingType === "annual";
    const match = prices.data.find(
      (p) =>
        p.unit_amount === plan.unitAmount &&
        p.currency === plan.currency &&
        (wantRecurring
          ? p.recurring?.interval === "year"
          : !p.recurring),
    );
    if (match) {
      console.log(`  Price already exists: ${match.id}`);
      continue;
    }

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.unitAmount,
      currency: plan.currency,
      ...(wantRecurring ? { recurring: { interval: "year" } } : {}),
      metadata: { orgPlan: plan.id },
    });
    console.log(`  Created price ${price.id} for plan "${plan.id}"`);
  }

  console.log("Done seeding org products.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
