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

The `constitution/`, `agents/`, `skills/`, `tools/`, `models/`, `workflows/`,
`policies/`, `schemas/` and `research/` directories are **governance and
configuration**. The **`runtime/`** directory is the **AI Software Company Agent
Runtime V1.0** — a TypeScript program that *executes* that configuration (loads the
agents, routes models, runs the gated workflows, enforces the policies, stops for
Human Founder approval). See [`docs/agent-runtime.md`](docs/agent-runtime.md) and
[`architecture/adr-agent-runtime.md`](architecture/adr-agent-runtime.md). The first
future product will be a B2B + B2C **Cleaning Commerce** platform (not built here, not
designed here, still `NOT_IMPLEMENTED`).

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
| `projects/` | Project Factory workspaces — one `<slug>/` per project (definition, not built app). See `docs/project-factory.md` |
| `architecture/` | ADR template; product ADRs will land here |
| `docs/` | Human-facing documentation (see `docs/beginner-guide.md` first) |
| `tests/` | Validation + organizational-security suite (pure Python) |
| `runtime/` | **Agent Runtime V1.0** — TypeScript (Node.js, no build step). Registry loader, default-deny capability gateway, Human Approval Engine, gated workflow engine with durable resume (`node:sqlite`), append-only audit ledger, provider-independent models (deterministic mock; no API key), model router, cost accounting, telemetry, local sandbox, global pause, `ai-company` CLI, one safe proof workflow, 58 tests. See `runtime/README.md`. |
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

**Agent Runtime V1.0** is built, documented, and — after Human Founder final
approval and green CI on PR #1 — **merged into `main`**. That approval was scoped to
accepting the runtime into `main` only.

