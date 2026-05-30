---
name: api-server runs a built bundle, not watch
description: Why new api-server routes/code don't appear until you restart its workflow
---

The `artifacts/api-server: API Server` workflow runs an esbuild **production
bundle** (`build && start`), not a tsx/ts-node watch process.

**Why:** New or changed routes/code in `artifacts/api-server/src` do NOT hot-reload.
The running process keeps serving the previously-bundled code until rebuilt.

**How to apply:** After editing api-server source, restart the
`artifacts/api-server: API Server` workflow before smoke-testing. The server
listens on `PORT` (observed 8080 in dev) and mounts the router at `/api`
(`app.use("/api", router)` in `app.ts`). The web app reaches it via
platform-level `/api` routing — there is no vite proxy in
`artifacts/myzolve-connect/vite.config.ts`.
