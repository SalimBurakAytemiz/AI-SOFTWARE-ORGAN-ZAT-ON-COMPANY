# microsoft/agent-framework — Evaluation

- **Repository:** microsoft/agent-framework (Python + .NET; Go in public preview in a
  separate repo)
- **Source:** https://github.com/microsoft/agent-framework
- **Purpose:** Microsoft's unified successor to Semantic Kernel + AutoGen: build,
  orchestrate and operate production agents and multi-agent workflows, with typed
  workflows, MCP support, and integration with Microsoft Foundry / Azure.
- **Architecture:** Multi-language (Python, .NET). Agents + a graph/workflow
  orchestration layer, checkpointing, MCP client/server, hosted-agent state
  persistence in Foundry. v1.0 released April 2026.
- **Development activity / maintenance health:** Very active, Microsoft-backed,
  regular releases; RC → 1.0 in early 2026.
- **License:** MIT.
- **Security considerations:** Enterprise-oriented; strong identity story when on
  Azure, but that path pulls Azure. Non-Azure use is supported but less first-class.
- **Dependencies:** Substantial; best experience inside the Microsoft/Azure ecosystem.
- **Complexity:** Medium–high.
- **Cost implications:** Framework free; Foundry / Azure services paid; the "happy
  path" nudges toward Azure spend.
- **Self-hosting:** Core yes; hosted-agent features want Foundry.
- **Vendor lock-in:** Medium–high if you adopt Foundry; low if you stay on the OSS
  core only.
- **Agent model:** Agents + typed workflows + MCP tools.
- **Human-in-the-loop capability:** Supported via workflow checkpoints / request-response
  patterns.
- **Permissions model:** Leans on platform identity (Entra) rather than in-framework
  capability scoping.
- **Workflow capability:** Strong, typed.
- **Checkpoint / resume:** Yes.
- **Testing / debugging:** Standard SDK testing; OTel-based tracing built in.
- **Context management:** Thread/state abstractions.
- **Observability:** OpenTelemetry-native — a genuine strength.
- **Usefulness to our company:** Medium. Good ideas (OTel-native, typed workflows,
  MCP-first) but the value concentrates on Azure, which we have not chosen.
- **Overlap with our own design:** Would implement workflows; philosophy overlaps.
- **Maintenance burden if adopted:** Medium; ecosystem gravity toward Azure.

### Decisions

- **knowledge_adoption:** PARTIAL
- **runtime_decision:** DEFER (reconsider only if the company commits to Azure/Foundry)
- **Rationale:** Technically solid and now 1.0, but its advantages are strongest
  inside Microsoft's cloud, and we have made no cloud commitment. LangGraph / Mastra
  give us the same orchestration primitives with less ecosystem pull.
- **What we take:** OpenTelemetry-native instrumentation as a baseline expectation;
  MCP-first tool integration; typed workflow definitions.
- **What we deliberately do not take (now):** Foundry-hosted agent state; Azure
  identity as our permission model.
- **Data checked:** Web search Aug 2026 (releases, devblogs, roadmap discussion
  #4262); prior knowledge.
