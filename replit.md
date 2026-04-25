# MyZolve Connect

## Overview

MyZolve Connect is a private, trust-based platform for families and trusted circles. It facilitates requesting and offering financial support, gently tracking repayments, exchanging services, and organizing mutual aid within a secure environment. The project aims to provide a warm, supportive ecosystem for financial and service-based interactions among trusted individuals.

## User Preferences

**Use**: "support", "help", "request", "return", "complete", "contribute", "offer", "share", "trusted circle"
**Never use**: "debt", "overdue", "delinquent", "late fee", "penalty", "balance due"
- Repayment reminders: "A gentle reminder about returning support" NOT "OVERDUE PAYMENT"
- Empty states: warm and inviting

## System Architecture

The project is a pnpm workspace monorepo utilizing TypeScript.

**Technology Stack:**
- **Node.js**: Version 24
- **Package Manager**: pnpm
- **TypeScript**: Version 5.9
- **API Framework**: Express 5
- **Database**: PostgreSQL with Drizzle ORM
- **Validation**: Zod (v4) and drizzle-zod
- **API Codegen**: Orval (from OpenAPI specification)
- **Bundler**: esbuild (CJS bundle)
- **Frontend**: React, Vite, Tailwind CSS, shadcn/ui
- **Authentication**: Clerk (@clerk/react, @clerk/express) for shared identity across the MyZolve ecosystem.
- **Routing**: Wouter for frontend, Express for backend.
- **API Client**: React Query with generated hooks from Orval.

**Monorepo Structure:**
- `artifacts/api-server`: Express 5 REST API server handling authentication via Clerk proxy middleware and `clerkMiddleware`. Routes are prefixed with `/api/*` and interact with the database via `@workspace/db`.
- `artifacts/myzolve-connect`: React + Vite frontend integrating Clerk authentication, Wouter for routing, and React Query for API data fetching.

**Key Internal Packages:**
- `lib/api-spec`: Defines the OpenAPI specification (`openapi.yaml`) used for API generation.
- `lib/api-client-react`: Contains generated React Query hooks for API interaction.
- `lib/api-zod`: Provides generated Zod schemas for validation.
- `lib/db`: Manages Drizzle ORM schema and PostgreSQL connection, including tables for users, circles, support requests, repayment plans, service posts, and activity feeds.

**Frontend UI/UX:**
- **Brand Palette**: Terracotta primary (#e07051 range), sage green secondary, warm off-white background.
- **Font**: Plus Jakarta Sans.
- **Design Principle**: Mobile-first design, no emojis in UI.
- **Features**: Dashboard, circle management (create, detail, members, invitations), support requests (list, detail, contributions, repayment), service exchange, ledger, activity feed, and user settings.
- **Co-pilot for elders**: A feature enabling trusted helpers to post on behalf of other circle members, with an approval workflow.
- **Gratitude wrap-ups**: A weekly (Sunday) and monthly (1st-of-month) recap of the care a member exchanged in their circles. Generated server-side by the scheduler, cached in the `wrapups` table, surfaced via the `/wrapup` mobile screen and a push notification, and gated by the `wrapup_weekly` / `wrapup_monthly` notification preferences.

**Backend API Endpoints:**
All API endpoints are prefixed with `/api` and cover functionalities such as health checks, user profiles, circle management, invitations, support requests, contributions, repayment plans, service posts, activity feeds, ledger entries, dashboard summaries, and co-pilot grant management.

## External Dependencies

- **PostgreSQL**: Relational database for data storage.
- **Clerk**: Authentication and user management service (`@clerk/react`, `@clerk/express`).
- **Plausible Analytics**: For website analytics, loaded conditionally in production builds based on `VITE_PLAUSIBLE_DOMAIN` and `VITE_PLAUSIBLE_API_HOST` environment variables.
- **RevenueCat**: Subscription billing for "MyZolve Connect Plus". Mobile uses `react-native-purchases` (App Store + Google Play); server uses `@replit/revenuecat-sdk` via `getUncachableRevenueCatClient` to read entitlements. Clerk userId is the RevenueCat App User ID. Entitlement: `plus`. Offering `default` with `$rc_monthly` ($3.99/mo) and `$rc_annual` ($29.99/yr) packages. RevenueCat is the source of truth — Plus state is never persisted in our database.
  - Mobile: `lib/revenuecat.tsx` (provider + `useIsPlus`), `components/PaywallSheet.tsx`, `components/PlusBadge.tsx`, `app/plus.tsx` (manage screen), Plus row in `app/settings.tsx`.
  - Server: `artifacts/api-server/src/lib/revenuecat.ts` (`isPlus(userId)` with 60s in-memory cache; resolves entitlement id from lookup key once and reuses) and `artifacts/api-server/src/middlewares/requirePlus.ts` (returns `402 plus_required`; mount AFTER `requireAuth`).
  - Setup / re-seed: ensure the Replit RevenueCat connector is connected and the env vars listed below are present, then run `pnpm --filter @workspace/scripts run seed:revenuecat`. Required env: `REVENUECAT_PROJECT_ID`, `REVENUECAT_TEST_STORE_APP_ID`, `REVENUECAT_APPLE_APP_STORE_APP_ID`, `REVENUECAT_GOOGLE_PLAY_STORE_APP_ID`, `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY`, `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`. The seed script is idempotent and updates pricing in place if products already exist.
  - Promotion runbook (Test Store → App Store / Play Store):
    1. App Store Connect: create products `plus_monthly` (auto-renewable, P1M, $3.99 USD) and `plus_annual` (auto-renewable, P1Y, $29.99 USD) in the same subscription group. Submit for review with the binary build and add localized display name + description.
    2. Google Play Console: create base subscription `plus_monthly` with offer id `monthly` (P1M, $3.99 USD) and `plus_annual` with offer id `annual` (P1Y, $29.99 USD). Activate the offers.
    3. RevenueCat dashboard → Project → Apps: confirm the App Store and Play Store apps are connected with the correct bundle id `com.myzolve.connect` and shared secrets / service account JSON uploaded.
    4. RevenueCat → Products: ensure the App Store products map to identifiers `plus_monthly` / `plus_annual`, and Play Store products to `plus_monthly:monthly` / `plus_annual:annual`. All four should be attached to the `plus` entitlement and to the `$rc_monthly` / `$rc_annual` packages of the `default` offering.
    5. Smoke test: install a TestFlight / Internal-test build, complete a sandbox purchase, confirm `useIsPlus()` flips to true on the device, and confirm `isPlus(userId)` flips to true on the server (within 60s — manual override available via `bustIsPlusCache(userId)`). Verify "Restore purchases" works after reinstall.
    6. Production rollout: only after both stores approve the products, promote the build through the normal release process. The RevenueCat config is environment-agnostic — no further server changes are required.