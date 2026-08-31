# Security Comparison

Compares the security tooling options and records the layered defense the company
adopts. Principle: **default deny, least privilege, audit everything, human approval
for critical actions** — tools enforce, they do not replace, the constitution.

## Scanning tools

| Need | Options considered | Choice | Why |
|---|---|---|---|
| SAST | Semgrep (OSS), CodeQL, SonarQube, Bearer | **Semgrep OSS** | Polyglot, fast, custom rules in YAML that encode *our* invariants; OSS engine keeps code local; CodeQL's licensing is GitHub-bound; Sonar is heavier. Pro tier deferred. |
| SCA | Trivy, osv-scanner, Grype, Snyk, Dependabot alerts | **Trivy** primary, **osv-scanner** optional | Trivy also does IaC + containers + secrets + SBOM → less sprawl. osv-scanner gives precise per-advisory triage + `fix`. Snyk is commercial/SaaS. |
| IaC misconfig | Trivy, Checkov, tfsec (→Trivy), conftest/OPA | **Trivy** + optional **conftest** | Only relevant once OpenTofu is adopted. |
| Container image | Trivy, Grype, Clair | **Trivy** | Same tool, one workflow. |
| Secrets | gitleaks, trufflehog, Trivy secrets, Secretlint (via Repomix) | **gitleaks** (gate) + backstops | Layered: pre-commit (gitleaks) → pack-time (Secretlint) → CI (gitleaks + Trivy). |
| DAST | OWASP ZAP, Nuclei, Burp (commercial) | **OWASP ZAP** | OSS, automation framework, packaged baseline/API scans; staging-only. Activate with the product. |
| LLM red teaming | promptfoo redteam, Garak, PyRIT | **promptfoo redteam** | Same tool as our eval harness; OWASP LLM Top 10 mapping; CI-friendly. |
| Policy-as-code | OPA/Rego, Cedar, Sentinel | **OPA/Rego** | CNCF-graduated, Apache-2.0, general-purpose, decision logs; Cedar is younger, Sentinel is HashiCorp-bound. |

## Secrets architecture

| Approach | Verdict |
|---|---|
| Give agents long-lived production secrets | **Forbidden** (Constitution Article 8). |
| Env vars injected per task from a vault (Infisical/Vault/Doppler) | Acceptable for **non-production**, low-risk. |
| **Credential proxy** — secret never reaches the agent, injected at the network boundary (Infisical Agent Vault / Agent Proxy) | **Target design** for anything sensitive. Tool is a research preview → `policies/secrets.yml` is written tool-agnostically and the runtime adopts a production-ready proxy. |
| Short-lived cloud creds via OIDC (GitHub Actions → cloud) | **Required** for any cloud access; no stored cloud keys. |

## Where each safeguard is enforced

| Safeguard | Enforcement point(s) |
|---|---|
| No merge to `main` by an agent | GitHub branch protection / ruleset + `policies/git.yml` + `tests/test_human_authority.py` |
| No production deploy without Human Founder | GitHub Environment required reviewer + `workflows/release.yml` gate + `policies/human-approval.yml` + `tests/test_org_security.py` |
| No production secret by default | `policies/secrets.yml` + credential proxy + no secret in agent tool grants (`tests/test_permissions.py`) |
| No destructive prod DB op | `policies/database.yml` RISK 5 + human approval + `tests/test_org_security.py` |
| Reviewer independence | Workflow step owners differ from implementer; `tests/test_workflows.py` |
| Every critical action audited | `schemas/audit-event.schema.json` + `policies/audit.yml` + OPA decision logs |
| LLM prompt-injection exposure | promptfoo redteam in `SECURITY` gate for any feature exposing an LLM to untrusted input |
| Supply chain (actions, deps, base images) | SHA-pinned actions, Renovate + Trivy/osv-scanner on every dep PR, pinned+scanned base images |

## Residual risks accepted for this phase

- The audit ledger and approval ledger are **schemas, not running systems** — no
  enforcement exists until the runtime is built. Mitigation: this repo cannot deploy
  anything, so there is nothing to bypass yet.
- Credential-proxy tooling is pre-production. Mitigation: policy is tool-agnostic;
  adoption gated on production readiness.
- OPA enforcement is a runtime-phase task; today only the Python validators check
  config. Mitigation: validators cover the critical invariants and run in CI.
