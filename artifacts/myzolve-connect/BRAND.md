# MyZolve Connect — Brand Tokens

MyZolve Connect is a **sub-brand of MyZolve**. It deliberately uses a warmer,
softer visual identity than the parent brand because the product lives in an
intimate, family/trusted-circle context where cold "fintech" energy would
undermine trust. This document captures the small set of tokens that make
that warmth feel consistent so future contributors don't drift.

## Shared identity with MyZolve

Sign-in is shared across the MyZolve ecosystem. Both
`connect.myzolve.com` and `myzolve.com` are backed by the **same**
Clerk instance, so a single MyZolve account carries the user into
Connect (and the mobile app) seamlessly. Connect's Clerk instance is
the canonical one. See `docs/shared-auth.md` for the architecture and
the Clerk Dashboard checklist; do not introduce a second Clerk
instance or alternative auth provider for Connect.

## The "by MyZolve" mark

Every public surface (landing, sign-in, sign-up, invite, 404, privacy,
terms) carries a footer with:

- The MyZolve Connect heart wordmark
- The phrase **"a sub-brand by MyZolve"** linking to `https://myzolve.com`
- Privacy and Terms links

Implementation: `src/components/site-footer.tsx`. Re-use this component
rather than rebuilding ad-hoc footers.

## Palette

Defined in `src/index.css` as HSL CSS variables. Reference colors via the
Tailwind tokens (`bg-primary`, `text-foreground`, etc.) — never hard-code
hex values in components.

| Token              | HSL                | Use                                    |
| ------------------ | ------------------ | -------------------------------------- |
| `--background`     | `40 33% 98%`       | Warm off-white page background         |
| `--foreground`     | `24 20% 15%`       | Deep warm gray body text               |
| `--primary`        | `16 75% 55%`       | Terracotta — CTAs, brand accents       |
| `--secondary`      | `115 25% 45%`      | Sage green — confirmations, success    |
| `--muted`          | `35 30% 94%`       | Soft warm surface                      |
| `--accent`         | `35 40% 90%`       | Cream highlight (callouts, badges)     |
| `--destructive`    | `0 70% 50%`        | Errors only — use sparingly            |
| `--card`           | `0 0% 100%`        | Card surface                           |

Dark-mode counterparts live in the same file under `.dark`.

## Typography

- Family: **Plus Jakarta Sans** (loaded from Google Fonts in `index.html`).
- Weight scale used in product: 400 (body), 500 (UI labels), 600
  (subheadings), 700 (headings).
- Headings get `tracking-tight`. Body copy stays at default tracking and
  uses `leading-relaxed` in marketing/legal contexts.

## Shape & motion

- Default radius is `1rem` (`--radius`). Buttons frequently round to
  full pills (`rounded-full`).
- Cards lean on `rounded-3xl` for a softer silhouette.
- No emoji in product UI. Icon library is `lucide-react`.

## Voice

Reinforces the warm tone. Use: *support, help, request, return, complete,
contribute, offer, share, trusted circle*. Never use: *debt, overdue,
delinquent, late fee, penalty, balance due*. See `replit.md` for the full
language rules.

## Analytics

Plausible is wired up in `src/lib/analytics.ts` and only loads when
`VITE_PLAUSIBLE_DOMAIN` is set at build time. The dashboard lives at
`https://plausible.io/<that domain>` (e.g.
`https://plausible.io/connect.myzolve.com`). See `replit.md` →
"Public-Launch Notes" for full setup details.

## When to introduce a new color

Don't. If you need a new shade, add a CSS variable to `:root` and
`.dark` in `src/index.css` and expose it via the `@theme inline` block so
Tailwind picks it up. This keeps the warmth coherent across surfaces.
