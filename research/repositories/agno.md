# agno-agi/agno — Evaluation

- **Repository:** agno-agi/agno
- **Source:** https://github.com/agno-agi/agno
- **Purpose:** Full-stack Python framework for building agentic systems — single
  agent up to coordinated teams — with tools, knowledge (RAG), persistent memory, a
  reasoning loop, and a bundled runtime/control-plane ("AgentOS") for serving them.
- **Architecture:** Python. An `Agent` is an LLM + tools + knowledge + memory + config
  in one class; `Team` for multi-agent; emphasis on performance (fast instantiation,
  low overhead) and a model-agnostic provider layer. ~41k stars mid-2026, very active
  (v2.x, releases roughly weekly).
- **License:** Mozilla Public License 2.0 for the core (verify per-package; some
  components differ).
- **Security considerations:** AgentOS runs services — standard web-service hardening.
  Tool sandboxing on you.
- **Dependencies:** Moderate; provider SDKs optional.
- **Complexity:** Low–medium.
- **Cost implications:** Free framework.
- **Self-hosting:** Yes — explicitly "your cloud, your data".
- **Vendor lock-in:** Low on models; medium if you build on AgentOS.
- **Agent model:** Configurable single class; teams with coordinate/route modes.
- **Human-in-the-loop capability:** Confirmation hooks / user-control flows exist;
  less battle-tested for durable multi-day approval than LangGraph.
- **Permissions model:** Tool-level; no capability sub-scoping / default-deny.
- **Workflow capability:** Workflows API (steps, conditions, loops) plus teams.
- **Checkpoint / resume:** Session storage + memory; workflow state persistence.
- **Testing approach:** Plain Python classes → unit-testable.
- **Debugging approach:** Structured logs; AgentOS UI.
- **Context management:** Explicit knowledge + memory config per agent.
- **Observability:** Built-in telemetry hooks; OTel / Langfuse integrations.
- **Usefulness to our company:** Medium–high. Its "agent = model + tools + knowledge +
  memory + config in one declarative unit" mirrors our agent-definition philosophy.
- **Overlap with our own design:** The agent-as-configured-object idea overlaps
  strongly; we express it as validated YAML rather than Python.
- **Maintenance burden if adopted:** Medium — fast-moving, weekly releases.

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** OPTIONAL (credible alternative/complement to LangGraph for the
  runtime; re-evaluate head-to-head during Agent Runtime design)
- **Rationale:** Agno's declarative "everything about the agent in one unit" and its
  performance focus validate our approach. It is a reasonable runtime candidate but
  its human-in-the-loop durability is less proven than LangGraph's checkpoint model,
  so we keep it OPTIONAL pending a direct comparison.
- **What we take:** Agent = (model + tools + knowledge + memory + policy + config) as
  one declarative unit; model-agnostic provider layer; "your cloud, your data".
- **What we deliberately do not take (yet):** AgentOS as our control plane; weekly
  upgrade cadence as a hard dependency.
- **Data checked:** Web search Aug 2026 (repo stats, v2.6.x releases); prior knowledge.
