# Task Execution

What happens between `ai-company task run "<instruction>"` and the Human Founder
approval gate.

## 1. Intake

`TaskIntake.create` writes a `Task` record: `id`, `title`, `description`, `project`,
`requested_by` (default `human-founder`), `priority`, `risk` (0 until classified),
`status = CREATED`, `created_at`. An audit event `task_created` is written.

## 2. Classification

`classifyTask` matches the instruction against an ordered rule set and picks a
workflow:

| Signal | Workflow |
|---|---|
| outage / incident / customer impact | `incident` |
| hotfix / ship a fix now | `hotfix` |
| CVE / vulnerability / red-team | `security-finding` |
| dependency / renovate / bump version | `dependency-update` |
| schema change / migration / alter table | `database-migration` |
| architecture / re-architect / technology change | `architecture-change` |
| bug / defect / regression / not working | `bugfix` |
| cut a release | `release` |
| (no specific signal) | `feature-development` |

Risk is `max(workflow.risk_level, assessRiskFromText(instruction))`. `assessRiskFromText`
is deliberately conservative: any RISK 5 keyword (auth, payment, production database,
secret, customer data, production deploy, merge to main, security architecture, …)
makes the task RISK 5. "When in doubt, round up" (`models/risk-policy.yml`).

An audit event `task_classified` records the rule that matched and the risk.

## 3. Workflow run

`WorkflowEngine.start` creates a `WorkflowRun`: `current_step` = the workflow's first
step, `status = RUNNING`, `project_state` = the first step's state, empty `history`.
The run is persisted immediately (it is durable from step zero).

## 4. Driving steps

`Orchestrator.drive` loops:

- Read the current step. If it is a `human_approval` step → open an approval and stop
  (see [`human-approval-runtime.md`](human-approval-runtime.md)).
- Resolve the owning agent from the step's `owner` (a role id).
- `AgentRunner.runStep`:
  - Build a **bounded context** — the task, the step, the agent's own definition, its
    skills, its quality gates, the applicable policies, and the previous stage's
    output. Never the whole repository.
  - `ModelRouter.route` picks a tier from risk floor + task type + agent ceiling.
    RISK 0 / `NO_AI` → no model call. Otherwise the `MockModelProvider` produces a
    deterministic stage output and a `CostAccounting` record is written.
  - For each capability the step needs, call `CapabilityGateway.authorize`. Probe
    capabilities the step must *not* have (e.g. `deploy.production`) are checked too,
    to demonstrate denial; they never fail the step.
  - Outcome: `PASS`, unless a needed capability was hard-denied (not merely
    approval-gated) or a test forces `FAIL`.
- `WorkflowEngine.submitOutcome` validates the actor is the step's owner, enforces
  reviewer independence, checks the global pause, checks that a RISK 5 / PRODUCTION /
  Human-Founder-owned step has a prior `APPROVED` approval, appends to `history`,
  transitions along `on_pass` / `on_fail`, and persists.

The loop stops when the run parks at approval, is blocked, is rejected, aborts, or
completes. `Orchestrator` never flips a specialist's `FAIL` to `PASS` and never
advances past a failed gate.

## 5. The proof

`ai-company proof` runs this whole chain on a disposable task ("Add a GET /health
endpoint to the demo service"). It asserts: the classifier chose
`feature-development`; the reviewer (`senior-code-reviewer`) was not the implementer
(`backend-engineer`); every gate passed; the run stopped at `HUMAN_APPROVAL_REQUIRED`
with a pending approval; and no production action occurred.
