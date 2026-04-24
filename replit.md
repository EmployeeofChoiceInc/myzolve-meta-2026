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
made it work, so it was a cold-start vs. post-`signIn.finalize` race —
the Home query fired before Clerk's session was fully active, so
`getToken()` either hung or returned null. Fix lives in three places:

- `artifacts/myzolve-connect-mobile/app/(tabs)/index.tsx` — gates
  `useListCircles`, `useGetCircleDashboard`, `useListSupportRequests`
  with `enabled: !!isLoaded && !!isSignedIn` from `useAuth()`.
- `artifacts/myzolve-connect-mobile/app/_layout.tsx` `AuthBridge` — when
  `userId` transitions to a value, `qc.clear()` then
  `setTimeout(() => qc.invalidateQueries(), 0)` to force a refetch with
  the fresh token.
- `lib/api-client-react/src/custom-fetch.ts` — `getTokenWithTimeout`
  caps the auth getter at 5 s so a hanging Clerk getter can never
  freeze a fetch (request fast-fails 401, React Query retries).
