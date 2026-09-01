# Model Routing (runtime)

Implements [`../models/routing.yml`](../models/routing.yml) and
[`../models/risk-policy.yml`](../models/risk-policy.yml). See also ADR-005 in
[`../research/architecture-decisions.md`](../research/architecture-decisions.md).

## Tiers

`NO_AI < LOW_COST < STANDARD_CODING < ADVANCED_REASONING < CRITICAL_REVIEW`.
Concrete models are never named in code — a tier resolves to a model at the provider.

## The routing algorithm (`ModelRouter.route`)

Inputs, in priority order: `risk` (hard floor), `task_type`, `complexity`,
`context size`, `quality bar`, then cost as the tie-breaker.

1. `floor = risk_floor[risk]` from `routing.yml` (`0→NO_AI`, `1→LOW_COST`,
   `2,3→STANDARD_CODING`, `4,5→ADVANCED_REASONING`).
2. `tier = max(floor, task_type_defaults[task_type])`.
3. Raise one tier if complexity is high, the context is large, the quality bar is
   critical, or the work touches a sensitive domain.
4. Clamp to the agent's own ceiling (expressed as a tier). If the *floor* legitimately
   exceeds the agent's ceiling, that is an Engineering Director sign-off / escalation
   — the router keeps the floor and never silently lowers it.
5. The floor always wins downward. Deterministic work stays `NO_AI`.

`fallback_tier` is the agent's declared `fallback_model_tier` when it is not higher
than the chosen tier.

## Providers

`ModelRouter` is constructed with an ordered provider list. `run()` tries the chosen
tier then the fallback tier, and within each tier tries each **ready** provider in
order. If no permitted provider produces a result, it throws `ALL_PROVIDERS_FAILED`
— a block, never a silent skip.

| Provider | State in V1 |
|---|---|
| `MockModelProvider` | **Ready.** Deterministic, offline, zero cost. Serves every tier. The default. |
| `LiteLlmProvider` | `NOT_CONFIGURED`. Becomes ready when `AI_COMPANY_LITELLM_BASE_URL` + `AI_COMPANY_LITELLM_API_KEY` and the per-tier model env vars are set. Talks to an OpenAI-compatible / LiteLLM gateway with per-agent virtual keys and budgets. |

Claude Code and any subscription credential are **never** used as an automated model
backend (build spec section 12). Real Anthropic access, if added, is legitimate API
authentication through `ModelProvider`.

## Configuring a real provider later

1. The Human Founder onboards a provider and sets budgets.
2. Stand up a LiteLLM gateway; create per-agent virtual keys with hard caps.
3. Export:
   ```
   AI_COMPANY_LITELLM_BASE_URL=https://<gateway>/v1
   AI_COMPANY_LITELLM_API_KEY=<virtual-key>
   AI_COMPANY_MODEL_LOW_COST=<model>
   AI_COMPANY_MODEL_STANDARD_CODING=<model>
   AI_COMPANY_MODEL_ADVANCED_REASONING=<model>
   AI_COMPANY_MODEL_CRITICAL_REVIEW=<model>
   ```
4. `ai-company doctor` will now show `model provider: litellm  OK`.

Budgets and per-agent caps remain the gateway's job; the runtime records cost and
reports it honestly (see [`runtime-cost.md`](runtime-cost.md)).
