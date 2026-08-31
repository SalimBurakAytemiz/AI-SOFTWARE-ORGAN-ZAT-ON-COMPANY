# GitHub + GitHub Actions — Evaluation

- **Tech:** GitHub (forge) and GitHub Actions (CI/CD).
- **Source:** https://github.com/features/actions , https://github.com/actions
- **Purpose:** Source hosting, pull requests, branch protection, code scanning
  (SARIF), environments with required reviewers, and CI/CD workflows.
- **Architecture:** YAML workflows triggered by repo events; hosted or self-hosted
  runners; reusable/composite actions; OIDC for cloud auth (no long-lived cloud
  secrets); **environments** with required reviewers and wait timers; branch
  protection / rulesets.
- **Development activity / maintenance health:** Continuously maintained platform.
- **License:** Proprietary SaaS (Actions runner is MIT; `act` allows local runs).
- **Security considerations:** Supply chain — pin actions to commit SHAs, restrict
  `GITHUB_TOKEN` permissions to least privilege, disallow untrusted `pull_request_target`
  patterns, require OIDC over stored cloud keys, protect `main` with rulesets. Third-
  party actions are code you are trusting.
- **Dependencies:** GitHub account/org.
- **Complexity:** Low–medium.
- **Cost implications:** Free tier + per-minute billing; self-hosted runners trade
  money for maintenance.
- **Self-hosting:** Partial (runners yes; the forge no — mitigate lock-in with a
  standard git remote and portable CI logic in scripts).
- **Vendor lock-in:** Medium — mitigated by keeping CI logic in shell/Make/Nix scripts
  that Actions merely calls.
- **Human-in-the-loop capability:** **Environments + required reviewers** is a native
  human-approval gate we can map the Human Founder onto for deploys.
- **Permissions model:** Fine-grained `permissions:` per job; environment protection
  rules; CODEOWNERS; rulesets.
- **Workflow capability:** Strong for CI/CD; not an agent orchestrator.
- **Observability:** Run logs, job summaries, OIDC claims, deployment history.
- **Usefulness to our company:** High. It is the enforcement point for git governance
  (branch protection), the Release Gate (required checks), and human approval for
  deploys (environments).
- **Overlap with our own design:** It enforces our git and release policies; it does
  not define them.
- **Maintenance burden:** Low–medium (action pinning, runner upkeep if self-hosted).

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** ADOPT (forge + CI/CD of record for this repo and future
  products; `main` protected; Release Gate = required status checks; deploys gated by
  a GitHub Environment whose required reviewer is the Human Founder)
- **Rationale:** Already the repo's home; provides native branch protection, required
  checks, and environment approvals that directly implement Constitution Articles 3
  and 9. Lock-in is contained by keeping CI logic in portable scripts.
- **What we take:** Branch protection / rulesets on `main`; least-privilege
  `GITHUB_TOKEN`; SHA-pinned actions; OIDC instead of stored cloud secrets;
  environments with the Human Founder as required reviewer.
- **What we deliberately do not take:** Business logic embedded only in Actions YAML;
  unpinned third-party actions; broad default token permissions.
- **Data checked:** Prior knowledge; general web awareness Aug 2026.
