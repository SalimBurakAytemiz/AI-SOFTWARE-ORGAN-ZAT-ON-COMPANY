# Final Recommendations

Synthesis of all research. This is the executive summary a future session or the
Human Founder should read first.

## 1. Organization

Adopt an **18-agent** software company: the 17 candidate roles unchanged, plus one
addition — **AI Model Operations Engineer** — to own model tiering/routing, the model
gateway, prompt/agent evaluations, and model-call cost & quality telemetry (a
documented ownership gap). No merges, no splits, no removals. Rationale and the
rejected merge/split options are in `role-gap-analysis.md`.

## 2. Method

Build our own governed lifecycle, informed by:

- **BMAD-METHOD** and **MetaGPT** — org-as-files, one role per domain, structured
  artifact hand-off, context sharding.
- **github/spec-kit** — spec → plan → tasks front end; "constitution" as a document.
- **obra/superpowers** — skills as composable, versioned, trigger-described files;
  TDD, systematic-debugging, worktree-isolation, verification-before-completion.
- **SWE-agent** — constrained, fully-logged tool interfaces (capability scoping).
- **OpenHands / aider** — sandboxed execution, tests-as-feedback, repo-map context,
  commit discipline.

We go beyond all of them on: default-deny capability permissions, layered
human-approval enforcement, machine-checkable org-security tests, risk-based model
routing, and an audit contract.

## 3. Runtime (next phase — do not build now)

Specify primitives; defer the framework. Shortlist: **Mastra** (if TypeScript, which
matches the engineering stack) or **LangGraph** (if Python), each on a
durable-execution substrate (**Trigger.dev** / LangGraph checkpointer) with **E2B**
(or OpenHands runtime) sandboxes. Always build ourselves: the OPA-backed default-deny
authorization layer, the audit ledger, the human-approval ledger, and per-agent
budget enforcement (LiteLLM virtual keys). Full comparison: `runtime-comparison.md`.

## 4. Tools — decisions

**ADOPTED (now):** Git, GitHub + Actions, Claude Code, Repomix, LiteLLM, promptfoo,
OpenTelemetry (as contract), Semgrep (OSS), Trivy, gitleaks, Playwright, Renovate,
Docker/OCI.

**OPTIONAL:** spec-kit, opencode, goose, superpowers plugin, pr-agent, osv-scanner,
Playwright MCP, OWASP ZAP (now; ADOPTED once a staging app exists), OPA (now; likely
ADOPTED in the runtime phase).

**DEFERRED:** Langfuse, Infisical Agent Vault / Agent Proxy, OpenTofu, Trigger.dev,
Daytona, E2B, LangGraph/Mastra/Agno as committed runtime, n8n.

**REJECTED:** aider as a company harness, Continue, crewAI autonomous-crew mode as
the core, MetaGPT/BMAD as a runtime, copying source or forking, single-provider
lock-in, autonomy without gates.

Full table: `repositories/README.md`; metadata: `../tools/registry.yml`.

## 5. Security posture

Layered: gitleaks (pre-commit) + Semgrep (SAST) + Trivy (SCA/IaC/container/SBOM) +
promptfoo redteam (LLM) + OWASP ZAP (DAST, later) as gates; OPA default-deny
authorization + audit decision logs at runtime; credential-proxy secrets architecture
(no production secret to any agent by default); OIDC short-lived cloud creds;
SHA-pinned actions; branch protection + environment approvals as the human-authority
enforcement surface. Details: `security-comparison.md`.

## 6. Cost posture

RISK 0 work → ordinary software (`NO_AI`). Cheap models for low-risk text. Strong
models reserved for RISK 3–5. Per-agent budgets enforced at the gateway; cost-overrun
triggers auto-pause. Details: `../policies/cost.yml`, `../models/routing.yml`.

## 7. What "done" means for this phase

One internally consistent, schema-validated, tested, documented, commit-ready
organization repository. Final project state: `HUMAN_APPROVAL_REQUIRED`. The Human
Founder reviews, then authorizes the single next phase: **AI Software Company Agent
Runtime**.

## 8. Open questions for the Human Founder

1. Runtime language: **TypeScript** (matches engineering stack + future product) or
   **Python** (matches most agent frameworks)? This drives the framework choice.
2. Hosting: any cloud commitment? (Affects MS Agent Framework, E2B self-host,
   OpenTofu targets, secrets proxy deployment.)
3. Model providers: which providers get accounts and budgets for tier mapping in
   `models/tiers.yml`?
4. Is a dedicated compliance/privacy role wanted before Cleaning Commerce handles
   real customer PII, or does the Application Security Engineer hold it initially?
