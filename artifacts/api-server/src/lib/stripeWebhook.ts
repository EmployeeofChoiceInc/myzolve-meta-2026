import { getStripeSync } from "./stripeClient";
import { handleOrgStripeEvent } from "./orgStripe";
import { logger } from "./logger";

/**
 * Process a verified Stripe webhook.
 *
 * stripe-replit-sync's processWebhook verifies the signature against the
 * managed webhook secret and syncs the stripe.* mirror tables. Only after it
 * succeeds (signature verified) do we parse the payload to run our own org
 * seat-lifecycle business logic.
 */
export async function processStripeWebhook(
  payload: Buffer,
  signature: string,
): Promise<void> {
  if (!Buffer.isBuffer(payload)) {
    throw new Error(
      "STRIPE WEBHOOK ERROR: Payload must be a Buffer. " +
        "Ensure the webhook route is registered BEFORE express.json().",
    );
  }

  const sync = await getStripeSync();
  await sync.processWebhook(payload, signature);

  // Signature already verified by sync.processWebhook above — safe to parse.
  try {
    const event = JSON.parse(payload.toString("utf8")) as {
      type: string;
      data: { object: Record<string, unknown> };
    };
    await handleOrgStripeEvent(event);
  } catch (err) {
    logger.error({ err }, "Org webhook business logic failed");
  }
}
