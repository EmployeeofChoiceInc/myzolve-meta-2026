import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";
import { logger } from "./logger";

/**
 * Fetches Stripe credentials from the Replit connection API.
 * Not cached — tokens can rotate, so fetch fresh each time.
 *
 * The managed Stripe connector exposes `secret` (secret key) and
 * `publishable` (publishable key). It does NOT expose a webhook secret —
 * webhook signing is handled by stripe-replit-sync's managed webhook
 * (see getStripeSync / findOrCreateManagedWebhook). The connector also
 * distinguishes development vs production connections via the `environment`
 * query param, keyed off REPLIT_DEPLOYMENT.
 */
async function getStripeCredentials(): Promise<{
  secretKey: string;
  publishableKey: string;
}> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      "Missing Replit environment variables. " +
        "Ensure the Stripe integration is connected via the Integrations tab.",
    );
  }

  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const targetEnvironment = isProduction ? "production" : "development";

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "stripe");
  url.searchParams.set("environment", targetEnvironment);

  const resp = await fetch(url.toString(), {
    headers: { Accept: "application/json", "X-Replit-Token": xReplitToken },
    signal: AbortSignal.timeout(10_000),
  });

  if (!resp.ok) {
    throw new Error(
      `Failed to fetch Stripe credentials: ${resp.status} ${resp.statusText}`,
    );
  }

  const data = (await resp.json()) as {
    items?: Array<{
      settings?: { secret?: string; publishable?: string };
    }>;
  };
  const settings = data.items?.[0]?.settings;

  if (!settings?.secret || !settings?.publishable) {
    throw new Error(
      `Stripe ${targetEnvironment} connection not found or missing keys. ` +
        "Connect Stripe via the Integrations tab first.",
    );
  }

  return {
    secretKey: settings.secret,
    publishableKey: settings.publishable,
  };
}

/** Returns the Stripe publishable key for the current environment. */
export async function getStripePublishableKey(): Promise<string> {
  const { publishableKey } = await getStripeCredentials();
  return publishableKey;
}

/**
 * Returns a fresh authenticated Stripe client.
 * Not cached — fetches credentials on every call so rotated keys are picked up.
 */
export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getStripeCredentials();
  return new Stripe(secretKey);
}

/**
 * Returns a fresh StripeSync instance for webhook processing and data sync.
 * Not cached — fetches credentials on every call so rotated keys are picked up.
 */
export async function getStripeSync(): Promise<StripeSync> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const { secretKey } = await getStripeCredentials();
  // No stripeWebhookSecret: the managed connector doesn't expose one. Webhook
  // signature verification is handled by the managed webhook created via
  // findOrCreateManagedWebhook (its secret is stored by stripe-replit-sync).
  return new StripeSync({
    poolConfig: { connectionString: databaseUrl },
    stripeSecretKey: secretKey,
  });
}

/**
 * True when the Stripe integration appears to be connected. Used to skip
 * Stripe initialization gracefully in environments where the connector
 * hasn't been set up yet (so the rest of the API keeps working).
 */
export async function isStripeConfigured(): Promise<boolean> {
  try {
    await getStripeCredentials();
    return true;
  } catch (err) {
    logger.warn({ err }, "Stripe not configured; org billing disabled");
    return false;
  }
}
