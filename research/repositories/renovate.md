# renovatebot/renovate — Evaluation

- **Repository:** renovatebot/renovate (Mend)
- **Source:** https://github.com/renovatebot/renovate
- **Purpose:** Automated dependency updates: raises PRs to bump dependencies (npm,
  Docker, GitHub Actions, Terraform/OpenTofu, and dozens more), with changelogs,
  grouping, scheduling, and auto-merge policies.
- **Architecture:** Node app; runs as a self-hosted CLI/Docker job, a GitHub App, or
  the hosted Mend service. `renovate.json` config; presets; dependency dashboard
  issue.
- **Development activity / maintenance health:** Very active; the standard alongside
  Dependabot.
- **License:** AGPL-3.0 for the self-hosted CLI (the hosted app avoids the AGPL
  question for consumers). Note the AGPL terms if embedding.
- **Security considerations:** Needs repo write + PR permissions — scope tightly. It
  proposes changes; it must not auto-merge anything that touches security-sensitive
  or RISK ≥ 4 code without review. Malicious upstream releases still require the
  security gate to catch them.
- **Dependencies:** Node; a git token.
- **Complexity:** Low–medium (config tuning).
- **Cost implications:** Free (self-hosted / hosted community); compute.
- **Self-hosting:** Yes.
- **Vendor lock-in:** Low (Dependabot is a drop-in alternative).
- **Human-in-the-loop capability:** Every update is a PR → normal review + gates
  apply; auto-merge is opt-in and policy-bounded.
- **Permissions model:** Git token scope; auto-merge rules per package/update-type.
- **Workflow capability:** Scheduling, grouping, base-branch strategies.
- **Observability:** Dependency dashboard; PR history.
- **Usefulness to our company:** High — it is the engine behind
  `workflows/dependency-update.yml` and keeps the supply chain current with minimal
  human toil.
- **Overlap with our own design:** It implements the dependency-update workflow.
- **Maintenance burden:** Low–medium.

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** ADOPT (dependency-update automation of record; PRs only;
  auto-merge limited to lockfile-only patch/minor updates of non-sensitive deps that
  pass all gates; everything else requires the Code Reviewer)
- **Rationale:** Mature, broad ecosystem coverage, self-hostable. The AGPL applies to
  the self-hosted binary we *run*, not to our product code, which is acceptable;
  Dependabot remains a fallback.
- **What we take:** Renovate PRs + dependency dashboard; conservative auto-merge
  policy; grouping to reduce PR noise; scanners (Trivy/osv-scanner) run on every
  Renovate PR.
- **What we deliberately do not take:** Auto-merge of major bumps or
  security-sensitive packages; treating a green Renovate PR as exempt from the
  security gate.
- **Data checked:** Prior knowledge; general web awareness Aug 2026.
