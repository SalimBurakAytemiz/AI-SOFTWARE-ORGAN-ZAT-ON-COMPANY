# langfuse/langfuse — Evaluation

- **Repository:** langfuse/langfuse
- **Source:** https://github.com/langfuse/langfuse
- **Purpose:** Open-source LLM engineering platform: tracing/observability of
  LLM/agent apps, prompt management, evaluations, datasets, and cost/latency
  analytics.
- **Architecture:** TypeScript (Next.js) app + Postgres + ClickHouse + Redis + S3-
  compatible blob store for scale. SDKs (Python, JS) and an **OpenTelemetry**
  endpoint; integrates with LiteLLM, LangGraph, and most frameworks.
- **Development activity / maintenance health:** Very active; company-backed; frequent
  releases.
- **License:** Core is MIT; some enterprise features are gated behind a commercial
  license (the repo is source-available for those parts). Self-hosting the OSS
  feature set is fully supported.
- **Security considerations:** Stores prompts, inputs, outputs and traces — treat it
  as sensitive-data infrastructure; enforce PII controls and access control. Multi-
  service deployment = larger attack surface than a single binary.
- **Dependencies:** Postgres, ClickHouse, Redis, blob storage (heavier stack).
- **Complexity:** Medium–high to self-host well.
- **Cost implications:** OSS free (infra cost); Langfuse Cloud tiers optional.
- **Self-hosting:** Yes (Docker Compose / Helm).
- **Vendor lock-in:** Low–medium — OTel ingestion means traces are portable.
- **Agent model:** N/A — observability layer.
- **Human-in-the-loop capability:** Human annotation queues, eval review UI.
- **Permissions model:** Projects, roles, scoped API keys.
- **Workflow capability:** Datasets + experiments for eval pipelines.
- **Observability:** This is the product — traces, spans, cost, latency, quality
  scores per agent/model/workflow.
- **Usefulness to our company:** High for the observability contract (docs/section 22)
  and agent performance metrics (section 23). Pairs naturally with LiteLLM and a
  LangGraph/Mastra runtime.
- **Overlap with our own design:** It implements the observability contract; it does
  not define it.
- **Maintenance burden if adopted:** Medium–high (multi-service stack to operate).

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** OPTIONAL / DEFER — adopt when the runtime exists and there is
  real agent traffic to observe. Until then, define the contract in OpenTelemetry
  terms so Langfuse (or an alternative) is a drop-in consumer.
- **Rationale:** Strong fit and mostly-OSS, but a heavy stack with no traffic to
  justify it yet. Deferring keeps us honest (no "imaginary integration") while the
  OTel-based contract keeps the choice open.
- **What we take:** Trace/span/score data model for agent runs; per-agent cost &
  quality dashboards; human annotation queues feeding agent metrics; OTel as the wire
  format.
- **What we deliberately do not take (now):** Operating the ClickHouse-backed stack
  before it is needed; Langfuse Cloud.
- **Data checked:** Prior knowledge; general web awareness Aug 2026. (Verify current
  OSS vs commercial feature split at integration time.)
