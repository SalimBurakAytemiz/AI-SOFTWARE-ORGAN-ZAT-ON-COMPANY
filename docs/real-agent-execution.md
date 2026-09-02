# Real Agent Execution + Software Factory Proof (Runtime V1.1)

Runtime V1.0 proved the *machinery* — routing, hand-off, gates, persistence, audit,
the Human Founder approval stop — with a deterministic mock model. **Runtime V1.1**
proves that **real AI agents** can receive one Human Founder software-development
request and execute a controlled workflow end to end, producing real code, real
test evidence and real review, then stopping for Human Founder approval.

It does this at minimum cost, in an isolated disposable workspace, with no
production deployment, no real customer data, no financial operations, and no paid
model requirement.

---

## 1. What was added

| Piece | File | Purpose |
|---|---|---|
| Generic OpenAI-compatible provider | `runtime/src/models/openai-compatible-provider.ts` | `baseUrl` + `apiKeyEnv` + `model` + `timeout` + `retry` + `headers` + usage metadata. Not hard-coded to any vendor. |
| Real provider resolver | `runtime/src/models/real-provider.ts` | Builds ONE generic OpenAI-compatible provider from environment. **Groq Direct** is the preferred V1.1 proof provider (default); **NVIDIA NIM** is the free-first fallback (auto-engaged on Groq `RATE_LIMIT_EXHAUSTED`); **OpenRouter** is the optional manual fallback (never auto-added). All are `PROOF_PROVIDER` / `NON_SENSITIVE_PROOF_ONLY`, not approved production providers, never paid. `resolveProofProviderChain()` returns `{ primary, fallbacks }`. |
| Free-first provider fallback | `runtime/src/models/real-provider.ts` (`resolveProofProviderChain`), `runtime/src/proof/software-factory.ts` | On a **bounded** Groq `RATE_LIMIT_EXHAUSTED` during the proof, the runner preserves the workflow checkpoint, records a `provider_transition` audit event (`from_provider` / `to_provider` / `reason=RATE_LIMIT_EXHAUSTED` / `stage`), switches to NVIDIA NIM, and retries **only the blocked stage**. Completed stages, tool writes and artifacts are never repeated; the shared request budget keeps counting (ceiling still enforced). Not triggered by a normal 429, a 5xx, a provider error or a model-response failure. |
| Structured agent result | `runtime/src/agents/agent-execution-result.ts` | `AgentExecutionResult` contract + parser/validator. Malformed → retry within budget → **BLOCK** (never guessed). |
| Prompt / context assembler | `runtime/src/agents/prompt-assembler.ts` | One reusable assembler (not 18 hand-written prompts). Bounded context; per-stage budget. |
| Real agent runner | `runtime/src/agents/real-agent-runner.ts` | Model → requested tool call → **Capability Gateway** → Policy Engine → ALLOW/DENY → executor. Runner-enforced machine evidence for QA and security. |
| Request budget | `runtime/src/proof/request-budget.ts` | Target ≤ 20, hard ceiling 30 real requests. Ceiling → BLOCK, no loops. |
| Proof workspace | `runtime/src/proof/proof-workspace.ts` | Disposable `build/proof/<task>/workspace`, seeded from the fixture. `workspace.read/list/write/patch/exec` with path-jail + command allow-list. DEFAULT DENY. |
| Artifact store | `runtime/src/proof/artifact-store.ts` | `build/proof/<task>/*.md`, attributable to agent/task/workflow/timestamp, labelled `PROOF_ONLY`. |
| Sensitivity guard | `runtime/src/proof/proof-sensitivity.ts` | Blocks tasks carrying PII / payment data / production secrets while the proof provider is active. |
| Software Factory driver | `runtime/src/proof/software-factory.ts` | Drives `feature-development` with real agents for the 9 key stages, deterministic auxiliary steps elsewhere, stopping at `HUMAN_APPROVAL_REQUIRED`. |
| CLI | `ai-company proof software-factory [--real]`, `proof real-agent`, `proof status`, `doctor` rows, `audit --task` | Founder-facing. |

