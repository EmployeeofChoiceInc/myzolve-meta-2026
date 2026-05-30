---
name: TS project refs rebuild after codegen
description: Generated client libs must be rebuilt before dependents typecheck
---

This monorepo uses TS project references. After regenerating the API client
from `lib/api-spec/openapi.yaml` (`pnpm --filter @workspace/api-spec run codegen`),
the source under `lib/api-client-react` / `lib/api-zod` changes but dependents
(web, mobile) consume the built `.d.ts`/`.js`.

**Rule:** after codegen, run `npx tsc -b lib/api-client-react lib/api-zod --force`
(and `npx tsc -b lib/db --force` after any drizzle schema change) before
typechecking web/mobile/api-server.

**Why:** without the rebuild, dependents see stale generated types and either
miss new fields or fail to resolve new hooks.
