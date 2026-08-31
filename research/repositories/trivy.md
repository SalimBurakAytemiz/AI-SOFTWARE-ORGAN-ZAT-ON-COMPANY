# aquasecurity/trivy — Evaluation

- **Repository:** aquasecurity/trivy
- **Source:** https://github.com/aquasecurity/trivy
- **Purpose:** All-in-one security scanner: OS/library vulnerabilities (SCA),
  misconfigurations (IaC — Terraform, Kubernetes, Dockerfile), exposed secrets,
  licenses, and SBOM generation/scanning; scans filesystems, images, repos, and live
  clusters.
- **Architecture:** Single Go binary. Pulls a vulnerability DB (from OCI registries);
  pluggable scanners; JSON/SARIF/table output; runs in CI, as a GitHub Action, or as
  an operator.
- **Development activity / maintenance health:** Extremely active, Aqua-backed, CNCF
  landscape staple.
- **License:** Apache-2.0.
- **Security considerations:** Downloads a DB (pin/mirror for air-gapped or supply-chain
  concerns); otherwise a defensive tool.
- **Dependencies:** None (static binary) + DB fetch.
- **Complexity:** Low.
- **Cost implications:** Free.
- **Self-hosting:** Fully; DB can be mirrored.
- **Vendor lock-in:** None.
- **Human-in-the-loop / agent model:** N/A — a scanner invoked by CI and the Security
  agent.
- **Permissions model:** Read filesystem/registry; no write.
- **Workflow capability:** CI gate; SARIF into code scanning.
- **Testing / debugging / review:** N/A.
- **Context management / observability:** Machine-readable reports (SARIF/JSON),
  severity thresholds, ignore files with expiry.
- **Usefulness to our company:** Very high — covers SCA + IaC + secrets + SBOM in one
  tool, reducing tool sprawl.
- **Overlap with our own design:** Overlaps osv-scanner (SCA) and gitleaks (secrets) —
  Trivy can be the primary, others secondary/defense-in-depth.
- **Maintenance burden if adopted:** Low.

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** ADOPT (primary SCA + IaC + container + SBOM scanner; standing
  Release Gate `SECURITY` check)
- **Rationale:** One well-licensed, self-hostable binary covers most of our scanning
  needs with SARIF output that plugs into gates and code scanning.
- **What we take:** Trivy as the default multi-target scanner; SARIF as the standard
  finding format; severity-threshold gating with expiring ignores.
- **What we deliberately do not take:** Aqua's commercial platform.
- **Data checked:** Prior knowledge; general web awareness Aug 2026.
