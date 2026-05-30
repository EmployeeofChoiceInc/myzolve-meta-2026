---
name: Replit managed Stripe connector fields
description: The exact connection settings exposed by Replit's managed Stripe connector, and how to fetch them per environment.
---

# Replit managed Stripe connector

When fetching credentials from the connector API
(`https://${REPLIT_CONNECTORS_HOSTNAME}/api/v2/connection?include_secrets=true&connector_names=stripe`):

- Auth header is `X-Replit-Token` (hyphens), value `repl <REPL_IDENTITY>` or
  `depl <WEB_REPL_RENEWAL>`. NOT `X_REPLIT_TOKEN`.
- `settings` exposes: `account_id`, `secret` (the sk_… secret key),
  `publishable`, `mcp`, `claim_url`. There is **NO** `webhook_secret` —
  webhook signing is handled by stripe-replit-sync's managed webhook
  (`findOrCreateManagedWebhook`), so don't pass a webhook secret to StripeSync.
- Connections are per-environment. Pass `&environment=development` or
  `&environment=production` keyed off `process.env.REPLIT_DEPLOYMENT === "1"`.
  A development connection does NOT imply a production one exists.

**Why:** an earlier custom client read `secret_key`/`webhook_secret` (wrong
names) so `isStripeConfigured()` was always false and checkout 502'd.
**How to apply:** after connecting Stripe in dev and confirming checkout, the
LIVE site needs a separate **production** connection (republish + bind), or
production billing degrades to 502 (logged as a warning, not a crash).

## Production connection must be bound from the Publish pane

Calling `proposeIntegration` on the Stripe connection in the dev workspace
only (re)authorizes the **development** connection — it does NOT create a
production connection. The live deployment's production Stripe connection is
set up from the **Publish/Deployment pane** (install the "Replit Integrated
Payments" app there, which provisions live keys). After connecting there,
**republish once** so the deployment restarts and `initStripe` runs (creates
the `stripe` schema + seeds products in the PROD db).
**Why:** schema/products are created at runtime by `initStripe`, not by the
publish-time drizzle schema diff — so an empty `stripe` schema in the prod
read-replica means init was skipped (no prod connection resolved).
**How to verify:** query the prod replica for `information_schema.schemata`
where name='stripe'; absent ⇒ prod Stripe never initialized.
