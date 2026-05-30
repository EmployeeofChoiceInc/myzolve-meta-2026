import { eq, sql } from "drizzle-orm";
import { db, orgsTable, type Org } from "@workspace/db";
import { getUncachableStripeClient } from "./stripeClient";
import { getOrgPlan, type OrgPlan } from "./orgPlans";
import { ORG_GRACE_MS } from "./orgEntitlement";
import { bustIsPlusCache } from "./revenuecat";
import { logger } from "./logger";

/**
 * Resolve the live Stripe price id for an org plan by joining the synced
 * `stripe.products` / `stripe.prices` tables on the product's
 * `metadata.orgPlan`. Returns null if products haven't been seeded/synced.
 */
export async function resolvePriceIdForPlan(
  planId: string,
): Promise<string | null> {
  const result = await db.execute(
    sql`
      SELECT pr.id AS price_id
      FROM stripe.products p
      JOIN stripe.prices pr ON pr.product = p.id
      WHERE p.active = true
        AND pr.active = true
        AND p.metadata->>'orgPlan' = ${planId}
      ORDER BY pr.created DESC
      LIMIT 1
    `,
  );
  const row = result.rows[0] as { price_id?: string } | undefined;
  return row?.price_id ?? null;
}

/**
 * Create a Stripe Checkout Session for an org seat-pack purchase. One-time
 * plans use mode "payment"; annual per-seat plans use "subscription" with the
 * chosen seat count as the line-item quantity. The org id + plan + seats are
 * stamped into metadata so the webhook can activate the right org.
 */
export async function createOrgCheckoutSession(params: {
  org: Org;
  plan: OrgPlan;
  seats: number;
  successUrl: string;
  cancelUrl: string;
  customerEmail: string;
}): Promise<{ url: string | null; sessionId: string }> {
  const { org, plan, seats, successUrl, cancelUrl, customerEmail } = params;
  const stripe = await getUncachableStripeClient();

  const priceId = await resolvePriceIdForPlan(plan.id);
  if (!priceId) {
    throw new Error(
      `No Stripe price found for plan "${plan.id}". Run the seed-org-products script.`,
    );
  }

  // Re-use the org's existing customer if we have one, otherwise let Checkout
  // create one (captured on the session) and tie it to the org via metadata.
  const quantity = plan.perSeat ? seats : 1;
  const mode = plan.billingType === "annual" ? "subscription" : "payment";

  const metadata = {
    orgId: String(org.id),
    orgPlan: plan.id,
    seats: String(plan.perSeat ? seats : plan.seats),
  };

  const session = await stripe.checkout.sessions.create({
    mode,
    line_items: [{ price: priceId, quantity }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: String(org.id),
    metadata,
    ...(org.stripeCustomerId
      ? { customer: org.stripeCustomerId }
      : { customer_email: customerEmail, customer_creation: mode === "payment" ? "always" : undefined }),
    ...(mode === "subscription"
      ? { subscription_data: { metadata } }
      : { payment_intent_data: { metadata } }),
  });

  await db
    .update(orgsTable)
    .set({ stripeCheckoutSessionId: session.id })
    .where(eq(orgsTable.id, org.id));

  return { url: session.url, sessionId: session.id };
}

/**
 * Create a Stripe Billing Portal session so an admin can manage their
 * subscription (update card, change seat count, cancel).
 */
export async function createOrgPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<string | null> {
  const stripe = await getUncachableStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });
  return session.url;
}

async function bustOrgMembersPlusCache(orgId: number): Promise<void> {
  // Bust the Plus cache for every member so entitlement changes surface
  // immediately instead of waiting out the 60s TTL.
  try {
    const rows = await db.execute(
      sql`
        SELECT u.clerk_id AS clerk_id
        FROM org_members m
        JOIN users u ON u.id = m.user_id
        WHERE m.org_id = ${orgId} AND m.status = 'active'
      `,
    );
    for (const r of rows.rows as Array<{ clerk_id?: string }>) {
      if (r.clerk_id) bustIsPlusCache(r.clerk_id);
    }
  } catch (err) {
    logger.warn({ err, orgId }, "Failed to bust org members Plus cache");
  }
}

