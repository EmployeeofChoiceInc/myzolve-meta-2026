---
name: Orval query hooks need queryKey
description: Generated react-query hooks reject query options that omit queryKey
---

When calling a generated orval query hook conditionally, e.g.
`useGetOrgDashboard(orgId, { query: { enabled } })`, typecheck fails with
"Property 'queryKey' is missing" because the `query` slot is typed as
`UseQueryOptions` where `queryKey` is required.

**Rule:** pass the generated key alongside `enabled`:
`{ query: { enabled, queryKey: getGetOrgDashboardQueryKey(orgId) } }`.

**Why:** the hook only auto-fills queryKey when no `query` object is passed;
once you pass `query`, you own the whole options object and must supply queryKey.

**How to apply:** every conditional query in the web + mobile apps uses this
pattern (see `pages/wall.tsx`, mobile `invite/[token].tsx`). Import the
`getX...QueryKey` named export from `@workspace/api-client-react`.
