# Model System

Provider-independent by design (Constitution Article 13). Cost-minimizing by mandate
(Article 11).

## Files

| File | Purpose |
|---|---|
| `models/tiers.yml` | Five conceptual tiers (validated against `schemas/model-tier.schema.json`) |
| `models/routing.yml` | How a task is mapped to a tier |
| `models/risk-policy.yml` | The 0–5 risk scale that drives routing, review depth, and approval |
| `policies/model-routing.yml` | Governance wrapper (who may change routing, hard constraints) |
| `policies/cost.yml` | Budgets, retries, cost visibility |

## Tiers

| Tier | Intent | Cost |
|---|---|---|
| `NO_AI` | No model call — ordinary software | none |
| `LOW_COST` | Cheap, fast; low-stakes text | very-low |
| `STANDARD_CODING` | Everyday implementation and tests | medium |
| `ADVANCED_REASONING` | Architecture, hard debugging, trade-offs | high |
| `CRITICAL_REVIEW` | High-consequence review, security judgment | highest |

Concrete model names are **illustrative only** and live in the model gateway's
config, never in this repository. Each tier should be satisfiable by at least two
providers.

## Routing

Inputs, in priority order: **risk level** (a hard floor), task type, complexity,
context size, quality bar, then cost as the tie-breaker.

`risk_floor` (minimum tier per risk level): 0→`NO_AI`, 1→`LOW_COST`,
2–3→`STANDARD_CODING`, 4–5→`ADVANCED_REASONING`. Task signals may raise the tier,
never lower it below the floor. RISK 5 additionally requires a `CRITICAL_REVIEW`
review step **and** the Human Founder.

Escalation ladder on failure: retry twice at tier → once at the next tier → escalate
to a human. Never unbounded.

## Risk scale (summary)

| Risk | Model tier | Review | Human Founder |
|---|---|---|---|
| 0 | `NO_AI` | automated only | no |
| 1 | `LOW_COST` | peer/automated | no |
| 2 | `STANDARD_CODING` | independent code review | no |
| 3 | `STANDARD_CODING` (design at `ADVANCED_REASONING`) | code review + QA | notified |
| 4 | `ADVANCED_REASONING` (review at `CRITICAL_REVIEW`) | code review + QA + security | approves the release |
| 5 | `ADVANCED_REASONING` + mandatory `CRITICAL_REVIEW` | full + Release Manager verification | **required before execution** |

RISK 5 domains: authentication, authorization, payments, critical DB migrations,
production infrastructure, customer-data security/export/deletion, financial
operations, ad-budget changes, bulk customer messaging, access-control escalation,
critical security architecture, production deployment, merge to main, secret changes.

## Model operations

Owned by the `model-operations-engineer` (see `docs/organization.md`). Runs the model
gateway (LiteLLM) with per-agent virtual keys + budgets + fallback chains, owns the
prompt/agent eval gate (promptfoo), and collects model-call cost/latency/quality
telemetry (OpenTelemetry GenAI conventions). Budget values are `PLANNED` until the
Human Founder onboards providers.
