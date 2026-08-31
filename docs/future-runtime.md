# Future Runtime (NOT built in this phase)

The **AI Software Company Agent Runtime** is the single authorized next phase, to
begin only after Human Founder review of this repository. This document is its
starting brief. Nothing here is implemented.

## What it would accomplish

Turn the static organization in this repository into a running system: agents that
execute the workflows, obey the policies, route through the model tiers, and stop for
Human Founder approval on every critical action — all observable and audited.

## Required primitives (from the constitution and build spec)

1. **Gated workflow execution** — run `workflows/*.yml` as ordered, typed steps with
   `PASS` / `FAIL` / `BLOCKED` outcomes and a project state machine.
2. **Durable human-in-the-loop** — pause a run for hours or days awaiting Human
   Founder approval, then resume deterministically. The single most important
   primitive.
3. **Default-deny action authorization** — before every tool call, evaluate
   `(agent, capability, resource, risk)` against `policies/` (default deny) and emit
   a decision log. Candidate: OPA/Rego.
4. **Per-agent model access + budget** — all model calls egress through a gateway
   (LiteLLM) with per-agent virtual keys, tier-based fallback chains, and hard cost
   caps that auto-pause on breach.
5. **Isolated execution** — engineer agents edit and run code in a sandbox; microVM
   isolation (E2B-style) for anything network-connected running generated code.
6. **Audit + observability** — every significant action → an append-only audit event
   (`schemas/audit-event.schema.json`); OpenTelemetry spans for agent, model, tool,
   workflow, cost, latency, retry, error, success, approval, deployment, incident.
7. **Checkpoint / resume of the whole run** — survive process restarts.
8. **Structural reviewer independence** — guarantee the reviewer agent
   instance/context is separate from the implementer's.

## Recommended shape

A **thin custom orchestrator** over a durable-execution engine. Framework shortlist
(decide at phase start, driven by runtime language):

- **TypeScript** (matches the engineering department's stack and the future product):
  **Mastra** for deterministic workflows + suspend/resume + built-in evals, optionally
  on **Trigger.dev** for durable execution; **E2B** sandboxes.
- **Python** (matches most agent frameworks): **LangGraph** for the checkpointer +
  `interrupt()` model; **OpenHands' runtime** or **E2B** sandboxes.

**Always build ourselves** (no framework provides these): the OPA-backed default-deny
authorization layer, the audit ledger, the human-approval ledger, per-agent budget
enforcement, and the reviewer-independence guarantee.

Full comparison: [`../research/runtime-comparison.md`](../research/runtime-comparison.md).

## Observability contract (define now, run then)

The runtime emits **only OTLP** (OpenTelemetry). Spans/metrics for: agent, model,
task, workflow, tool call, cost, latency, retry, error, success, approval,
deployment, incident. The OTel Collector redacts secrets and PII before export. Any
backend (Langfuse or otherwise) is then a swappable consumer. See ADR-013.

## Open questions for the Human Founder

1. Runtime language: TypeScript or Python?
2. Any cloud commitment? (Affects MS Agent Framework, E2B self-host, OpenTofu
   targets, and the secrets proxy deployment.)
3. Which model providers get accounts and budgets, for the tier-to-model mapping?
4. Is a dedicated compliance/privacy role wanted before Cleaning Commerce handles
   real customer PII?

## Explicitly out of scope for the runtime phase

Cleaning Commerce, any commerce platform selection, marketing/ops agents, CRM/ERP,
production cloud infrastructure, mobile apps, payment integration.
