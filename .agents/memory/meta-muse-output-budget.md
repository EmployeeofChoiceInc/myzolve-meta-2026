---
name: Muse Spark structured-output budgets
description: Token-budget behavior when requesting schema-constrained Muse Spark outputs.
---

Muse Spark's internal reasoning consumes the same completion-token budget as the visible structured response. A small output schema does not guarantee a small completion. When generating JSON plans, allow sufficient completion-token headroom and check the provider finish reason before parsing or returning the content; `finish_reason: "length"` means the response may be truncated and must not be treated as a valid plan.

**Why:** Live Muse Spark 1.3 tests returned HTTP 200 but truncated JSON when internal reasoning exhausted the configured completion-token limit.

**How to apply:** In LIFE model requests, validate both completion status and schema. Retry only with an explicit budget policy; never pass partially generated JSON to the plan UI.

Keep LIFE model calls single-attempt by default; do not silently add automatic retries as a reliability fix.

**Why:** Every retry can consume additional Meta API quota. More completion headroom and concise output instructions can address exhaustion without hidden duplicate calls.

**How to apply:** If retries are introduced later, make the maximum attempts and usage tradeoff explicit, and continue rejecting incomplete output.