The existing `AgentRunner`, `Orchestrator`, `WorkflowEngine`, `PolicyEngine`,
`CapabilityGateway`, `ApprovalEngine`, `StateStore`, `AuditLog` and
`ModelProvider` abstraction are **reused, not replaced**. No new agent framework
(Mastra / LangGraph / CrewAI / Agno) was introduced.

---

## 1a. Verification status (2026-09-02)

Offline: 223 runtime tests + 85 organization tests green, typecheck clean;
`gitleaks` clean. The full pipeline is proven end-to-end against local
OpenAI-compatible fake servers + a mocked Codex CLI (strict JSON-Schema output,
the `json_schema → json_object → prompt-only` self-heal cascade, the bounded
one-shot test-repair, rate-limit pacing / 429 reset waits / `RATE_LIMIT_EXHAUSTED`,
truncation retry, provider HTTP/5xx/404, `insufficient_quota` →
`PROVIDER_QUOTA_EXHAUSTED`, `doctor --probe`, the Groq→NVIDIA free-first fallback,
the implementation-stage hardening below, and the premium implementation
escalation — both the `codex-cli` harness (detection, ChatGPT-login readiness
without reading auth files, `OPENAI_API_KEY`-stripped child env, bounded 1 run +
1 repair, changed-file scope check, shared deterministic gates, independent
review) and the paid `openai` API path).

**Live-provider evidence (2026-09-02).** A real run reached `spec_review` on Groq,
hit the Groq free-tier per-day token cap (`RATE_LIMIT_EXHAUSTED`), transitioned to
NVIDIA NIM with the checkpoint preserved, and NVIDIA passed `spec_review`,
`architecture` and `plan`. It then FAILed at `implementation` on free-model code
quality. Forensic analysis of that run found:

- **The `architecture` and `plan` stages hallucinated the stack** — both artifacts
  describe an "Express app" tested with "Jest", but the fixture is plain
  `node:http` with `node --test` and no existing tests. Those stages are not
  shown the workspace, so they guessed.
- **The `implementation` stage inherited that false plan** and, separately, the
  double-escaped `args_json` string form of `workspace.write` defeated the free
  model (both write calls came back `args_json is not valid JSON`). The stage then
  applied no code change at all and BLOCKed fail-safe on the `npm test` /
  `requireWorkspaceChange` gates.

**Implementation-stage hardening (2026-09-02), no gate weakened:**

1. **Deterministic `projectFacts()`** — the runtime analyses the real workspace
   (module system, `scripts.test` + discovery rule, entrypoint + exports,
   existing tests) and hands the result to the implementation stage as
   AUTHORITATIVE context; the stage is told to *ignore* any earlier artifact that
   contradicts it.
2. **First-class `fileChanges`** — code and test changes are delivered as an
   array of complete files (`{ path, operation, content }`), not as
   double-escaped `args_json` strings. Each entry is applied as a
   `workspace.write` through the same Capability Gateway and audit path.
3. **Inspect-first directives** — the model must state, in `reasoningSummary`,
   the module system, the test command, the file+symbol it will change, and the
   test path + why the runner discovers it, before its changes.
4. **`requireTestChange` gate** — a code stage that writes no discoverable test
   file BLOCKs with a precise reason (in addition to the existing `npm test`
   0-passing gate).
5. **Repair with real evidence** — the one bounded repair pass is fed the exact
   failing command, exit code, stderr tail, the current content of the files the
   model wrote, and the module/discovery facts, and is told to fix only the
   demonstrated failure, not redesign.
6. **`.npm` pollution fixed** — the seed fixture now `.gitignore`s `.npm/` so
   `npm test`'s own cache files can't mask "the model changed nothing".
7. **Workspace snapshot/restore on provider fallback** — a Groq→NVIDIA transition
   mid-stage rolls the workspace back to a pre-stage checkpoint so a partial
   write is never re-applied.

