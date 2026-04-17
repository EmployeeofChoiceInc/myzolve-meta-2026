# Shared Auth — MyZolve Ecosystem

MyZolve Connect (this repo) and the parent MyZolve product
(myzolve.com) share a single identity. A user who signs in on either
property is signed in on both, with the same Clerk user id and email.

## Architecture

- **Path A — single Clerk instance.** The Clerk instance that already
  backs MyZolve Connect is the canonical identity provider for the
  whole ecosystem. myzolve.com adopts this same instance.
- No SAML/OIDC federation, no second Clerk org.
- Sessions are shared across `myzolve.com` and `connect.myzolve.com`
  via Clerk's standard cross-subdomain cookies on the apex domain.
- The mobile app (Expo) signs in against the same instance using the
  same publishable key.

## Where the keys live in this repo

| Variable | Used by | Source |
| --- | --- | --- |
| `CLERK_SECRET_KEY` | `artifacts/api-server` (Express middleware + proxy) | Replit secret |
| `CLERK_PUBLISHABLE_KEY` | re-exported as `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` for mobile | Replit secret |
| `VITE_CLERK_PUBLISHABLE_KEY` | `artifacts/myzolve-connect` web | Replit secret |
| `VITE_CLERK_PROXY_URL` | optional override for the web Clerk proxy URL | Replit secret (optional) |

All three keys must point at the **same** Clerk instance. The same
keys must be reused by myzolve.com when it is migrated to Clerk.

## Clerk Dashboard checklist

Before myzolve.com ships its Clerk integration, verify in the Clerk
Dashboard for the canonical instance:

1. **Domains** — both `myzolve.com` (primary) and `connect.myzolve.com`
   are added. Confirm the apex domain is set as primary so
   subdomain session cookies are issued on `.myzolve.com`.
2. **Allowed origins** — include `https://myzolve.com`,
   `https://www.myzolve.com`, `https://connect.myzolve.com`, plus
   the Replit dev domain(s) used for local work.
3. **Redirect URLs** — sign-in / sign-up / after-sign-in / after-sign-out
   URLs are registered for both domains, e.g.
   `https://myzolve.com/dashboard`,
   `https://connect.myzolve.com/dashboard`.
4. **OAuth providers** (Google, Apple, etc.) — each provider's
   authorized JavaScript origin and redirect URI cover both apex and
   Connect subdomain. Update Google / Apple / etc. consoles to match.
5. **Mobile (Expo)** — the `myzolve` Expo scheme is registered for
   native deep-link redirect URIs.

## API server

`artifacts/api-server/src/app.ts` already accepts CORS from
`myzolve.com` and any `*.myzolve.com` subdomain, so no code change is
needed when myzolve.com starts calling the API. The Clerk proxy at
`/api/__clerk` is host-aware (it reads the incoming `Host` header to
build `Clerk-Proxy-Url`), so the same deployment proxies cleanly for
both domains.

## Verification (2026-04-17)

The repo's existing configuration was confirmed ready to back the
shared identity model — no code changes were required:

- Workflows running cleanly:
  - `artifacts/api-server: API Server` — Express boot logs show
    "Server listening port: 8080" with `clerkMiddleware()` mounted.
  - `artifacts/myzolve-connect: web` — Vite dev server up; browser
    console shows `Clerk has been loaded with development keys`,
    confirming `VITE_CLERK_PUBLISHABLE_KEY` resolves at runtime.
  - `artifacts/myzolve-connect-mobile: expo` — Metro bundles the app;
    the dev script already maps `CLERK_PUBLISHABLE_KEY` →
    `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` so the mobile build uses the
    exact same publishable key as the web app.
- Secrets in this Replit project (verified via the secrets store):
  `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, and
  `VITE_CLERK_PUBLISHABLE_KEY` are all present. They must continue
  to point at the canonical Clerk instance — do not split them.
- API server CORS (`artifacts/api-server/src/app.ts` `isOriginAllowed`)
  already accepts `myzolve.com` and any `*.myzolve.com` origin, so the
  parent product can hit `/api` without further changes once it
  adopts Clerk.

## Migration scope

Confirmed with the product owner during discovery (2026-04-17):

- Connect production has only test accounts — safe to wipe; no
  preservation work required on this side. The current development
  `users` table holds 5 test rows; production has no real customers
  yet, so no `users.clerk_id` re-linking script is needed.
- myzolve.com runs a custom bcrypt + JWT stack with a very small
  user base. Migrating those accounts to Clerk is part of the
  follow-up that swaps myzolve.com onto this Clerk instance — it is
  intentionally not done in this task because that codebase lives
  outside this repo.

## What's NOT done by this task

- Building or migrating myzolve.com itself. That's a follow-up that
  swaps its bcrypt + JWT stack for Clerk using the keys above.
- Merging or syncing user profile data between products.
- The Money OS ↔ Gentle Ledger bridge or unified notification center
  (separate, larger tasks that depend on this foundation).
