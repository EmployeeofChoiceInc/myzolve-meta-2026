---
name: isOrgMain circle list filtering
description: Why the org main circle must be filtered client-side (not server-side) from the circles list.
---

# isOrgMain circle list filtering

## The rule
Filter `isOrgMain` circles from UI views that show "personal circles" (e.g. the Circles page "Your circles" grid) **client-side only**. Never exclude them globally from `GET /circles`.

**Why:** `GET /circles` is consumed by dashboard, mobile home, plus, settings, and year-recap — all of which use `circles.length === 0` to trigger onboarding redirects and `circles[0]` for primary actions. A reunion-only member (no personal circles) would be wrongly sent to onboarding, and the already-published mobile app would break immediately since its binary can't be patched server-side.

**How to apply:**
- Add `isOrgMain` to `circleToApi` response (additive, safe).
- In the specific view that needs dedup, filter with a cast: `circles.filter(c => !(c as { isOrgMain?: boolean }).isOrgMain)`.
- The Circles page `circles.tsx` already does this for "Your circles" grid.
- Dashboard, mobile home, plus, settings must continue to receive all circles.
