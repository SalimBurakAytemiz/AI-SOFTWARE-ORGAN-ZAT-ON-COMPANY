# garrytan/gstack — Evaluation

- **Repository:** garrytan/gstack
- **Source:** https://github.com/garrytan/gstack
- **Purpose:** An opinionated, batteries-included full-stack starter / reference stack
  intended to give AI coding agents a known-good project layout, conventions and tool
  choices so they produce consistent output.
- **Architecture:** Application template (TypeScript, React/Next.js, Postgres, auth,
  testing, CI wiring) plus agent guidance files.
- **Development activity / maintenance health:** Small project, personal maintainer;
  activity varies. Treat as a reference, not a dependency.
- **License:** MIT (verify at integration time).
- **Security considerations:** Standard web-app template concerns; keep dependencies
  patched.
- **Dependencies:** Full JS/TS app toolchain.
- **Complexity:** Medium (a whole app skeleton).
- **Cost implications:** None directly.
- **Self-hosting:** It is your app.
- **Vendor lock-in:** Low.
- **Agent model:** None; it is a target codebase, not an agent.
- **Human-in-the-loop / permissions / workflow / checkpoint:** N/A.
- **Testing approach:** Ships a test setup and conventions worth studying.
- **Context management:** "Give the agent a consistent stack and conventions" is the
  core lesson.
- **Observability:** Basic wiring if present.
- **Usefulness to our company:** Relevant to the *future* Cleaning Commerce product
  architecture decision, not to this organization repository.
- **Overlap with our own design:** None (different layer).
- **Maintenance burden if adopted:** Would be the product team's concern later.

### Decisions

- **knowledge_adoption:** PARTIAL
- **runtime_decision:** DEFER (belongs to a future Product Architecture decision, not
  this organization foundation)
- **Rationale:** Stack choice for Cleaning Commerce is explicitly out of scope here.
  We record the lesson — agents do better against an opinionated, conventionalized
  stack — and defer the actual evaluation.
- **What we take:** The principle: define house conventions and a reference project
  layout for agents before large builds begin.
- **What we deliberately do not take:** Any concrete stack commitment in this repo.
- **Data checked:** Prior knowledge; not re-verified in depth (out of current scope,
  low risk).
