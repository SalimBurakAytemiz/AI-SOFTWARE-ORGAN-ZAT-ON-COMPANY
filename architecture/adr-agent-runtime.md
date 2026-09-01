# ADR-0014: Agent Runtime V1.0 — language, framework, and architecture

- **Status:** ACCEPTED
- **Date:** 2026-08-31
- **Deciders:** solution-architect + engineering-director (proposers); Human Founder (approver at review of Agent Runtime V1.0)
- **Risk level:** 4
- **Workflow:** architecture-change (Agent Runtime V1.0 milestone)

## Context

Organization V1.0 defined the company as validated configuration. The Agent Runtime
must *execute* that configuration: load the 18 agent definitions, 22 skills, tool +
capability registries, model tiers, 9 gated workflows and 14 policies, then coordinate
the right roles, models, tools, reviews and approvals for a Human Founder task —
without any agent being able to bypass Human Founder approval on a critical action.

Constraints, from the constitution, the research dossier and the build spec:

- **Human authority, least privilege, auditability, security** take priority over any
  other consideration.
- The acceptance test suite must run **without any paid AI API key**, without a cloud
  account, without an external database, and without production GitHub writes.
- **Minimize dependencies.** One runtime foundation, wrapped. No installing five agent
  frameworks. Every dependency must have a real use in V1.
- **Avoid framework lock-in.** The company's own runtime interfaces must wrap
  framework-specific functionality.
- Durable human-in-the-loop (pause for hours/days, resume deterministically) is the
  single most important primitive (`research/runtime-comparison.md`).
- The default-deny authorization layer, audit ledger, human-approval ledger and
  per-agent budget enforcement are **not provided by any framework** — the research
  already concluded we build these ourselves regardless of framework (ADR-009).

In scope: the runtime, its CLI, its persistence, its tests, one safe proof workflow.
Out of scope: Cleaning Commerce, production infrastructure, real model API usage, any
production deployment, a hosted control plane.

## Options considered

### Option A — TypeScript, thin custom orchestrator on the Node platform, framework-adapter seams

- **Summary:** Runtime language TypeScript, executed natively by Node.js 22+ (type
  stripping — no build step). The orchestrator, workflow engine, policy engine,
  capability gateway, approval engine, audit ledger, state store, model-provider
  abstraction and cost accounting are all first-party code behind narrow interfaces.
  Mastra, LiteLLM, Trigger.dev, E2B, Daytona, Langfuse and OPA are integrated later
  as **adapters behind those interfaces** (`WorkflowEngine`, `ModelProvider`,
  `StateStore`, `Sandbox`, `Observability`), never as the control plane.
- **Pros:**
  - Matches the engineering department's declared stack (every engineer agent lists
    TypeScript) and the future Cleaning Commerce ecosystem — one language for
    runtime, product backend/frontend and tests.
  - Smallest possible dependency surface: three runtime libraries (`yaml`, `ajv`,
    `ajv-formats`), zero native modules. Persistence is the built-in `node:sqlite`;
    the test runner is the built-in `node:test`.
  - The governance-critical logic (authz, approvals, audit, reviewer independence) is
    ours, readable, and directly unit-testable — exactly what the research said we
    must own.
  - No framework lock-in by construction: there is no framework in V1 to be locked
    into, and the adapter seams are defined and documented.
  - Runs offline, in Codespaces, with no API keys — the MockModelProvider is the
    default provider.
- **Cons / risks:**
  - We implement workflow suspend/resume and checkpointing ourselves (mitigated: the
    workflows are simple typed state machines already fully specified in
    `workflows/*.yml`; the state store is a well-understood pattern).
  - No built-in agent-loop / tool-calling harness for real LLMs yet (acceptable: V1's
    job is to prove routing, gating, permissions, approvals, persistence and audit —
    not to run real developers; the `AgentRunner` + `ModelProvider` seam is where a
    real harness or Mastra plugs in for V1.1).
  - `node:sqlite` is marked experimental in Node 22–24 (mitigated: it is API-stable,
    behind the `StateStore` interface, and swappable for `better-sqlite3` or Postgres
    with no orchestrator change).

