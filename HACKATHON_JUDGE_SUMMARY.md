# MyZolve LIFE — Judge Summary

**Competition:** Meta Global AI Developer Hackathon 2026  
**Development window:** October 26–November 4, 2026  
**Demo:** [connect.myzolve.com/myzolve-life/](https://connect.myzolve.com/myzolve-life/)

## Before and after

| Before the hackathon | Added during the hackathon |
| --- | --- |
| MyZolve Connect already supported trusted circles, member profiles, requests, service exchanges, messages, events, notifications, and paid features. | MyZolve LIFE is a separate, mobile-responsive family-resilience planning demo. |
| Connect’s co-pilot let an authorized person help another member; it was a human workflow, not an AI agent. | LIFE uses Meta Muse Spark 1.3 through a server-side API call to turn a disruption scenario into structured suggestions, assumptions, and questions. |
| The baseline app had no AI-generated resilience plans or circumstance-driven replanning. | People can edit suggestions, approve them, mark approved tasks complete, and selectively ask the model to revisit unapproved suggestions when circumstances change. |
| The baseline did not include a Meta Model API client. | LIFE validates structured model output and rejects invalid plans or assignments to people outside the selected fictional household. |

The distinction between pre-existing Connect functionality and new LIFE work is documented in [`BASELINE.md`](./BASELINE.md) and [`HACKATHON_CHANGELOG.md`](./HACKATHON_CHANGELOG.md). Connect continuity-packet and billing changes are separate product work and are not presented as the LIFE AI contribution.

## Reproducible demo

1. Open the public demo and select **The Rivera household**.
2. Enter this ordinary scenario:

   > The school announces a two-day closure tomorrow while adults have overlapping work shifts.

3. Review the generated suggestions and their explanations. Edit a suggestion, approve it, and mark an approved task complete to show that those are distinct decisions.
4. Open **Circumstances changed?**, select only an unapproved suggestion, and explain a change such as an adult’s work shift being cancelled. Show which suggestions changed and which were kept.
5. To demonstrate ambiguity handling, use either scenario:
   - **Missing information:** “The schedule is incomplete: two adults may be working, but no hours or backup caregiver availability is confirmed.”
   - **Conflicting availability:** “The adults both say they are unavailable during the school closure, while the household asks for one of them to provide daytime supervision.”

The public fixtures endpoint currently returns two fictional households and three sample scenarios. Exact prompts and automated-test coverage are in [`artifacts/api-server/LIFE_TESTING.md`](./artifacts/api-server/LIFE_TESTING.md).

## Safety and scope

- Use only the supplied fictional households. Do not enter real family, contact, or medical details.
- LIFE does not read or write Connect member data, and it does not persist plans. Edits and decisions remain in the browser session.
- Model calls stay on the API server; the Meta key is not sent to the browser.
- Suggestions are not actions: approval and completion are separate. Approved and completed tasks cannot be replaced during selective replanning.
- This is a planning aid, not emergency, medical, or professional advice. Check assumptions and use trusted local guidance.

## Verification and final pre-demo check

- Last checked November 1, 2026: the LIFE API suite passed **17/17** tests and the API typecheck passed. The Connect web typecheck passed during the earlier readiness check.
- Automated model tests use fixed mock responses. Following repeated incomplete model responses in production, all three supplied scenarios returned HTTP 200 against the corrected development API. After republishing, a live public storm-scenario request also returned HTTP 200 with five suggested tasks, three assumptions, and four clarification questions. The other two production scenarios were not re-run.
- The public LIFE page and its fixture endpoint were reachable during the final check.
