# n8n-io/n8n — Evaluation

- **Repository:** n8n-io/n8n
- **Source:** https://github.com/n8n-io/n8n
- **Purpose:** Fair-code workflow automation platform — visual node-based workflows
  connecting 400+ apps/APIs, with a growing set of AI/agent nodes.
- **Architecture:** Node/TypeScript; self-hostable server + editor UI; webhook/cron
  triggers; queue mode for scale; credentials vault.
- **Development activity / maintenance health:** Very active; large community.
- **License:** **Sustainable Use License** (fair-code, source-available) — free to
  self-host and use internally, with restrictions on offering it as a competing
  hosted service. Not OSI-open.
- **Security considerations:** Stores many third-party credentials (broad blast
  radius); code nodes execute arbitrary JS; a tempting target. Network-isolate and
  scope credentials hard.
- **Dependencies:** Node; a database; optional Redis for queue mode.
- **Complexity:** Low to start; medium at scale.
- **Cost implications:** Free self-hosted; n8n Cloud paid.
- **Self-hosting:** Yes.
- **Vendor lock-in:** Medium — workflows are n8n-specific JSON; the license is not
  OSI-open.
- **Human-in-the-loop capability:** Wait/approval nodes exist.
- **Permissions model:** Users/projects/roles; credential sharing scopes.
- **Workflow capability:** Strong for glue automation / integrations; not built for
  governed, audited, multi-agent software delivery.
- **Observability:** Execution logs; some metrics.
- **Usefulness to our company:** Low for this organization foundation. The prompt
  explicitly says do not build n8n workflows now. It may later help the *business
  operations* side of Cleaning Commerce (marketing, CRM glue), not engineering
  governance.
- **Overlap with our own design:** Overlaps `workflows/` superficially but lacks the
  risk/approval/audit semantics we require, and adds licensing friction.
- **Maintenance burden:** Medium.

### Decisions

- **knowledge_adoption:** PARTIAL
- **runtime_decision:** DEFER (out of scope now; reconsider only for business-ops glue
  in a later phase, and weigh the fair-code license then)
- **Rationale:** Useful category (integration automation) but wrong layer for
  governed software delivery, and the non-OSI license means we should not build core
  governance on it. Explicitly deferred per the build spec.
- **What we take:** The visual "trigger → nodes → action" mental model as an
  onboarding aid for describing workflows to non-engineers.
- **What we deliberately do not take:** n8n as the engineering workflow engine;
  n8n-format workflow definitions in this repo.
- **Data checked:** Prior knowledge; general web awareness Aug 2026.
