# Workspace

## Overview

pnpm workspace monorepo using TypeScript. **MyZolve Connect** — "For families and trusted circles" — a private, warm, trust-based platform for families and trusted circles to request/offer financial support, track repayments gently, exchange services, and organize mutual aid.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Auth**: Clerk (@clerk/react + @clerk/express) — **shared identity across the MyZolve ecosystem**: this Clerk instance is canonical for both connect.myzolve.com and myzolve.com. See `docs/shared-auth.md`.
- **Routing**: Wouter (frontend), Express (backend)
- **API client**: React Query + generated hooks from Orval

## Artifacts

### `artifacts/api-server`
Express 5 REST API server. Runs on port from `PORT` env var (default 8080).
- Clerk proxy middleware + clerkMiddleware for auth
- Routes at `/api/*`
- DB access via `@workspace/db`

### `artifacts/myzolve-connect`
React + Vite frontend. Preview at `/`.
- Clerk auth via `@clerk/react`
- Wouter routing
- React Query for API data fetching

## Key Packages

### `lib/api-spec`
OpenAPI spec at `lib/api-spec/openapi.yaml`. 
- Run `pnpm --filter @workspace/api-spec run codegen` after changes.

### `lib/api-client-react`
Generated React Query hooks from OpenAPI spec.
- Import from `@workspace/api-client-react`
- Hooks return T directly (not `{ data: T }`)

### `lib/api-zod`
Generated Zod schemas for validation.

### `lib/db`
Drizzle ORM schema + PostgreSQL connection.
- Schema tables: `usersTable`, `circlesTable`, `circleMembersTable`, `circleInvitationsTable`, `supportRequestsTable`, `supportContributionsTable`, `repaymentPlansTable`, `repaymentsTable`, `servicePostsTable`, `activityFeedItemsTable`, `ledgerEntriesTable`
- Import: `import { db } from "@workspace/db"` and `import { ... } from "@workspace/db/schema"`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Routes (Frontend)

| Path | Component | Description |
|------|-----------|-------------|
| `/` | Landing/HomeRedirect | Landing page for logged-out; redirect to /dashboard if logged in |
| `/sign-in` | SignInPage | Clerk sign-in |
| `/sign-up` | SignUpPage | Clerk sign-up |
| `/dashboard` | DashboardPage | Main portal |
| `/circles` | CirclesPage | Circle list + create |
| `/circles/:id` | CircleDetailPage | Circle overview + stats |
| `/circles/:id/requests` | RequestsPage | Support requests list |
| `/requests/:id` | RequestDetailPage | Request detail + contributions + repayment |
| `/circles/:id/services` | ServicesPage | Service exchange board |
| `/services/:id` | ServiceDetailPage | Service post detail |
| `/circles/:id/ledger` | LedgerPage | Soft ledger (summary + entries) |
| `/circles/:id/activity` | ActivityPage | Activity feed |
| `/circles/:id/members` | MembersPage | Members + invitations |
| `/settings` | SettingsPage | Profile settings |

## API Endpoints (Backend)

All endpoints prefixed with `/api`.

- `GET /healthz` — health check
- `GET/PATCH /me` — current user profile
- `GET/POST /circles` — list/create circles
- `GET/PATCH/DELETE /circles/:id` — circle CRUD
- `GET /circles/:id/stats` — circle statistics
- `GET/PATCH/DELETE /circles/:id/members/:memberId` — member management
- `GET/POST /circles/:id/invitations` — invitations
- `POST /invitations/:token/accept` — accept invitation
- `DELETE /invitations/:id` — revoke invitation
- `GET/POST /circles/:id/requests` — support requests
- `GET/PATCH /requests/:id` — request CRUD
- `POST /requests/:id/cancel|complete|confirm-receipt` — request actions
- `GET/POST /requests/:id/contributions` — contributions
- `POST /contributions/:id/forgive` — forgive contribution
- `GET/POST /requests/:id/repayment-plan` — repayment plans
- `POST /repayments` — record repayment
- `GET /circles/:id/repayments` — list repayments
- `POST /repayments/:id/confirm` — confirm repayment
- `GET/POST /circles/:id/services` — service posts
- `GET/PATCH /services/:id` — service CRUD
- `POST /services/:id/match|complete` — service actions
- `GET /circles/:id/activity` — activity feed
- `GET /circles/:id/ledger` — ledger entries
- `GET /circles/:id/ledger/summary` — ledger summary
- `GET /circles/:id/dashboard` — dashboard summary
- `GET /copilot/grants` — list co-pilot grants for current user (helpers + grantors)
- `GET/POST /circles/:id/copilot/grants` — list circle co-pilot grants / invite a co-pilot
- `POST /copilot/grants/:id/accept|decline|revoke` — co-pilot grant lifecycle
- `POST /copilot/posts/:entityType/:entityId/review` — grantor approve/flag a co-pilot's post

