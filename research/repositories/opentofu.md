# opentofu/opentofu — Evaluation

- **Repository:** opentofu/opentofu (Linux Foundation)
- **Source:** https://github.com/opentofu/opentofu
- **Purpose:** Infrastructure as Code — an open, community-governed fork of Terraform
  (created after Terraform moved to the BUSL license). Declarative provisioning of
  cloud/infra with plan/apply and state.
- **Architecture:** Go binary; HCL config; providers; state backend (S3/GCS/etc. with
  locking); `plan` (preview) / `apply` (execute); native state encryption.
- **Development activity / maintenance health:** Active, LF-governed, broad vendor
  support; Terraform-provider-compatible.
- **License:** MPL-2.0 (open, unlike current Terraform).
- **Security considerations:** State files contain secrets — encrypt + restrict the
  backend. `apply` against production is a **RISK 5 critical action** (production
  infrastructure modification) and always requires the Human Founder. Provider
  binaries are supply chain — pin + checksum-lock.
- **Dependencies:** Go binary; a state backend; provider plugins.
- **Complexity:** Medium.
- **Cost implications:** Free tool; it provisions real, billable infra.
- **Self-hosting:** Yes; no mandatory SaaS (unlike HCP Terraform).
- **Vendor lock-in:** Low (open license, open registry).
- **Human-in-the-loop capability:** `plan` output is the artifact an agent prepares;
  `apply` is human-gated in our model.
- **Permissions model:** Cloud credentials — via OIDC/short-lived only, never
  long-lived keys in an agent.
- **Workflow capability:** plan → review → approve → apply maps onto
  `workflows/architecture-change.yml` and a future infra workflow.
- **Observability:** Plan diffs, state history, drift detection.
- **Usefulness to our company:** High *later*. There is no infrastructure to manage in
  this organization repository.
- **Overlap with our own design:** None.
- **Maintenance burden:** Medium (state, providers, drift).

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** DEFER (adopt when Cleaning Commerce needs real infrastructure;
  commit now that IaC will be OpenTofu, plans are agent-prepared, and `apply` to any
  non-dev environment is Human-Founder-only)
- **Rationale:** Correct open choice for IaC and clearly aligns with model/tool
  independence, but nothing to provision yet. We lock in the *policy* (plan vs apply
  split, RISK 5 apply) and defer the tool.
- **What we take:** OpenTofu over Terraform for licensing; plan-as-proposal /
  apply-as-critical-action; encrypted remote state; OIDC short-lived cloud creds.
- **What we deliberately do not take (now):** Any infra code; HCP/SaaS backends.
- **Data checked:** Prior knowledge; general web awareness Aug 2026.
