# semgrep/semgrep — Evaluation

- **Repository:** semgrep/semgrep
- **Source:** https://github.com/semgrep/semgrep
- **Purpose:** Fast, polyglot static analysis (SAST) using lightweight
  pattern-matching rules that look like the code they match; large community rule
  registry; also secret and dependency rules.
- **Architecture:** OCaml core + Python CLI. Rules in YAML; runs locally/CI without
  sending code anywhere (OSS engine); Semgrep AppSec Platform (SaaS) adds triage,
  dataflow/pro rules, and cross-file taint analysis.
- **Development activity / maintenance health:** Very active; company-backed; widely
  adopted.
- **License:** OSS CLI/engine is **LGPL-2.1**; many community rules are permissively
  licensed; **Pro rules and the platform are commercial** and the pro engine is not
  OSS.
- **Security considerations:** Defensive tool; OSS mode keeps code local. Watch rule
  provenance if pulling third-party rulesets.
- **Dependencies:** Python; downloaded rulesets.
- **Complexity:** Low to run, medium to write good custom rules.
- **Cost implications:** OSS engine free; Pro engine / platform paid.
- **Self-hosting:** OSS CLI fully; platform is SaaS.
- **Vendor lock-in:** Low if you stay on OSS rules + engine; higher on Pro.
- **Agent model / HITL / workflow:** N/A — a CI/agent-invoked scanner; SARIF output.
- **Permissions model:** Read-only.
- **Context management / observability:** SARIF/JSON; `.semgrepignore`; baseline
  scanning (only new findings).
- **Usefulness to our company:** High — custom rules let us encode our own security
  and architecture invariants (e.g. "no raw SQL string concatenation", "no
  `dangerouslySetInnerHTML` without sanitizer").
- **Overlap with our own design:** Complements Trivy (SAST vs SCA/IaC). Can also
  enforce some org rules that our Python tests cannot see inside product code.
- **Maintenance burden if adopted:** Low–medium (curating custom rules).

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** ADOPT (OSS engine + community/custom rules as the SAST gate;
  Pro platform DEFERRED unless a concrete need appears)
- **Rationale:** Best-in-class OSS SAST; custom rules turn our written standards into
  enforced checks. LGPL engine is fine for CI use. We explicitly stay on the OSS
  tier for now.
- **What we take:** Semgrep OSS as the SAST Release Gate; a house ruleset encoding
  our security + architecture invariants; baseline scanning for large repos.
- **What we deliberately do not take (now):** Pro rules, the AppSec Platform,
  autofix-on-merge.
- **Data checked:** Prior knowledge; general web awareness Aug 2026. (License tier
  boundaries: verify current terms at integration time.)
