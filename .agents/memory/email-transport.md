---
name: Email sending transport
description: How transactional email is sent (Gmail connector), config, and gotchas
---

Transactional email (`artifacts/api-server/src/lib/email.ts`, `sendEmail`) sends
via the Replit **google-mail** (Gmail) connector by default, not Resend.

**Why:** The team had no Resend account / verified domain and didn't want to pay.
They use Google Workspace (info@employeeofchoice.com), so sending *through* their
Gmail account is free, needs no domain DNS verification, and applicants receive
mail from a real human address. `RESEND_API_KEY` was never set, which is why the
old Resend-only path was a silent no-op (it logs and returns ok without sending).

**How it works / how to apply:**
- Uses `@replit/connectors-sdk` (CommonJS): `new ReplitConnectors().proxy("google-mail", "/gmail/v1/users/me/messages/send", { method:"POST", body: JSON.stringify({ raw }) })`. The `raw` is a base64url-encoded RFC 2822 multipart/alternative message.
- The proxy returns a fetch-style Response — check `.ok`/`.status`, call `.text()`/`.json()` to read the body.
- Config env: `EMAIL_FROM` (shared) is the From header, set to the connected Google account, e.g. `MyZolve Connect <info@employeeofchoice.com>`. Gmail sends as the authenticated account regardless. `EMAIL_TRANSPORT=resend` forces the Resend fallback (only if `RESEND_API_KEY` is set).
- esbuild **bundles** the SDK fine (pure HTTP client) — no need to externalize it.
- The connector SDK resolves env injected by Replit; to test ad-hoc, run a script from inside `artifacts/api-server/` (so node finds its node_modules), not from the repo root or /tmp.

**Deploy note:** email changes only take effect on the live site after a republish.