### Option B — TypeScript on Mastra as the control plane

- **Summary:** Adopt Mastra now; model workflows as Mastra workflows; use its
  `suspend`/`resume` and snapshots for human-in-the-loop; agents as Mastra agents.
- **Pros:** First-class deterministic workflow API and suspend/resume; built-in
  evals; TypeScript-native; the research shortlist's TypeScript pick.
- **Cons / risks:**
  - Large transitive dependency tree (AI SDK, provider packages, storage adapters)
    for capability we do not exercise in an offline, no-API V1.
  - The authz layer, approval ledger, audit ledger and budget enforcement still have
    to be built by us and sit *in front of* Mastra — so Mastra would not remove the
    hard work, only add a dependency around it.
  - Control-plane lock-in: workflow definitions, state format and agent lifecycle
    would be Mastra-shaped. The build spec explicitly forbids this ("interfaces must
    wrap framework-specific functionality", "avoid framework lock-in").
  - Ties V1's correctness and its test suite to a fast-moving external framework's
    release cadence.

### Option C — Python on LangGraph

- **Summary:** Runtime in Python; LangGraph checkpointer + `interrupt()` for durable
  HITL; graph + conditional edges for workflows.
- **Pros:** The most production-proven durable-HITL primitive of the candidates;
  strong checkpoint/resume with time-travel.
- **Cons / risks:**
  - Language mismatch with the entire engineering department and the future product —
    permanent two-language tax for a one-human company (the build spec's stated
    reason to prefer TypeScript).
  - Still must build the same authz/approval/audit/budget layer ourselves.
  - Heavier dependency and packaging story than Option A; the org validation suite is
    already Python — mixing a Python *runtime* invites confusion about which Python is
    which.

### Option D — Do nothing / keep the runtime as specification only

- **Summary:** Leave `docs/future-runtime.md` as the deliverable.
- **Cons:** Does not satisfy the milestone. Recorded for completeness only.

## Decision

**Adopt Option A: a TypeScript-first, thin custom orchestrator on the Node platform,
with framework-adapter seams.**

Rationale:

1. **Language:** TypeScript. Unambiguously supported by existing evidence — the
   engineering roster, the future product ecosystem, and the research recommendation
   ("if TypeScript … Mastra") which already assumed TypeScript as the direction. This
   removes technology fragmentation for a one-human company.
2. **Framework:** none in V1; **Mastra is the designated framework for V1.1+**, to be
   integrated behind the `WorkflowEngine` / `AgentRunner` interfaces. This honours
   both the research shortlist (Mastra is the TypeScript pick) and the build spec's
   dependency-discipline and anti-lock-in rules. The tool registry keeps Mastra as
   `DEFERRED` with `runtime_decision: OPTIONAL` until real multi-agent LLM execution
   is in scope.
3. **Architecture:** the "build ourselves" list from ADR-009 (default-deny
   authorization, audit ledger, human-approval ledger, per-agent budget enforcement,
   reviewer-independence guarantee) *is* the core of V1. There is no framework that
   would have built it for us, so building it first — cleanly, behind interfaces —
   is the correct sequencing, not premature.

What would change this decision: real LLM agent execution entering scope with
non-trivial tool-calling loops, multi-turn planning, and eval harnessing — at which
point integrating Mastra (or an equivalent) behind `AgentRunner` becomes worth its
dependency cost. The seam for that is already in the code.

## Consequences

### Positive

- Governance-critical code is first-party, small, and fully unit-tested.
- The runtime installs 7 npm packages total and runs entirely offline.
- Organization V1.0 is untouched: the runtime *reads* `agents/`, `skills/`, `tools/`,
  `models/`, `workflows/`, `policies/`, `schemas/` and re-validates them against the
  same JSON Schemas the Python suite uses.
- Clear upgrade path: each external system (Mastra, LiteLLM, E2B, Daytona, Langfuse,
  OPA, Postgres) has a named interface and a stub/mock adapter already in the tree.

### Negative / debt incurred

- We maintain our own workflow state-machine executor and checkpoint format
  (`runtime/src/workflows/`, `runtime/src/state/`). Bounded: the workflows are fixed
  and simple.
- No real model calls in V1 — `MockModelProvider` is deterministic and the LiteLLM
  adapter is `SUPPORTED_NOT_CONFIGURED`. Real-provider wiring is a V1.1 task.
- `node:sqlite` experimental-warning noise (suppressed in the CLI; irrelevant to
  correctness).

### Follow-up actions

- **Owner: model-operations-engineer** — wire a real provider through
  `ModelProvider` (LiteLLM adapter) once the Human Founder onboards providers and
  sets budgets. Until then budgets are `NOT_CONFIGURED`, surfaced honestly by
  `ai-company doctor` and the cost report.
- **Owner: engineering-director** — evaluate Mastra integration behind `AgentRunner`
  when real agent execution is scheduled (V1.1).
- **Owner: application-security-engineer** — revisit the compliance/privacy role and
  the secrets proxy (Agent Vault / LiteLLM keys) before any project handles real
  customer PII (recorded as a mandatory pre-production decision in
  `docs/runtime-security.md`).
- **Owner: sre-observability-engineer** — replace the in-process `Observability`
  buffer with an OTLP exporter + collector when there is traffic.

### Fitness functions

- `npm run check` in `runtime/` (typecheck + full test suite) stays green, offline,
  with no API keys.
- `python3 tests/run_all.py` (Organization V1.0) stays green — the 85 tests are never
  weakened.
- Adding a new external system requires only a new adapter file implementing an
  existing interface — no change to `orchestrator/`, `policy/`, `approvals/` or
  `audit/`. If that stops being true, this ADR failed.

## Security review

Threat model summary (application-security-engineer):

- **Bypass of Human Founder approval** — mitigated in layers: the `PolicyEngine`
  returns `APPROVAL_REQUIRED` for every critical action and every RISK 5 step; the
  `WorkflowEngine` refuses to advance past a `human_approval` step without an
  `APPROVED` record from the `ApprovalEngine`; the `ApprovalEngine` rejects any
  approver that is not `human-founder` and rejects self-approval; the `Capability
  Gateway` denies non-grantable capabilities unconditionally. Each layer is
  independently tested (`runtime/test/security-policy.test.ts`,
  `critical-approval.test.ts`).
- **Agent self-escalation** — no runtime API mutates a loaded agent's permissions;
  `access_control_escalation` is a critical action and is denied.
- **Secret leakage** — `redactSecrets()` is applied to every audit record and every
  telemetry attribute; no provider keys are read in V1; the local sandbox confines
  file writes to a per-run workspace directory.
- **Malicious config** — every definition is schema-validated on load; the registry
  loader fails closed (startup aborts) on any invalid or unresolved reference.

No critical security architecture change (RISK 5) is introduced by V1: it adds no
production trust boundary, no production credential path, and no external write
capability. The runtime itself is not production-deployed.

## Links

- Build spec: "AI SOFTWARE COMPANY AGENT RUNTIME V1.0 — ONE-SHOT MASTER BUILD PROMPT"
- [`../research/runtime-comparison.md`](../research/runtime-comparison.md)
- [`../research/final-recommendations.md`](../research/final-recommendations.md)
- [`../research/architecture-decisions.md`](../research/architecture-decisions.md) (ADR-009, ADR-005, ADR-010, ADR-013)
- [`../docs/runtime-architecture.md`](../docs/runtime-architecture.md)
- [`../docs/agent-runtime.md`](../docs/agent-runtime.md)
