# Runtime Operations

Day-to-day operation of the Agent Runtime by the Human Founder.

## Install and verify

```
cd runtime
npm install
npm run check            # typecheck + full test suite, offline
node bin/ai-company.js doctor
```

`npm run check` and `doctor` must both be green before use.

## Run a task

```
ai-company task run "Add a GET /health endpoint to the demo service"
```

The runtime prints the workflow it chose, the per-step chain (agent + model tier +
outcome), and — when it parks — the approval id and the command to inspect it.

## The approval loop

```
ai-company approvals list
ai-company approvals show <id>
ai-company approvals approve <id> --note "reviewed release package"
#   or
ai-company approvals reject  <id> --note "hold for next release"
```

The parked run resumes automatically after the decision. To resume manually (e.g.
after a restart) use `ai-company approvals resume <run-id>`.

## The kill switch

```
ai-company pause "reason"     # blocks every write; reads/status/audit still work
ai-company resume
```

Use it whenever behaviour looks wrong. No agent can override it.

## Inspecting

```
ai-company status
ai-company task status <task-id>
ai-company audit --limit 200
ai-company agents show <id>
ai-company workflows show <id>
```

## Data and backups

State is a single file: `runtime/.data/runtime.sqlite` (or `$AI_COMPANY_DATA_DIR`).
Back it up by copying the file while the runtime is idle. Deleting it resets all
tasks, runs, approvals and audit history — it does **not** affect the organization
configuration, which is the git repository.

## CI

`.github/workflows/validate.yml` runs both suites on every change: the Organization
V1.0 Python suite (`python3 tests/run_all.py`) and the runtime suite
(`npm --prefix runtime run check`). Both must pass.

## Upgrading to real models / sandboxes / a backend

See [`model-routing.md`](model-routing.md) (LiteLLM), [`runtime-security.md`](runtime-security.md)
(sandbox isolation, secrets), and [`runtime-audit.md`](runtime-audit.md) (OTLP). Each
is an adapter behind an existing interface; the ADR lists the owners.
