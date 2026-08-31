# Runtime Comparison

The Agent Runtime is **not built in this phase.** This document compares candidates so
the next phase starts from a decision, not a blank page.

## What the runtime must provide

Derived from the constitution and the build spec:

1. **Gated workflow execution** — run `workflows/*.yml` as ordered, typed steps with
   pass/fail/blocked outcomes and a project state machine.
2. **Durable human-in-the-loop** — pause a run for hours/days awaiting Human Founder
   approval, then resume deterministically. This is the single most important
   primitive.
3. **Default-deny action authorization** — before any tool call, check
   `policies/agent-permissions.yml` + risk policy; deny unless explicitly allowed;
   emit a decision log.
4. **Per-agent model access + budget** — route via the model gateway with per-agent
   virtual keys, tier-based fallback, and hard cost caps.
5. **Isolated execution** — engineer agents edit and run code in a sandbox; strong
   isolation (microVM) for anything network-connected running generated code.
6. **Audit + observability** — every significant action → an audit event; OTel spans
   for agent/model/tool/workflow/cost/latency/approval/deployment.
7. **Checkpoint / resume of the whole run** — survive process restarts.
8. **Reviewer independence** — the runtime must be able to guarantee the reviewer
   agent instance/context is separate from the implementer's.

## Candidates

| Dimension | LangGraph | Mastra | Agno | MS Agent Framework | crewAI | Build-from-scratch |
|---|---|---|---|---|---|---|
| Language | Python (+JS) | TypeScript | Python | Python + .NET | Python | our choice |
| Durable HITL interrupt | First-class (checkpointer + `interrupt()`) | First-class (workflow suspend/resume) | Present, less proven | Present (checkpoints) | Basic | must build |
| Deterministic gated workflow | Graph + conditional edges | Deterministic workflow API | Workflows API | Typed workflows | Flows (Crews too loose) | must build |
| Checkpoint/resume | Strong, time-travel | Strong (snapshots) | Session/workflow state | Yes | Weak | must build |
| Auth / permission model | none (write in nodes) | none (write in steps) | tool-level | platform identity (Entra) | tool-level | must build |
| Model gateway integration | via LiteLLM/any | via AI SDK | model-agnostic layer | Azure-leaning | via LiteLLM | via LiteLLM |
| Observability | OTel + LangSmith | OTel-based | built-in + OTel | OTel-native | integrations | must build |
| Execution sandbox | bring your own | bring your own | bring your own | bring your own | bring your own | bring your own |
| License | MIT (SaaS optional) | Apache/Elastic (verify) | MPL-2.0 (verify) | MIT | MIT | n/a |
| Lock-in risk | low (lib) / med (platform) | low/med (AI SDK) | low/med (AgentOS) | med/high (Azure) | low | none |
| Maturity for production HITL | highest | high | medium | medium | medium | lowest |
| Fit with our TS engineering stack | mismatch | match | mismatch | mismatch | mismatch | match |

The auth/permission layer is **not provided by any framework** — we build it
regardless, backed by OPA/Rego, sitting in front of every tool call.

## Recommendation for the next phase

**Primary recommendation: a thin custom orchestrator built on a durable-execution
engine, with the framework choice narrowed to LangGraph or Mastra.**

- If the runtime is **TypeScript** (matches the engineering department's stack and
  the future product): **Mastra** for workflow + suspend/resume + built-in evals,
  optionally on **Trigger.dev** for durable execution; sandboxes via **E2B**.
- If the runtime is **Python**: **LangGraph** for the checkpointer + `interrupt()`
  model; sandboxes via **OpenHands' runtime** or **E2B**.
- **Do not** adopt CrewAI's autonomous-crew mode, MAF's Foundry-hosted path, or
  Agno's AgentOS as the control plane in v1 — revisit later.
- **Always build ourselves:** the default-deny authorization layer (OPA), the audit
  ledger, the human-approval ledger, per-agent budget enforcement (LiteLLM keys),
  and reviewer-independence guarantees.

Decision owner: Human Founder + AI Engineering Director, at the start of the Agent
Runtime phase. This document is the starting input.
