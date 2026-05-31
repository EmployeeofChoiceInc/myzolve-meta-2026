---
name: Org/Reunion group space model
description: Architectural invariants for treating a Reunion (Org) as a Circle-backed group space.
---

# Org/Reunion as a group space

Each Org (Reunion) is backed by Circle infrastructure rather than a parallel feature set: every org owns one auto-created "main circle" plus admin-created sub-circles, all tagged with the org id.

**Invariant 1 — free-cap exemption.** Org-scoped circles must NEVER count against the personal free circle cap (`FREE_CIRCLE_LIMIT`).
**Why:** members would be wrongly blocked from joining reunions once they hit their personal limit.
**How to apply:** any code that counts a user's circles for billing/limits must exclude circles whose org id is set.

**Invariant 2 — org membership gates org-circle access.** A user may only hold membership in an org-scoped circle while they are an active member of that org.
**Why:** reunion circles carry private wall/calendar/care data; broken access control here is a security issue (flagged in review).
**How to apply:** guard every circle-membership *grant* path (invite create + accept, join-request approve, any direct add/reactivation) — if the circle is org-scoped, require active org membership for the target user. And every org-member *removal/deactivation* path must revoke that user's memberships across the org's main + sub-circles in lockstep.