The one required real run to `HUMAN_APPROVAL_REQUIRED` has **not yet completed**.
Timeline of the blockers, none a runtime defect: (1) free-model implementation
quality — addressed by the hardening above; (2) the paid OpenAI API path — the
supplied key authenticates but the org has **zero API credit**
(`insufficient_quota`), so the runtime classified it `PROVIDER_QUOTA_EXHAUSTED`
and stopped with **zero tokens billed**; (3) the Codex CLI path — `codex exec`
**hung** because `promisify(execFile)` left its stdin an open pipe with no EOF
(two 15-minute timeouts, no edits). That is **fixed**: the harness now spawns
`codex exec` with stdin closed (`/dev/null`) and process-group kill. Verified live
(2026-09-02): a bounded `codex exec` against a copy of the demo-service fixture
completed in ~47 s, changed exactly `src/server.js` + a discoverable test, passed
every deterministic gate, and `GET /health` returned `200 {"status":"ok"}`. The
milestone remains **BUILD / BLOCKED** pending one full real Software Factory proof
to `HUMAN_APPROVAL_REQUIRED`.

---

## 2. The proof chain

The task — *"Add a GET /health endpoint … return HTTP 200 and JSON with
`status: 'ok'` … add automated tests and documentation"* — enters through normal
task intake, classifies to `feature-development`, and runs:

| Stage | Role | Real model? | What it must actually do |
|---|---|---|---|
| business_analysis | AI Business Analyst | ✅ | produce requirements / acceptance criteria |
| spec_review, plan | AI Engineering Director / CTO | ✅ | confirm testable spec; implementation plan |
| architecture | AI Solution Architect | ✅ | technical plan / ADR notes |
| implementation | AI Backend Engineer | ✅ | **real `workspace.write` edits**; add `/health` + a test |
| code_review | AI Senior Code Reviewer | ✅ | **independently** inspect the real diff (never the implementer) |
| qa | AI QA Lead | ✅ | **runner executes `npm test`**; PASS needs machine evidence |
| security | AI Application Security Engineer | ✅ | deterministic checks on the diff before AI opinion |
| release_review | AI Release Manager | ✅ | evaluate gates → `READY_FOR_HUMAN_APPROVAL` or `BLOCKED` |
| human_approval | **Human Founder** | — | run STOPS here; nothing is deployed |

`idea`, `product_analysis`, `design`, `self_test`, `automated_test`, `staging`,
`staging_verify` run as deterministic auxiliary steps (no model request) to keep
the request count low.

---

## 3. Founder quickstart

```
cd runtime
npm install
npm run check                       # 170 runtime tests, offline, no key

# 1. Configure the PREFERRED proof provider (Groq Direct) securely - never commit it
export AI_COMPANY_REAL_PROVIDER=groq
export AI_COMPANY_REAL_MODEL=openai/gpt-oss-120b
export GROQ_API_KEY=...              # your key, shell/env only

# 2. Live health check (OK / NOT_CONFIGURED / RATE_LIMITED / ERROR)
node bin/ai-company.js doctor --probe   # "Groq Direct (live) -> OK"

# 3. Run the real Software Factory proof
node bin/ai-company.js proof real-agent

# 4. Watch each role execute, gates pass, and the run stop at:
#    PRODUCTION: HUMAN APPROVAL REQUIRED

# 5. Review the evidence
node bin/ai-company.js proof status
node bin/ai-company.js audit --task <task-id>
ls runtime/build/proof/<task-id>/
```

OpenRouter remains an optional fallback proof provider:

```
export AI_COMPANY_REAL_PROVIDER=openrouter
export AI_COMPANY_REAL_MODEL=openrouter/free   # or a pinned model id
export OPENROUTER_API_KEY=...
```

Without a key:

```
node bin/ai-company.js proof real-agent
# REAL PROOF BLOCKED: GROQ_API_KEY is not set; real-agent proof is BLOCKED_PROVIDER_UNAVAILABLE
```

The mock proof always works and is always labelled `MOCK`:

