# Architecture Decisions (ADR log)

Lightweight ADRs for the organization foundation. Status: `ACCEPTED` unless noted.
Detailed per-decision context also lives in `architecture/` and `repositories/`.

---

## ADR-001 — The company is defined as validated configuration, not code

**Decision:** Roles, skills, tools, models, workflows, policies and project state are
YAML/JSON validated against JSON Schemas and a test suite. The future runtime
*executes* this configuration.
**Why:** Auditable, diffable, reviewable, testable; a non-programmer Human Founder can
read it; institutional memory survives session boundaries.
**Consequences:** Every config file must validate in CI; schema changes are
governance changes.

## ADR-002 — Default deny, capability-scoped permissions

**Decision:** No permission is implied. Tools are split into named capabilities
(`github.create_pr`, not `github`). An agent holds an explicit allowlist.
**Why:** Constitution Art. 2; SWE-agent's "constrained interface" lesson.
**Consequences:** `policies/agent-permissions.yml` is the source of truth; tests fail
on any agent granted a capability outside its role or any forbidden capability.

## ADR-003 — Human approval is a workflow primitive, enforced in multiple layers

**Decision:** Critical actions (constitution Art. 3) are `human_approval: true` steps.
Enforcement is layered: workflow definition + policy + GitHub branch protection /
environments + org-security tests.
**Why:** No single point of enforcement should be bypassable.
**Consequences:** Every production-reaching workflow must have an approval step before
any production step; a test asserts no bypass edge exists.

## ADR-004 — Reviewer independence is structural

**Decision:** The `senior-code-reviewer` agent is never the implementing agent. The
runtime must guarantee separate instance/context.
**Why:** Constitution Art. 5.2.
**Consequences:** Workflow step owners for REVIEW differ from IMPLEMENTATION;
`handoff_from` for the reviewer excludes self.

## ADR-005 — Model access is abstracted; tiers are conceptual

**Decision:** Five tiers (`NO_AI`, `LOW_COST`, `STANDARD_CODING`, `ADVANCED_REASONING`,
`CRITICAL_REVIEW`). Concrete models are illustrative. All model calls egress through a
gateway (LiteLLM) with per-agent virtual keys and budgets.
**Why:** Constitution Art. 11 & 13.
**Consequences:** `models/*.yml` never hard-codes a provider as required; routing is
by task type / risk / complexity / cost / quality / context.

## ADR-006 — Risk levels 0–5 drive routing, review depth and approval

**Decision:** RISK 0 = ordinary software; 1 = cheap model; 2 = coding model; 3 =
strong coding/reasoning; 4 = senior review model required; 5 = senior model + Human
Founder. RISK 5 domains: authn, authz, payment, critical migrations, production
infra, customer-data security, financial ops, critical security changes.
**Why:** Build spec §10; constitution Art. 3 & 7.
**Consequences:** `models/risk-policy.yml`; every agent has a `risk_level` ceiling;
workflows tag steps with risk.

## ADR-007 — 18 agents; add only on demonstrated gap

**Decision:** Keep all 17 candidate roles; add `model-operations-engineer` (documented
gap: model ops / evals / model observability / cost telemetry had no owner).
**Why:** `role-gap-analysis.md`.
**Consequences:** New roles require a written gap analysis and a Human Founder–merged
PR.

## ADR-008 — No runtime, no product this phase

**Decision:** This repository is the governance foundation only. No agent runtime, no
Cleaning Commerce, no infrastructure.
**Why:** Build spec §0, §33, §38.
**Consequences:** Anything not built is labeled `PLANNED` / `RESEARCHED` / `DEFERRED`
/ `NOT_IMPLEMENTED`. Final state is `HUMAN_APPROVAL_REQUIRED`.

## ADR-009 — Orchestration framework deferred; primitives specified