function findOrgIdFromMetadata(
  metadata: Record<string, string> | null | undefined,
): number | null {
  const raw = metadata?.["orgId"];
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * React to verified Stripe webhook events to drive org seat lifecycle.
 *
 * The raw body is already signature-verified by stripe-replit-sync's
 * processWebhook (which also syncs the stripe.* tables); here we only read
 * the event to run our own business logic. Unknown event types are ignored.
 */
export async function handleOrgStripeEvent(event: {
  type: string;
  data: { object: Record<string, unknown> };
}): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await onCheckoutCompleted(event.data.object);
      break;
    case "customer.subscription.updated":
      await onSubscriptionUpdated(event.data.object);
      break;
    case "customer.subscription.deleted":
      await onSubscriptionDeleted(event.data.object);
      break;
    case "invoice.payment_failed":
      await onInvoicePaymentFailed(event.data.object);
      break;
    case "invoice.payment_succeeded":
    case "invoice.paid":
      await onInvoicePaid(event.data.object);
      break;
    default:
      break;
  }
}

async function findOrgBySubscription(subId: string): Promise<Org | null> {
  return db
    .select()
    .from(orgsTable)
    .where(eq(orgsTable.stripeSubscriptionId, subId))
    .limit(1)
    .then((r) => r[0] ?? null);
}

async function findOrgByCustomer(customerId: string): Promise<Org | null> {
  return db
    .select()
    .from(orgsTable)
    .where(eq(orgsTable.stripeCustomerId, customerId))
    .limit(1)
    .then((r) => r[0] ?? null);
}

async function onCheckoutCompleted(
  session: Record<string, unknown>,
): Promise<void> {
  const metadata = session["metadata"] as Record<string, string> | undefined;
  let orgId = findOrgIdFromMetadata(metadata);
  if (!orgId && typeof session["client_reference_id"] === "string") {
    const n = Number(session["client_reference_id"]);
    if (Number.isFinite(n) && n > 0) orgId = n;
  }
  if (!orgId) return;

  const planId = metadata?.["orgPlan"];
  const plan = getOrgPlan(planId);
  const seatsFromMeta = Number(metadata?.["seats"] ?? "0");

  const customerId =
    typeof session["customer"] === "string" ? (session["customer"] as string) : null;
  const subscriptionId =
    typeof session["subscription"] === "string"
      ? (session["subscription"] as string)
      : null;

  let currentPeriodEnd: Date | null = null;
  let seatLimit = Number.isFinite(seatsFromMeta) && seatsFromMeta > 0 ? seatsFromMeta : plan?.seats ?? 0;

  // For subscriptions, read the live subscription to get quantity + period end.
  if (subscriptionId) {
    try {
      const stripe = await getUncachableStripeClient();
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const item = sub.items.data[0];
      if (item?.quantity && item.quantity > 0) seatLimit = item.quantity;
      const periodEnd = (item as { current_period_end?: number } | undefined)
        ?.current_period_end ??
        (sub as unknown as { current_period_end?: number }).current_period_end;
      if (periodEnd) currentPeriodEnd = new Date(periodEnd * 1000);
    } catch (err) {
      logger.warn({ err, subscriptionId }, "Failed to retrieve subscription on checkout");
    }
  }

  await db
    .update(orgsTable)
    .set({
      status: "active",
      stripeCustomerId: customerId ?? undefined,
      stripeSubscriptionId: subscriptionId ?? undefined,
      seatLimit,
      currentPeriodEnd,
      graceEndsAt: null,
      cancelAtPeriodEnd: null,
      ...(plan ? { plan: plan.id, billingType: plan.billingType } : {}),
    })
    .where(eq(orgsTable.id, orgId));

  await bustOrgMembersPlusCache(orgId);
  logger.info({ orgId, seatLimit }, "Org activated via checkout");
}

