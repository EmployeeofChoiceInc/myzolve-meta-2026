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
- **Animated app open (mobile)**: On cold launch only, an in-app "peach reveal" overlay plays after the native splash hides — heart fades + scales in, then the leaves fade + drift down, then the whole overlay crossfades to the app. Background → foreground does not replay the animation (gated by a module-scoped `isColdLaunch` flag in `app/_layout.tsx`). Honors Reduce Motion via Reanimated's `useReducedMotion` (simple fade + longer hold). Tap to skip. Component: `artifacts/myzolve-connect-mobile/components/AnimatedSplash.tsx`. Layer assets: `assets/images/splash/heart.png` and `leaves.png` (extracted from `icon.png` 1024×1024 via a sharp color-threshold script). Native splash `backgroundColor` is `#F4E8CC` (the icon's cream) so the hand-off from native splash → animated splash → app is seamless.

**Backend API Endpoints:**
All API endpoints are prefixed with `/api` and cover functionalities such as health checks, user profiles, circle management, invitations, support requests, contributions, repayment plans, service posts, activity feeds, ledger entries, dashboard summaries, and co-pilot grant management.

## External Dependencies

- **PostgreSQL**: Relational database for data storage.
- **Clerk**: Authentication and user management service (`@clerk/react`, `@clerk/express`).
- **Plausible Analytics**: For website analytics, loaded conditionally in production builds based on `VITE_PLAUSIBLE_DOMAIN` and `VITE_PLAUSIBLE_API_HOST` environment variables.
- **RevenueCat**: Subscription billing for "MyZolve Connect Plus". Mobile uses `react-native-purchases` (App Store + Google Play); server uses `@replit/revenuecat-sdk` via `getUncachableRevenueCatClient` to read entitlements. Clerk userId is the RevenueCat App User ID. Entitlement: `plus`. Offering `default` with `$rc_monthly` ($3.99/mo) and `$rc_annual` ($29.99/yr) packages. RevenueCat is the source of truth — Plus state is never persisted in our database.
  - Mobile: `lib/revenuecat.tsx` (provider + `useIsPlus`), `components/PaywallSheet.tsx`, `components/PlusBadge.tsx`, `app/plus.tsx` (manage screen), Plus row in `app/settings.tsx`.
  - Web Plus suite (`artifacts/myzolve-connect`): view + manage only (no Stripe / RevCat Web Billing — purchases happen on iPhone). Status comes from the same `/v1/plus/status` endpoint via `useMyPlusStatus`. Components: `components/paywall-dialog.tsx` (`PaywallProvider`/`usePaywall` exposing `open(reason)`, `close()`, and `handleApiError(err): boolean` that catches `402 plus_required` thrown by `customFetch` as `ApiError`), `components/plus-badge.tsx`, `components/verified-badge.tsx`, `components/role-picker-dialog.tsx`, `components/apply-verification-dialog.tsx`, `components/ledger-pro-section.tsx`, `components/voice-recorder.tsx`, `components/media-attachment-display.tsx`. `pages/plus.tsx` is the Plus manage screen and is wired in `App.tsx` + `components/layout.tsx` (Plus nav link + badge). `pages/settings.tsx` shows a Plus row card. `pages/circles.tsx` and `pages/circle-detail.tsx` render verified badges and "Apply for verification" entry; `pages/members.tsx` uses `RolePickerDialog` with paywall-on-Plus-gated; `pages/ledger.tsx` mounts `LedgerProSection`; `pages/wall.tsx` renders `MediaAttachmentList` and a multi-photo + voice + video composer that uploads via `useCircleMediaUpload`/`useUploadCircleMedia` and POSTs to `/api/v1/circles/:id/attachments/...` via `customFetch`. `lib/circle-roles.ts` mirrors mobile role labels/colors. `ApiError` is now exported from `@workspace/api-client-react` for paywall error sniffing.
  - Server: `artifacts/api-server/src/lib/revenuecat.ts` (`isPlus(userId)` with 60s in-memory cache; resolves entitlement id from lookup key once and reuses) and `artifacts/api-server/src/middlewares/requirePlus.ts` (returns `402 plus_required`; mount AFTER `requireAuth`).
  - **Circle Plus** (sub-roles + unlimited circles): Free users are capped at 2 active circle memberships (created or joined). Hitting the cap returns `402 {error:"plus_required",reason:"circle_limit"}` from `POST /circles`, `POST /circles/:id/join-requests`, `POST /circles/:id/join-requests/:id/approve`, and `POST /invitations/:token/accept`. Plus owners can grant sub-roles `host` (manage members/invites), `treasurer` (manage ledger/requests), and `scribe` (manage wall posts) via `PATCH /circles/:id/members/:id` and `POST /circles/:id/invitations`; granting any of these without owner Plus returns `402 {reason:"role_grant"}`. Server permission helpers live in `artifacts/api-server/src/lib/permissions.ts` (`canManageMembers`, `canManageLedger`, `canManagePosts`, `isPlusGatedRole`, `ASSIGNABLE_ROLES`); circle-cap helper lives in `artifacts/api-server/src/lib/circleLimits.ts`. Mobile mirrors role labels/colors in `artifacts/myzolve-connect-mobile/lib/circleRoles.ts`, surfaces the picker via `components/RolePickerSheet.tsx`, and opens `PaywallSheet` on any 402 from circle creation, join, or role grant.
  - Setup / re-seed: ensure the Replit RevenueCat connector is connected and the env vars listed below are present, then run `pnpm --filter @workspace/scripts run seed:revenuecat`. Required env: `REVENUECAT_PROJECT_ID`, `REVENUECAT_TEST_STORE_APP_ID`, `REVENUECAT_APPLE_APP_STORE_APP_ID`, `REVENUECAT_GOOGLE_PLAY_STORE_APP_ID`, `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY`, `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`. The seed script is idempotent and updates pricing in place if products already exist.
  - Promotion runbook (Test Store → App Store / Play Store):
    1. App Store Connect: create products `plus_monthly` (auto-renewable, P1M, $3.99 USD) and `plus_annual` (auto-renewable, P1Y, $29.99 USD) in the same subscription group. Submit for review with the binary build and add localized display name + description.
    2. Google Play Console: create base subscription `plus_monthly` with offer id `monthly` (P1M, $3.99 USD) and `plus_annual` with offer id `annual` (P1Y, $29.99 USD). Activate the offers.
    3. RevenueCat dashboard → Project → Apps: confirm the App Store and Play Store apps are connected with the correct bundle id `com.myzolve.connect` and shared secrets / service account JSON uploaded.
    4. RevenueCat → Products: ensure the App Store products map to identifiers `plus_monthly` / `plus_annual`, and Play Store products to `plus_monthly:monthly` / `plus_annual:annual`. All four should be attached to the `plus` entitlement and to the `$rc_monthly` / `$rc_annual` packages of the `default` offering.
    5. Smoke test: install a TestFlight / Internal-test build, complete a sandbox purchase, confirm `useIsPlus()` flips to true on the device, and confirm `isPlus(userId)` flips to true on the server (within 60s — manual override available via `bustIsPlusCache(userId)`). Verify "Restore purchases" works after reinstall.
  - **Plus rich media** (voice notes / short videos / extra photos): `attachmentsTable` carries `kind` (`photo|voice|video`), `durationMs`, `width`, `height`. Voice ≤ 2 min on requests/comments/gratitude, video ≤ 30 s on wall posts, photo cap 3 (free) / 8 (Plus), per-file cap 10 MB (free) / 50 MB (Plus). Server gates creation only — playback is open to any active circle member. Endpoints: `POST /storage/circle-media/request-url` (accepts `kind`; returns 402 plus_required for voice/video off-Plus); `POST /circles/:id/attachments/:entityType/:entityId` (returns 402 plus_required reason `voice_note`/`video_clip`/`photo_cap`). Mobile components: `components/MediaUI.tsx` (`VoiceRecorder`, `VoicePlayer`, `CircleVideoPlayer`, `VideoPreview`); helpers in `lib/postApi.ts` (`uploadCircleMediaToStorage`, `recordEntityAttachment`, `useEntityAttachments`, `PlusRequiredError`). Wall composer (`app/circle/[id]/wall.tsx`) supports multi-photo + 1 voice + 1 video; New Request (`app/circle/[id]/new-request.tsx`) supports an optional voice note. Detail screens render attachments via `useEntityAttachments`. Composer surfaces `PaywallSheet` on any `PlusRequiredError`. iOS/Android permissions and `expo-audio` / `expo-video` plugins live in `artifacts/myzolve-connect-mobile/app.json`. Comment / gratitude composers do not yet exist in the mobile UI; server-side support is in place for when those screens are added.
    6. Production rollout: only after both stores approve the products, promote the build through the normal release process. The RevenueCat config is environment-agnostic — no further server changes are required.