## Co-pilot for elders

A circle member can invite a trusted helper (free) to post requests, comments, gratitude, and wall posts on their behalf. Every entry created by a helper carries an `actingForUserId` plus a `copilotReview` workflow state ("pending", "approved", or "flagged"). The grantor is notified via `copilot_post_made` and can approve or flag inline from the alerts tab. Mobile shows a tinted "Posting as Helper for [Member]" switcher in compose flows when grants exist, and renders a clear `[Helper] posted for [Member]` attribution on cards/details. Settings exposes "People who help me" (active + pending invitations) and "People I help" (active arrangements + pending invites to accept/decline) with invite, accept, decline and revoke actions. Web is deferred.

## Language Rules (Product Voice)

**Use**: "support", "help", "request", "return", "complete", "contribute", "offer", "share", "trusted circle"
**Never use**: "debt", "overdue", "delinquent", "late fee", "penalty", "balance due"
- Repayment reminders: "A gentle reminder about returning support" NOT "OVERDUE PAYMENT"
- Empty states: warm and inviting

## Brand

- Palette: Terracotta primary (#e07051 range), sage green secondary, warm off-white background
- Font: Plus Jakarta Sans
- No emojis in UI
- Mobile-first design

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Public-Launch Notes

### Analytics (Plausible)
The web app loads Plausible Analytics in production builds only, gated on a
build-time env var. Page views fire on every wouter location change.

- **Implementation**: `artifacts/myzolve-connect/src/lib/analytics.ts`,
  invoked from `App.tsx` via `<AnalyticsTracker />`.
- **Env vars** (set as build-time secrets on the web artifact):
  - `VITE_PLAUSIBLE_DOMAIN` — the site domain registered in Plausible
    (e.g. `connect.myzolve.com`). When unset, no analytics script is
    injected — safe in dev and during initial deploys.
  - `VITE_PLAUSIBLE_API_HOST` *(optional)* — override for self-hosted
    Plausible. Defaults to `https://plausible.io`.
- **Dashboard**: `https://plausible.io/<VITE_PLAUSIBLE_DOMAIN>` once the
  site is added to the team Plausible account
  (e.g. `https://plausible.io/connect.myzolve.com`). For self-hosted,
  swap in the value of `VITE_PLAUSIBLE_API_HOST`.
- Plausible is cookieless, so no GDPR consent banner is required.

### Waitlist references in the production bundle
A previous review flagged `"/waitlist"` appearing in the JS bundle. The
project itself contains zero waitlist code paths — Connect intentionally
does not mount Clerk's waitlist UI. The only remaining `"/waitlist"`
occurrences come from the Clerk SDK's internal waitlist feature
(`mountWaitlist`, `redirectToWaitlist`,
`waitlist:{pathRoot:"/waitlist"`, …) and are inert.

To prove this stays true on every build, an audit script enforces the
rule with an explicit allowlist of Clerk-internal contexts. Any *new*
`"/waitlist"` literal that does not match the allowlist (i.e. any
app-owned waitlist link or route) fails the audit:

```bash
pnpm --filter ./artifacts/myzolve-connect run build
pnpm --filter ./artifacts/myzolve-connect run audit:waitlist
```

The audit lives at `artifacts/myzolve-connect/scripts/audit-waitlist.mjs`
and is intended to be wired into CI before public launch.

### Brand tokens
See `artifacts/myzolve-connect/BRAND.md` for palette, typography, shape,
voice, and "by MyZolve" sub-brand mark guidance.

### Mobile post-sign-in race (Apple TestFlight 2.1(a) fix)
Apple App Review repeatedly rejected MyZolve Connect Mobile because the
Home tab stayed on its loading skeleton forever after the very first
sign-in (`useListCircles` never resolved). Closing and reopening the app
made it work, so it was a cold-start vs. post-`signIn.finalize` race.

**Confirmed root cause** (from `connect.myzolve.com` deployment logs of
build 1.0.5(9)): immediately after Clerk's `POST /v1/client/sessions/.../touch`
returned, the Home tab mounted and fired `GET /api/circles` only ~334 ms
later. Clerk's local token cache still held the pre-sign-in anonymous JWT
at that moment, so the server returned `401` in 2 ms — and React Query
never recovered because `qc.clear()` in `AuthBridge` was racing the
in-flight retry and canceling it. Result: a perma-pending query, the
exact "skeleton forever" bug Apple flagged.

Fix lives in four places:

- `artifacts/myzolve-connect-mobile/app/sign-in.tsx` — after
  `signIn.finalize`, **awaits `getToken({ skipCache: true })`** (capped
  at 4 s) before navigating to `/(tabs)`, so the very first
  authenticated request leaves with a freshly-minted JWT.
- `artifacts/myzolve-connect-mobile/app/_layout.tsx` `AuthBridge` — only
  `qc.clear()`s when transitioning AWAY from a previous user
  (sign-out / account switch), never on a fresh sign-in, so it can't
  cancel the just-started post-sign-in queries.
- `artifacts/myzolve-connect-mobile/app/(tabs)/index.tsx` — gates
  `useListCircles` etc. with `enabled: !!isLoaded && !!isSignedIn`.
- `lib/api-client-react/src/custom-fetch.ts` — `getTokenWithTimeout`
  caps the token getter at 5 s, AND a 401-safety-net force-refreshes
  the token and retries the request once if the server rejects it
  (handles any future stale-token race the same way).

### Onboarding redirect loop & post-create dead-end (build 1.0.5(10+))

After 1.0.5(9) finally let users sign in, two follow-up bugs blocked App
Review for accounts that have zero circles:

1. **Redirect loop.** `(tabs)/index.tsx` had an unconditional
   `useEffect` that called `router.replace("/onboarding")` whenever the
   circles list came back empty.  The Onboarding screen's "Skip for
   now" button routed back to `/(tabs)`, where the same effect
   re-fired within ~50 ms, so Skip looked broken (it wasn't — it just
   got undone instantly).  Fix: a per-user "onboarding acknowledged"
   flag is persisted in AsyncStorage by `lib/onboardingFlag.ts`, set
   by the Skip button **and** by a successful create, and read by
   Home.  Home only auto-redirects when `circles.length === 0` AND the
   flag is unset — so brand-new sign-ups still get the guided Welcome
   screen exactly once, and skipping it sticks.  Home's empty state
   also got an explicit "Create your first circle" button so the user
   can always reach onboarding voluntarily.
2. **Stranded after create.** Onboarding's success handler did
   `router.replace("/circle/${id}")`, leaving the navigation stack
   with only that one screen — the back arrow then silently no-op'd
   because there was nowhere to back to.  Fix: replace to `/(tabs)`
   first then `push` the new circle, so the stack is `[tabs,
   circle/[id]]` and back works.  As a defense in depth, the back
   arrow in `circle/[id]/index.tsx` now falls through to
   `router.replace("/(tabs)")` whenever `router.canGoBack()` is false.
3. **"circle/[id]" shown as the screen title.**  Because
   `circle/[id]/_layout.tsx` is a nested Stack, the outer
   `app/_layout.tsx` sees the whole folder as a single screen named
   `circle/[id]` — none of the per-subscreen registrations
   (`circle/[id]/index`, `circle/[id]/requests`, …) ever matched, so
   the outer Stack fell back to its default header and showed the
   literal route name.  Fixed by replacing all of those broken
   registrations with one `<Stack.Screen name="circle/[id]"
   options={{ headerShown: false }} />`; every subscreen already
   draws its own header.
4. **Discover -> blank circle screen.**  `app/discover.tsx` was
   pushing every tapped circle to `/circle/{id}` regardless of
   membership.  For non-members the protected `/circles/:id`
   endpoint correctly returns 404, so the detail screen sat on its
   skeleton with no path forward.  Fix: Discover now branches on
   `circle.isMember` / `circle.joinRequestStatus`.  Members open the
   detail; everyone else gets a confirm-to-join Alert that calls
   `useCreateJoinRequest` and refetches the discover list on
   success (with copy that adapts to whether the circle requires
   admin approval).  As defense in depth, `circle/[id]/index.tsx`
   now renders a friendly "this circle isn't available" card when
   `useGetCircle` errors, so any other code path that lands a
   non-member here (deep links, push notifications, stale lists)
   never gets stranded on a blank skeleton again.
5. **Trapped on circle subscreens (force-quit-to-escape).**
   `circle/[id]/_layout.tsx` is a Stack with `headerShown:false`,
   so each subscreen is responsible for drawing its own header.
   Five of them — `requests`, `activity`, `ledger`, `services`,
   `wall` — were drawing the title only, with no back button at
   all.  iOS edge-swipe was the only way out, which most users
   never discover; the user had to force-quit and reopen the app to
   leave "View requests".  Eleven other screens did have a back
   arrow but called bare `router.back()`, which silently no-ops
   when the screen is reached with no history (deep links, push
   notifications, cold-start to a deep route).  Fix: a tiny shared
   helper `lib/safeBack.ts` that does
   `canGoBack() ? back() : replace("/(tabs)")`.  Every back arrow
   in the app now uses it (members, new-request, new-service,
   settings, discover, messages, profile/edit, profile/[userId],
   request/[id], service/[id], circle/[id]/index — and the
   previously trapped five, which all grew a real back arrow + safe
   area padding).  The two auth screens (sign-in/sign-up) keep
   bare `router.back()` since their natural fallback (the auth
   gate) already handles the empty-history case.
