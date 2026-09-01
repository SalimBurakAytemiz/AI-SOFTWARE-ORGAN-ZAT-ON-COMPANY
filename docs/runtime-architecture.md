# Runtime Architecture

Companion to [`../architecture/adr-agent-runtime.md`](../architecture/adr-agent-runtime.md).
This document describes the modules and how a task flows through them.

## Principles

1. **The organization is configuration; the runtime executes it.** Nothing about the
   18 roles, their permissions, the workflows or the policies is hard-coded in
   application source. The runtime loads `agents/`, `skills/`, `tools/`, `models/`,
   `workflows/`, `policies/` and re-validates them against `schemas/`.
2. **Default deny.** Every consequential action is denied unless a policy explicitly
   allows it. Unknown or uncertain ⇒ deny.
3. **Human authority is layered.** The policy engine, the workflow engine and the
   approval engine each independently refuse to let a critical action through without
   an `APPROVED` record decided by `human-founder`.
4. **Fail safe.** Policy-engine failure ⇒ deny. Approval-store failure ⇒ block.
   Gate failure ⇒ block. A technical failure is never read as approval.
5. **Framework-independent.** Each external system (Mastra, LiteLLM, E2B/Daytona,
   Langfuse/OTLP, OPA, PostgreSQL) sits behind a first-party interface with a
   mock/stub adapter already in the tree.

## Flow

```
Human Founder
      | ai-company task run "<instruction>"
      v
TaskIntake ............ creates a Task record
      v
Classifier ........... instruction -> workflow id + task_type + risk (conservative)
      v
Orchestrator ......... starts a WorkflowEngine run; drives permitted steps
      |
      |  for each step:
      |    resolve owning agent (role id -> definition)
      |    AgentRunner:
      |      ModelRouter -> tier (risk floor, task type, ceiling); MockModelProvider
      |      CostAccounting.record(...)
      |      CapabilityGateway.authorize(...) for each needed capability
      |         -> PolicyEngine.evaluate(...)  (default deny)
      |         -> AuditLog.record(...)
      |    WorkflowEngine.submitOutcome(PASS|FAIL)
      |      -> reviewer-independence check, owner check, pause check,
      |         RISK5/PRODUCTION-needs-approval check
      |      -> persist run (StateStore)  -> AuditLog.record(...)
      v
human_approval step reached
      v
WorkflowEngine.openApproval(...) -> ApprovalEngine.request(...)  [PENDING]
      v
run PARKED  (status APPROVAL_REQUIRED, project_state HUMAN_APPROVAL_REQUIRED)
      |
      |  ai-company approvals approve|reject <id>   (decided_by must be 'human-founder')
      v
Orchestrator.resume(runId)
      APPROVED -> WorkflowEngine follows the step's on_pass (simulated production step,
                 recorded with approved_by = human-founder)
      REJECTED -> run marked REJECTED; the critical action never executes
```

## Modules

| Module | Responsibility |
|---|---|
| `config/` | Repo-root discovery, YAML loading, Ajv validation against `schemas/*.json` |
| `registry/` | Load + cross-validate agents, skills, tools+capabilities, workflows, policies, model config; fail closed on any broken reference |
| `policy/` | `assessRiskFromText` (conservative); `PolicyEngine` — the default-deny decision point |
| `permissions/` | `CapabilityGateway` — resolves the agent, checks the global pause, evaluates the policy, audits the request and its outcome |
| `approvals/` | `ApprovalEngine` — states `NOT_REQUIRED / PENDING / APPROVED / REJECTED / EXPIRED / CANCELLED`; only `human-founder` decides; no self-approval |
| `state/` | `StateStore` interface; `SqliteStore` (`node:sqlite`, append-only audit/cost/span tables); `RuntimeControl` (global pause) |
| `audit/` | `AuditLog` — build event, redact secrets, validate against schema, append |
| `cost/` | `CostAccounting` — per-call records; unknown cost stays `null`; budgets `NOT_CONFIGURED` unless the Human Founder sets them |
| `models/` | `ModelProvider` interface; `MockModelProvider` (deterministic, offline); `LiteLlmProvider` (inert until configured); `ModelRouter` (risk floor + task type + ceiling + fallback) |
| `telemetry/` | `Observability` — OpenTelemetry-shaped spans buffered in the state store |
| `sandbox/` | `Sandbox` interface; `LocalSandbox` — temp workspace, allow-list execution, hard blocks on destructive / production / network-egress commands |
| `workflows/` | `WorkflowEngine` — gated state machine; checkpoint/resume; `openApproval` / `resumeAfterApproval`; reviewer-independence enforcement |
| `orchestrator/` | `TaskIntake`, `classifyTask`, `buildContext` (bounded), `Orchestrator` (drives runs, never overrides a specialist FAIL) |
| `agents/` | `AgentRunner` — one agent, one step; behaviour derived entirely from the definition |
| `cli/` | `ai-company` — founder-friendly commands; `--json` for machine output |

## Storage

`node:sqlite` at `runtime/.data/runtime.sqlite` (override with `AI_COMPANY_DATA_DIR`).
Tables: `flags`, `tasks`, `runs`, `approvals`, `audit` (append-only), `cost`
(append-only), `spans` (append-only). The `StateStore` interface is the seam for a
future PostgreSQL implementation — no orchestrator change required.

See also [`runtime-state.md`](runtime-state.md), [`runtime-audit.md`](runtime-audit.md),
[`runtime-security.md`](runtime-security.md).
