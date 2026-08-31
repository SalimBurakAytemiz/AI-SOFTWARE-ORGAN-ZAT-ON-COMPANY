# google/osv-scanner — Evaluation

- **Repository:** google/osv-scanner
- **Source:** https://github.com/google/osv-scanner
- **Purpose:** Dependency vulnerability scanner powered by OSV.dev: reads lockfiles,
  SBOMs, container images and directories and reports known vulnerabilities from a
  distributed, precise advisory database; `osv-scanner fix` can guide remediation.
- **Architecture:** Go binary + OSV.dev API/DB. Lockfile parsers for most ecosystems;
  call-graph analysis for some languages to cut false positives; guided remediation;
  SARIF/JSON output; reachability analysis (Go, and expanding).
- **Development activity / maintenance health:** Active, Google-backed, v2.x.
- **License:** Apache-2.0.
- **Security considerations:** Queries OSV.dev (or use the offline DB for air-gapped);
  defensive tool.
- **Dependencies:** None (static binary) + advisory DB.
- **Complexity:** Low.
- **Cost implications:** Free.
- **Self-hosting:** Yes; offline DB available.
- **Vendor lock-in:** None (OSV is an open schema/database).
- **Agent model / HITL / workflow:** CI gate; `fix` subcommand assists remediation
  PRs.
- **Permissions model:** Read-only.
- **Observability:** SARIF/JSON; feeds audit trail and Renovate-style updates.
- **Usefulness to our company:** High for precise SCA. OSV's per-advisory precision
  and guided remediation complement Trivy.
- **Overlap with our own design:** Overlaps Trivy SCA. Decision: Trivy is primary
  (broad: OS + libs + IaC + secrets); osv-scanner is a precise second opinion for
  application dependencies and remediation guidance.
- **Maintenance burden if adopted:** Low.

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** OPTIONAL (secondary SCA + guided-remediation aid alongside
  Trivy; promote to ADOPT if Trivy SCA proves noisy for our stack)
- **Rationale:** Excellent, precise, Apache-2.0 SCA, but it overlaps Trivy's SCA
  scope. Running both by default is defensible but we keep osv-scanner OPTIONAL to
  avoid duplicate gate noise; its `fix` guidance is valuable for the
  dependency-update workflow.
- **What we take:** OSV.dev as the advisory source of truth; guided remediation into
  `workflows/dependency-update.yml`; reachability analysis to prioritize findings.
- **What we deliberately do not take:** Running it as a redundant blocking gate next
  to Trivy SCA unless justified.
- **Data checked:** Prior knowledge; general web awareness Aug 2026.
