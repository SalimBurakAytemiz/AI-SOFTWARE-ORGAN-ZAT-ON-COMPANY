# block/goose — Evaluation

- **Repository:** block/goose
- **Source:** https://github.com/block/goose
- **Purpose:** Local, extensible AI agent (CLI + desktop) that automates engineering
  tasks; MCP-native for extensions; model-agnostic.
- **Architecture:** Rust core. Agent loop with **MCP extensions** as the tool model;
  "recipes" for reusable parameterized task templates; permission modes
  (auto / approve / chat); session storage.
- **Development activity / maintenance health:** Active, Block-backed, regular
  releases.
- **License:** Apache-2.0.
- **Security considerations:** Executes commands locally; permission modes and an
  allowlist mitigate; MCP extension supply chain matters.
- **Dependencies:** Single binary; MCP servers as needed.
- **Complexity:** Low–medium.
- **Cost implications:** Model spend only.
- **Self-hosting:** Fully local.
- **Vendor lock-in:** Low (model-agnostic, open).
- **Agent model:** Single agent + subagents/recipes.
- **Human-in-the-loop capability:** Built-in permission modes including "approve
  every action".
- **Permissions model:** Modes + tool allowlists; per-extension.
- **Workflow capability:** Recipes (parameterized templates); not a multi-stage
  pipeline engine.
- **Checkpoint / resume:** Session resume.
- **Testing / debugging:** Runs project tests; interactive iteration.
- **Review approach:** Human review of diffs.
- **Context management:** Session context; MCP resources.
- **Observability:** Local logs; OTel-ish hooks emerging.
- **Usefulness to our company:** Medium. Good reference for MCP-first tooling and
  clean permission modes; "recipes" ≈ our parameterized workflows/skills.
- **Overlap with our own design:** Harness-level; complementary.
- **Maintenance burden if adopted:** Low–medium.

### Decisions

- **knowledge_adoption:** PARTIAL
- **runtime_decision:** OPTIONAL (another viable local harness / MCP host; not a
  differentiator over Claude Code + opencode for us)
- **Rationale:** Solid, well-licensed, MCP-native. Its permission-mode design and
  recipe concept are worth borrowing; we do not need three harnesses, so OPTIONAL.
- **What we take:** Explicit permission modes (auto / approve / chat) as a per-agent
  setting; parameterized "recipe" templates ≈ our workflows; MCP as the tool
  integration standard.
- **What we deliberately do not take:** Goose as the primary harness.
- **Data checked:** Prior knowledge; general web awareness Aug 2026.
