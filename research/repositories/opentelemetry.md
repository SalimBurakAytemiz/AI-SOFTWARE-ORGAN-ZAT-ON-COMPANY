# OpenTelemetry — Evaluation

- **Tech:** OpenTelemetry (open-telemetry/*) — specification, SDKs, and the Collector.
- **Source:** https://github.com/open-telemetry
- **Purpose:** Vendor-neutral standard and tooling for traces, metrics, and logs;
  now includes GenAI semantic conventions for LLM/agent spans (model, tokens, cost,
  tool calls).
- **Architecture:** SDKs instrument code → OTLP export → Collector (receive, process,
  export) → any backend (Langfuse, Grafana/Tempo, Jaeger, Prometheus, vendor SaaS).
- **Development activity / maintenance health:** CNCF, very active, second-largest
  CNCF project.
- **License:** Apache-2.0.
- **Security considerations:** Telemetry can carry sensitive data — use Collector
  processors to redact/scrub before export; secure OTLP endpoints (mTLS/auth).
- **Dependencies:** SDK per language; a Collector deployment.
- **Complexity:** Medium.
- **Cost implications:** Free; backend storage cost.
- **Self-hosting:** Fully.
- **Vendor lock-in:** **Negative** — it is the anti-lock-in layer for observability.
- **Agent model / workflow:** N/A — instrumentation standard.
- **Observability:** It *is* the observability contract wire format.
- **Usefulness to our company:** High. Defining our observability contract (docs
  section 22) in OTel terms means any backend — Langfuse, Grafana, a vendor — is a
  swappable consumer.
- **Overlap with our own design:** It is the substrate our observability standard
  targets.
- **Maintenance burden:** Medium (run and configure a Collector).

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** ADOPT as the *contract* now (define spans/metrics for agent,
  model, tool, workflow, cost, latency, approval, deployment); ADOPT the Collector
  once there is runtime traffic.
- **Rationale:** Standardizing on OTel keeps backend choice open and satisfies
  Constitution Article 13. No reason to couple our telemetry to any one vendor.
- **What we take:** GenAI semantic conventions for agent/model spans; Collector-side
  redaction; OTLP as the only telemetry wire format the runtime emits.
- **What we deliberately do not take:** A vendor-specific SDK as the primary
  instrumentation path.
- **Data checked:** Prior knowledge; general web awareness Aug 2026.
