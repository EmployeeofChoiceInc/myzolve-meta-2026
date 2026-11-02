---
name: GitHub integration vs. Git pane
description: Distinguish Replit's GitHub API integration from Git remotes used to share repository branches.
---

GitHub API access through Replit integrations and GitHub remotes configured in the Replit Git pane are separate. An authorization or `addIntegration` result does not guarantee that the API row is callable; use `searchIntegrations` status as the source of truth and do not fetch credentials or call the API until it is `ready`. Replit-internal `gitsafe` and `subrepl` remotes are not shareable repository URLs.

**Why:** A GitHub connection was authorized and attached, but the API row remained `connect`; the workspace had no external remote to share.

**How to apply:** For GitHub API operations, wait for a `ready` API row and read its integration skill. For pushing a project branch, connect a GitHub repository through the Replit Git pane and push the intended branch there.
