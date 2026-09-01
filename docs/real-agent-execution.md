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
| Real provider resolver | `runtime/src/models/real-provider.ts` | Builds the provider from environment. OpenRouter is the **first proof configuration** — a `PROOF_PROVIDER`, not an approved production provider. |
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
npm run check                       # 103 runtime tests, offline, no key

# 1. Configure a provider credential securely (never commit it)
export AI_COMPANY_REAL_PROVIDER=openrouter
export OPENROUTER_API_KEY=...        # your key, shell only

# 2. Health check
node bin/ai-company.js doctor        # OpenRouter proof provider -> OK

# 3. Run the real Software Factory proof
node bin/ai-company.js proof real-agent

# 4. Watch each role execute, gates pass, and the run stop at:
#    PRODUCTION: HUMAN APPROVAL REQUIRED

# 5. Review the evidence
node bin/ai-company.js proof status
node bin/ai-company.js audit --task <task-id>
ls runtime/build/proof/<task-id>/
```

Without a key:

```
node bin/ai-company.js proof real-agent
# REAL PROOF BLOCKED: OPENROUTER_API_KEY is not configured ...
```

The mock proof always works and is always labelled `MOCK`:

```
node bin/ai-company.js proof software-factory
```

---

## 4. Configuration reference

| Variable | Default | Meaning |
|---|---|---|
| `AI_COMPANY_REAL_PROVIDER` | `openrouter` | `openrouter` \| `openai-compatible` \| `disabled` |
| `AI_COMPANY_REAL_BASE_URL` | `https://openrouter.ai/api/v1` | OpenAI-compatible base URL |
| `AI_COMPANY_REAL_MODEL` | a free OpenRouter model | model id |
| `AI_COMPANY_REAL_API_KEY_ENV` | `OPENROUTER_API_KEY` | **name** of the env var holding the key |
| `AI_COMPANY_REAL_TIMEOUT_MS` | `60000` | per-request timeout |
| `AI_COMPANY_REAL_MAX_RETRIES` | `2` | extra attempts on 429 / 5xx / network error |
| `OPENROUTER_API_KEY` (or the named var) | — | the key itself; **shell/env only, never committed** |

See `runtime/.env.example`.

### Secret handling

The API key is read from the named environment variable **at call time** and held
only in a local variable for the duration of the HTTPS request. It is never
stored on the provider instance, written to the repository, a config file, a log,
the audit ledger, a prompt, memory, or a test snapshot, and never printed.

---

## 5. Safety properties (all covered by tests)

- **Provider independence** — a generic OpenAI-compatible adapter; OpenRouter is
  one config, marked `PROOF_PROVIDER` / `NON_SENSITIVE_PROOF_ONLY`.
- **No auto-spend** — the real provider is never in the general router rotation.
  Ordinary tasks and the mock proof never touch it. Moving from a zero-cost proof
  provider to a paid provider needs separate Human Founder authorization.
- **No fake success** — if the real provider is unavailable the proof reports
  `REAL_PROOF: BLOCKED_PROVIDER_UNAVAILABLE`; it never silently falls back to the
  mock and claims the real proof passed.
- **Structured or blocked** — a malformed `AgentExecutionResult` is retried once
  within the request budget, then BLOCKS the workflow.
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
| `REAL PROOF BLOCKED: OPENROUTER_API_KEY is not configured` | Export the key in your shell. |
| `BLOCKED_SENSITIVE_TASK` | The task text looks like it contains PII / payment / production secrets. Use a benign task, or an approved provider with a data-processing agreement. |
| `PROVIDER_RATE_LIMITED` after retries | The free model is busy. Re-run, or set `AI_COMPANY_REAL_MODEL` to another free model. |
| `PROVIDER_TIMEOUT` | Raise `AI_COMPANY_REAL_TIMEOUT_MS`. |
| A stage is `BLOCKED` with "malformed structured output" | The selected free model cannot hold the JSON contract. Choose a stronger free model; validation is never removed to accommodate a weak model. |
| `REQUEST_BUDGET_EXCEEDED` | The run hit the 30-request ceiling (usually repeated malformed responses). Investigate the model choice. |
| Cost shows `UNKNOWN` | The provider did not report cost. It is **not** assumed free just because the model name says "free". |
