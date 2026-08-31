# Architecture (of this repository)

This repository is **configuration-as-code for an organization**. It is not an
application. Its "architecture" is the shape of the configuration and the checks that
keep it consistent.

## Layers

```
constitution/            authoritative law (prose)
        │  informs
        ▼
schemas/*.json           structural contracts (JSON Schema, Draft 2020-12)
        │  validate
        ▼
agents/  skills/  tools/  models/  workflows/  policies/  project-state/
        │  cross-reference each other by id
        ▼
tests/                   validation + organizational-security suite (Python)
        │  runs in
        ▼
.github/workflows/       CI enforcement on every change
```

Alongside: `research/` (institutional memory — why every decision was made),
`docs/` (human-facing explanation), `architecture/` (ADRs for products).

## Cross-reference graph

- Agents reference **skills** (`required_skills`) and **capabilities**
  (`allowed_tools` / `forbidden_tools`) and each other (`handoff_from/to`,
  `escalation_to`).
- Capabilities reference **tools** (`tool`).
- Workflows reference **agents** (`owner`) and **project states** (`project_state`).
- Policies reference each other (`related_policies`) and name the **tests** that
  enforce them.
- Everything references the **schemas**.

`tests/` verifies every one of these references resolves.

## Design decisions

The full ADR log is [`../research/architecture-decisions.md`](../research/architecture-decisions.md)
(ADR-001 … ADR-013). Highlights:

- **ADR-001** — the company is validated configuration, not code; the future runtime
  executes it.
- **ADR-002** — default deny, capability-scoped permissions.
- **ADR-003** — human approval is a workflow primitive, enforced in multiple layers.
- **ADR-004** — reviewer independence is structural (the reviewer lacks write
  capabilities).
- **ADR-005 / 006** — abstract model tiers; a 0–5 risk scale drives routing, review,
  approval.
- **ADR-009** — the orchestration framework is deferred; the required primitives are
  specified.
- **ADR-013** — the observability contract is OpenTelemetry; the backend is deferred.

## Why JSON Schema + a Python test suite (not, say, a bespoke DSL)

- Schemas are a widely understood, tool-supported contract; editors and CI can use
  them directly.
- The Python suite adds the checks a schema cannot express: cross-file reference
  resolution, workflow graph reachability, and the organizational-security
  invariants.
- Both are readable by a non-programmer Human Founder with a little guidance.
- A future runtime can consume the same YAML/JSON; OPA/Rego can enforce the same
  policies at action time.

## Extending the repository

Add a file, reference it from something, make it validate, run the tests. Governance-
sensitive paths (`constitution/`, `policies/human-approval.yml`,
`policies/agent-permissions.yml`, `tools/capabilities.yml`, `schemas/`, workflow
approval gates) are Human-Founder-reviewed (`.github/CODEOWNERS`).