```
node bin/ai-company.js proof software-factory
```

---

## 4. Configuration reference

| Variable | Default | Meaning |
|---|---|---|
| `AI_COMPANY_REAL_PROVIDER` | `groq` | `groq` (preferred) \| `openrouter` (fallback) \| `openai-compatible` \| `disabled` |
| `AI_COMPANY_REAL_BASE_URL` | provider default (`groq` → `https://api.groq.com/openai/v1`) | OpenAI-compatible base URL |
| `AI_COMPANY_REAL_MODEL` | provider default (`groq` → `openai/gpt-oss-120b`; `openrouter` → `openrouter/free`) | explicit model id override |
| `AI_COMPANY_REAL_API_KEY_ENV` | provider default (`groq` → `GROQ_API_KEY`; `openrouter` → `OPENROUTER_API_KEY`) | **name** of the env var holding the key |
| `AI_COMPANY_REAL_TIMEOUT_MS` | `60000` | per-request timeout |
| `AI_COMPANY_REAL_MAX_RETRIES` | `2` | extra attempts on 429 / 5xx / network error |
| `GROQ_API_KEY` / `OPENROUTER_API_KEY` (or the named var) | — | the key itself; **shell/env only, never committed, never logged/audited** |

See `runtime/.env.example`.

`ai-company doctor` always shows a **Groq Direct proof provider** row and an
**OpenRouter proof provider** row (OK when that key is present, NOT_CONFIGURED
otherwise, `[ACTIVE]` on the selected one). `ai-company doctor --probe` adds one
live row for the selected provider — `OK / NOT_CONFIGURED / RATE_LIMITED / ERROR`
— using a `GET /models` reachability + auth check that spends no completion tokens.

### Secret handling

The API key is read from the named environment variable **at call time** and held
only in a local variable for the duration of the HTTPS request. It is never
stored on the provider instance, written to the repository, a config file, a log,
the audit ledger, a prompt, memory, or a test snapshot, and never printed.

---

## 5. Safety properties (all covered by tests)

- **Provider independence** — ONE generic OpenAI-compatible adapter (no per-vendor
  HTTP/model client). Groq Direct and OpenRouter are just configurations of it,
  each marked `PROOF_PROVIDER` / `NON_SENSITIVE_PROOF_ONLY`.
- **No auto-spend** — the real provider is never in the general router rotation.
  Ordinary tasks and the mock proof never touch it. Moving from a zero-cost proof
  provider to a paid provider needs separate Human Founder authorization.
- **No fake success** — if the real provider is unavailable the proof reports
  `REAL_PROOF: BLOCKED_PROVIDER_UNAVAILABLE`; it never silently falls back to the
  mock and claims the real proof passed.
- **Structured or blocked** — a failed `AgentExecutionResult` parse is classified
  (`OUTPUT_TRUNCATED` when the model hit the output-token cap, `MALFORMED`
  otherwise), retried once within the request budget (a truncation retry raises
  the token budget, bounded, and asks for compact JSON), then BLOCKS the
  workflow. Stages carry compact per-stage budgets (~2000–3000 tokens); the
  runner default and the global safety ceiling are configurable
  (`AI_COMPANY_AGENT_MAX_OUTPUT_TOKENS` / `..._CEILING`), never unlimited.
- **API-enforced structure where possible** — on models that support it (Groq
  `gpt-oss`) the `AgentExecutionResult` JSON Schema is sent as
  `response_format: { type: "json_schema", strict: true }`. The schema is built
  to Groq's strict-Structured-Output subset: every object sets
  `additionalProperties: false` and lists every property in `required`, `type`
  is always a single string (a nullable object is `anyOf: [ <object>, { type:
  "null" } ]`), and the genuinely open-ended tool-call arguments travel as a
  bounded `args_json` string that is parsed only after schema validation. This
  is defence in depth: `parseModelResult` still validates every response. If the
  provider rejects the schema **or** the model cannot finish a schema-valid
  object within the token budget (Groq returns HTTP 400 `json_validate_failed`,
  not a truncated 200), the client self-heals down a bounded cascade
  — `json_schema` → `json_object` → prompt-only — raising the output-token
  budget on each step, so a truncated generation comes back as a normal
  `finish_reason: "length"` 200 that the truncation retry can grow. A 400 whose
  body signals a per-minute token/request ceiling is treated as a rate limit
  (the scheduler waits), and any other 400 surfaces its redacted response body.
