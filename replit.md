# MyZolve Connect

## Overview

MyZolve Connect is a private, trust-based platform designed for families and trusted circles. Its primary purpose is to facilitate secure and supportive interactions related to financial assistance, service exchange, and mutual aid. The platform allows users to request and offer financial support, gently track repayments, exchange services, and organize communal assistance within a secure and warm environment. The project envisions creating a supportive ecosystem for trusted individuals to manage financial and service-based interactions with empathy and clear communication.

## User Preferences

**Use**: "support", "help", "request", "return", "complete", "contribute", "offer", "share", "trusted circle"
**Never use**: "debt", "overdue", "delinquent", "late fee", "penalty", "balance due"
- Repayment reminders: "A gentle reminder about returning support" NOT "OVERDUE PAYMENT"
- Empty states: warm and inviting

## System Architecture

MyZolve Connect is built as a pnpm workspace monorepo using TypeScript, designed for scalability and maintainability.

**Technology Stack:**
- **Backend**: Node.js (v24), Express 5, PostgreSQL with Drizzle ORM, Zod for validation.
- **Frontend**: React, Vite, Tailwind CSS, shadcn/ui.
- **Authentication**: Clerk for shared identity management across the MyZolve ecosystem.
- **API Generation**: Orval from OpenAPI specification.
- **Routing**: Wouter for frontend, Express for backend.
- **Data Fetching**: React Query with generated hooks.

**Monorepo Structure:**
- `artifacts/api-server`: Hosts the Express 5 REST API, handling authentication via Clerk middleware and database interactions.
- `artifacts/myzolve-connect`: Contains the React + Vite frontend, integrating Clerk, Wouter, and React Query.
- `lib/api-spec`: Defines the OpenAPI specification.
- `lib/api-client-react`: Generated React Query hooks.
- `lib/api-zod`: Generated Zod schemas.
- `lib/db`: Manages Drizzle ORM schema and PostgreSQL connections.

**Frontend UI/UX:**
- **Design Principles**: Mobile-first, warm off-white background, terracotta primary, sage green secondary, Plus Jakarta Sans font. No emojis in UI.
- **Core Features**: Dashboard, circle management (create, detail, invitations), support requests (list, detail, contributions, repayment), service exchange, ledger, activity feed, and user settings.
- **Co-pilot for elders**: Allows trusted helpers to post on behalf of other circle members with an approval workflow.
- **Gratitude Wrap-ups**: Weekly and monthly summaries of member contributions, generated server-side and surfaced via mobile screens and push notifications, gated by user preferences.
- **Animated App Open**: A "peach reveal" animation on cold mobile app launches, respecting reduced motion settings.
- **Clerk Integration**: Special handling for Clerk on Expo web target to ensure proper API proxy URL resolution.
- **Mobile Over-the-Air Updates (EAS Update)**: Configured for seamless JS-only updates via `expo-updates`, with `app.config.ts` dynamically managing `runtimeVersion` for compatibility with Expo Go and EAS builds.

**Backend API Endpoints:**
All endpoints are prefixed with `/api` and cover functionalities such as health checks, user profiles, circle management, invitations, support requests, contributions, repayment plans, service posts, activity feeds, ledger entries, dashboard summaries, and co-pilot grant management.

## External Dependencies

- **PostgreSQL**: Primary relational database.
- **Clerk**: Authentication and user management.
- **Plausible Analytics**: Conditional website analytics in production.
- **RevenueCat**: Subscription billing for "MyZolve Connect Plus", managing entitlements and offerings across mobile and web platforms. It supports various features like unlimited circles, sub-roles, and rich media (voice notes, videos, additional photos).