# Human Approval (runtime)

Implements Constitution Article 3 and
[`../policies/human-approval.yml`](../policies/human-approval.yml). See also
[`human-approval.md`](human-approval.md) for the organizational policy.

## States

```
NOT_REQUIRED   the action is not critical
PENDING        awaiting the Human Founder
APPROVED       the Human Founder approved this specific instance
REJECTED       the Human Founder rejected it; the action does not execute
EXPIRED        a TTL passed without a decision
CANCELLED      withdrawn before a decision
```

## Rules the engine enforces

- **Only `human-founder` decides.** `approve()` / `reject()` throw
  `NOT_HUMAN_FOUNDER` for any other identity, including every agent id. This is
  tested against all 18 agents.
- **No self-approval.** A request whose `requested_by` is `human-founder` cannot be
  self-decided.
- **One decision.** Only a `PENDING` request can be decided; a decided request is
  immutable.
- **Auto-expiry.** A request past its `expires_at` becomes `EXPIRED` on read and can
  no longer be approved.
- **Everything is audited.** `approval_request`, `approval_granted`,
  `approval_rejected`, `approval_expired`, `approval_cancelled`, and every rejected
  decision attempt.

## How a run reaches the gate

When `Orchestrator.drive` finds the current step is a `human_approval` step, it calls
`WorkflowEngine.openApproval(runId, packet)`. That:

1. creates a `PENDING` `ApprovalRequest` with the decision packet (impact, tests,
   security, rollback, estimated cost, environment, risk 5),
2. sets the run `status = APPROVAL_REQUIRED`, `project_state = HUMAN_APPROVAL_REQUIRED`,
   `pending_approval_id`,
3. persists, and writes a `workflow_parked` audit event.

The run is now durable and idle. It can wait indefinitely and survives restarts.

## Deciding

```
ai-company approvals list
ai-company approvals show <id>          # full packet, not a JSON dump
ai-company approvals approve <id> --note "..."
ai-company approvals reject  <id> --note "..."
```

After the decision the CLI calls `Orchestrator.resume(runId)`:

- **APPROVED** → `WorkflowEngine.resumeAfterApproval` follows the step's `on_pass`.
  The next (production) step is executed as a **simulated, authorized** system action
  and its audit event carries `approved_by = human-founder`. In V1 no real deployment
  happens; the step is simulated to prove the post-approval path.
- **REJECTED / EXPIRED / CANCELLED** → the run follows `on_fail`, is marked
  `REJECTED`, and the critical action never executes.

## Layered enforcement

No single point is the only barrier:

| Layer | Guarantee |
|---|---|
| `PolicyEngine` | every critical action and every RISK 5 step ⇒ `APPROVAL_REQUIRED` |
| `WorkflowEngine` | refuses to pass a RISK 5 / PRODUCTION / Human-Founder-owned step without an `APPROVED` record for the run |
| `ApprovalEngine` | only `human-founder` decides; no self-approval; one decision |
| `CapabilityGateway` | non-grantable capabilities denied unconditionally |
| Registry loader | startup aborts if any agent is granted a reserved capability |

Each layer has its own tests in `runtime/test/`.
