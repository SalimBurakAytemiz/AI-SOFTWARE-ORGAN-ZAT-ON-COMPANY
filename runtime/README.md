# AI Software Company — Agent Runtime (V1.0 core + V1.1 real agent execution)

This directory is the **executable runtime** for the organization defined in the rest
of this repository. It loads the agent definitions, skills, tools, capabilities,
model tiers, workflows and policies from `../` and coordinates them to carry a Human
Founder task through a gated lifecycle — stopping for explicit Human Founder approval
on every critical action.

**V1.1** adds real, model-backed agent execution and a Software Factory proof: a
generic OpenAI-compatible provider, a reusable prompt/context assembler, a
validated `AgentExecutionResult` contract, a disposable proof workspace with
default-deny file + command capabilities, a real-request budget, and a proof that
drives real AI agents through `feature-development` to the Human Founder approval
gate. See [`../docs/real-agent-execution.md`](../docs/real-agent-execution.md).

## REAL AGENT PROOF (Founder quickstart)

```
cd runtime && npm install && npm run check      # offline, no key, 170 tests

export AI_COMPANY_REAL_PROVIDER=groq             # preferred proof provider
export AI_COMPANY_REAL_MODEL=openai/gpt-oss-120b
export GROQ_API_KEY=...                          # your key — shell/env only, never commit

node bin/ai-company.js doctor --probe            # Groq Direct (live) -> OK
node bin/ai-company.js proof real-agent          # watch the agents execute
node bin/ai-company.js proof status              # what ran, which gates passed
node bin/ai-company.js audit --task <task-id>    # full evidence
```

The run stops at `PRODUCTION: HUMAN APPROVAL REQUIRED`. Nothing is deployed,
merged or released. Without a key it reports `REAL PROOF BLOCKED` and does not
fake success. **Groq Direct** is the preferred proof provider and **OpenRouter**
(`AI_COMPANY_REAL_PROVIDER=openrouter` + `OPENROUTER_API_KEY`) the optional
fallback — both **PROOF_PROVIDER** / `NON_SENSITIVE_PROOF_ONLY`, not approved
production providers; moving to a paid provider needs separate Human Founder
authorization.

- **Language / platform:** TypeScript, run natively by Node.js 22.6+ (type stripping;
  no build step). Decision and alternatives: [`../architecture/adr-agent-runtime.md`](../architecture/adr-agent-runtime.md).
- **Dependencies:** `yaml`, `ajv`, `ajv-formats`. Persistence is the built-in
  `node:sqlite`; tests use the built-in `node:test`.
- **No paid API keys.** The default model provider is a deterministic mock. Real
  providers attach later through the `ModelProvider` abstraction (LiteLLM adapter).

## Quick start

```
cd runtime
npm install
npm run check          # typecheck + full test suite (offline, no API key)
node bin/ai-company.js doctor
node bin/ai-company.js proof
```

## The CLI

```
ai-company doctor                     runtime health
ai-company agents list                the 18 AI employees
ai-company workflows show feature-development
ai-company task run "<instruction>"   create + classify + drive to Human approval
ai-company approvals list
ai-company approvals approve <id>     (decided as 'human-founder' only)
ai-company approvals reject <id>
ai-company audit [--task <id>]
ai-company proof software-factory     V1.1 Software Factory proof (mock)
ai-company proof real-agent           V1.1 proof with the real (proof) provider
ai-company proof status               latest Software Factory proof run
ai-company pause "<reason>"           global kill switch
ai-company resume
```

## Documentation

- [`../docs/agent-runtime.md`](../docs/agent-runtime.md) — start here
- [`../docs/runtime-architecture.md`](../docs/runtime-architecture.md) — modules and data flow
- [`../docs/task-execution.md`](../docs/task-execution.md) — what happens when you give it a task
- [`../docs/human-approval-runtime.md`](../docs/human-approval-runtime.md) — the approval engine
- [`../docs/runtime-operations.md`](../docs/runtime-operations.md) — day-to-day operation
- [`../docs/runtime-troubleshooting.md`](../docs/runtime-troubleshooting.md)

## Layout

```
src/
  core/          shared types, errors, ids, clock, redaction, doctor
  config/        repo-root paths, YAML loading, JSON-Schema validation (reuses ../schemas)
  registry/      agent / skill / tool+capability / workflow / policy / model loaders
  policy/        risk assessment + the default-deny PolicyEngine
  permissions/   the CapabilityGateway (in front of every consequential tool call)
  approvals/     the Human Approval Engine (states, human-founder-only decisions)
  state/         StateStore interface + node:sqlite implementation + RuntimeControl (pause)
  audit/         append-only, schema-validated, secret-redacted audit ledger
  cost/          honest cost accounting (NOT_CONFIGURED budgets are never faked)
  models/        ModelProvider interface + MockModelProvider + LiteLlmProvider + ModelRouter
  telemetry/     OpenTelemetry-shaped span buffer
  sandbox/       Sandbox interface + LocalSandbox (working-directory bounded)
  workflows/     the gated WorkflowEngine (checkpoint / resume, no approval bypass)
  orchestrator/  task intake, classifier, bounded-context builder, Orchestrator
  agents/        AgentRunner (derives behaviour from the definition)
  proof/         the one safe end-to-end proof workflow
  cli/           the ai-company command-line interface
test/            unit + integration + workflow + security + approval + proof tests
fixtures/        disposable demo-service used by the proof
```
