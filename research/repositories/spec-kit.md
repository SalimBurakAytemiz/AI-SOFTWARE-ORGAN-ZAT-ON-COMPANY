# github/spec-kit — Evaluation

- **Repository:** github/spec-kit
- **Source:** https://github.com/github/spec-kit
- **Purpose:** Toolkit for Spec-Driven Development: scaffolds a durable `spec` →
  `plan` → `tasks` → `implement` flow in your repo, then hands off to your coding
  agent. Explicit counter to "vibe coding".
- **Architecture:** A CLI (`specify`) plus a set of slash-command templates and a
  `constitution` concept. Agent-agnostic — v0.11.0 (June 2026) supports 30+ agents
  including Claude Code. Artifacts are Markdown in the repo.
- **Development activity / maintenance health:** Active, GitHub-backed, frequent
  releases.
- **License:** MIT.
- **Security considerations:** Low; it produces text. Slash-command templates run in
  your agent — review before trusting.
- **Dependencies:** Python CLI (`uv`/`uvx` friendly).
- **Complexity:** Low.
- **Cost implications:** None beyond your model.
- **Self-hosting:** N/A.
- **Vendor lock-in:** None.
- **Agent model:** None of its own — orchestrates whatever agent you use.
- **Human-in-the-loop:** Review gates between spec, plan and tasks are the intended
  practice.
- **Permissions model:** None.
- **Workflow capability:** Strong for the front of the lifecycle (idea → tasks).
- **Checkpoint / resume:** Spec/plan/tasks files are durable and resumable.
- **Testing / debugging / review:** Encourages acceptance criteria in the spec;
  otherwise defers to the agent.
- **Context management:** The spec + plan + tasks files are the context contract —
  aligns with our SPEC and PLAN project states.
- **Observability:** None.
- **Usefulness to our company:** High for the Business Analyst / spec-authoring skill
  and for our `constitution` naming (spec-kit also uses a project "constitution").
- **Overlap with our own design:** Front-of-lifecycle overlap. We extend past
  `implement` into review, QA, security, staging, approval, production, monitoring.
- **Maintenance burden if adopted:** Low.

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** OPTIONAL (thin, low-risk; usable as the spec/plan front-end
  for Claude Code sessions without committing the company to it)
- **Rationale:** Spec-Driven Development is exactly our IDEA → SPEC → PLAN spine, and
  spec-kit is a clean, MIT, agent-agnostic implementation of the front half. Keeping
  it OPTIONAL avoids lock-in while letting teams use it.
- **What we take:** `spec.md` / `plan.md` / `tasks.md` artifact triplet; acceptance
  criteria in the spec; "constitution" as a first-class repo document; explicit
  review checkpoint before implementation.
- **What we deliberately do not take:** Its command templates verbatim; reliance on
  it as the only spec path.
- **Data checked:** Web search Aug 2026 (github.github.io/spec-kit docs, v0.11.0
  notes); prior knowledge.
