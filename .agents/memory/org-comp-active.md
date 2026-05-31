---
name: Org comp must override seat-active checks
description: Why comped orgs need explicit handling anywhere org "active"/billing UI is derived
---

A whole-org complimentary grant (comps table, target_type=org) only changes
*entitlement* — it does NOT change `orgs.status` (stays "pending"). Member Plus
works because `getOrgEntitlement`/`isPlus` OR-in comped org ids. But any surface
that derives "is this org active / paid" from `isOrgSeatActive(org)` alone will
ignore the comp, because that helper only looks at Stripe `status`
(active/past_due-in-grace).

**Why:** the org dashboard showed "Pending" + a "Complete checkout" button for a
comped org, risking an accidental Stripe charge for a non-technical founder who
had already been granted free access.

**How to apply:** whenever you compute an org's active/paid state for UI or
billing actions, OR-in the comp (`isOrgComped` / `getActiveOrgCompIds`). Concretely:
the org API payload carries both `isActive` (= seat-active OR comped) and a
separate `comped` flag; the checkout AND portal endpoints hard-block comped orgs
server-side so no Stripe session can be created. If you add a new org-billing
surface, replicate both the comped UI branch and the server-side guard.