- **Free-tier rate-limit awareness** — the runtime reads `Retry-After` and every
  `x-ratelimit-*-requests` / `-tokens` header, records the (credential-free)
  numbers in telemetry + audit, paces real requests sequentially, waits for the
  provider's reset window on HTTP 429 (bounded retry cycles with small jitter,
  then `RATE_LIMIT_EXHAUSTED`), and pre-emptively waits when the learned budget
  is insufficient. Waiting for free-tier quota is **not** a critical action and
  needs no Human Founder approval; the workflow checkpoint is preserved and a
  stage is never executed twice. Limits are learned from headers; provider
  descriptors carry only safe fallback metadata.
- **Low reasoning by default** — model reasoning effort is `low` for every proof
  stage. `medium` burned so much of the completion budget on chain-of-thought
  that Groq's strict Structured Output truncated the JSON mid-object, so the
  small `/health` proof uses `low` throughout. Private chain-of-thought is never
  requested or stored.
- **Bounded test-repair** — if the runner's own `npm test` fails on the
  implementation stage's first pass, the agent gets **one** repair pass: the
  failing test output is fed back, it may issue more workspace tool calls, and
  the tests run again. One pass only, and it consumes one slot of the
  real-request budget (which BLOCKS at its ceiling).
- **Model never drives the shell** — every tool call is adjudicated by the
  Capability Gateway and Policy Engine before any executor runs.
- **Path jail** — `../` traversal, absolute paths, `.git` internals and
  secret-like paths are denied; writes are confined to the disposable workspace.
- **Command allow-list** — only `npm test|lint|typecheck|build`, `npm ci/install`
  and `node --test`. `rm -rf`, `sudo`, `curl | sh`, `git push`, `kubectl/terraform
  apply` and the like are refused.
- **Request budget** — target ≤ 20, ceiling 30; the ceiling BLOCKS the run.
- **Reviewer independence** — enforced by the WorkflowEngine; the reviewer is
  never the implementer.
- **QA / security evidence** — QA PASS requires a real `npm test` exit code and
  test count; security runs deterministic checks on the diff before any AI
  opinion.
- **Privacy guard** — a task that appears to contain customer PII, payment data or
  production secrets is BLOCKED before any real request while the proof provider
  is active.
- **Human Founder boundary** — the proof stops at `HUMAN_APPROVAL_REQUIRED`. It
  does not auto-approve. If later approved, only a clearly labelled
  `SIMULATED_RELEASE` occurs inside the fixture workflow; nothing is deployed.

---

