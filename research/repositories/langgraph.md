# langchain-ai/langgraph — Evaluation

- **Repository:** langchain-ai/langgraph
- **Source:** https://github.com/langchain-ai/langgraph
- **Purpose:** Low-level library for building stateful, controllable multi-agent /
  multi-step systems as a directed graph of nodes and conditional edges, with durable
  state, checkpointing, human-in-the-loop interrupts and replay.
- **Architecture:** Graph of nodes (functions/agents) over a typed shared state;
  persistence layer (checkpointer) enabling pause/resume, time-travel and
  human-in-the-loop `interrupt()`; Python and JS. Optional LangGraph Platform/Server
  and LangSmith for hosting and tracing.
- **Development activity / maintenance health:** Very active; ~39M monthly PyPI
  downloads reported mid-2026; widely cited as the de-facto production standard.
- **License:** MIT (library). Platform and LangSmith are commercial.
- **Security considerations:** You own tool sandboxing and secrets. Large dependency
  surface via LangChain ecosystem if you pull extras.
- **Dependencies:** Core is relatively contained; ecosystem can sprawl.
- **Complexity:** Medium — explicit graph modeling has a learning curve but pays off.
- **Cost implications:** Library is free; hosted platform / tracing are paid.
- **Self-hosting:** Library yes; server component self-hostable; LangSmith mostly SaaS
  (self-host tier exists).
- **Vendor lock-in:** Low at library level, higher if you adopt Platform + LangSmith.
- **Agent model:** Anything you write as a node; supports supervisor / swarm patterns.
- **Human-in-the-loop capability:** First-class — `interrupt()` + checkpointer is
  exactly the approval-gate primitive we need.
- **Permissions model:** None built in — you enforce it in node logic.
- **Workflow capability:** Strong — this is a workflow engine for agents.
- **Checkpoint / resume:** First-class, durable, with time-travel.
- **Testing approach:** Nodes are plain functions → unit-testable; graph can be
  driven deterministically in tests.
- **Debugging approach:** Step-through via checkpoints; LangSmith traces.
- **Review approach:** N/A (framework).
- **Context management:** Explicit typed state; you decide what each node sees →
  aligns with least-privilege context.
- **Observability:** Via OpenTelemetry / LangSmith integrations.
- **Usefulness to our company:** High. Strong candidate for the future runtime's
  orchestration core, especially for durable state + human-in-the-loop interrupts.
- **Overlap with our own design:** It would *implement* our workflows and state
  machine, not replace their definitions.
- **Maintenance burden if adopted:** Medium — track releases, keep the graph code
  small and typed.

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** ADOPT (recommended orchestration core for the next phase —
  final selection to be confirmed during Agent Runtime design)
- **Rationale:** Its checkpointer + `interrupt()` model is the cleanest fit for
  "agent prepares, human approves, runtime resumes" without us building a durable
  execution engine from scratch. MIT-licensed library; SaaS parts are optional.
- **What we take:** Graph-of-gated-steps model; durable checkpoints; human-in-the-loop
  interrupt as the approval primitive; typed state as least-privilege context.
- **What we deliberately do not take (yet):** LangGraph Platform and mandatory
  LangSmith; deep LangChain ecosystem coupling.
- **Data checked:** Web search Aug 2026 (framework comparison articles,
  langchain.com); prior knowledge.
