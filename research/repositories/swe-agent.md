# SWE-agent/SWE-agent — Evaluation

- **Repository:** SWE-agent/SWE-agent (Princeton NLP)
- **Source:** https://github.com/SWE-agent/SWE-agent
- **Purpose:** Research-grade agent that turns an LM into a software-engineering agent
  via a carefully designed **Agent-Computer Interface (ACI)**; also does offensive
  security ("EnIGMA") and general tasks. Origin of the SWE-bench evaluation harness
  ecosystem.
- **Architecture:** Python. A minimal, well-instrumented loop; the key idea is the
  ACI — specially designed commands (a bespoke file viewer/editor, search, context
  management) that make LMs far more effective than raw shell. Config-driven agents.
- **Development activity / maintenance health:** Active, academic cadence; influential;
  SWE-agent 1.0+ generalized beyond the paper.
- **License:** MIT.
- **Security considerations:** Runs commands in a container; designed for benchmark
  isolation. EnIGMA mode is explicitly offensive-security tooling — out of scope for
  us.
- **Dependencies:** Docker; Python.
- **Complexity:** Low–medium (deliberately small core).
- **Cost implications:** Model spend per trajectory.
- **Self-hosting:** Yes.
- **Vendor lock-in:** None.
- **Agent model:** Single agent; the interface is the contribution, not orchestration.
- **Human-in-the-loop capability:** Minimal (benchmark focus).
- **Permissions model:** Container isolation only.
- **Workflow capability:** None (single task).
- **Checkpoint / resume:** Trajectory files; limited resume.
- **Testing approach:** Task success measured against a hidden test suite (SWE-bench
  style).
- **Debugging approach:** Trajectory inspection.
- **Review approach:** N/A.
- **Context management:** Explicit ACI commands for viewing/searching code and
  managing the window — this is the valuable lesson.
- **Observability:** Rich trajectory logs.
- **Usefulness to our company:** High as a lesson in **tool interface design**: give
  agents purpose-built, constrained commands rather than raw power, and instrument
  every step.
- **Overlap with our own design:** Informs `tools/` capability scoping and the idea
  that a tool grant ≠ full tool power.
- **Maintenance burden if adopted:** N/A as runtime.

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** DEFER (its trajectory/eval harness may be useful for agent
  performance benchmarking later; not a production runtime)
- **Rationale:** SWE-agent's ACI thesis — constrained, well-designed, fully logged
  commands beat raw shell access — directly shapes our capability-oriented tool
  permission model and our audit requirements.
- **What we take:** Purpose-built constrained tool interfaces; per-step trajectory
  logging; the discipline of measuring agent success against hidden tests.
- **What we deliberately do not take:** EnIGMA offensive-security tooling; a
  single-task loop as our org model.
- **Data checked:** Prior knowledge; general web awareness Aug 2026.
