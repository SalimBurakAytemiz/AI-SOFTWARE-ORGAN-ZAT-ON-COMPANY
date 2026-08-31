# qodo-ai/pr-agent — Evaluation

- **Repository:** qodo-ai/pr-agent (formerly Codium-AI/pr-agent)
- **Source:** https://github.com/qodo-ai/pr-agent
- **Purpose:** AI tool that reviews pull requests: `/describe`, `/review`, `/improve`,
  `/ask` commands that post structured PR descriptions, review comments, and code
  suggestions; runs as a GitHub/GitLab/Bitbucket app, Action, or CLI.
- **Architecture:** Python. Provider-agnostic git platform adapters; a compression
  strategy to fit large diffs; configurable via TOML; LiteLLM for models. Open-source
  core with a commercial "Qodo Merge" hosted tier.
- **Development activity / maintenance health:** Active; company-backed; regular
  releases.
- **License:** Apache-2.0 (OSS core).
- **Security considerations:** Needs a token with PR read/write; scope it tightly.
  Reads code into a model — respect data policy. Prompt-injection via PR content is a
  known class of risk for PR bots.
- **Dependencies:** Python; git platform token; model access.
- **Complexity:** Low–medium.
- **Cost implications:** Model spend per PR; self-host is otherwise free.
- **Self-hosting:** Yes (Action / Docker / CLI).
- **Vendor lock-in:** Low for OSS core; hosted tier optional.
- **Agent model:** Task-specific commands, not a general agent.
- **Human-in-the-loop capability:** It *assists* human review; humans still decide.
- **Permissions model:** Whatever the git token grants — must be least-privilege
  (comment + read; never merge).
- **Workflow capability:** Triggered on PR events; fits into CI.
- **Checkpoint / resume:** N/A (stateless per PR).
- **Testing approach:** N/A (it reviews, it does not test).
- **Debugging approach:** N/A.
- **Review approach:** This *is* a review tool — structured, checklist-like PR review
  with inline suggestions.
- **Context management:** Diff-compression to fit large PRs.
- **Observability:** Logs; usage analytics in hosted tier.
- **Usefulness to our company:** Medium–high as an *assistive input* to the Senior
  Code Reviewer agent and as a first-pass PR describer. Must never be the sole
  reviewer and must never hold merge rights.
- **Overlap with our own design:** Overlaps the Code Reviewer role partially — as a
  tool the reviewer uses, not a replacement.
- **Maintenance burden if adopted:** Low–medium.

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** OPTIONAL (usable as a CI-triggered first-pass PR reviewer /
  describer feeding the Senior Code Reviewer agent; token limited to read + comment)
- **Rationale:** Good, well-licensed PR-review automation that complements — never
  replaces — our independent Code Reviewer. Kept OPTIONAL and permission-boxed.
- **What we take:** Structured review checklist output; diff-compression for large
  PRs; `/describe` to standardize PR descriptions (our git policy).
- **What we deliberately do not take:** Any configuration granting merge; treating it
  as the independent reviewer of record.
- **Data checked:** Prior knowledge; general web awareness Aug 2026.
