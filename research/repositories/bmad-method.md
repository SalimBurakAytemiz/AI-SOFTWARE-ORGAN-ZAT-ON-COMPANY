# bmad-code-org/BMAD-METHOD — Evaluation

- **Repository:** bmad-code-org/BMAD-METHOD ("Breakthrough Method of Agile AI-Driven Development")
- **Source:** https://github.com/bmad-code-org/BMAD-METHOD
- **Purpose:** A *method*, distributed as files — agent persona definitions in
  Markdown+YAML, plus workflows, templates and a CLI installer that drops them into
  your own AI coding environment (Claude Code, Cursor, etc.).
- **Architecture:** No runtime. Personas (Analyst, PM, Architect, PO, SM, Dev, QA),
  a planning phase that yields PRD + architecture, a "shard" step that splits work
  into story files with focused context, then execution. Current line is V6 (module
  ecosystem, scale-adaptive planning, "BMad Builder").
- **Development activity / maintenance health:** Very active; large community; frequent
  tagged releases.
- **License:** MIT.
- **Security considerations:** Minimal attack surface (it is text). No permission or
  approval model — that is left to the host tool and the human.
- **Dependencies:** Node CLI installer only.
- **Complexity:** Low to adopt, medium to master.
- **Cost implications:** None beyond the model you already run.
- **Self-hosting:** N/A (files in your repo).
- **Vendor lock-in:** None; bring-your-own-model, bring-your-own-agent.
- **Agent model:** Prompt personas with attached checklists/templates; not
  capability-scoped employees.
- **Human-in-the-loop:** The human *is* the loop — the human drives each phase.
- **Permissions model:** None.
- **Workflow capability:** Strong as documented process; not machine-enforced.
- **Checkpoint / resume:** Story files act as durable, resumable units of work.
- **Testing / debugging / review:** QA persona + checklists; not automated.
- **Context management:** Excellent — the "shard into story files with focused
  context" idea directly informs our memory_scope and context_requirements fields.
- **Observability:** None.
- **Usefulness to our company:** Very high as a knowledge source. This repository is
  the closest existing artifact to what we are building.
- **Overlap with our own design:** High and intentional. We add: capability scoping,
  default-deny permissions, human-approval gates, audit schema, model routing,
  automated validation tests.
- **Maintenance burden if adopted as runtime:** N/A — there is no runtime.

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** REJECT (nothing to run; it is a method, and we are authoring
  our own governed method with enforcement)
- **Rationale:** BMAD validates "org as files": personas + workflows + templates +
  installer. We take its structure and its context-sharding discipline, and we go
  further on governance and machine-checkable safety.
- **What we take:** Persona/role files as the unit of org design; planning →
  sharding → execution rhythm; checklist/template attachments (our `skills/`);
  scale-adaptive planning (our risk levels).
- **What we deliberately do not take:** Its persona prompt style as a substitute for
  full agent definitions; its human-drives-everything assumption (we formalize which
  steps are agent-autonomous vs approval-gated).
- **Data checked:** Web search Aug 2026 (docs.bmad-method.org, release notes to
  ~v6.8.0); prior knowledge.
