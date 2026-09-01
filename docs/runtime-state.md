# Runtime State & Durable Resume

## Where state lives

`node:sqlite` database at `runtime/.data/runtime.sqlite`. Override the directory with
`AI_COMPANY_DATA_DIR` (tests use a temp dir; `:memory:` is used for unit tests).

Behind the `StateStore` interface — the seam for a future PostgreSQL implementation
(build spec section 39). No orchestrator, policy, approval or audit code depends on
SQLite directly.

## Tables

| Table | Contents | Mutability |
|---|---|---|
| `flags` | key/value runtime flags (e.g. `runtime.paused`) | read/write |
| `tasks` | one row per task, JSON blob | upsert |
| `runs` | one row per workflow run, JSON blob | upsert (checkpoint) |
| `approvals` | one row per approval request | upsert (state transitions) |
| `audit` | append-only event log | **insert only** |
| `cost` | append-only model-call cost records | **insert only** |
| `spans` | append-only telemetry spans | **insert only** |

The `SqliteStore` class exposes no `UPDATE` or `DELETE` path for `audit`, `cost` or
`spans`.

## Checkpoint / resume

A `WorkflowRun` is persisted after **every** transition: `current_step`, `status`,
`project_state`, the full `history`, and `pending_approval_id`. This means:

1. Run a task → it parks at `HUMAN_APPROVAL_REQUIRED`.
2. The runtime process exits (or the machine restarts).
3. A brand-new process opens the same database.
4. `WorkflowEngine.getRun(id)` returns the run exactly where it stopped.
5. The Human Founder approves.
6. `Orchestrator.resume(id)` continues from the correct step.

This is covered by `runtime/test/state-persistence.test.ts`, which runs two separate
`Runtime` instances against one on-disk database.

## Inspecting state

```
ai-company status                 counts + pause state
ai-company task list
ai-company task status <task-id>   task + run + per-step history
ai-company approvals list
ai-company audit --limit 200
```

Add `--json` to any read command for machine-readable output.
