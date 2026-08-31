# Tool Gap Analysis

Goal: map required capabilities to tools, adopt the minimum set, and record overlaps
so we do not run three tools where one suffices. Full per-tool metadata lives in
`../tools/registry.yml`; per-project reasoning in `repositories/`.

## Capability → tool map

| Capability needed | Primary (ADOPTED) | Secondary / overlap | Notes |
|---|---|---|---|
| Version control | Git | — | Baseline. |
| Forge, PRs, branch protection, code scanning | GitHub | — | Enforcement point for git + release + human-approval gates. |
| CI/CD | GitHub Actions | `act` (local) | CI logic kept in portable scripts to limit lock-in. |
| Human-driven agent harness | Claude Code | opencode, goose (OPTIONAL) | Avoid harness monoculture; opencode as second option. |
| Spec / plan authoring | spec-kit (OPTIONAL) | BMAD ideas | Front of lifecycle; not mandatory. |
| Reusable skills | native `skills/` (this repo) | superpowers plugin (OPTIONAL) | Own format, schema-validated. |
| Repo context packing | Repomix | aider repo-map (technique only) | Includes secret pre-flight. |
| Model gateway / provider abstraction | LiteLLM | — | Per-agent virtual keys + budgets + spend logs. |
| Prompt / agent evaluation | promptfoo | — | Regression gate for agent prompts. |
| LLM red teaming | promptfoo `redteam` | — | OWASP LLM Top 10 coverage. |
| Observability wire format | OpenTelemetry | — | Contract now; Collector when there is traffic. |
| LLM/agent trace + cost UI | Langfuse (DEFERRED) | Grafana/Tempo, vendor SaaS | OTel-native so it is swappable. |
| PR first-pass review | pr-agent (OPTIONAL) | — | Feeds the independent reviewer; never merges. |
| SAST | Semgrep (OSS) | custom house ruleset | Encodes our invariants. |
| SCA (dependencies) | Trivy | osv-scanner (OPTIONAL, precise + `fix`) | Trivy primary to cut gate noise. |
| IaC misconfig scanning | Trivy | Semgrep IaC rules, `conftest` | Only relevant once infra exists. |
| Container image scanning | Trivy | — | On every image build. |
| Secret scanning | gitleaks (pre-commit + CI) | Trivy secrets, Repomix Secretlint | Layered at three points. |
| SBOM | Trivy | Syft (if needed) | Generated per release. |
| DAST | OWASP ZAP (OPTIONAL→ADOPT) | — | Staging-only; activate with the product. |
| Secrets storage / injection | credential-proxy pattern (DEFERRED tool) | Infisical Agent Vault / Agent Proxy | Policy written to be tool-agnostic. |
| E2E / browser testing | Playwright | — | Also component + API-request tests. |
| Agent-driven UI verification | Playwright MCP (OPTIONAL) | — | Domain allowlist required. |
| Dependency updates | Renovate | Dependabot (fallback) | Conservative auto-merge only. |
| Container isolation | Docker / OCI | Podman/nerdctl | Engine/Compose, not Desktop. |
| Strong isolation for hostile code | E2B / Daytona (DEFERRED) | gVisor/Kata | Decide in runtime phase. |
| Durable execution / approval waits | Trigger.dev or LangGraph/Mastra (DEFERRED) | — | Runtime-phase decision. |
| Policy decision engine | OPA/Rego (OPTIONAL→ADOPT) | our Python validators, `conftest` | Runtime enforcement of `policies/`. |
| IaC provisioning | OpenTofu (DEFERRED) | — | plan=proposal, apply=RISK 5. |
| Integration automation (business ops) | n8n (DEFERRED) | Trigger.dev | Out of scope now; license caveat. |

## Identified overlaps and the resolution

1. **Secret scanning ×3** (gitleaks, Trivy, Repomix/Secretlint) — *intentional*
   defense in depth at commit time, pack time, and CI. gitleaks is the blocking
   pre-commit gate; the others are backstops.
2. **SCA ×2** (Trivy, osv-scanner) — Trivy is the single blocking gate; osv-scanner
   is OPTIONAL for precise triage and `fix` guidance in the dependency-update
   workflow. Do not run both as blocking gates by default.
3. **SAST vs org validation** (Semgrep vs this repo's Python tests) — different
   targets: Semgrep scans *product* code; the Python tests validate *governance
   config*. `conftest`/OPA can later add a third, Rego-based config check.
4. **Code review** (Senior Code Reviewer agent vs pr-agent) — the agent is the
   reviewer of record; pr-agent is a tool it may consult. pr-agent never holds merge
   rights.
5. **Agent sandbox ×3** (OpenHands runtime, Daytona, E2B) — one slot; decide in the
   Agent Runtime phase against real risk/volume data.
6. **Orchestration ×5** (LangGraph, Mastra, Agno, MAF, crewAI) — one core; LangGraph
   or Mastra recommended, decided in the runtime phase.
7. **Observability UI** (Langfuse vs Grafana stack vs vendor) — deferred; OTel
   contract keeps all three viable.

## Gaps with no tool yet (accepted, tracked)

- **Approval ledger / audit store** — schema defined (`schemas/audit-event.schema.json`);
  storage/query implementation is a runtime-phase task (candidate: append-only log →
  OTel + a queryable store; OPA decision logs feed it).
- **Agent performance datastore** — metrics defined (`docs/agent-system.md`);
  implementation deferred to the runtime (Langfuse scores + a metrics table).
- **Repository-evaluator utility** — specified in `docs/repository-research.md`;
  only a tiny validation helper is built now (`tests/`), not a full CLI.
