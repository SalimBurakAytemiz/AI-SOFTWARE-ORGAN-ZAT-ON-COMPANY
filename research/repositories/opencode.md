# anomalyco/opencode — Evaluation

- **Repository:** anomalyco/opencode (by the SST team)
- **Source:** https://github.com/anomalyco/opencode
- **Purpose:** Open-source, terminal-native AI coding agent; model-agnostic (75+
  providers), client/server architecture, local-first, with your approval at each
  step.
- **Architecture:** A local server + multiple clients (TUI, desktop, IDE ext, SDK)
  talking over HTTP; conversations stored in SQLite; permission prompts before
  actions. ~180k stars mid-2026, very active.
- **License:** MIT.
- **Security considerations:** Local execution with per-action approval; supply-chain
  trust in the binary; broad provider list means many outbound endpoints.
- **Dependencies:** Single binary; Node-ish toolchain to build.
- **Complexity:** Low to use.
- **Cost implications:** Model spend only.
- **Self-hosting:** Fully local; server is yours.
- **Vendor lock-in:** None — explicitly model-agnostic and inspectable.
- **Agent model:** Single interactive coding agent; sub-agents / modes.
- **Human-in-the-loop capability:** Strong — approval at each step is the default.
- **Permissions model:** Per-action allow/deny prompts; config allowlists.
- **Workflow capability:** Session-level; not an org pipeline.
- **Checkpoint / resume:** SQLite-backed conversation history; resumable sessions.
- **Testing approach:** Runs project tests as feedback.
- **Debugging approach:** Interactive; console/log reading.
- **Review approach:** Human reviews diffs; not independent-agent review.
- **Context management:** Repo indexing; session context; the client/server split
  keeps state outside the model.
- **Observability:** Local logs; SDK for instrumentation.
- **Usefulness to our company:** Medium–high as an alternative human-driven harness to
  Claude Code, and as a clean reference for client/server + per-action approval + SDK.
- **Overlap with our own design:** It is a harness, like Claude Code — a tool, not an
  org model.
- **Maintenance burden if adopted:** Low–medium.

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** OPTIONAL (a legitimate second human-driven harness and an SDK
  worth considering for the runtime's engineer-agent layer)
- **Rationale:** Confirms the pattern we want: model-agnostic, local-first,
  per-action approval, state held in a server/DB not the model. Its SDK is a possible
  building block later. Kept OPTIONAL to avoid harness monoculture and lock-in.
- **What we take:** Client/server separation so conversation state is durable and
  auditable; per-action approval prompts; provider-agnostic model layer.
- **What we deliberately do not take (now):** Committing the company to a single
  harness.
- **Data checked:** Web search Aug 2026 (guides, ghtrends); prior knowledge.
