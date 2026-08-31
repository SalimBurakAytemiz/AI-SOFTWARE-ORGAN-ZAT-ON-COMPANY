# e2b-dev/E2B — Evaluation

- **Repository:** e2b-dev/E2B (+ e2b-dev/infra)
- **Source:** https://github.com/e2b-dev/E2B
- **Purpose:** Open-source runtime for running AI-generated code in secure,
  **Firecracker microVM** sandboxes; SDK (Python/JS) to spawn a sandbox, run code,
  read/write files, and expose ports.
- **Architecture:** Firecracker microVMs (stronger isolation than containers) with
  fast start and snapshot/resume; a control plane (`e2b-dev/infra`, self-hostable on
  your cloud) + hosted E2B. Custom sandbox templates (Dockerfile-defined).
- **Development activity / maintenance health:** Active; company-backed; widely used
  as the sandbox behind other agent products.
- **License:** Apache-2.0 (SDK and infra).
- **Security considerations:** microVM boundary is the right isolation model for
  hostile code. Self-hosting the infra is non-trivial (Nomad/Consul/Firecracker on
  your cloud). Sandboxes with internet access are an egress risk — default to no
  network / allowlist.
- **Dependencies:** SDK: minimal. Self-hosted infra: substantial (cloud + HashiCorp
  stack).
- **Complexity:** Low (SDK) / high (self-host infra).
- **Cost implications:** SDK free; hosted E2B usage-priced; self-host = cloud cost +
  ops.
- **Self-hosting:** Yes, but heavy.
- **Vendor lock-in:** Low–medium (Apache SDK; self-hostable, but the infra is
  opinionated).
- **Human-in-the-loop / workflow:** N/A — execution substrate.
- **Checkpoint / resume:** Sandbox pause/resume + snapshots.
- **Observability:** Sandbox metrics/logs via API/control plane.
- **Usefulness to our company:** High as the strongest-isolation candidate for
  running untrusted generated code (RISK-aware: use microVMs for anything that
  executes model-written code touching the network).
- **Overlap with our own design:** Same slot as Daytona and OpenHands' runtime.
- **Maintenance burden:** Low (hosted) / high (self-host infra).

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** DEFER (leading candidate for the strong-isolation sandbox tier
  in the runtime phase; decide hosted vs self-hosted then)
- **Rationale:** Firecracker microVMs are the correct isolation model for hostile
  code, and the SDK is Apache-2.0. The self-hosted infra is heavy, so the
  hosted-vs-self-host decision waits for the runtime phase and real risk/volume data.
- **What we take:** microVM isolation as the standard for executing model-generated
  code with network access; snapshot/resume; no-network-by-default sandboxes with
  egress allowlists.
- **What we deliberately do not take (now):** Standing up the self-hosted infra
  before there is a runtime and a workload.
- **Data checked:** Prior knowledge; general web awareness Aug 2026.
