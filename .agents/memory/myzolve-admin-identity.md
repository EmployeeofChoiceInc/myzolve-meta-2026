---
name: MyZolve admin identity
description: How program-admin access is determined across MyZolve Connect (web, api, CLI).
---

# MyZolve admin identity

Admin status is determined by the comma-separated `VERIFICATION_ADMIN_EMAIL` env
allow-list (matched against the user's email), centralized in
`artifacts/api-server/src/lib/admin.ts` (`isProgramAdmin`). There is **no
`users.isAdmin` column** and **no `isAdmin` field on `/me`**.

**Why:** the circle-builder admin feature already established this env-allow-list
convention; adding a DB column would have been a parallel, inconsistent source of
truth. Reusing it kept one admin definition and avoided an openapi/contract change.

**How to apply:**
- API: gate routes with `requireAdmin` middleware (uses `isProgramAdmin`).
- Web: detect admin via the `GET /admin/check` probe (`useAdminCheck` → `.ok`),
  not a `/me` flag. Not-authorized = ApiError status 403.
- CLI (`scripts/src/comp.ts`): not gated — direct DB access is the privilege, so
  there is no `make-admin` command.
- To grant someone admin, add their email to `VERIFICATION_ADMIN_EMAIL` (do NOT
  clobber existing entries).
