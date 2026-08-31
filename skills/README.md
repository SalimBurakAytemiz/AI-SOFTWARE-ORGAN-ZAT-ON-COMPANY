# Skills — `skills/`

Reusable, composable, versioned capabilities that agents reference by `id` in their
`required_skills`. Skills hold engineering *method* so agent YAML stays about role,
model, tools, and permissions — **an agent is never just a prompt, and a skill is
where the "how" lives.**

Each skill validates against `../schemas/skill.schema.json` and records
`source_influences` — the third-party projects whose techniques it adapts (technique,
never copied code). See `../research/adopted-practices.md`.

| Skill | Purpose | Primary users |
|---|---|---|
| `requirements-analysis` | Elicit and structure requirements | product-manager, business-analyst |
| `product-discovery` | Frame the problem, users, and value | product-manager |
| `spec-authoring` | Write testable specs (spec → plan → tasks) | business-analyst |
| `accessibility-design` | Design and verify to WCAG 2.2 AA | ux-ui-designer |
| `architecture-review` | Evaluate architecture and record ADRs | solution-architect, senior-code-reviewer |
| `api-design` | Contract-first API design | solution-architect, backend-engineer |
| `threat-modeling` | STRIDE threat modeling of new surfaces | solution-architect, application-security-engineer |
| `frontend-development` | Implement accessible, performant UI | frontend-engineer |
| `backend-development` | Implement secure backend services | backend-engineer, integration-engineer |
| `database-design` | Safe schema, migration, backup design | database-engineer |
| `test-driven-development` | RED → GREEN → REFACTOR → commit | all engineering agents |
| `api-testing` | Contract and API-level tests | test-automation-engineer, qa-lead |
| `e2e-testing` | Playwright E2E with evidence capture | test-automation-engineer |
| `code-review` | Independent review method | senior-code-reviewer |
| `security-review` | Application security review | application-security-engineer |
| `systematic-debugging` | Hypothesis-driven debugging | incident-debug-engineer |
| `incident-analysis` | Triage, evidence, RCA, postmortem | incident-debug-engineer, sre-observability-engineer |
| `observability-instrumentation` | OTel spans/metrics for a change | sre-observability-engineer, model-operations-engineer |
| `git-worktree-isolation` | Isolated worktree per task | all engineering agents |
| `verification-before-completion` | Evidence before "done" | every agent |
| `release-verification` | Verify the Release Gate | release-manager |
| `cost-aware-model-routing` | Pick the cheapest adequate tier | engineering-director, model-operations-engineer |

Status values: `ACTIVE`, `DRAFT`, `DEFERRED`, `DEPRECATED`.
