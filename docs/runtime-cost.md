# Runtime Cost

Implements [`../policies/cost.yml`](../policies/cost.yml) and the budgets section of
[`../models/routing.yml`](../models/routing.yml).

## Principles

- **Ordinary software over models.** RISK 0 / `NO_AI` work makes no model call at all.
- **Cheapest adequate tier.** The router never picks a higher tier "to be safe".
- **Honesty over precision.** When a provider does not report a cost, the record is
  stored with `cost_known = false` and the number stays `null`. The runtime never
  invents a cost.
- **Unconfigured budgets are `NOT_CONFIGURED`, not a placeholder.** `routing.yml`
  ships budget keys with the value `PLANNED`; the runtime reports them as
  `NOT_CONFIGURED` until the Human Founder sets real numbers during provider
  onboarding.

## What is recorded (`CostAccounting`)

Per model call: `provider`, `model`, `agent_id`, `task_id`, `run_id`, `workflow_id`,
`input_tokens`, `output_tokens`, `estimated_cost_usd` (or `null`), `duration_ms`,
`cost_known`.

`CostAccounting.summary()` aggregates: total known cost, count of unknown-cost calls,
calls per agent, calls per model, and the budget status.

## In V1

The `MockModelProvider` genuinely costs **zero**, so the proof run reports
`total_known_cost_usd: 0` with `budgets_configured: false`. That is accurate, not a
stub.

## Configuring budgets later

1. Onboard a provider; stand up a LiteLLM gateway.
2. Set real values in `models/routing.yml` under `budgets`
   (`per_task_soft_cap_usd`, `per_task_hard_cap_usd`, `per_agent_daily_cap_usd`,
   `per_workflow_cap_usd`) — this is a governance change reviewed by the Human Founder.
3. Enforce the hard caps at the gateway via per-agent virtual keys; a breach
   auto-pauses the run (`ai-company pause`) and notifies the Engineering Director and
   the Human Founder.
4. `CostAccounting.summary().budgets_configured` becomes `true` and the real numbers
   are surfaced by the runtime.
