# MyZolve LIFE — Hackathon Baseline

**Audit date:** 2026-10-31  
**Competition window:** 2026-10-26 through 2026-11-04  
**Hackathon branch:** `meta-2026-myzolve-life`  
**Application source baseline:** commit `61a4335` (`Published your App`, 2026-06-07)  
**Branch point:** commit `4a0c4dc` (`Add baseline metadata to agent memory`, 2026-10-31)

## Attribution rule

The capabilities below were already present in MyZolve Connect before the hackathon. They are baseline product functionality, not MyZolve LIFE or hackathon-created functionality. New competition-period work must be recorded in `HACKATHON_CHANGELOG.md` and described as new only when supported by the change history.

The branch point includes the application source baseline above plus an agent-memory-only commit. The source diff between those commits contains only `.agents/memory/MEMORY.md` and `.agents/memory/meta-hackathon-baseline.md`; it adds no product code.

## Existing product and architecture

- **Web app:** React and Vite, with protected routes for circles, requests, services, the ledger, profiles, messages, notifications, organizations, reunion pages, and account settings.
- **Mobile app:** Expo / React Native with circle, profile, message, notification, request, service, reunion, and settings flows.
- **API:** Express 5 service. Its routes cover users, circles, members, requests, services, activity, comments, notifications, connections, messaging, attachments/storage, care dates, organizations, billing-related features, wrap-ups, and administration.
- **Data:** PostgreSQL managed through Drizzle ORM. Existing schema includes users, circles and membership, requests, services, comments/posts, activity and ledger entries, messages, connections, notifications, care dates, organizations/events, attachments, wrap-ups, and human co-pilot grants.
- **API contracts:** OpenAPI is the API contract; generated TypeScript client hooks and Zod schemas are used by the clients. The checked-in spec contains 115 paths and 147 operations.
- **Authentication:** Clerk.
- **Existing external services:** Stripe and RevenueCat support billing and entitlements; existing storage and notification flows support user-facing product features.

## Existing user-facing capabilities

The checked-in app includes private trusted circles and invitations; member profiles and discovery; support requests and contributions; gentle return tracking and ledger features; service exchange; circle posts, comments, activity, and direct messages; care dates/calendar; notifications; organizations and Reunion Home pages with announcements/events; gratitude wrap-ups; and paid Plus features.

The existing “co-pilot” feature authorizes a trusted human to help a member post on their behalf, with invitation, acceptance/revocation, and review flows. It is not an LLM or autonomous agent.

## What is not in the baseline

The inspected application source contains no MyZolve LIFE scenario intake, AI-generated resilience plan, AI-proposed task assignments, plan approval/editing flow, circumstance-driven replanning, or Meta Model API client. No Meta/Muse API configuration or integration was identified. Meta account access and API credentials therefore remain **unverified**.

The LIFE demo should use synthetic households and scenarios. It must not use production member data without a separately approved, privacy-reviewed integration.

## Source history and production status

- At the audit, `main` was clean and its application source was at `61a4335`, dated 2026-06-07. No application-source commits after the 2026-10-26 competition start were found in the inspected history.
- The latest checked-in Reunion Home organizer changes are dated 2026-05-31.
- `connect.myzolve.com` was reported by deployment metadata as an active, public autoscale deployment with a successful build. This audit did not run a production runtime smoke test.
- A hackathon-start tag or previously frozen baseline document was not present at audit time. The source commit above is the reference point for before/after attribution.

## Proposed isolated implementation

1. Keep LIFE work on `meta-2026-myzolve-life`; do not modify the production branch or production data model for the demo.
2. Build a separate mobile-responsive LIFE demo using synthetic household fixtures.
3. Keep Meta Model API calls in an isolated server-side LIFE service. Validate structured model output against a fixed schema before returning it to the UI.
4. Represent generated assignments as recommendations with short, user-facing rationales and explicit assumptions. Require a person to review, edit, and approve them; never equate a recommendation or approval with a completed action.
5. Version plans so circumstance changes can regenerate affected recommendations without silently replacing unaffected approved or completed work.
6. Cover ordinary scenarios, missing information, conflicting constraints, invalid model output, model/API failures, privacy boundaries, approval/editing, and replanning with tests and a reproducible synthetic demo.

### Model candidate

Evaluate Meta **Muse Spark 1.3** first because Meta's model documentation describes support for reasoning and structured output. Select it only after account access is verified and it performs acceptably on the synthetic test set. Do not expose private model reasoning; show concise, scenario-grounded explanations instead.

References:

- [Meta Model API models](https://developer.meta.ai/docs/models)
- [Meta Model API structured output](https://developer.meta.ai/docs/features/structured-output)
- [Meta Model API reasoning](https://developer.meta.ai/docs/reasoning)