## 6. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `REAL PROOF BLOCKED: GROQ_API_KEY is not set` (or `OPENROUTER_API_KEY`) | Export the selected provider's key in your shell, then `ai-company doctor --probe`. |
| `PROVIDER_HTTP` / HTTP 404 `MODEL_UNAVAILABLE` | The pinned `AI_COMPANY_REAL_MODEL` id was retired upstream. Unset it to fall back to the `openrouter/free` router, or pin a currently-served model id. |
| `PROVIDER_HTTP ... 400 (Bad Request): <body>` | A non-recoverable provider 400; the redacted response body is now in the message. If the body mentions `response_format` / `json_schema` / `json_validate_failed` the client already self-heals (`json_schema → json_object → prompt-only`); other causes (bad param, context length) need a config change. |
| A stage is `BLOCKED` with `RATE_LIMIT_EXHAUSTED` at the same stage every re-run | The free tier's per-day token budget is spent (`Retry-After` is minutes, not seconds). Wait for the daily reset, switch `AI_COMPANY_REAL_PROVIDER=openrouter`, or raise `maxWaitMsPerCycle` / `maxRetryCycles` if you are willing to wait a long cooldown. |
| `BLOCKED_SENSITIVE_TASK` | The task text looks like it contains PII / payment / production secrets. Use a benign task, or an approved provider with a data-processing agreement. |
| `WAITING_FOR_PROVIDER_QUOTA` lines on stderr | Normal. The free tier hit its per-window limit; the runtime is waiting for the reset window and will continue automatically. No action needed. |
| A stage is `BLOCKED` with `RATE_LIMIT_EXHAUSTED` | HTTP 429 did not clear within the bounded retry cycles (default 3, each honouring the provider's own reset window). The workflow checkpoint is preserved - re-run later, or raise `maxRetryCycles` / wait for the daily window. |
| `PROVIDER_TIMEOUT` | Raise `AI_COMPANY_REAL_TIMEOUT_MS`. |
| A stage is `BLOCKED` with "malformed structured output" (`modelStatus: MALFORMED`) | The selected free model cannot hold the JSON contract. Choose a stronger free model; validation is never removed to accommodate a weak model. |
| A stage is `BLOCKED` with "output truncated" (`modelStatus: OUTPUT_TRUNCATED`) | The model hit the output-token cap before the JSON closed, twice (finish_reason `length`/similar, or `output_tokens` == the cap). Raise `StagePlan.maxOutputTokens` for that stage (bounded by `AGENT_MAX_OUTPUT_TOKENS_CEILING`), or ask for a less verbose model. |
| `REQUEST_BUDGET_EXCEEDED` | The run hit the 30-request ceiling (usually repeated malformed responses). Investigate the model choice. |
| Cost shows `UNKNOWN` | The provider did not report cost. It is **not** assumed free just because the model name says "free". |

---

## 7. Model-tier routing policy (STANDING policy; premium path is authorization-gated per run)

This is the standing routing policy for all Runtime work. The premium path is
**not auto-engaged** — it requires an explicit Human Founder authorization for
each run (an env flag; see below). Landing the full policy into
`models/routing.yml` / `models/risk-policy.yml` is still a **RISK 5 governance
change** (see `.github/CODEOWNERS`); the mechanism below is what the runtime
enforces today.

| Risk band | Model policy |
|---|---|
| **LOW** (risk 0–1) | FREE tier only. |
| **MEDIUM** (risk 2–3 — the current `/health` proof is MEDIUM / standard development) | FREE-FIRST → Groq → NVIDIA, with a bounded free retry / provider fallback. If a stage's genuine free quality/retry budget is exhausted (the implementation stage fails its own deterministic gates after the bounded retry **and** the one test-repair pass, on the free provider **and** its free fallback), that stage becomes `PREMIUM_ELIGIBLE` → **HUMAN FOUNDER AUTHORIZATION** → **Codex CLI premium** (`AI_COMPANY_PREMIUM_IMPL_PROVIDER=codex-cli`), or the paid OpenAI API. Premium is used for that stage only, and only for the authorized run. |
| **HIGH** (risk 4) | `PREMIUM_ELIGIBLE` for the implementing stage, behind a Human Founder policy / budget gate; review at `CRITICAL_REVIEW`. |
| **CRITICAL** (risk 5) | Independent PREMIUM models where appropriate, deterministic validation, **plus** Human Founder approval before execution (unchanged from `risk-policy.yml`). |

**Never auto-spend premium budget merely because a free provider failed.** The
runtime BLOCKs fail-safe when the free budget is exhausted; a human decides
whether to escalate.

### How a premium escalation is authorized and bounded (implementation stage)

The Human Founder authorizes a premium escalation for a single run by setting one
environment variable. **`AI_COMPANY_PREMIUM_IMPL_PROVIDER` is the authorization
itself.** Two paths:

**Preferred — Codex CLI (ChatGPT login, no paid API credit)**

```
AI_COMPANY_PREMIUM_IMPL_PROVIDER=codex-cli
AI_COMPANY_PREMIUM_IMPL_MODEL=            # optional; empty = the account default model
```

Requires the Codex CLI authenticated with a ChatGPT account
(`codex login status` ⇒ "Logged in using ChatGPT"). The runtime interacts only
through `codex exec` — it never reads or copies `~/.codex/auth.json`, and it
**unsets `OPENAI_API_KEY`** for the Codex child so an empty-credit API key is
never used.

`codex exec` runs `--sandbox workspace-write --skip-git-repo-check --ephemeral
--json`, confined by `--cd` to the disposable proof workspace (the minimum needed
to let Codex edit files there — not a global sandbox bypass; no
`--dangerously-bypass-approvals-and-sandbox`). **Critical (root cause fixed
2026-09-02):** the child is spawned with `stdio[0] = "ignore"` so its stdin is
`/dev/null`. `promisify(execFile)` leaves the child an *open stdin pipe with no
EOF*, and Codex 0.152.1 — which reads a piped stdin to append a `<stdin>` block —
then blocks forever in "Reading additional input from stdin..." (observed: two
15-minute timeouts, ~0 CPU, no edits). The harness also gives Codex its own
process group and, on the wall-clock deadline, SIGTERM→SIGKILLs the **whole
group** so sandbox-helper descendants never leak.

Each `codex exec` is classified: `CODEX_SUCCESS` (exit 0), `CODEX_TIMEOUT`,
`CODEX_AUTH_REQUIRED`, `CODEX_APPROVAL_BLOCKED`, `CODEX_PROCESS_ERROR`; the caller
adds `CODEX_NO_WORKSPACE_CHANGE` when a clean exit changed nothing. `AUTH` /
`APPROVAL` map to `PREMIUM_PROVIDER_UNAVAILABLE` and stop the run with no repair.
Codex edits files directly; the runtime then validates with the shared
deterministic gates.

**Alternative — paid OpenAI Chat Completions API (needs org API credit)**

```
AI_COMPANY_PREMIUM_IMPL_PROVIDER=openai
OPENAI_API_KEY=...                        # environment only, never committed/logged
AI_COMPANY_PREMIUM_IMPL_MODEL=gpt-5.1     # default priority: gpt-5.1 → gpt-5 → gpt-4.1
```

The credential is read only by name; the provider reads the key at call time and
never logs/persists/audits it. OpenAI's newer models need `max_completion_tokens`
and reject `temperature: 0`, so the descriptor sets
`tokenParam: "max_completion_tokens"`, `omitTemperature`, `omitSeed`. The
`*-codex` / `*-pro` variants are `/v1/responses`-only and are deliberately not in
the default priority list — the shared `OpenAICompatibleProvider` speaks
`chat/completions`.

When either is set, the Software Factory proof:

- uses the premium path for the **`implementation` stage only** — every other
  stage stays on the free-first chain (Groq → NVIDIA);
- is **bounded**: one primary attempt + at most one targeted repair;
- records a `premium_escalation` audit event (provider, model, model source,
  risk, reason) **before** the first premium request;
- runs the change through the **same** deterministic gates — `decideImplementationOutcome`
  in `runtime/src/agents/implementation-gates.ts` is the single source of truth
  shared with the free/API runner: workspace-change, `requireTestChange`, the
  project's own test command, test discovery, `/health` source check. For the
  Codex path there is also a **changed-file scope check** (only `src/`, `test/`,
  `docs/`, `package.json`, `README`, `.gitignore` may change). The premium
  implementer's own claim of success is **never** sufficient evidence;
- keeps **independent review intact** — the premium implementer does not review
  its own work (`code_review` is `senior-code-reviewer`);
- on any premium failure (bad code that fails a gate; a Codex non-zero exit /
  timeout / not-logged-in; or an OpenAI `insufficient_quota` →
  `PROVIDER_QUOTA_EXHAUSTED`) STOPS with `PREMIUM_IMPLEMENTATION_FAILED` — **no
  free fallback, no premium retry, no further spend**.
