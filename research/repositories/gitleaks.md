# gitleaks/gitleaks — Evaluation

- **Repository:** gitleaks/gitleaks
- **Source:** https://github.com/gitleaks/gitleaks
- **Purpose:** Detect and prevent hardcoded secrets (keys, tokens, credentials) in git
  repos, git history, stdin, and as a pre-commit / CI hook.
- **Architecture:** Single Go binary. Regex + entropy rules (TOML), `git log` history
  scanning, `--staged` mode for pre-commit, baseline/allowlist support, SARIF output.
- **Development activity / maintenance health:** Active, widely used, steady releases.
- **License:** MIT.
- **Security considerations:** Defensive; runs locally. Keep custom allowlists under
  review so real leaks are not permanently suppressed.
- **Dependencies:** None (static binary).
- **Complexity:** Very low.
- **Cost implications:** Free.
- **Self-hosting:** Fully.
- **Vendor lock-in:** None.
- **Agent model / HITL / workflow:** CI gate + local pre-commit hook.
- **Permissions model:** Read-only.
- **Checkpoint / resume:** Baseline file.
- **Observability:** SARIF/JSON reports; findings feed the audit trail.
- **Usefulness to our company:** High as a cheap, focused defense-in-depth layer for
  Constitution Article 8 ("never commit secrets") at commit time and in CI.
- **Overlap with our own design:** Overlaps Trivy's secret scanning and Repomix's
  Secretlint pass — intentional layered defense at different points (pre-commit, pack,
  CI).
- **Maintenance burden if adopted:** Very low.

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** ADOPT (pre-commit hook + CI gate for secret detection in
  history and staged changes)
- **Rationale:** Tiny, MIT, single-purpose, catches the highest-severity mistake
  (committed secret) at the earliest point. Layering it with Trivy/Secretlint is
  cheap and worth it.
- **What we take:** gitleaks as the commit-time and history secret gate; SARIF
  findings into code scanning; reviewed, expiring allowlists only.
- **What we deliberately do not take:** Reliance on a single secret scanner; blanket
  allowlists.
- **Data checked:** Prior knowledge; general web awareness Aug 2026.
