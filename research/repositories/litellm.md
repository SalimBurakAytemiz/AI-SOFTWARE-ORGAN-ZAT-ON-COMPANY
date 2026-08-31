# BerriAI/litellm — Evaluation

- **Repository:** BerriAI/litellm
- **Source:** https://github.com/BerriAI/litellm
- **Purpose:** Unified interface to 100+ LLM providers in the OpenAI request/response
  format, plus a **proxy/gateway** ("LiteLLM Proxy") that adds routing, fallbacks,
  load balancing, virtual API keys, per-key budgets/rate limits, caching, and spend
  logging.
- **Architecture:** Python SDK (`litellm.completion(...)`) + a FastAPI proxy server
  with a Postgres-backed admin UI. Config-file or DB-driven model list; hooks for
  guardrails; callbacks to Langfuse/OTel/Prometheus.
- **Development activity / maintenance health:** Extremely active; large adoption;
  frequent releases. (Fast pace = read release notes before upgrading.)
- **License:** MIT (SDK + proxy core); an "Enterprise" tier adds SSO, some admin
  features, support.
- **Security considerations:** The proxy holds provider keys and mints virtual keys —
  it is a high-value secret store and must be hardened, network-restricted, and
  audited. History of frequent releases means keep it patched.
- **Dependencies:** Python; Postgres + Redis for the proxy at scale.
- **Complexity:** Low as SDK; medium as an operated gateway.
- **Cost implications:** OSS free; the point of it is to *control and reduce* spend
  via routing, budgets and caching.
- **Self-hosting:** Fully (Docker/Helm).
- **Vendor lock-in:** **Negative** — it is the anti-lock-in layer; standardizes on the
  OpenAI schema so provider swaps are config changes.
- **Agent model:** N/A — infrastructure every agent's model calls pass through.
- **Human-in-the-loop capability:** Budgets/limits can hard-stop runaway spend;
  admin UI for key management.
- **Permissions model:** Virtual keys scoped to models, budgets, rate limits, teams —
  maps well to per-agent model access + cost policy.
- **Workflow capability:** Routing strategies, fallback chains, retries.
- **Checkpoint / resume:** N/A.
- **Observability:** Spend logs, request logs, Prometheus metrics, Langfuse/OTel
  callbacks — directly satisfies parts of our observability contract.
- **Usefulness to our company:** Very high. It is the concrete implementation of
  Constitution Article 13 (model independence) and Article 11 (cost discipline).
- **Overlap with our own design:** It *implements* `models/routing.yml` and
  `policies/cost.yml`. No conflict.
- **Maintenance burden if adopted:** Medium (operate + patch the gateway).

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** ADOPT (model gateway of record; per-agent virtual keys with
  model scope + budget; spend logging into audit/observability)
- **Rationale:** Nothing else so cleanly delivers provider abstraction + per-agent
  budgets + fallback routing + spend telemetry in one self-hostable MIT component.
- **What we take:** LiteLLM Proxy as the single egress for all model calls; virtual
  keys = per-agent model permission + cost cap; fallback chains mapped to our tier
  system; spend logs into the audit trail.
- **What we deliberately do not take (now):** Enterprise tier; treating the SDK as a
  substitute for the governed proxy.
- **Data checked:** Prior knowledge; general web awareness Aug 2026.
