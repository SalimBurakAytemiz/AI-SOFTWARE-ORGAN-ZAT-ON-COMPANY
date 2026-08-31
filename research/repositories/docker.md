# Docker / OCI containers — Evaluation

- **Repository / tech:** Docker Engine, BuildKit, Docker Compose (moby/moby,
  docker/compose) and the OCI image/runtime specs.
- **Source:** https://github.com/moby/moby , https://github.com/docker/compose
- **Purpose:** Reproducible build and run environments; the isolation boundary for
  agent code execution and for every service the company ships.
- **Architecture:** Client + daemon; images as layered filesystems; Compose for local
  multi-service topologies; rootless mode available.
- **Development activity / maintenance health:** Industry standard; continuously
  maintained.
- **License:** Apache-2.0 (Moby); Docker Desktop has commercial terms for large
  orgs — use Engine/Compose or Podman/nerdctl to avoid that.
- **Security considerations:** Container ≠ VM. Use rootless, drop capabilities,
  read-only root fs, no docker socket in agent containers, pinned base images,
  Trivy-scanned images. Agent execution sandboxes need stricter isolation
  (gVisor/Kata/microVM) for untrusted code.
- **Dependencies:** Linux kernel features; a container runtime.
- **Complexity:** Low–medium.
- **Cost implications:** Free (Engine); CI/registry compute.
- **Self-hosting:** Yes.
- **Vendor lock-in:** None (OCI standard).
- **Agent model / workflow:** The unit of execution isolation for engineer agents and
  for CI jobs.
- **Observability:** Logs/stats; integrates with OTel collectors.
- **Usefulness to our company:** Essential and unambiguous.
- **Overlap with our own design:** None — it is a substrate.
- **Maintenance burden:** Low.

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** ADOPT (container isolation is mandatory for agent execution
  and all services; Docker Desktop avoided in favor of Engine/Compose or equivalents)
- **Rationale:** Non-negotiable substrate. The only real decision is *how strong* the
  isolation must be for untrusted generated code — flagged for the Agent Runtime
  phase (microVM/gVisor).
- **What we take:** OCI images, Compose for local topologies, rootless + hardened
  defaults, pinned + scanned base images.
- **What we deliberately do not take:** Docker Desktop licensing exposure; the docker
  socket inside agent containers.
- **Data checked:** Prior knowledge; general web awareness Aug 2026.
