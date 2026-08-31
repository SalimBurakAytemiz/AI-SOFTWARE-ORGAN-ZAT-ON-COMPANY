# zaproxy/zaproxy — Evaluation

- **Repository:** zaproxy/zaproxy (OWASP ZAP; now under the Software Security Project)
- **Source:** https://github.com/zaproxy/zaproxy
- **Purpose:** Dynamic application security testing (DAST): an intercepting proxy and
  active/passive scanner for finding runtime web vulnerabilities against a running
  app.
- **Architecture:** Java. Passive scan (observe traffic), active scan (attack a
  target), spider/ajax-spider, an automation framework (YAML plans), a headless
  daemon mode with a REST API, and packaged scans (baseline / full / API) as Docker
  images and a GitHub Action.
- **Development activity / maintenance health:** Active; long-standing flagship OWASP
  project; steady releases.
- **License:** Apache-2.0.
- **Security considerations:** **Active scan is an attack** — only run against systems
  you own, in staging, never production, with explicit authorization. Can generate
  load and mutate data.
- **Dependencies:** Java runtime / Docker image.
- **Complexity:** Medium — tuning to reduce false positives and scan time takes
  effort.
- **Cost implications:** Free; staging compute + time.
- **Self-hosting:** Fully.
- **Vendor lock-in:** None.
- **Agent model / HITL:** Automation-framework YAML plans; human reviews findings.
- **Permissions model:** Network reachability to the target; scope config is critical.
- **Workflow capability:** Automation plans in CI (against staging only).
- **Checkpoint / resume:** Session files.
- **Testing / review:** DAST findings feed the Security agent and the `SECURITY` gate.
- **Context management / observability:** HTML/JSON/SARIF/XML reports.
- **Usefulness to our company:** Medium–high for the future web product — the DAST
  half of "SAST + DAST" in the constitution. Not needed until there is a running app.
- **Overlap with our own design:** None (DAST is otherwise uncovered).
- **Maintenance burden if adopted:** Medium (scan tuning, staging targets).

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** OPTIONAL now / ADOPT once Cleaning Commerce has a staging
  deployment (baseline + API scans in the `SECURITY` gate, staging-only, scoped)
- **Rationale:** The canonical OSS DAST tool; correct choice, but there is nothing to
  scan yet. We commit the design and defer activation.
- **What we take:** ZAP baseline/API packaged scans as the DAST gate; automation-plan
  YAML; hard rule that active scans run only against owned staging with authorization.
- **What we deliberately do not take:** Any production scanning; unscoped active
  scans.
- **Data checked:** Prior knowledge; general web awareness Aug 2026.
