# open-policy-agent/opa — Evaluation

- **Repository:** open-policy-agent/opa (+ conftest, Gatekeeper, OPAL ecosystem)
- **Source:** https://github.com/open-policy-agent/opa
- **Purpose:** General-purpose policy engine. Policies written in **Rego** are
  evaluated against JSON input to return allow/deny (and structured reasons),
  decoupling authorization decisions from application code.
- **Architecture:** Go library / sidecar / CLI. Load policy + data, query with input,
  get a decision; `conftest` applies the same engine to config files (YAML/JSON/HCL)
  in CI; decision logs for audit.
- **Development activity / maintenance health:** CNCF graduated; very active; broad
  adoption (Kubernetes admission, API authz, CI config checks).
- **License:** Apache-2.0.
- **Security considerations:** It is a security control — protect policy distribution
  (signed bundles), monitor decision logs, and fail closed (default deny) if the
  engine is unreachable.
- **Dependencies:** Single binary / Go module.
- **Complexity:** Medium — Rego has a learning curve.
- **Cost implications:** Free (Styra DAS is the optional commercial control plane).
- **Self-hosting:** Fully.
- **Vendor lock-in:** Low.
- **Human-in-the-loop capability:** Decisions can be `deny` with a message routing to
  human approval; policy changes themselves go through PR review.
- **Permissions model:** This *is* a permissions/authorization engine — a natural fit
  to evaluate "may agent X perform capability Y on resource Z at risk R?".
- **Workflow capability:** Gate in CI (conftest) and at runtime (decision API).
- **Observability:** Structured decision logs → audit trail.
- **Usefulness to our company:** High. OPA/Rego could be the *enforcement runtime* for
  `policies/*.yml` and `policies/agent-permissions.yml`: our YAML compiles to data,
  Rego evaluates every agent action, default-deny, with an auditable decision log.
- **Overlap with our own design:** It enforces our policy system; it does not replace
  the policy definitions. `conftest` also overlaps our Python validation tests for
  config linting (complementary — different rule language, same intent).
- **Maintenance burden:** Medium (Rego authorship + policy bundle pipeline).

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** OPTIONAL now / likely ADOPT in the runtime phase as the
  policy decision point (default-deny action authorization + `conftest` config gates)
- **Rationale:** OPA is the industry-standard way to externalize authorization and
  keep it auditable, which is exactly what Constitution Article 2 demands. We defer
  committing until the runtime exists, but design `policies/` so it can compile to
  OPA input/data cleanly.
- **What we take:** Default-deny decision engine model; decision logs as audit
  events; `conftest` as an optional second config-validation layer; policy-as-code
  under PR review.
- **What we deliberately do not take (now):** A hard Rego dependency before the
  runtime; Styra DAS.
- **Data checked:** Prior knowledge; general web awareness Aug 2026.
