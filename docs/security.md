# Security

Posture: **default deny, least privilege, audit everything important, human approval
for critical actions.** Tools enforce; they do not replace the constitution.

Policies: [`../policies/security.yml`](../policies/security.yml),
[`../policies/secrets.yml`](../policies/secrets.yml). Tool rationale:
[`../research/security-comparison.md`](../research/security-comparison.md).

## Layered scanning

| Concern | Blocking gate | Backstops / notes |
|---|---|---|
| Committed secrets | **gitleaks** (pre-commit + CI, history) | Trivy secrets, Repomix Secretlint pre-flight |
| SAST | **Semgrep OSS** + a house ruleset encoding our invariants | Pro tier deferred |
| Dependencies (SCA) | **Trivy** | osv-scanner (optional, precise triage + `fix`) |
| IaC misconfig | **Trivy** (once infra exists) | Semgrep IaC rules, conftest/OPA |
| Container images | **Trivy** on every build | pinned base images |
| SBOM | **Trivy** per release | — |
| DAST | **OWASP ZAP** baseline + API (staging only, once an app is staged) | active scans only against owned staging, authorized, scoped |
| LLM adversarial | **promptfoo redteam** (OWASP LLM Top 10) for any untrusted-input LLM feature | — |

Findings are SARIF into GitHub code scanning. A `SECURITY` gate `PASS` is not issued
with an unresolved high/critical finding unless there is a time-boxed,
Human-Founder-visible waiver (max 90 days; expired waivers block the gate).

## Secrets architecture

- **Never commit secrets.** Ever.
- **No production secret to any agent by default.** Not a standing grant.
- **Credential-proxy pattern** (target design): the secret is injected at the network
  boundary; the agent never receives the value. Reference implementation: Infisical
  Agent Vault / Agent Proxy — currently `DEFERRED` (Agent Vault is a research
  preview). `policies/secrets.yml` is written tool-agnostically so any compliant
  proxy satisfies it.
- **Short-lived credentials.** Cloud access via OIDC-issued short-lived tokens, never
  stored long-lived keys.
- **No secret in a prompt, a log, telemetry, or agent memory.** Record references and
  fingerprints, never values.
- Secret creation/rotation/revocation is a critical action — Human Founder only.

## Supply chain

- GitHub Actions pinned to commit SHAs; Renovate updates them via PR.
- Base images pinned and Trivy-scanned.
- Renovate PRs run the full scanner set; auto-merge is limited to lockfile-only
  patch/minor of non-sensitive deps that pass every gate.
- No third-party source copied into this repository; no unnecessary forks.

## Observability contract (security-relevant)

Defined in OpenTelemetry terms now (`docs/future-runtime.md`). Telemetry carries no
secrets and no raw PII; the OTel Collector redacts before export. Audit events
(`schemas/audit-event.schema.json`) are append-only and record the reason for every
significant action, plus `approved_by` (only `human-founder` or `null`).

## Residual risks accepted for this phase

The audit ledger, approval ledger, credential proxy, and OPA enforcement are
**schemas and contracts, not running systems** — there is no runtime yet, so there is
nothing deployable to bypass. They become obligations in the Agent Runtime phase.
