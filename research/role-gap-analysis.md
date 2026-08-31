# Role Gap Analysis

Method: start from the 17 candidate roles in the build spec (section 5). For each,
decide KEEP / MERGE / SPLIT / REMOVE. Then look for genuine responsibility gaps that
justify ADD. Bias hard against inflating the agent count — "another OSS project uses
a separate agent" is not evidence.

Inputs: MetaGPT (role decomposition), BMAD-METHOD (agile personas), spec-kit
(spec/plan split), OpenHands / SWE-agent (engineer execution), constitution
(independent review, human approval, cost discipline).

## Candidate-by-candidate

| # | Candidate role | Decision | Reasoning |
|---|---|---|---|
| 1 | AI Engineering Director / CTO | **KEEP** | Single coordination + routing + escalation owner. Guardrail: explicitly *not* a universal agent (enforced via `non_responsibilities`). |
| 2 | AI Product Manager | **KEEP** | Owns product intent, value, prioritization. Distinct from specification. |
| 3 | AI Business Analyst | **KEEP** | Owns user stories, business rules, acceptance criteria, traceability. Merging with PM would blur "what is valuable" vs "what exactly must be true". BMAD and spec-kit both keep this split. |
| 4 | AI UX/UI Designer | **KEEP** | IA, flows, states, accessibility, design system. No other role owns this. |
| 5 | AI Solution Architect | **KEEP** | System/component/integration architecture + tech decisions. Distinct from per-stack implementation. |
| 6 | AI Frontend Engineer | **KEEP** | TS/React/Next implementation + FE performance + a11y implementation. |
| 7 | AI Backend Engineer | **KEEP** | TS/Node APIs, authn/authz logic, business logic, background jobs. |
| 8 | AI Database Engineer | **KEEP** | Schema, indexing, transactions, migrations, backup/recovery. Distinct risk profile (RISK 5 migrations) justifies a dedicated owner rather than folding into backend. |
| 9 | AI Integration Engineer | **KEEP** | Third-party adapters, webhooks, idempotency, retries. Cleaning Commerce will be integration-heavy (payments, shipping, ERP/CRM). |
| 10 | AI QA Lead | **KEEP** | Test strategy, risk analysis, quality gates, release-quality recommendation. Strategy vs automation is a real split. |
| 11 | AI Test Automation Engineer | **KEEP** | Implements unit/API/integration/E2E automation, test data, CI wiring. |
| 12 | AI Application Security Engineer | **KEEP** | Appsec review, OWASP, SAST/DAST, dependency + secret + container security, security release gate. |
| 13 | AI DevOps / Platform Engineer | **KEEP** | Docker, CI/CD, environments, deployment *preparation*, backups, config. Pre-production focus. |
| 14 | AI SRE / Observability Engineer | **KEEP** | Production health, telemetry, SLOs, alerting, performance. Post-production focus. Merging 13+14 would put "build the pipeline" and "run production" on one overloaded role and weaken the pre-prod/prod separation of duties. |
| 15 | AI Incident / Debug Engineer | **KEEP** | Triage, reproduction, evidence, RCA, fix recommendation, postmortem. Distinct from SRE (detection/monitoring) and from engineers (feature work). |
| 16 | AI Senior Code Reviewer | **KEEP** | Structurally independent from the implementer. Constitution Article 5.2 makes this non-negotiable. |
| 17 | AI Release Manager | **KEEP** | Verifies the whole Release Gate; may mark `READY_FOR_HUMAN_APPROVAL`, may not approve production. |

**MERGE considered and rejected:** PM+BA (2+3), QA Lead + Test Automation (10+11),
DevOps + SRE (13+14). In each case the two halves have different time horizons,
different risk exposure, and — for 10+11 and 13+14 — a healthy separation-of-duties
reason to stay apart.

**SPLIT considered and rejected:** Solution Architect into "app architect" +
"security architect" — coordination with the Application Security Engineer covers it;
a separate security architect would create ownership ambiguity for RISK 5 security
architecture changes (which are Human-Founder decisions anyway).

**REMOVE:** none. Every candidate owns a distinct responsibility domain.

## Gap analysis → ADD

Sections 10, 11, 22 and 23 of the build spec create a substantial, ongoing body of
work that **no candidate role owns**:

- Maintain `models/tiers.yml`, `models/routing.yml`, `models/risk-policy.yml`.
- Operate the model gateway (LiteLLM): per-agent virtual keys, budgets, fallbacks.
- Own the prompt/agent **evaluation** harness (promptfoo) and its regression gate.
- Own model-call **observability** and **cost** telemetry (OTel/Langfuse), and the
  agent performance metrics that feed performance-based routing.

Assigning this to the Engineering Director would make it a universal agent (forbidden
by section 5). Assigning it to DevOps conflates "model operations" with
"infrastructure/CI". Assigning it to Security covers only the red-team slice.

**ADD 1 role — AI Model Operations Engineer (`model-operations-engineer`), department
`platform`.** Owns model tiering & routing policy, the model gateway, prompt/agent
evals, model-call cost & quality telemetry, and performance-based routing inputs.
Evidence of gap: four spec sections with no current owner. This is the only ADD.

Other gaps examined and **not** turned into new roles:
- **Documentation / knowledge:** distributed ownership — each role produces its own
  docs; the Business Analyst owns traceability; the Engineering Director owns
  `docs/` structure. No dedicated writer agent.
- **Compliance / privacy / DPO:** folded into the Application Security Engineer for
  now, flagged `PLANNED` for a dedicated role once Cleaning Commerce handles real
  customer data at scale.
- **Data / analytics engineering:** belongs to the future product, `DEFERRED`.
- **Runtime / orchestration engineer:** the runtime does not exist yet; when it does,
  re-run this analysis. For now the Engineering Director owns workflow *definitions*
  and DevOps owns their CI implementation.

## Final roster: 18 agents

Leadership (1): engineering-director.
Product (2): product-manager, business-analyst.
Design (1): ux-ui-designer.
Architecture (1): solution-architect.
Engineering (4): frontend-engineer, backend-engineer, database-engineer,
integration-engineer.
Quality (2): qa-lead, test-automation-engineer.
Security (1): application-security-engineer.
Platform (3): devops-platform-engineer, sre-observability-engineer,
model-operations-engineer.
Incident (1): incident-debug-engineer.
Review (1): senior-code-reviewer.
Release (1): release-manager.

The Human Founder is **not** an agent; the Human Founder is the authority the agents
report to.
