# mastra-ai/mastra — Evaluation

- **Repository:** mastra-ai/mastra
- **Source:** https://github.com/mastra-ai/mastra
- **Purpose:** TypeScript agent framework: agents, tools, deterministic workflows
  (graph of steps with branching/suspend-resume), RAG, memory, evals, and local dev
  playground; from the team behind Gatsby.
- **Architecture:** TypeScript/Node. `Agent` primitives + a `Workflow` engine with
  `.then()/.branch()/.parallel()` and **suspend/resume** for human-in-the-loop;
  deploy as a service or to serverless. Model routing via the Vercel AI SDK.
- **Development activity / maintenance health:** Active, well-funded, frequent
  releases; strong docs.
- **License:** Apache-2.0 / Elastic-2.0 depending on component (verify at
  integration).
- **Security considerations:** Standard Node service hardening; you own tool
  sandboxing and secrets.
- **Dependencies:** Node ecosystem; Vercel AI SDK.
- **Complexity:** Low–medium; good DX.
- **Cost implications:** Free framework; optional Mastra Cloud.
- **Self-hosting:** Yes.
- **Vendor lock-in:** Low–medium (AI SDK coupling; Cloud optional).
- **Agent model:** Declarative agents + tools; workflows for control.
- **Human-in-the-loop capability:** First-class **suspend/resume** on workflow steps —
  a clean approval-gate primitive, in our target language (TypeScript).
- **Permissions model:** Tool-level; no capability sub-scoping.
- **Workflow capability:** Strong and deterministic — arguably its best feature.
- **Checkpoint / resume:** Yes (workflow snapshots, suspend/resume).
- **Testing approach:** TS unit tests; built-in eval framework for agent outputs.
- **Debugging approach:** Local playground, tracing, step inspection.
- **Context management:** Explicit per-agent memory + working memory.
- **Observability:** OTel-based tracing; integrations.
- **Usefulness to our company:** High if the runtime is TypeScript (our engineering
  stack is TS/Node-heavy). Suspend/resume + evals + deterministic workflows map
  directly onto our workflow schema and quality gates.
- **Overlap with our own design:** It would implement our workflows; no conceptual
  conflict.
- **Maintenance burden if adopted:** Medium.

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** OPTIONAL (primary TypeScript runtime candidate; head-to-head
  vs LangGraph during Agent Runtime design)
- **Rationale:** If the runtime is built in TypeScript to match the company's
  engineering stack, Mastra's deterministic workflows + suspend/resume + built-in
  evals are the strongest fit. Kept OPTIONAL only because the runtime language is not
  yet decided.
- **What we take:** Deterministic workflow-as-graph with suspend/resume for approval;
  built-in eval step as a quality gate; local playground for debugging.
- **What we deliberately do not take (yet):** Mastra Cloud; hard AI-SDK coupling
  before the runtime decision.
- **Data checked:** Web search Aug 2026 (framework comparisons, mastra.ai docs);
  prior knowledge.
