# Agent Runtime V1.0

The **AI Software Company Agent Runtime** turns the static organization in this
repository into a running system. One Human Founder gives it a software-development
task; it safely coordinates the right AI roles, models, tools, workflows, reviews and
approvals — and stops for the Human Founder before any critical action.

Status: **HUMAN_APPROVAL_REQUIRED** — built, tested, documented, awaiting Human
Founder review. The runtime itself has not been production-deployed. Cleaning Commerce
is still not implemented.

- Architecture decision and alternatives: [`../architecture/adr-agent-runtime.md`](../architecture/adr-agent-runtime.md)
- Module map and data flow: [`runtime-architecture.md`](runtime-architecture.md)
- The code: [`../runtime/`](../runtime/README.md)

## What it does and does not do

**Does:** load and validate all 18 agents / 22 skills / 47 capabilities / 9 workflows
/ 14 policies; classify a task; pick a workflow; route each step to the owning role;
route a model tier by risk; run every consequential tool call through a default-deny
capability gateway; persist the run so it survives a restart; record an append-only
audit event for everything significant; and **park the run at the Human Founder
approval gate**.

**Does not:** deploy anything, spend real money, use real customer data, require a
paid AI API key, make production GitHub writes, or let any agent approve its own work
or a critical action.

## The Human Founder's questions, answered

### How do I start the company?

```
cd runtime && npm install
node bin/ai-company.js doctor
```

`doctor` must report **healthy**. There is no long-running server to start; the CLI
is the control surface and the state lives in `runtime/.data/runtime.sqlite`.

### How do I check health?

`ai-company doctor`. Required subsystems (config registries, policy/permission/approval
engines, state + audit stores, the mock model provider) must be `OK`. External
systems you have not configured show `NOT_CONFIGURED`, `OPTIONAL` or `DEFERRED` and
never fail the runtime.

### How do I give it a task?

```
ai-company task run "Add a GET /health endpoint to the demo service"
```

The runtime classifies it (here: `feature-development`), starts the workflow, and
drives each step through its owning agent until it reaches the Human Founder approval
gate, where it stops and prints the approval id.

### How do I see which agent is working?

The `task run` output prints the chain: each step, its owning agent, the model tier
it routed, and the outcome. `ai-company task status <task-id>` shows the same for a
past task. `ai-company audit` is the full event log.

### How do I inspect a task?

```
ai-company task status <task-id>
ai-company approvals show <approval-id>
```

`approvals show` prints the full decision packet: requested action, risk, impact,
affected environment, test summary, security summary, rollback summary and estimated
cost — not a raw JSON dump.

### How do I approve something?

```
ai-company approvals approve <approval-id> --note "reviewed the release package"
```

Only the identity `human-founder` can decide an approval. The runtime resumes the
parked run automatically after the decision.

### How do I reject something?

```
ai-company approvals reject <approval-id> --note "hold for the next release"
```

The run is marked `REJECTED`; the critical action does **not** execute.

### How do I stop all autonomous writes?

```
ai-company pause "investigating anomaly"
```

While paused, every tool write, every write-bearing workflow step, and every external
write is blocked. Status, monitoring, audit reads and analysis still work. No ordinary
agent can lift the pause.

### How do I resume?

```
ai-company resume
```

### How do I see audit history?

```
ai-company audit --limit 100
```

Every event is append-only, schema-validated against
[`../schemas/audit-event.schema.json`](../schemas/audit-event.schema.json), and
secret-redacted.

### How do I know something failed?

A failed gate stops the run with status `BLOCKED` or `FAIL` and an audit event
explaining why. `ai-company task status <id>` shows the current step and each step's
result. `ai-company doctor` shows subsystem failures. The CLI exits non-zero on error.

### How do I configure a real model later?

Real model access is legitimate API access through the `ModelProvider` abstraction —
never Claude Code or a subscription. See [`model-routing.md`](model-routing.md) and
[`runtime-cost.md`](runtime-cost.md). In short: the Human Founder onboards a provider,
stands up a LiteLLM gateway, sets per-agent virtual keys and budgets, and exports
`AI_COMPANY_LITELLM_BASE_URL`, `AI_COMPANY_LITELLM_API_KEY` and the per-tier model
names. Until then the deterministic `MockModelProvider` is used and budgets report
`NOT_CONFIGURED`.

## Related

- [`task-execution.md`](task-execution.md)
- [`human-approval-runtime.md`](human-approval-runtime.md)
- [`tool-permissions.md`](tool-permissions.md)
- [`runtime-state.md`](runtime-state.md)
- [`runtime-audit.md`](runtime-audit.md)
- [`runtime-security.md`](runtime-security.md)
- [`runtime-cost.md`](runtime-cost.md)
- [`runtime-operations.md`](runtime-operations.md)
- [`runtime-troubleshooting.md`](runtime-troubleshooting.md)
- [`beginner/runtime-guide.md`](beginner/runtime-guide.md)
- [`future-runtime.md`](future-runtime.md) — the original brief
