# LIFE synthetic demo and reliability tests

The API tests use fictional fixtures and mocked model responses. They do not call the Meta API, require a real model key, access Connect member data, or save plans.

Run the tests from the repository root:

```sh
pnpm --filter @workspace/api-server run test:life
pnpm --filter @workspace/api-server run typecheck
```

## Repeatable demo scenarios

In the LIFE demo, choose **The Rivera household** and use one of these exact descriptions:

1. **Ordinary:** `The school announces a two-day closure tomorrow while adults have overlapping work shifts.`
2. **Missing information:** `The schedule is incomplete: two adults may be working, but no hours or backup caregiver availability is confirmed.`
3. **Conflicting availability:** `The adults both say they are unavailable during the school closure, while the household asks for one of them to provide daytime supervision.`

The model may phrase its plan differently between runs. For the missing-information and conflicting-availability cases, check that it states assumptions or asks questions rather than inventing confirmed availability. Every generated action should remain a suggestion until a person approves it, and completion is a separate decision.

The automated suite checks ordinary, incomplete, and conflicting scenarios with fixed synthetic responses; malformed, truncated, and out-of-household model output; timeout/network and provider HTTP failures; fixture privacy; and protection of approved and completed tasks during selective re-planning.
