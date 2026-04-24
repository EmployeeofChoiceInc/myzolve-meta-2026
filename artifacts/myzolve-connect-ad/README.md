# MyZolve Connect Ad

Vertical 9:16 brand video for MyZolve Connect, with three render variants
served from the same artifact:

| Cut    | URL                | Duration | Use                                          |
| ------ | ------------------ | -------- | -------------------------------------------- |
| Master | `/`                | ~25.5s   | Organic Reels / TikTok / Shorts placements   |
| 15s    | `/?cut=15s`        | 15.0s    | Instagram Stories ads, TikTok ads, IG/FB ads |
| 6s     | `/?cut=6s`         | 6.0s     | YouTube bumper ads, TikTok Spark, IG bumpers |

The 15s and 6s cuts render a bare `VideoTemplate` (no controls chrome) so
the recording pipeline captures exactly that cut's duration. The master
cut at `/` keeps the existing `VideoWithControls` UI for in-browser
review.

All three cuts share the same scene components, brand voice
(no "debt / owe / overdue" language), color tokens, and end on the
MyZolve Connect heart logo + wordmark + "a sub-brand by MyZolve" +
"For families and trusted circles" lockup.

## Cut composition

- **Master**: hook → problem → product → payoff → outro
- **15s**: hook → product → outro
- **6s**: product → outro
