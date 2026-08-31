# obra/superpowers — Evaluation

- **Repository:** obra/superpowers (+ obra/superpowers-skills, -marketplace, -lab)
- **Source:** https://github.com/obra/superpowers
- **Purpose:** An agentic *skills framework* and software-development methodology for
  Claude Code. Bundles composable skills (brainstorming, test-driven-development,
  using-git-worktrees, verification-before-completion, …) plus bootstrap instructions
  that make the agent actually use them; skills auto-trigger by context.
- **Architecture:** A Claude Code plugin. Skills are Markdown files with frontmatter
  and a trigger description; the plugin clones the community skills repo locally and
  injects an index. No server.
- **Development activity / maintenance health:** Very active; currently the
  most-starred Claude Code skills repository.
- **License:** MIT.
- **Security considerations:** Skills are instructions the agent will follow — supply
  chain matters. Pin versions; review community skills before enabling.
- **Dependencies:** Claude Code plugin manager.
- **Complexity:** Low to install; the value is in the skill content.
- **Cost implications:** None beyond your model.
- **Self-hosting:** Skills live in your environment.
- **Vendor lock-in:** Claude Code specific in packaging, but the skill *content* is
  portable prose.
- **Agent model:** N/A — augments an existing agent.
- **Human-in-the-loop:** Some skills (verification-before-completion) enforce a
  self-check; approval is still the host's job.
- **Permissions model:** None.
- **Workflow capability:** Skill-level, not org-level.
- **Checkpoint / resume:** The git-worktree skill gives isolation and clean resume.
- **Testing approach:** The TDD skill enforces RED → GREEN → REFACTOR → commit.
- **Debugging approach:** Systematic-debugging skill (hypothesis-driven).
- **Review approach:** Skills for self-review; not independent review.
- **Context management:** Skills keep method out of the main prompt — directly
  validates our `skills/` design.
- **Observability:** None.
- **Usefulness to our company:** High. Our `skills/` directory is modeled on this
  idea: reusable, versioned, trigger-described capability files referenced by agents.
- **Overlap with our own design:** The skill *concept*. We add schema validation,
  risk levels, explicit source attribution, and binding to agent definitions.
- **Maintenance burden if adopted:** Low–medium (curating which skills are ACTIVE).

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** PARTIAL / OPTIONAL — adopt the skill *format and discipline*;
  optionally use the Claude Code plugin during human-driven sessions. Do not make the
  company depend on the plugin.
- **Rationale:** Superpowers is the best existing demonstration that "skills as
  composable files" keeps agents disciplined without bloating prompts. We reproduce
  the pattern natively (`schemas/skill.schema.json`) so it is portable and validated.
- **What we take:** Skill file structure; TDD, systematic-debugging,
  git-worktree-isolation, verification-before-completion as named skills;
  auto-trigger `when_to_use` metadata.
- **What we deliberately do not take:** Blind import of the whole community skill
  library; plugin as a hard dependency.
- **Data checked:** Web search Aug 2026 (repo + marketplace listings); prior knowledge.
