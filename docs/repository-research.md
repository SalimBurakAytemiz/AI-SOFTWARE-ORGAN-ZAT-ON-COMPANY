# Repository Research (method)

How the company evaluates third-party open-source projects — the reusable standard
behind everything in [`../research/repositories/`](../research/repositories/).

## Two independent decisions per project

- **`knowledge_adoption`**: `ADOPT` | `PARTIAL` | `REJECT` — do we learn techniques
  from it?
- **`runtime_decision`**: `ADOPT` | `OPTIONAL` | `DEFER` | `REJECT` — do we install
  it or depend on it (now or as a committed plan)?

A project can be `knowledge_adoption: ADOPT` while `runtime_decision: REJECT`.
Learning from a project never implies installing it.

## Evaluation dimensions

For each meaningful project: repository name, source, purpose, architecture,
development activity, maintenance health, license, security considerations, known
advisories, dependencies, complexity, cost implications, self-hosting capability,
vendor lock-in, agent model, human-in-the-loop capability, permissions model,
workflow capability, checkpoint/resume, testing approach, debugging approach, review
approach, context management, observability, usefulness to our company, overlap with
our own design, and maintenance burden if adopted.

## Rules

- **Do not** copy third-party source into this repository.
- **Do not** create unnecessary forks.
- Prefer external dependencies and adapters when integration is later required.
- A project being named in a build prompt is **not** a reason to adopt it — research
  decides the status.
- Record *why*, so a future session understands the reasoning, not just the outcome.

## Future utility (specified, not built)

A future command could be `ai-company tool evaluate <repository>`. It would consider
metadata, license, activity, security, dependencies, install scripts, overlap,
benefit, complexity, cost, maintenance, and architecture fit, and return one of
`INSTALL` | `OPTIONAL` | `REJECT` | `REPLACE_EXISTING` | `DEFER`. Only a tiny
validation utility (`tests/`) is built now — not a runtime CLI.

## What was researched

~38 projects across methods, agent frameworks, SWE agents, code-context/review, QA,
security, model-ops, observability, infrastructure, CI/CD, secrets, policy, and
sandboxes. The summary table and per-project files:
[`../research/repositories/README.md`](../research/repositories/README.md). Synthesis:
[`../research/final-recommendations.md`](../research/final-recommendations.md),
[`../research/adopted-practices.md`](../research/adopted-practices.md),
[`../research/rejected-practices.md`](../research/rejected-practices.md).
