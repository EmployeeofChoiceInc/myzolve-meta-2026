---
name: Clerk session token has no email claim
description: Why DB user rows can end up with @unknown.com emails and how to get the real email
---

In this app, the Clerk session token (sessionClaims) does NOT include an
`email` claim by default — only `sub` (clerkId), `sid`, etc. Code that reads
`sessionClaims["email"]` always gets undefined and falls back to a placeholder.

**Symptom:** every `users` row gets email `${clerkId}@unknown.com`. Anything
that matches on a real email (e.g. the `VERIFICATION_ADMIN_EMAIL` admin
allow-list checked against `req.dbUser.email`) can NEVER match, so admins get
"Not authorized" even when their email is on the list.

**Why:** Clerk only puts custom claims in the session JWT if you configure a
session-token template in the Clerk dashboard. Out of the box, email is not in it.

**How to apply:** Get the real email from the Clerk **Backend API**, not the
session token: `clerkClient.users.getUser(clerkId)` → pick the address whose
`id === primaryEmailAddressId` (fallback to `emailAddresses[0]`). `requireAuth`
does this on user creation and also **heals** existing rows whose email still
ends with `@unknown.com` on their next authenticated request. Only call the
Clerk API when needed (new user or placeholder email) to avoid an API hit on
every request.

**Deploy note:** api-server runs a built bundle and the live site serves the
last *published* bundle — an auth/middleware fix like this only takes effect on
connect.myzolve.com after a republish.
