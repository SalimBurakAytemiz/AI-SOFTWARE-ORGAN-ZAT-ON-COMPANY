# FoundationAgents/MetaGPT — Evaluation

- **Repository:** FoundationAgents/MetaGPT
- **Source:** https://github.com/FoundationAgents/MetaGPT
- **Purpose:** Multi-agent framework that models a software company: a single line
  requirement is expanded by role agents (PM, Architect, PM, Engineer, QA) following
  encoded Standard Operating Procedures (SOPs) into PRD, design, tasks and code.
- **Architecture:** Python. Role objects with `_think`/`_act` loops, a shared message
  bus / environment, an `Team` that runs roles in an ordered pipeline; artifacts
  passed as structured documents. "Code = SOP(Team)" thesis.
- **Development activity / maintenance health:** Active, large contributor base,
  frequent releases; associated research papers (MetaGPT, Data Interpreter).
- **License:** MIT.
- **Security considerations / known advisories:** Executes generated code; sandboxing
  is the integrator's responsibility. No production-authority controls. Prompt-injection
  surface via web-browsing tools.
- **Dependencies:** Heavy Python stack (pydantic, tenacity, provider SDKs, optional
  browser tooling).
- **Complexity:** High. Opinionated abstractions; non-trivial to bend to a different
  org shape.
- **Cost implications:** Multiple model calls per role per phase; can be expensive on
  large tasks.
- **Self-hosting:** Yes, runs locally.
- **Vendor lock-in:** Low on models (configurable), medium on framework abstractions.
- **Agent model:** Role agents with SOP-encoded behavior and structured hand-offs.
- **Human-in-the-loop capability:** Limited; mostly autonomous run with review points,
  no first-class approval gate.
- **Permissions model:** None to speak of — no capability scoping, no default-deny.
- **Workflow capability:** Strong conceptually (SOP pipeline), weak as a configurable
  external workflow engine.
- **Checkpoint / resume:** Partial (serialized team state).
- **Testing approach:** Generates tests via a QA role; not a test framework itself.
- **Debugging approach:** Ad hoc; Data Interpreter adds iterative execution.
- **Review approach:** A reviewer role exists but not structurally independent.
- **Context management:** Document-passing between roles; memory per role.
- **Observability:** Minimal; logs.
- **Usefulness to our company:** High as a *reference* for role decomposition, SOP
  encoding, and structured artifact hand-off between roles.
- **Overlap with our own design:** Significant conceptual overlap (roles + pipeline),
  which is exactly why we do not need it as a runtime.
- **Maintenance burden if adopted:** High — we would fight its opinions.

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** REJECT
- **Rationale:** MetaGPT proves the "AI software company as ordered roles + SOPs"
  model works, and its artifact hand-off discipline is worth copying as *technique*.
  But it has no permission model, no human-approval gate, no capability scoping, and
  its abstractions are too opinionated to carry our governance requirements. We build
  our own governed pipeline and borrow its decomposition lessons.
- **What we take (technique, not code):** SOP-style explicit step ownership; one role
  per responsibility; structured documents as the hand-off contract; "requirement →
  PRD → design → tasks → code" spine (we extend it with review/security/approval).
- **What we deliberately do not take:** Its runtime, its role classes, its
  autonomy-first posture.
- **Data checked:** Prior knowledge; web search Aug 2026 (BMAD/MetaGPT comparison
  articles, arXiv agentic-SE roadmap).
