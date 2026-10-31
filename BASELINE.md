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

The inspected application source contains no MyZolve LIFE scenario intake, AI-generated resilience plan, AI-proposed task assignments, plan approval/editing flow, circumstance-driven replanning, or Meta Model API client. The initial baseline audit did not identify Meta/Muse API configuration or an integration, so account access was **unverified at that point**. A later access check and synthetic plan evaluation are recorded below and in `HACKATHON_CHANGELOG.md`; no model client or product feature was added to the baseline application.

The LIFE demo should use synthetic households and scenarios. It must not use production member data without a separately approved, privacy-reviewed integration.

## LIFE demo implementation status — 2026-10-31

- Added a separate `myzolve-life` web artifact for the synthetic resilience demo; the MyZolve Connect web and mobile artifacts and production data model remain unchanged.
- The API serves two fixed fictional households and three sample scenarios. The plan endpoints accept only those household IDs; there is no read or write path to Connect member records.
- Meta Muse Spark 1.3 calls run only in the API server, use the `MODEL_API_KEY` secret, request strict structured output, and validate the result and every assigned member before returning it.
- Re-planning is limited to selected suggested tasks. The API merges new suggestions into the current plan while retaining unselected tasks as supplied; approved and completed tasks cannot be selected for replacement.
- Editing, approval, completion, and plan state are held in the browser session only. The demo does not persist plans or modify the Connect database.
- The web interface labels the data synthetic, warns against entering real personal or medical details, and separates suggestions, approvals, and completed actions.

See `HACKATHON_CHANGELOG.md` for the implementation record.

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

## Post-baseline Meta Model API access check

On 2026-10-31, a secured `MODEL_API_KEY` was used for live requests to `https://api.meta.ai/v1/chat/completions` with model ID `muse-spark-1.3`. All three completed synthetic scenarios returned HTTP 200 and passed local validation against the same strict JSON Schema. Scenarios covered a caregiver's unexpected hospitalization, a two-day school closure with overlapping work schedules, and conflicting caregiver availability. The conflict case returned clarification questions rather than inventing availability.

This confirms that the supplied key can access Muse Spark 1.3 from this workspace at the time of the check. It does not establish that another Meta account has access, guarantee ongoing availability, or add a Meta integration or application-side client. The key remains in Replit Secrets; it was not written to source, logs, or this document. No Connect code or production behavior was changed.

Meta's published Standard-tier limits for Muse Spark 1.3 are 3,000 requests per minute and 4,000,000 tokens per minute per team/model. Its published context window is 1,048,576 tokens. Published Standard pricing is $1.25 per 1M input tokens, $0.15 per 1M cached input tokens, and $4.25 per 1M output tokens. Actual account billing and access policy should be checked in Meta's Model API dashboard. The test responses exposed a request-limit header of 3,000; no rate-limit error occurred. Meta documents HTTP 401 for missing/invalid/revoked credentials, 403 for insufficient permissions, 402 for billing requirements, 429 for rate limiting (honor `Retry-After`), and 5xx/503/504 service errors as retry candidates according to its error-handling guidance.

API setup steps: sign in to the [Meta Model API dashboard](https://developer.meta.ai/), create a key under **API keys**, and save it as the Replit Secret `MODEL_API_KEY`. Send it only as a Bearer token to the API; never put it in source or a client bundle. Meta currently documents structured output via `response_format` with `type: "json_schema"` and a schema; recursive schemas are not supported.

Test harness note: an initial request capped at 300 completion tokens ended with `finish_reason: length`; the school-closure scenario also truncated at a 1,400-token cap. These were incomplete model responses, not authentication or provider errors. Retrying that case with a 3,000-token cap completed and passed schema validation. Keep a sufficient completion budget and reject/handle truncated JSON rather than returning it as a plan.

