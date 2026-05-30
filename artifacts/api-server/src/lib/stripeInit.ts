import { runMigrations } from "stripe-replit-sync";
import { getStripeSync, isStripeConfigured } from "./stripeClient";
import { seedOrgProducts } from "./orgStripe";
import { logger } from "./logger";

/**
 * Initialize the Stripe schema + sync on startup.
 *
 * This is best-effort: if the Stripe integration isn't connected yet (the
 * connector hasn't been set up), we skip silently so the rest of the API keeps
 * serving. Org billing endpoints will return a friendly 502 until Stripe is
 * connected. Once connected, restart the server to run this init.
 */
export async function initStripe(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("DATABASE_URL missing; skipping Stripe init");
    return;
  }

  if (!(await isStripeConfigured())) {
    logger.warn("Stripe integration not connected; skipping Stripe init");
    return;
  }

  try {
    await runMigrations({ databaseUrl });
    logger.info("Stripe schema ready");

    // Ensure the org plan products/prices exist in Stripe before backfill so
    // they get pulled into the synced stripe.* tables (idempotent).
    try {
      await seedOrgProducts();
      logger.info("Stripe org products seeded");
    } catch (err) {
      logger.error({ err }, "Failed to seed Stripe org products");
    }

    const stripeSync = await getStripeSync();

    const domain = process.env.REPLIT_DOMAINS?.split(",")[0]
      ?? process.env.REPLIT_DEV_DOMAIN;
    if (domain) {
      const webhookUrl = `https://${domain}/api/stripe/webhook`;
      const webhook = await stripeSync.findOrCreateManagedWebhook(webhookUrl);
      logger.info(
        { url: webhook?.url ?? webhookUrl },
        "Stripe managed webhook configured",
      );
    } else {
      logger.warn("No REPLIT domain found; skipping managed webhook setup");
    }

    // Backfill in the background so startup isn't blocked. Must pass
    // { object: "all" } — calling syncBackfill() with no args defaults to a
    // no-op branch and syncs nothing (products/prices would never populate).
    stripeSync
      .syncBackfill({ object: "all" })
      .then((res) => logger.info({ res }, "Stripe data synced"))
      .catch((err) => logger.error({ err }, "Stripe backfill failed"));
  } catch (err) {
    logger.error({ err }, "Failed to initialize Stripe (continuing without it)");
  }
}