**Runtime V1.1 — Real Agent Execution + Software Factory Proof** was **merged into
`main`** by the Human Founder (PR #2, merge commit `e8c012b`, 2026-09-02). It
*extends* the existing
runtime (no new agent framework): ONE generic OpenAI-compatible model provider
(no per-vendor client), a reusable prompt/context assembler, a validated
`AgentExecutionResult` contract (malformed / truncated → one bounded classified
retry → BLOCK) that is also sent as a provider-native `response_format`
JSON Schema where supported (Groq gpt-oss), a `RealAgentRunner` that routes model
tool-call requests through the Capability Gateway, a disposable proof workspace
with default-deny `workspace.read/list/write/patch/exec`, a real-request budget
(target ≤ 20, ceiling 30), a proof-provider privacy guard, a **provider-agnostic
rate-limit scheduler** (learns per-window request/token budget from `Retry-After`
/ `x-ratelimit-*` headers, paces real calls sequentially, waits out HTTP 429
reset windows over bounded retry cycles → `RATE_LIMIT_EXHAUSTED`; waiting for
free-tier quota needs no Human Founder approval), stage-aware output-token
budgets (~2000–3000, configurable global default + ceiling), low reasoning
effort by default, and a Software Factory proof that drives `feature-development`
with real agents to `HUMAN_APPROVAL_REQUIRED`.
The V1.1 proof-provider strategy is **FREE-FIRST**: **Groq Direct = preferred /
primary** (`AI_COMPANY_REAL_PROVIDER=groq`, `GROQ_API_KEY`, default model
`openai/gpt-oss-120b`); **NVIDIA NIM = free fallback** (`NVIDIA_API_KEY`,
`nvidia/nemotron-3.5-lightning-30b-a3b`), auto-engaged **only** on a bounded Groq
`RATE_LIMIT_EXHAUSTED` — the runner preserves the workflow checkpoint, records a
`provider_transition` audit event (`from_provider` / `to_provider` /
`reason=RATE_LIMIT_EXHAUSTED` / `stage`), switches provider, and retries **only
the blocked stage** (no completed stage / tool write / artifact is repeated;
shared request budget keeps counting). **OpenRouter = optional manual fallback**
(`AI_COMPANY_REAL_PROVIDER=openrouter`), never auto-added to the chain. Every
real provider is a `PROOF_PROVIDER` / `NON_SENSITIVE_PROOF_ONLY`, never
auto-selected for ordinary work, no paid provider. Disable the auto fallback with
`AI_COMPANY_REAL_FALLBACK=none`.

**PREMIUM implementation escalation (authorization-gated per run).** When the
Human Founder sets `AI_COMPANY_PREMIUM_IMPL_PROVIDER`, the `implementation` stage
ONLY uses the premium path; every other stage stays on the free-first chain. Two
paths: **`codex-cli`** (preferred — the locally authenticated Codex CLI / ChatGPT
login, no paid API credit; `codex exec --sandbox workspace-write --ephemeral`
confined to the proof workspace; `OPENAI_API_KEY` stripped from the Codex child;
`~/.codex/auth.json` never read) or **`openai`** (paid Chat Completions API,
default model priority `gpt-5.1 → gpt-5 → gpt-4.1`). It is **bounded** (one
primary attempt + one targeted repair), records a `premium_escalation` audit
event before the first request, runs the change through the **same** deterministic
gates as the free runner (`decideImplementationOutcome` in
`runtime/src/agents/implementation-gates.ts` — one source of truth — plus a
changed-file scope check for Codex), keeps independent review intact
(`code_review` = `senior-code-reviewer`), and on ANY failure — bad code that fails
a gate, Codex non-zero exit / not-logged-in, or `insufficient_quota` →
`PROVIDER_QUOTA_EXHAUSTED` — STOPS with `PREMIUM_IMPLEMENTATION_FAILED`: no free
fallback, no premium retry, no further spend. Never auto-engaged. Standing routing
policy: LOW→free; MEDIUM→free-first, escalate a stage to `PREMIUM_ELIGIBLE` only
after its genuine free budget is exhausted AND a Human Founder authorizes that
run; HIGH→premium implementer behind a Founder budget gate; CRITICAL→independent
premium + Founder. Never auto-spend premium. See `docs/real-agent-execution.md` §7.

237 runtime tests + 85 organization tests pass offline; the full real-agent pipeline
is proven against local OpenAI-compatible fake servers + a mocked Codex CLI
(Groq + NVIDIA + OpenRouter + OpenAI-premium + codex-cli config, provider HTTP
error [redacted body], 5xx, 404
`MODEL_UNAVAILABLE`, `insufficient_quota` → `PROVIDER_QUOTA_EXHAUSTED`
[non-retryable, not a rate limit], output-token
truncation [`OUTPUT_TRUNCATED`, bounded retry], rate-limit header parsing +
scheduler [pace / Retry-After wait / bounded cycles / `RATE_LIMIT_EXHAUSTED` /
checkpoint preserved / no duplicate stage or tool execution], HTTP-400
`rate_limit_exceeded` treated as a rate limit, strict JSON-Schema
structured output + the `json_schema → json_object → prompt-only` self-heal
cascade, a bounded one-shot implementation test-repair pass, the
**Groq→NVIDIA free-first fallback** [transition audit, checkpoint resume, no
duplicate stages/writes/artifacts, NVIDIA-also-fails stays fail-safe, secret
protection], the **implementation-stage hardening** [deterministic `projectFacts()`
authoritative context, first-class `fileChanges` channel replacing double-escaped
`args_json`, inspect-first directives, `requireTestChange` gate, evidence-driven
repair, `.npm` diff-pollution fix, snapshot/restore on fallback — no gate weakened],
the **premium implementation escalation** [`codex-cli` + `openai` paths,
implementation-only, bounded 1+1, never auto-engaged, no free fallback on failure,
Codex `OPENAI_API_KEY`-stripped + auth-file-never-read + changed-file scope check,
`codex exec` run with **stdin closed (`/dev/null`)** — an open stdin pipe hung
Codex 0.152.1 forever in "Reading additional input from stdin" — and killed as a
process **group** on timeout; classified `CODEX_SUCCESS`/`CODEX_TIMEOUT`/
`CODEX_AUTH_REQUIRED`/`CODEX_APPROVAL_BLOCKED`/`CODEX_PROCESS_ERROR`/
`CODEX_NO_WORKSPACE_CHANGE`; shared `decideImplementationOutcome` gates,
independent review intact], and
`doctor --probe` live health OK/NOT_CONFIGURED/RATE_LIMITED/ERROR).
**`project-state/current.yml` is `state: HUMAN_APPROVAL_REQUIRED` /
`status: APPROVAL_REQUIRED`**. The one required real Software Factory proof run
**reached `HUMAN_APPROVAL_REQUIRED`** (run `run_254a2876`, 2026-09-02). It was
completed in two parts across a GitHub Codespace shutdown: run 7 drove `idea →
code_review` on real providers (Codex CLI premium implementer, every
deterministic gate PASS), then the `qa` model call hit a Groq HTTP 400
`tool_use_failed` and the environment stopped; run 8 **resumed the same persisted
run** from the `pre:qa` checkpoint via `ai-company proof resume` and drove `qa →
security → release_review → HUMAN_APPROVAL_REQUIRED` on Groq `gpt-oss-120b` with
**no completed stage or the implementation re-run**. The `qa` 400 root cause (the
`qa`/`security` StagePlans advertised `workspace.exec` to the tool-native Groq
model while the OpenAI-compatible provider by design sends no `tools` array) is
fixed with the minimum provider-compat change: `PLANS.qa` / `PLANS.security` use
`allowedRuntimeTools: []` (their gates are the runner's own `npm test` and
`deterministicSecurityChecks`, not model tool calls) and `stageDirectives` only
asks for a `workspace.exec` test run when that tool is actually offered. The
proof driver gained a `resume` path (`RunOptions.resume` +
`ai-company proof resume`), `ProofWorkspace` re-attaches to a workspace it seeded
in a prior run, and `RequestBudget` accepts a `used` seed. No gate, schema or
validation was weakened. The Groq strict-Structured-Output blocker and the
Groq→NVIDIA free-first fallback remain fixed/proven. 225 runtime + 85
organization tests pass; typecheck clean; gitleaks clean.

On 2026-09-02 the Human Founder **APPROVED the disposable Software Factory proof
approval artifact** (`apr_03ac3263…`, run `run_254a2876`, `APPROVED`) — scoped
strictly to that proof; it authorized no deployment, and the workflow run is
deliberately **held at the `human_approval` step** (never driven into
`PRODUCTION`). The Human Founder then merged **PR #2** into `main`. Accepting the
runtime code into `main` did **not** authorize deploying anything, onboarding a
paid provider, a production cloud, real customer data, or financial actions. See
[`docs/real-agent-execution.md`](docs/real-agent-execution.md).

**Project Factory V0.1** is built on branch `feat/project-factory-v0.1` (not yet
merged). It lets the Human Founder describe a project in natural language and
have AI Company create a **structured, persistent project workspace**
(`projects/<slug>/` — `project.yml` + a `product/` document set + plans +
decisions) and a **validated, immutable, checksum-protected Runtime handoff
package** (`artifacts/runtime-handoff.json`). Creation is **deterministic** — no
model call, no paid API, Codex not required. Lifecycle
`DRAFT → INTAKE → DISCOVERY → SPEC_READY → PLAN_READY → READY_FOR_BUILD`; BUILD is
never entered automatically — `ai-company project authorize-build <slug>` (Human
Founder only, RISK 5, audited) is required before Runtime V1.1 may execute a
project. Every project inherits and cannot weaken Runtime V1.1 governance (Human
Founder approval, kill switch, audit, capability gates, secret protection, no
auto production deploy / financial actions / destructive prod ops). Per-project
AI budget policy: FREE-FIRST, premium disabled by default, premium always needs a
separate per-run authorization. CLI: `ai-company new <slug>`, `ai-company project
list | status | show | advance | verify | authorize-build`. It does **not** build
the application and never invokes a model provider. See
[`docs/project-factory.md`](docs/project-factory.md). The V0.1 acceptance sample
is `projects/project-factory-proof/` (build not authorized). Runtime V1.1 stays
green (typecheck + 237 runtime tests, incl. 12 Project Factory tests).

**`qa-portfolio` — first authorized project build (in progress).** The Human
Founder authorized `qa-portfolio`'s build on 2026-09-02
(`project.yml` `build_authorization.granted: true`, audited RISK 5). A 14-document
pre-development planning package is in `projects/qa-portfolio/planning/`, reviewed
from 10 perspectives. Implementation is proceeding **locally** on branch
`feat/qa-portfolio-build` under the §13 carve-out (Next.js 15 + Supabase +
Vercel, bilingual TR/EN public site + admin CMS) — no deployment, no
*production* Supabase/cloud, no real customer/personal data, `[PLACEHOLDER]` /
`DEMO` / `SANITIZED` for missing professional content, not merged to `main`.
On 2026-09-03 the Human Founder explicitly stood up a **DEVELOPMENT / STAGING**
Supabase project and authorized applying the schema migrations to it; the two
migrations (`0001_schema.sql`, `0002_functions_rls.sql`) were applied via
`supabase db push` (33 tables, RLS on all 33, 66 policies, 4 app functions;
migration history recorded). Credentials live only in gitignored
`web/.env.local`. The app still serves fixtures (`NEXT_PUBLIC_CONTENT_SOURCE`
gate stays `fixtures`). All
new source carries Turkish comments per `docs/coding-standards.md`. Progress:
**Phase 1** (foundation, design tokens, i18n routing, DB migrations + full RLS,
Supabase client modules, public page shells), **Phase 2** (content repository
abstraction, case-study template, QA components, Markdown sanitization + XSS
corpus, admin mutation infra `withAdminAction` + DataTable + mock publication
behaviours, component gallery, i18n formatting, empty/loading/error states,
mobile nav, Playwright e2e + axe) and **Phase 3** (SEO infra — canonical +
hreflang + `buildPageMetadata`; URL-synced filterable projects list with
noindex/canonical on filtered views; JSON-LD Person/WebSite/CreativeWork/
BreadcrumbList; dynamic Open Graph images via `next/og`; case-study TL;DR band +
section jump-nav; /about + skills matrix; committed visual-regression baselines;
Lighthouse CI budget; Supabase factory auto-switch prepared) are committed.
Phase 3 also had a quality-hardening pass (SEO-validation + localization e2e
suites, heading-order a11y fixes → Lighthouse a11y 100 on all routes,
locale-switch preserves query params, Lighthouse CI resource budgets, expanded
component tests). `projects/qa-portfolio/web/`: 108 unit/component tests + ~200
e2e (chromium + mobile: critical flows + SEO validation + localization + axe +
visual regression + admin auth) + typecheck + lint + `next build` all green.
Lighthouse: perf 100 (×5) / 87 (case study, from a Codespaces-only phantom CLS —
real CLS 0.000 verified), a11y 100, best-practices 96, SEO 100 (×5) / 91
(Codespaces-only phantom meta-description — verified present via curl).

**Phase 4 — real Supabase data layer (in progress).** The `media` Storage bucket
is secured (`0003_storage_policies.sql`). **Read** path is real
(`SupabaseContentRepository`, typed PostgREST via a cookie-less anon client
`supabase/public.ts`, domain mappers, per-locale publish resolution), wrapped in
`CachedContentRepository` (tag-based revalidation). **Admin auth** is real
(email+password Supabase Auth, generic errors, per-IP rate limit, allow-list
authz — a valid non-admin session is signed out, middleware session refresh,
logout). **Admin CMS write path is built**: `0004_admin_rpcs.sql`
(`admin_project_transition` — status change + `content_audit` row in one
`SECURITY DEFINER` txn, `is_admin()` guard; `content_audit.actor_user_id`
default `auth.uid()`); `AdminContentRepository` (project CRUD, meta, TR/EN
translation upsert, transitions, flags, reorder, dashboard counts) +
`AdminMediaRepository` (magic-byte validation, server-generated
`{uuid}/{uuid}.{ext}` path, `media` row + alt text, public URL, delete); admin
UI (projects list with row transitions, new/edit forms, TR/EN editors, media
manager, real dashboard). `content_audit` writes are wired
(`SupabaseAuditRepository`). Every write is RLS `is_admin()`-gated; no
service-role key. **`NEXT_PUBLIC_CONTENT_SOURCE` stays `fixtures`** — the data
layer is verified on STAGING but the CMS UI has not been run with a real admin
session (Founder-secret password) and the flip invalidates fixture-based e2e /
visual baselines + adds a build-time DB dependency (keep-alive cron, RISK-004).
Verified on STAGING (60 checks, all green): `write-path-matrix.mjs` (20 — full
CRUD + every transition + atomic audit + authz + invalid-transition), `rls-test-matrix.mjs`
(22), `content-parity-check.mjs` (14), `verify-storage-policies.mjs` (4); all
write tests roll back (no persistent data beyond the DEMO seed). **Next:** Founder
admin smoke test + keep-alive cron → the flag flip; other admin editors
(Experience/Skills/Services/Education/Certifications), QA-artefact sub-editors,
project media/taxonomy binding, `supabase gen types` version alignment.
Generated DB types: `src/lib/db/database.generated.ts` (0004 functions hand-added,
see `database.types.ts`). `pg` / `@types/pg` are devDependencies for the staging
scripts only (never imported by app code).

Neither approval authorizes deploying anything, onboarding a *paid* model provider,
a production cloud, real customer data, financial transactions, or starting Cleaning
Commerce / a Commerce AI Workforce, and neither weakens any critical-action approval
requirement. Project Factory V0.1 creates project *definitions* only; it starts no
build, and Cleaning Commerce remains `NOT_IMPLEMENTED`.

## 10. Testing requirements

Both suites must pass, and CI runs both on every PR:

- `python3 tests/run_all.py` — Organization V1.0: validates every YAML/JSON against
  its schema and asserts the organizational-security invariants (no agent can bypass
  Human Founder approval). See [`docs/testing.md`](docs/testing.md).
- `npm --prefix runtime run check` — Agent Runtime: typecheck + 237 tests
  (registry, policy, gateway, approval, workflow, model routing, persistence/resume,
  audit, cost, global pause, security-policy, critical-approval, proof, CLI,
  Project Factory V0.1 (project creation, invalid schema, duplicate slug,
  persistence, lifecycle transitions, listing/status, Human Founder build gate,
  budget policy, Runtime handoff package + checksum, no secret leakage, no
  provider/payment/deployment side effects), plus
  V1.1: one OpenAI-compatible provider serving Groq Direct (primary) + NVIDIA NIM
  (free fallback) + OpenRouter (manual fallback), the Groq→NVIDIA free-first
  fallback (transition audit, checkpoint resume, no duplicate stages/writes/
  artifacts, NVIDIA-also-fails fail-safe, secret protection),
  missing-key/timeout/5xx/404-model-unavailable/malformed handling,
  proof runner fails safe + structured on any provider error, output-token
  truncation detection (`finish_reason`, bounded classified retry, `OUTPUT_TRUNCATED`
  vs `MALFORMED`) with a configurable default / ceiling, rate-limit header parsing +
  provider-agnostic scheduler (pacing, Retry-After / reset-window waits, bounded
  429 cycles, `RATE_LIMIT_EXHAUSTED`, checkpoint preserved, no duplicate stage/tool
  execution, credential-free telemetry), HTTP-400 `rate_limit_exceeded` classified
  as a rate limit, strict JSON-Schema structured output + the
  `json_schema → json_object → prompt-only` self-heal cascade (with a bounded
  output-token bump) + redacted 400 bodies, a bounded one-shot implementation
  test-repair pass, `doctor --probe` live proof-provider health
  (OK/NOT_CONFIGURED/RATE_LIMITED/ERROR),
  structured-result validation, tool-call adjudication, path traversal, unauthorized
  write, arbitrary-shell rejection, request-budget ceiling, context assembly, agent
  handoff, review independence, real-vs-mock identification, proof-provider privacy,
  Human-Approval stop). Runs offline with no API keys. See
  [`docs/agent-runtime.md`](docs/agent-runtime.md) and
  [`docs/real-agent-execution.md`](docs/real-agent-execution.md).

Never weaken either suite. The 15 critical actions reserved to the Human Founder are
enforced in both.

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

Agent Runtime V1.0 and Runtime V1.1 (real agent execution) are built and merged
into `main`. Real model calls happen only via the explicit `proof real-agent`
path; Groq Direct is the primary `PROOF_PROVIDER`, NVIDIA NIM the free-first
auto-fallback, OpenRouter the optional manual fallback — all
`NON_SENSITIVE_PROOF_ONLY`, never auto-selected for ordinary work. The premium
`implementation`-stage escalation (Codex CLI / ChatGPT login, or the paid OpenAI
API) may be used ONLY for the `implementation` stage, and ONLY for a run the Human
Founder explicitly authorized via `AI_COMPANY_PREMIUM_IMPL_PROVIDER` — bounded, no
free fallback on failure, never auto-engaged. Do not onboard any other paid
provider and do not use premium for any other stage. **Project Factory V0.1** may
create project *definitions* under `projects/<slug>/` and Runtime handoff
packages — deterministically, with no model call — but it starts no build:
entering BUILD needs `ai-company project authorize-build` by the Human Founder.

**Authorized-project build carve-out.** Once the Human Founder has run
`ai-company project authorize-build <slug>` (RISK 5, audited), that **one**
project's application code MAY be written **locally** under
`projects/<slug>/` — source, migrations, tests, local dev only. Currently
authorized: **`qa-portfolio`** (authorized 2026-09-02, see
`projects/qa-portfolio/decisions/decision-log.md`). A **development / staging** Supabase project for an authorized build — with the
schema migrations applied to it — is permitted once the Human Founder explicitly
decides so per build (done for `qa-portfolio` on 2026-09-03); its credentials
stay only in gitignored `web/.env.local`. Even for an authorized project, the
following stay prohibited without a further explicit Human Founder decision: any
production deployment, provisioning a **production** cloud / Supabase / hosting
project, using real customer/personal data, onboarding a paid provider,
financial actions, destructive production operations, and merging to `main`. Missing professional content uses visible
`[PLACEHOLDER]` values and is never invented. Where progress needs a credential
or a human action, stop that thread, state in Turkish exactly what is required,
and continue the independent work.

Still **do not build** (unchanged): Cleaning Commerce or any *un*authorized
project's application code, any commerce frontend/backend,
Vendure/Medusa/Saleor, a control tower, CRM/ERP, marketing/ops agents, n8n
workflows, production cloud infra, mobile apps, payment integration, or any real
production deployment. Do not deploy, wire a real production model provider, or
use real credentials or customer data. Do not adopt Mastra or any agent
framework as a dependency yet (ADR-0014 keeps it `DEFERRED` behind the
`AgentRunner` interface). Anything only planned must be labeled `PLANNED` /
`RESEARCHED` / `DEFERRED` / `NOT_IMPLEMENTED`.

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

## 15. Language & code-comment standard

The Human Founder is not a fluent English speaker. Two standing rules, detailed in
[`docs/coding-standards.md`](docs/coding-standards.md):

- **Communicate with the Human Founder in Turkish.** All user-facing explanations,
  questions, decision requests, progress/error reports, test results and next-step
  instructions are written in Turkish. Technical identifiers (code, file/branch
  names, commands, framework/API terms) stay in English but are always explained in
  Turkish; never leave the Founder to interpret English terminal output. Decisions:
  state the situation, the options, each option's consequence, and a clear
  recommendation. Errors: what it is, whether it is critical, the cause if known,
  what happens next. End every significant development step with a Turkish report
  (files changed · feature · what it does · tests run · results · risks · next step).
- **Source-code comments are written in Turkish; identifiers stay English.** Naming
  (variables, functions, classes, files, folders, API/route names, DB table/column
  names, framework terms) follows international convention in English. Comments and
  JSDoc/TSDoc explain **why** the code exists and **which business rule** it enforces,
  in Turkish — mandatory for auth, authorization, RLS, Supabase/DB operations, the
  admin CMS, draft/published/archived and featured/supported rules, TR/EN
  localization, API handlers, form validation, cache/revalidation, error handling,
  security-critical code, complex hooks and state. Comment **why**, not **what**; no
  noise comments. Per-filetype format (`//`, `/** */`, `--`, `<!-- -->`, `#`); no
  comments in JSON. Comments must not break lint/build or contain secrets.
- Applies to this repo and every `projects/<slug>/` project from now on, first in
  `projects/qa-portfolio/`. The existing `runtime/` code is not retrofitted; only
  new files added there follow it. This standard weakens no quality gate, security
  rule, or Human-Founder approval requirement.
