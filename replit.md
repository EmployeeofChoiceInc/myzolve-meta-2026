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
- **Auth**: Clerk (@clerk/react + @clerk/express)
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
