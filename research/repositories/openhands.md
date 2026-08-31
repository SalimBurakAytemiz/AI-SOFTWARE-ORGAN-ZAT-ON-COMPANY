# All-Hands-AI/OpenHands — Evaluation

- **Repository:** All-Hands-AI/OpenHands (formerly OpenDevin)
- **Source:** https://github.com/All-Hands-AI/OpenHands
- **Purpose:** A platform for software-development agents: an agent that edits code,
  runs commands in a sandbox, browses the web, and iterates to complete a task, with
  a UI, a headless mode, and a GitHub-integrated "resolver".
- **Architecture:** Python backend + React UI. An agent controller loop, an
  **event stream** as the durable interaction log, a pluggable **runtime** that
  executes actions inside a Docker sandbox (also remote runtime options), a
  microagent/skill system, and an agent SDK. Strong SWE-bench track record.
- **Development activity / maintenance health:** Very active, large community,
  frequent releases, commercial backing (All Hands AI).
- **License:** MIT.
- **Security considerations:** Executes arbitrary generated commands — the Docker
  sandbox is the primary control; browsing adds prompt-injection surface. Good default
  isolation posture relative to peers.
- **Dependencies:** Docker required; Python stack; provider access via LiteLLM.
- **Complexity:** Medium–high.
- **Cost implications:** Model spend can be significant on long tasks; runtime infra
  cost if using remote runtimes.
- **Self-hosting:** Yes (local Docker or your infra); also a paid cloud.
- **Vendor lock-in:** Low — LiteLLM under the hood, self-hostable.
- **Agent model:** Single primary agent + microagents; delegation possible.
- **Human-in-the-loop capability:** Confirmation mode for actions; UI review of
  each step; can pause for input.
- **Permissions model:** Sandbox-level; action confirmation; no fine-grained
  capability tokens.
- **Workflow capability:** Task-loop, not a multi-stage org pipeline.
- **Checkpoint / resume:** Event stream enables replay/resume of a session.
- **Testing approach:** Runs the repo's own tests as its feedback signal; strong at
  test-driven iteration.
- **Debugging approach:** Iterative run-observe-fix inside the sandbox.
- **Review approach:** Not independent review; produces PRs for humans to review.
- **Context management:** Event stream + condenser for long histories; microagents
  inject scoped knowledge.
- **Observability:** Session logs, trajectories; OTel work ongoing.
- **Usefulness to our company:** High as the reference **execution environment** for
  engineer agents: sandboxed runtime + event stream + "tests are the feedback loop".
- **Overlap with our own design:** It is an execution layer under our roles, not an
  org model — complementary.
- **Maintenance burden if adopted:** Medium–high (Docker runtime, fast release pace).

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** OPTIONAL / DEFER — a strong candidate for the *engineer-agent
  execution sandbox* in the runtime phase; not adopted now because no runtime is built
  yet.
- **Rationale:** OpenHands solves "how does a coding agent safely edit + run code" —
  Docker sandbox, event-stream replay, tests-as-feedback. We will very likely want
  this or an equivalent under our Frontend/Backend/DB engineer agents.
- **What we take:** Docker-sandboxed execution runtime; event stream as the durable,
  replayable action log (feeds our audit schema); microagents ≈ our scoped skills;
  action-confirmation mode ≈ our approval gates.
- **What we deliberately do not take (now):** Its single-agent task loop as our whole
  org model; its UI as our control surface.
- **Data checked:** Prior knowledge; general web awareness Aug 2026. Deep repo
  re-verification deferred to Agent Runtime phase.
