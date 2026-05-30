---
name: Artifact prod build needs platform env
description: Web artifact vite build fails standalone without injected env vars
---

Running `pnpm --filter @workspace/<web-artifact> run build` from the shell fails
at vite config load with "PORT environment variable is required" and then
"BASE_PATH environment variable is required". These are injected by the
platform's workflow/deploy runner, not present in a bare shell.

**Rule:** don't treat a failed standalone prod build as a code defect. Verify
artifact code via `run typecheck` + the running dev workflow instead.

**Why:** the vite config hard-requires PORT and BASE_PATH for path-based routing;
the deploy pipeline supplies them.
