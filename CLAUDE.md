# CLAUDE.md — Orientation for future Claude Code sessions

This is the persistent constitution-and-orientation document for anyone (human or
agent) working in this repository. Read it first. Keep it short; it points to the
detailed sources.

---

## 1. What this repository is

The **AI Software Company — Organization V1.0**. It defines the organization,
constitution, agent workforce, governance, engineering lifecycle, permissions, tools,
model policy, quality gates, security rules, and human-approval system of an
AI-powered software company controlled by **one Human Founder**.

It is **governance and configuration, not a running system.** A future *Agent
Runtime* (not built here) will execute this configuration. The first future product
will be a B2B + B2C **Cleaning Commerce** platform (not built here, not designed here).

## 2. Human Founder authority (non-negotiable)

The **Human Founder** is the supreme authority. AI agents are employees, not owners.
The full rules are in [`constitution/AI_SOFTWARE_COMPANY_CONSTITUTION.md`](constitution/AI_SOFTWARE_COMPANY_CONSTITUTION.md).

No AI agent may independently execute any **critical action**: production deployment,
merge to protected `main`, production DB migration/destructive op/data deletion,
production infra change, secret creation/rotation/revocation, payment-config change,
real refund/financial transaction, ad-budget change, supplier payment, bulk customer
messaging, customer-data export, access-control escalation, or critical security
architecture change. Agents may analyze, plan, propose, and **prepare** these, then
stop and request Human Founder approval. Enforced by
[`policies/human-approval.yml`](policies/human-approval.yml) and the tests.

## 3. Repository structure

| Path | Contents |
|---|---|
| `constitution/` | The authoritative company constitution |
| `agents/software-company/` | 18 agent definitions (YAML) — one AI employee each |
| `skills/` | 22 reusable, composable skills agents reference by id |
| `tools/` | `registry.yml` (external tools) + `capabilities.yml` (capability-scoped permissions) |
| `models/` | `tiers.yml`, `routing.yml`, `risk-policy.yml` — provider-independent model strategy |
| `workflows/` | 9 gated lifecycles (feature, bugfix, incident, hotfix, release, dependency-update, security-finding, architecture-change, database-migration) |
| `policies/` | 14 machine-readable governance policies (default-deny) |
| `schemas/` | 8 JSON Schemas that validate all of the above |
| `research/` | Repository evaluations + gap analyses + ADR log + recommendations (institutional memory) |
| `architecture/` | ADR template; product ADRs will land here |
| `docs/` | Human-facing documentation (see `docs/beginner-guide.md` first) |
| `tests/` | Validation + organizational-security suite (pure Python) |
| `project-state/current.yml` | Where the project is in its state machine |
| `future-projects/` | Cleaning Commerce placeholder only |
| `.github/` | CI (`validate.yml`), PR template, CODEOWNERS |

## 4. Agent model

`AGENT = ROLE + SKILLS + MODEL + TOOLS + PERMISSIONS + POLICIES + CONTEXT + MEMORY +
QUALITY GATES + METRICS`. Never just a prompt. See
[`docs/agent-system.md`](docs/agent-system.md) and
[`agents/software-company/README.md`](agents/software-company/README.md). The 18 roles
and why the roster looks like this: [`research/role-gap-analysis.md`](research/role-gap-analysis.md).

## 5. Workflow model

Every production-bound change runs a gated workflow ending in
`… → RELEASE_REVIEW → HUMAN_APPROVAL → PRODUCTION → VERIFY → MONITORING`. The
independent reviewer is never the implementer. Details:
[`docs/workflows.md`](docs/workflows.md). Project states and statuses:
`schemas/project-state.schema.json`.

## 6. Permission model

Default deny, least privilege, capability-scoped (`github.create_pr`, not `github`).
Capabilities marked `grantable: false` (e.g. `github.merge`, `deploy.production`) can
never be granted to any agent. See
[`policies/agent-permissions.yml`](policies/agent-permissions.yml) and
[`tools/capabilities.yml`](tools/capabilities.yml).

## 7. Model & cost policy

Five provider-independent tiers (`NO_AI` → `CRITICAL_REVIEW`). Route by risk, task
type, complexity, cost, quality, context. Deterministic work uses `NO_AI`. RISK 5
always additionally needs the Human Founder. See
[`docs/model-system.md`](docs/model-system.md), [`models/`](models/),
[`policies/cost.yml`](policies/cost.yml).

## 8. Tool registry & research decisions

Tools are `ADOPTED / OPTIONAL / DEFERRED / REJECTED / RESEARCH` based on research, not
on being named in a prompt. Two independent decisions per project: knowledge vs
runtime. See [`tools/registry.yml`](tools/registry.yml),
[`research/repositories/README.md`](research/repositories/README.md),
[`research/final-recommendations.md`](research/final-recommendations.md).

## 9. Current project state

`HUMAN_APPROVAL_REQUIRED` — the organization foundation is complete and awaits Human
Founder review. See [`project-state/current.yml`](project-state/current.yml). Do
**not** start the Agent Runtime or Cleaning Commerce without Human Founder
authorization.

## 10. Testing requirements

`python3 tests/run_all.py` must pass. It validates every YAML/JSON against its schema
and asserts the organizational-security invariants (no agent can bypass Human Founder
approval). CI runs it on every PR. See [`docs/testing.md`](docs/testing.md).

## 11. Security requirements

Layered scanning (gitleaks, Semgrep, Trivy, promptfoo redteam, ZAP later); no
production secret to any agent by default; OIDC short-lived cloud creds; SHA-pinned
actions; branch protection + environment approvals as the human-authority enforcement
surface. See [`docs/security.md`](docs/security.md), [`policies/security.yml`](policies/security.yml),
[`policies/secrets.yml`](policies/secrets.yml).

## 12. Cost principles

Cost minimization is mandatory. Ordinary software over models for deterministic work.
Cheapest adequate tier. Per-agent budgets with auto-pause on breach. Bounded retries.

## 13. Prohibited in this phase

Do not build: the agent runtime, Cleaning Commerce, any commerce frontend/backend,
Vendure/Medusa/Saleor, a control tower, CRM/ERP, marketing/ops agents, n8n workflows,
production cloud infra, mobile apps, payment integration, or any real production
deployment. Anything only planned must be labeled `PLANNED` / `RESEARCHED` /
`DEFERRED` / `NOT_IMPLEMENTED`.

## 14. Working conventions

- Change anything under `constitution/`, `policies/human-approval.yml`,
  `policies/agent-permissions.yml`, `tools/capabilities.yml`, `schemas/`, or a
  workflow approval gate → it is a **RISK 5 governance change** for Human Founder
  review (see `.github/CODEOWNERS`).
- Every new agent/skill/tool/workflow/policy must be referenced by something and must
  validate. Run the tests.
- Record decisions with rationale in `research/` or an ADR. Institutional memory
  matters more than speed.
- Never claim work is complete because files were created. Working, tested, verified
  output with evidence is required (Constitution Article 5.4).