async function onSubscriptionUpdated(
  sub: Record<string, unknown>,
): Promise<void> {
  const subId = typeof sub["id"] === "string" ? (sub["id"] as string) : null;
  if (!subId) return;
  let org = await findOrgBySubscription(subId);
  if (!org) {
    const customerId =
      typeof sub["customer"] === "string" ? (sub["customer"] as string) : null;
    if (customerId) org = await findOrgByCustomer(customerId);
  }
  if (!org) return;

  const status = sub["status"] as string | undefined;
  const cancelAtPeriodEnd = sub["cancel_at_period_end"] === true;
  const items = (sub["items"] as { data?: Array<Record<string, unknown>> } | undefined)
    ?.data ?? [];
  const firstItem = items[0];
  const quantity = Number(firstItem?.["quantity"] ?? 0);
  const periodEndRaw =
    (firstItem?.["current_period_end"] as number | undefined) ??
    (sub["current_period_end"] as number | undefined);

  // Map Stripe subscription status to our org status. active/trialing → active.
  // past_due/unpaid keep the grace window (set on payment_failed).
  let nextStatus = org.status;
  if (status === "active" || status === "trialing") {
    nextStatus = "active";
  } else if (status === "canceled") {
    nextStatus = "canceled";
  }

  await db
    .update(orgsTable)
    .set({
      status: nextStatus,
      ...(quantity > 0 ? { seatLimit: quantity } : {}),
      ...(periodEndRaw ? { currentPeriodEnd: new Date(periodEndRaw * 1000) } : {}),
      cancelAtPeriodEnd: cancelAtPeriodEnd ? "true" : null,
      ...(nextStatus === "active" ? { graceEndsAt: null } : {}),
    })
    .where(eq(orgsTable.id, org.id));

  await bustOrgMembersPlusCache(org.id);
  logger.info(
    { orgId: org.id, status: nextStatus, seatLimit: quantity, cancelAtPeriodEnd },
    "Org subscription updated",
  );
}

async function onSubscriptionDeleted(
  sub: Record<string, unknown>,
): Promise<void> {
  const subId = typeof sub["id"] === "string" ? (sub["id"] as string) : null;
  if (!subId) return;
  const org = await findOrgBySubscription(subId);
  if (!org) return;

  await db
    .update(orgsTable)
    .set({ status: "canceled", graceEndsAt: null, cancelAtPeriodEnd: null })
    .where(eq(orgsTable.id, org.id));

  await bustOrgMembersPlusCache(org.id);
  logger.info({ orgId: org.id }, "Org subscription canceled; seats deactivated");
}

async function onInvoicePaymentFailed(
  invoice: Record<string, unknown>,
): Promise<void> {
  const customerId =
    typeof invoice["customer"] === "string"
      ? (invoice["customer"] as string)
      : null;
  if (!customerId) return;
  const org = await findOrgByCustomer(customerId);
  if (!org) return;

  const graceEndsAt = new Date(Date.now() + ORG_GRACE_MS);
  await db
    .update(orgsTable)
    .set({ status: "past_due", graceEndsAt })
    .where(eq(orgsTable.id, org.id));

  await bustOrgMembersPlusCache(org.id);
  logger.info(
    { orgId: org.id, graceEndsAt },
    "Org payment failed; entered grace period",
  );
}

async function onInvoicePaid(invoice: Record<string, unknown>): Promise<void> {
  const customerId =
    typeof invoice["customer"] === "string"
      ? (invoice["customer"] as string)
      : null;
  if (!customerId) return;
  const org = await findOrgByCustomer(customerId);
  if (!org) return;
  if (org.status === "canceled") return;

  const periodEnd = invoice["period_end"] as number | undefined;
  await db
    .update(orgsTable)
    .set({
      status: "active",
      graceEndsAt: null,
      ...(periodEnd ? { currentPeriodEnd: new Date(periodEnd * 1000) } : {}),
    })
    .where(eq(orgsTable.id, org.id));

  await bustOrgMembersPlusCache(org.id);
  logger.info({ orgId: org.id }, "Org payment succeeded; seats active");
}
