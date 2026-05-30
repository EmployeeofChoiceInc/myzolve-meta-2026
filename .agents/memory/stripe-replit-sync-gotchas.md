---
name: stripe-replit-sync gotchas
description: Two non-obvious failure modes of stripe-replit-sync in a bundled api-server (silent no-op migrations and no-op backfill).
---

# stripe-replit-sync gotchas

Two silent failures cost real debugging time; both look like success in logs.

## 1. Migrations create the schema but NO tables when the server is esbuild-bundled
`runMigrations()` loads its SQL via `path.resolve(__dirname, "./migrations")`.
The api-server esbuild build injects a banner that rewrites `__dirname` to the
bundle's `dist/` dir, so the migrations folder isn't found. `runMigrations`
then logs "Finished migrations" (only if you pass it a logger) and creates the
`stripe` schema namespace via `CREATE SCHEMA IF NOT EXISTS` but **zero tables**.
Later `findOrCreateManagedWebhook` fails with `relation "stripe.accounts" does
not exist`.

**Why:** bundlers break packages that read sibling files relative to their own
module location.
**How to apply:** keep `stripe-replit-sync` in the esbuild `external` list
(artifacts/api-server/build.mjs) so it loads from node_modules where its
`./migrations` ship, and declare it as an explicit api-server dependency.
Symptom check: `SELECT count(*) FROM pg_tables WHERE schemaname='stripe'` should
be ~29, not 0. If a half-created empty `stripe` schema exists, drop it
(`DROP SCHEMA stripe CASCADE`) before re-running — an existing-but-empty schema
makes migrations short-circuit.

## 2. syncBackfill() with no args is a no-op
`syncBackfill()` defaults `object` to a value that hits the `default` switch
branch and syncs nothing — it returns `{}` and your `stripe.products` /
`stripe.prices` mirror tables stay empty even though products exist in Stripe.
**How to apply:** always call `syncBackfill({ object: "all" })`.
