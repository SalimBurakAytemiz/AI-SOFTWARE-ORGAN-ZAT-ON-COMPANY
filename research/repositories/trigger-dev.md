# triggerdotdev/trigger.dev — Evaluation

- **Repository:** triggerdotdev/trigger.dev
- **Source:** https://github.com/triggerdotdev/trigger.dev
- **Purpose:** Open-source background-jobs / durable-execution platform for
  TypeScript: long-running tasks with automatic retries, queues, schedules, and
  checkpoint/resume, without managing your own queue infrastructure.
- **Architecture:** Write tasks as TS functions; a self-hostable orchestrator runs
  them in isolated containers with **durable checkpointing** (a task can wait for
  minutes/days and resume), concurrency controls, and a dashboard with run logs and
  replay.
- **Development activity / maintenance health:** Active; company-backed; v3+ focuses
  on the self-hostable durable runtime.
- **License:** Apache-2.0.
- **Security considerations:** Runs your code in containers; self-hosting means you
  own the isolation and the secrets store. Dashboard access = production job control.
- **Dependencies:** Node; Postgres; Redis; container runtime (self-hosted).
- **Complexity:** Medium to self-host.
- **Cost implications:** OSS free; Trigger.dev Cloud paid.
- **Self-hosting:** Yes (a stated priority of v3+).
- **Vendor lock-in:** Low–medium (task code is fairly portable TS; the orchestration
  API is theirs).
- **Human-in-the-loop capability:** `wait` primitives + `waitForToken` enable
  approval pauses that resume on an external signal — a real approval-gate mechanism.
- **Permissions model:** Project/environment scoping; API keys.
- **Workflow capability:** Durable task chains, not a visual pipeline; good for the
  *execution* substrate under a runtime.
- **Checkpoint / resume:** First-class — its headline feature.
- **Observability:** Run logs, traces, replay, alerting.
- **Usefulness to our company:** Medium–high as a candidate *durable execution
  substrate* for a TypeScript runtime (pairs with Mastra), giving retries +
  checkpointing + human-approval waits without building them.
- **Overlap with our own design:** It would host workflow execution; no conceptual
  conflict.
- **Maintenance burden:** Medium.

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** DEFER (evaluate as the durable-execution layer during Agent
  Runtime design, especially if the runtime is TypeScript; not needed now)
- **Rationale:** Solves durable execution + approval-waits + retries with an
  Apache-2.0, self-hostable tool. No runtime exists yet, so we record it as a strong
  candidate and defer.
- **What we take:** Durable checkpoint/resume and `waitForToken`-style approval pauses
  as required runtime primitives; container-per-run isolation; replayable run logs
  into the audit trail.
- **What we deliberately do not take (now):** Trigger.dev Cloud; a dependency before
  the runtime language is chosen.
- **Data checked:** Prior knowledge; general web awareness Aug 2026.
