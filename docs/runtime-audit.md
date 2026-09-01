# Runtime Audit

Implements [`../policies/audit.yml`](../policies/audit.yml) and the schema at
[`../schemas/audit-event.schema.json`](../schemas/audit-event.schema.json).

## Contract

Every audit event is:

- **built** by `AuditLog.record` with sensible nulls for absent fields,
- **redacted** by `redactSecrets` (masks secret-looking keys, scrubs token / JWT /
  private-key / cloud-key patterns from every string),
- **validated** against `audit-event.schema.json` — an invalid event throws rather
  than being silently dropped,
- **appended** to the `audit` table (insert only).

`approved_by` is `"human-founder"` or `null` — no other value is representable, per
the schema.

## What is recorded

`task_created`, `task_classified`, `workflow_started`, `agent_step:<step>`,
`tool_request:<action>` (with the policy decision), `workflow_step:<wf>.<step>`
(with `previous_state` / `new_state` / `approved_by`), `workflow_parked`,
`workflow_blocked_no_approval`, `workflow_blocked_paused`, `step_owner_mismatch`,
`approval_request`, `approval_granted`, `approval_rejected`, `approval_expired`,
`approval_cancelled`, `approval_decision_rejected`, `runtime_pause`, `runtime_resume`,
`workflow_rejected`.

Each event carries enough to reconstruct **who / what / when / why / with which model
/ with which tool / under which capability / under which approval**:
`agent_id`, `agent_role`, `model`, `tool`, `capability`, `action`, `reason`,
`risk_level`, `previous_state`, `new_state`, `approval_required`, `approved_by`,
`approval_timestamp`, `result`, `duration`, `estimated_cost`, `error`.

## Reading it

```
ai-company audit --limit 100
ai-company audit --json | jq '.[] | select(.result=="BLOCKED")'
```

The proof run alone produces ~40 events; `runtime/test/audit-and-cost.test.ts`
validates every one of them against the schema and asserts secrets are redacted.

## Observability

Alongside audit, the runtime emits OpenTelemetry-shaped **spans** (`agent`,
`workflow_step`, `model_call`, `tool_call`, `approval_wait`, …) into the `spans`
table. ADR-013: the runtime emits only OTLP; a collector / Langfuse backend is a
later phase and is not required to run. Span attributes are redacted the same way
audit events are.
