---
name: Mobile artifact development workflow
description: A Replit-managed Expo artifact may need its dev script run directly from the artifact workspace.
---

For the MyZolve Connect mobile artifact, use `pnpm run dev` as the managed development command from the artifact directory instead of `pnpm --filter @workspace/myzolve-connect-mobile run dev`.

**Why:** The managed workflow exited with “No projects matched the filters” even though the package filter worked in direct shell checks; running the package script directly started Metro and served the Expo web preview.

**How to apply:** If the mobile artifact workflow fails at package filtering, verify its working directory and use the artifact-local package script. Keep production build and serve commands unchanged unless they show the same failure.
