# Agent System

## An agent is never just a prompt

```
AGENT = ROLE + SKILLS + MODEL + TOOLS + PERMISSIONS + POLICIES + CONTEXT + MEMORY
      + QUALITY GATES + METRICS
```

Every agent is one YAML file in `agents/software-company/`, validated against
[`../schemas/agent.schema.json`](../schemas/agent.schema.json).

## Field reference

| Field | Meaning |
|---|---|
| `id`, `title`, `department`, `seniority` | Identity and placement |
| `purpose`, `mission` | Why the role exists; what "good" looks like |
| `responsibilities` / `non_responsibilities` | The domain it owns, and explicit boundaries |
| `required_skills` | References into `skills/` — the *how* |
| `domain_knowledge`, `programming_languages`, `frameworks`, `engineering_practices` | Competence profile |
| `preferred_model_tier` / `fallback_model_tier` | Conceptual tiers (`models/tiers.yml`), never a provider |
| `risk_level` | Highest risk level the agent may autonomously drive. **Never 5** — RISK 5 always additionally needs the Human Founder |
| `allowed_tools` / `forbidden_tools` | Capability-scoped references into `tools/capabilities.yml`. Forbidden always wins |
| `allowed_actions` / `forbidden_actions` | Free-text actions. No agent lists any of the 15 critical actions in `allowed_actions`; every agent lists all 15 in `forbidden_actions` |
| `human_approval_required` | Critical actions this agent may *prepare* but never execute |
| `inputs` / `outputs` | The work contract |
| `quality_gates` | What must be true before the agent's output is accepted |
| `handoff_from` / `handoff_to` / `escalation_to` | The collaboration graph; resolves to agent ids or `human-founder` |
| `memory_scope` | `read` / `write` namespaces, `retention` (`task` or `durable`), and `forbidden` (always: secrets, customer data) |
| `context_requirements` | What context the agent must be given (least privilege) |
| `audit_requirements` | What this agent must emit as audit events |
| `success_metrics` / `failure_conditions` | Performance contract |

## Memory

`memory_scope` namespaces (e.g. `product/specs`, `code/backend`, `security/findings`)
are logical; the runtime maps them to storage. Rules:

- `retention: task` — scratch memory for one unit of work, discarded after.
- `retention: durable` — institutional knowledge that persists.
- `forbidden` — no secret material, no customer PII, ever. Record references, not
  values (Constitution Article 8).

## Performance metrics (contract for the runtime)

Every agent will be measured on:

`tasks_assigned`, `tasks_completed`, `success_rate`, `first_pass_success_rate`,
`review_pass_rate`, `bugs_created`, `regressions_created`,
`security_findings_created`, `average_duration`, `average_cost`, `retry_count`,
`human_intervention_rate`, `quality_score`.

These feed **performance-based routing**: over time, the runtime can prefer the
agent/tier configuration that produces the best outcome per dollar for a given task
type. The datastore is a runtime-phase build (candidate: Langfuse scores + a metrics
table); the contract is defined now. See also `docs/model-system.md` and
[`../research/architecture-decisions.md`](../research/architecture-decisions.md).

## Adding or changing an agent

A pull request that validates (`python3 tests/run_all.py`), references real skills
and capabilities, and — for any permission or risk change — is routed to the Human
Founder (`.github/CODEOWNERS`). New roles require a written gap analysis in
`research/`.