**Decision:** Do not pick LangGraph/Mastra/Agno/MAF/crewAI now. Specify the required
primitives (durable HITL, gated workflows, checkpoint/resume, default-deny authz,
per-agent budgets, isolated execution, audit/observability). Narrow to LangGraph
(Python) or Mastra (TypeScript) for the runtime phase.
**Why:** `runtime-comparison.md`; premature commitment is lock-in.
**Consequences:** `docs/future-runtime.md` records the shortlist and the
build-ourselves list (authz layer, audit ledger, approval ledger, budget enforcement).

## ADR-010 — Secrets: credential-proxy pattern, tool-agnostic

**Decision:** Design around a credential proxy (secret never reaches the agent;
injected at the network boundary). Name Infisical Agent Vault / Agent Proxy as the
reference implementation; do not take a runtime dependency while it is a research
preview.
**Why:** Constitution Art. 8; `research/agent-vault.md`.
**Consequences:** `policies/secrets.yml` is written to be satisfiable by any
compliant proxy; OIDC short-lived creds required for cloud.

## ADR-011 — Layered security scanning, minimal tool sprawl

**Decision:** Trivy (SCA + IaC + container + SBOM + secrets backstop), Semgrep OSS
(SAST + house rules), gitleaks (commit-time secrets), promptfoo (eval + LLM
red-team), OWASP ZAP (DAST, staging-only, activate with product). osv-scanner and
conftest/OPA optional/secondary.
**Why:** `security-comparison.md`, `tool-gap-analysis.md`.
**Consequences:** One blocking gate per concern; extras are triage aids, not
duplicate gates.

## ADR-012 — GitHub is the enforcement surface for git & release governance

**Decision:** `main` protected by ruleset; Release Gate = required status checks;
production deploys gated by a GitHub Environment whose required reviewer is the Human
Founder. CI logic kept in portable scripts to limit lock-in.
**Why:** `research/github-actions.md`; native enforcement beats convention.
**Consequences:** `.github/` config is part of the governance surface and is reviewed
like policy.

## ADR-013 — Observability contract is OpenTelemetry, backend deferred

**Decision:** Define spans/metrics for agent, model, tool, workflow, cost, latency,
retry, error, success, approval, deployment, incident in OTel terms now. Choose a
backend (Langfuse or otherwise) when there is traffic.
**Why:** Art. 13; `research/opentelemetry.md`, `research/langfuse.md`.
**Consequences:** The runtime emits only OTLP; no vendor SDK as the primary path.

## ADR-014 — Agent Runtime V1.0 is TypeScript on a thin custom orchestrator; no framework yet

**Decision:** Build Agent Runtime V1.0 in TypeScript, executed natively by Node.js
22.6+ (type stripping, no build step), with three runtime dependencies (`yaml`,
`ajv`, `ajv-formats`), `node:sqlite` for durable state, and `node:test` for tests.
The orchestrator, workflow engine, policy engine, capability gateway, approval
engine, audit ledger, model-provider abstraction and cost accounting are all
first-party code behind narrow interfaces. **Mastra is the designated framework for
V1.1+**, integrated later behind the `AgentRunner` / `WorkflowEngine` interfaces; it
stays `DEFERRED` in the tool registry until real multi-agent LLM execution is in
scope. The full ADR (options, security review, follow-ups) is
`../architecture/adr-agent-runtime.md`.
**Why:** The engineering roster and future product are TypeScript; ADR-009 already
concluded the authz/approval/audit/budget layer must be built ourselves regardless of
framework, so building it first behind interfaces is correct sequencing, not
premature. The build spec mandates minimal dependencies, no framework lock-in, and an
acceptance suite that runs with no paid API key.
**Consequences:** We maintain our own workflow state-machine executor and checkpoint
format (bounded — the workflows are fixed and simple). No real model calls in V1
(`MockModelProvider` is the default; the LiteLLM adapter is `SUPPORTED_NOT_CONFIGURED`).
Each external system (Mastra, LiteLLM, E2B/Daytona, Langfuse/OTLP, OPA, PostgreSQL)
has a named interface and a mock/stub adapter in `runtime/src/`.
