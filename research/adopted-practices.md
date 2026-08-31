# Adopted Practices

Techniques we adopt (as practice, not code). Each links to where it lives in the repo
and the projects that informed it.

| Practice | Where it lives | Informed by |
|---|---|---|
| Org-as-files: roles, workflows, policies, skills as versioned, validated config | whole repo | BMAD-METHOD, MetaGPT |
| One role owns one responsibility domain; leadership coordinates, never universalizes | `agents/software-company/*`, `non_responsibilities` field | MetaGPT SOPs, constitution |
| Structured artifact hand-off between roles (spec → arch → design → plan → code) | `workflows/feature-development.yml`, `handoff_from`/`handoff_to` | MetaGPT, BMAD |
| Spec-driven development: durable `spec` → `plan` → `tasks` before implementation | `skills/spec-authoring`, feature workflow SPEC/PLAN states | github/spec-kit |
| Project "constitution" as a first-class document | `constitution/` | spec-kit, BMAD |
| Context sharding into focused units of work | `memory_scope`, `context_requirements`, workflow steps | BMAD story files |
| Skills as composable, versioned, trigger-described files referenced by agents | `skills/`, `schemas/skill.schema.json` | obra/superpowers |
| Test-driven development: RED → GREEN → REFACTOR → commit | `skills/test-driven-development` | superpowers, aider |
| Systematic (hypothesis-driven) debugging | `skills/systematic-debugging` | superpowers, SWE-agent |
| Git worktree isolation per task | `skills/git-worktree-isolation` | superpowers |
| Verification before completion — no "done" without evidence | `skills/verification-before-completion`, constitution Art. 5.4 | superpowers, constitution |
| Constrained, purpose-built, fully-logged tool interfaces (capability scoping) | `tools/registry.yml`, `policies/agent-permissions.yml` | SWE-agent ACI |
| Ranked repo-map / packed context instead of dumping files | `skills/*`, Repomix in `tools/` | aider, Repomix |
| Secret pre-flight before sending code to a model | Repomix Secretlint + gitleaks | Repomix, gitleaks |
| Sandboxed code execution + event stream as replayable action log | `docs/future-runtime.md`, audit schema | OpenHands |
| Tests are the feedback loop for engineer agents | quality gates, `skills/test-driven-development` | OpenHands, aider |
| Durable human-in-the-loop: pause run, await approval, resume deterministically | `workflows/*` human_approval steps, `docs/future-runtime.md` | LangGraph interrupt, Mastra suspend/resume, Trigger.dev |
| Model provider abstraction + conceptual tiers | `models/tiers.yml`, `models/routing.yml` | LiteLLM, constitution Art. 13 |
| Per-agent model virtual keys with hard budgets | `models/routing.yml`, `policies/cost.yml` | LiteLLM proxy |
| Prompt/agent evaluation as a regression gate | `skills/*`, `SECURITY`/quality gates | promptfoo |
| OWASP-LLM adversarial testing for untrusted-input features | `workflows/security-finding.yml`, `SECURITY` gate | promptfoo redteam |
| OpenTelemetry as the vendor-neutral observability contract | `docs/security.md`, `docs/future-runtime.md`, observability standard | OpenTelemetry, MS Agent Framework |
| Default-deny policy decision engine, decision logs = audit | `policies/*`, `research/opa.md` | OPA |
| Branch protection + required status checks + environment approvals as enforcement | `policies/git.yml`, `policies/release.yml`, `.github/` | GitHub Actions |
| SHA-pinned actions, OIDC over stored cloud keys | `.github/workflows/*`, `policies/security.yml` | GitHub Actions security guidance |
| Conservative automated dependency updates (PR-only, narrow auto-merge) | `workflows/dependency-update.yml` | Renovate |
| IaC: plan is a proposal, apply is a critical action | `policies/production.yml`, `workflows/architecture-change.yml` | OpenTofu |
| Firecracker microVM isolation for network-connected generated code | `docs/future-runtime.md` | E2B |
| Explicit permission modes per agent (auto / approve / chat) | `agents/*` allowed/forbidden actions, human_approval_required | goose, opencode |
| E2E evidence artifacts: trace-on-retry, screenshots, video | `skills/e2e-testing`, `policies/qa.yml` | Playwright |
| Accessibility-tree snapshots as cheap structured UI context for agents | `skills/e2e-testing` | Playwright MCP |
| One logical change per commit with generated, reviewed messages | `policies/git.yml` | aider |
| Institutional memory: decisions recorded with rationale | `research/`, `docs/`, ADRs in `architecture/` | build spec, general practice |
