# AI Software Company — Organization V1.0

The organizational and governance foundation for an AI-powered software company
controlled by **one Human Founder**. This repository defines *how the company is
structured and governed*; it does not contain a running system or a product.

> **Status:** `HUMAN_APPROVAL_REQUIRED` — complete and awaiting Human Founder review
> before the next phase (the AI Software Company Agent Runtime).
> See [`project-state/current.yml`](project-state/current.yml).

## What is in here

- **A constitution** — [`constitution/AI_SOFTWARE_COMPANY_CONSTITUTION.md`](constitution/AI_SOFTWARE_COMPANY_CONSTITUTION.md)
  — Human Founder supremacy, default-deny security, human approval for critical
  actions, quality, cost, and auditability.
- **An 18-agent workforce** — [`agents/software-company/`](agents/software-company/)
  — one AI employee per responsibility domain, each defined as
  `ROLE + SKILLS + MODEL + TOOLS + PERMISSIONS + POLICIES + CONTEXT + MEMORY + QUALITY GATES + METRICS`.
- **22 reusable skills** — [`skills/`](skills/) — engineering method kept out of the
  agent files.
- **A tool + capability registry** — [`tools/`](tools/) — every external tool with a
  status decided by research, and capability-scoped permissions.
- **A provider-independent model strategy** — [`models/`](models/) — five conceptual
  tiers, risk-based routing, cost discipline.
- **9 gated workflows** — [`workflows/`](workflows/) — feature, bugfix, incident,
  hotfix, release, dependency-update, security-finding, architecture-change,
  database-migration. Every production path passes through Human Founder approval.
- **14 machine-readable policies** — [`policies/`](policies/) — all default-deny.
- **8 JSON Schemas** — [`schemas/`](schemas/) — everything above is validated.
- **A research dossier** — [`research/`](research/) — ~38 open-source projects
  evaluated (knowledge vs runtime decisions), gap analyses, an ADR log, and the
  runtime recommendation for the next phase.
- **A test suite** — [`tests/`](tests/) — validates all config and asserts the
  organizational-security invariants (no agent can bypass Human Founder authority).

## Quick start

```bash
# Validate the whole organization + run the organizational-security tests
python3 -m pip install pyyaml jsonschema referencing
python3 tests/run_all.py
```

New here? Read [`docs/beginner-guide.md`](docs/beginner-guide.md), then
[`CLAUDE.md`](CLAUDE.md).

## What this repository deliberately does NOT do

No agent runtime. No Cleaning Commerce product. No commerce platform selection. No
infrastructure. No marketing/ops agents. Those belong to later, separately authorized
phases. Anything only planned is labeled `PLANNED` / `RESEARCHED` / `DEFERRED` /
`NOT_IMPLEMENTED`.

## Documentation map

| Doc | For |
|---|---|
| [`docs/beginner-guide.md`](docs/beginner-guide.md) | Plain-language overview; what the Human Founder should check |
| [`docs/organization.md`](docs/organization.md) | Departments, roles, and how the roster was decided |
| [`docs/agent-system.md`](docs/agent-system.md) | Agent definition fields, memory, metrics |
| [`docs/workflows.md`](docs/workflows.md) | The lifecycles and gates |
| [`docs/human-approval.md`](docs/human-approval.md) | The critical-action list and how approval is enforced |
| [`docs/tool-system.md`](docs/tool-system.md) | Tool registry and capability permissions |
| [`docs/model-system.md`](docs/model-system.md) | Tiers, routing, cost |
| [`docs/security.md`](docs/security.md) | Security posture and scanning |
| [`docs/testing.md`](docs/testing.md) | The validation and security test suite |
| [`docs/architecture.md`](docs/architecture.md) | How the repository itself is architected |
| [`docs/repository-research.md`](docs/repository-research.md) | How third-party projects were evaluated |
| [`docs/future-runtime.md`](docs/future-runtime.md) | What the next phase would build |

## License

No license file yet — the Human Founder sets licensing. Until then, treat as
all-rights-reserved to the Human Founder.
