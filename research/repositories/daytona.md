# daytonaio/daytona — Evaluation

- **Repository:** daytonaio/daytona
- **Source:** https://github.com/daytonaio/daytona
- **Purpose:** Secure, elastic infrastructure for running AI-generated / untrusted
  code — fast-booting isolated sandboxes with a filesystem, process execution, and
  an API/SDK, aimed squarely at agent workloads.
- **Architecture:** A control plane + runners that create sandboxes (sub-second start,
  claimed) with configurable resources, snapshots, and auto-stop; Python/TS SDKs;
  self-hostable or Daytona Cloud. (Project repositioned from "dev environment
  manager" to "AI sandbox infrastructure".)
- **Development activity / maintenance health:** Active; company-backed; rapid
  evolution (has changed focus, so track direction).
- **License:** Apache-2.0 (verify components at integration).
- **Security considerations:** Purpose-built for isolating untrusted code — a plus.
  Self-hosting means you own the isolation guarantees (kernel/microVM boundary
  matters for truly hostile code).
- **Dependencies:** Container/VM infra; control-plane services.
- **Complexity:** Medium (self-host) / low (SDK against Cloud).
- **Cost implications:** OSS free (infra cost); Cloud is usage-priced.
- **Self-hosting:** Yes.
- **Vendor lock-in:** Medium (SDK/API surface is theirs).
- **Human-in-the-loop / workflow:** N/A — it is an execution substrate.
- **Checkpoint / resume:** Sandbox snapshots.
- **Observability:** Sandbox logs/metrics via API.
- **Usefulness to our company:** Medium–high as a candidate execution sandbox for
  engineer agents (alternative/complement to OpenHands' runtime or E2B).
- **Overlap with our own design:** Same slot as E2B and the OpenHands runtime — pick
  one in the runtime phase.
- **Maintenance burden:** Medium; watch the project's direction changes.

### Decisions

- **knowledge_adoption:** PARTIAL
- **runtime_decision:** DEFER (one of several agent-sandbox options to compare during
  Agent Runtime design)
- **Rationale:** Right category (isolated execution for agent code), but it competes
  with E2B and OpenHands' built-in runtime, and the project has shifted focus once
  already. Defer the choice; commit only to the requirement (strong isolation + fast
  start + snapshots + SDK).
- **What we take:** Requirements checklist for an agent sandbox: sub-second start,
  resource caps, auto-stop, snapshots, no host network by default, SDK-driven.
- **What we deliberately do not take (now):** A dependency on any single sandbox
  vendor.
- **Data checked:** Prior knowledge; general web awareness Aug 2026.
