# aider-ai/aider — Evaluation

- **Repository:** aider-ai/aider
- **Source:** https://github.com/aider-ai/aider
- **Purpose:** Terminal-based AI pair programmer that edits code in your local git
  repo and commits each change with a sensible message.
- **Architecture:** Python CLI. A **repository map** (tree-sitter-derived, ranked) gives
  the model a compact view of a large codebase; edit formats (diff/whole/udiff) tuned
  per model; tight git integration (auto-commit, undo); lint/test hooks.
- **Development activity / maintenance health:** Very active, single-maintainer-led
  with community; frequent releases; well-known leaderboard.
- **License:** Apache-2.0.
- **Security considerations:** Local execution; `--yes` / auto-commit can move fast —
  git is the safety net. Optional shell-command execution needs care.
- **Dependencies:** Python; tree-sitter; LiteLLM for providers.
- **Complexity:** Low.
- **Cost implications:** Model spend; repo map keeps prompts efficient.
- **Self-hosting:** Local.
- **Vendor lock-in:** None (LiteLLM).
- **Agent model:** Single pair-programmer loop; recent "architect/editor" two-model
  mode.
- **Human-in-the-loop capability:** Strong — diff review + git undo per change.
- **Permissions model:** Prompt-per-action; config.
- **Workflow capability:** None (interactive edits).
- **Checkpoint / resume:** Git history is the checkpoint trail.
- **Testing approach:** `--test-cmd` runs your tests after edits and feeds failures
  back; `--lint-cmd` similar.
- **Debugging approach:** Iterative, test-driven.
- **Review approach:** Human diff review.
- **Context management:** The repository map is the standout technique — compact,
  ranked codebase context without dumping files.
- **Observability:** Local chat history / analytics opt-in.
- **Usefulness to our company:** High as a lesson in **cheap, high-quality context**
  (repo map) and **commit discipline** (one logical change per commit, generated
  messages).
- **Overlap with our own design:** It is a harness; informs our git governance and
  context requirements.
- **Maintenance burden if adopted:** N/A as runtime.

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** REJECT (single-user interactive tool; not an orchestrated
  runtime and not a harness we need alongside Claude Code / opencode)
- **Rationale:** aider's durable contributions are ideas, not infrastructure: the
  ranked repository map and disciplined per-change git commits. We bake both into our
  git policy and context requirements.
- **What we take:** Ranked repo-map style context (see also Repomix); one-logical-
  change-per-commit with generated messages; test-command feedback loop after edits.
- **What we deliberately do not take:** aider as a company harness.
- **Data checked:** Prior knowledge; general web awareness Aug 2026.
