# continuedev/continue — Evaluation

- **Repository:** continuedev/continue
- **Source:** https://github.com/continuedev/continue
- **Purpose:** Open-source IDE extension (VS Code, JetBrains) for AI chat, autocomplete,
  edit and agent modes; plus a hub for sharing "assistants", rules, prompts and MCP
  configs.
- **Architecture:** TypeScript core shared across IDE extensions + a CLI; `config.yaml`
  / hub-based assistant definitions; model-agnostic; local or team hub.
- **Development activity / maintenance health:** Very active; company-backed.
- **License:** Apache-2.0.
- **Security considerations:** IDE-level code access; MCP and hub content are supply
  chain; team hub centralizes config (good and a target).
- **Dependencies:** IDE; Node.
- **Complexity:** Low.
- **Cost implications:** Model spend; hub has paid team tiers.
- **Self-hosting:** Extension is local; hub is SaaS (self-host limited).
- **Vendor lock-in:** Low for the extension; medium if standardized on the hub.
- **Agent model:** IDE assistant with an agent mode; not orchestrated.
- **Human-in-the-loop capability:** Inherently — a developer is in the editor.
- **Permissions model:** Tool/MCP toggles per assistant.
- **Workflow capability:** Rules + prompts; not a pipeline.
- **Checkpoint / resume:** Session history in IDE.
- **Testing / debugging / review:** Defers to the developer and IDE.
- **Context management:** Context providers (@file, @repo, @docs, …) — a decent model
  for scoped context injection.
- **Observability:** Dev data export; hub analytics.
- **Usefulness to our company:** Low–medium for this organization repo. It is a
  human-developer productivity tool; our workforce is agents in a pipeline, not
  humans in an IDE.
- **Overlap with our own design:** The "assistant = model + rules + tools + context
  providers" idea overlaps our agent definition, weakly.
- **Maintenance burden if adopted:** Low.

### Decisions

- **knowledge_adoption:** PARTIAL
- **runtime_decision:** REJECT (IDE-centric; the Human Founder is not the one writing
  code line-by-line, and agents do not use an IDE)
- **Rationale:** Continue is excellent for human developers but orthogonal to an
  agent-run software company. We take only its context-provider vocabulary.
- **What we take:** Named, typed context providers (@repo, @docs, @spec…) as an
  inspiration for our `context_requirements` field.
- **What we deliberately do not take:** The extension, the hub, assistant configs.
- **Data checked:** Prior knowledge; general web awareness Aug 2026.
