# yamadashy/repomix — Evaluation

- **Repository:** yamadashy/repomix
- **Source:** https://github.com/yamadashy/repomix
- **Purpose:** Packs an entire repository (or a filtered subset) into a single,
  AI-friendly file (XML/Markdown/plain), with token counting, secret detection,
  compression, and remote-repo support.
- **Architecture:** Node CLI + optional MCP server. Respects `.gitignore`, custom
  include/ignore globs; optional tree-sitter "compression" that keeps signatures and
  drops bodies; Secretlint pass to flag secrets before they reach a model.
- **Development activity / maintenance health:** Very active, popular, frequent
  releases.
- **License:** MIT.
- **Security considerations:** Built-in secret scanning is a *plus*; still, review
  output before sending externally. Remote-repo mode fetches third-party code.
- **Dependencies:** Node; tree-sitter; Secretlint.
- **Complexity:** Very low.
- **Cost implications:** Free; actively *reduces* token spend by compressing context.
- **Self-hosting:** Local CLI.
- **Vendor lock-in:** None.
- **Agent model:** N/A (a preprocessing tool).
- **Human-in-the-loop / permissions / workflow / checkpoint:** N/A.
- **Testing / debugging / review:** N/A.
- **Context management:** This *is* a context-management tool — the whole point.
- **Observability:** Token/char/file stats in output.
- **Usefulness to our company:** High and concrete. Useful for the Code Reviewer,
  Solution Architect and Security Engineer agents to get whole-repo or scoped context
  cheaply, and for the future repository-evaluator utility.
- **Overlap with our own design:** None — it fills the "package context" gap.
- **Maintenance burden if adopted:** Very low (pinned CLI dependency).

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** ADOPT (low-risk, high-value utility; add to `tools/registry.yml`
  as ADOPTED, invoked via CLI/MCP, no fork)
- **Rationale:** Cheap, MIT, single-purpose, reduces cost, and includes a secret
  pre-flight. Exactly the kind of external dependency we prefer over building our own.
- **What we take:** Use it directly as the "pack repo context" tool; adopt its
  secret-scan-before-send discipline; use its tree-sitter compression to keep
  architecture/review context within budget.
- **What we deliberately do not take:** No customization needed; do not fork.
- **Data checked:** Prior knowledge; general web awareness Aug 2026.
