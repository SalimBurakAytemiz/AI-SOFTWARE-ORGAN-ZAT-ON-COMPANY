# Organization

## Departments and roles (18 agents)

| Department | Agents | Owns |
|---|---|---|
| Leadership | `engineering-director` | Task routing, standards, architecture governance, escalation, final recommendation to the Human Founder |
| Product | `product-manager`, `business-analyst` | Product intent & priority / testable specification & traceability |
| Design | `ux-ui-designer` | IA, flows, states, accessibility, design system |
| Architecture | `solution-architect` | System/integration architecture, technology decisions, ADRs |
| Engineering | `frontend-engineer`, `backend-engineer`, `database-engineer`, `integration-engineer` | Implementation by domain |
| Quality | `qa-lead`, `test-automation-engineer` | Test strategy & gates / test implementation |
| Security | `application-security-engineer` | Appsec review, scanning, threat modeling, SECURITY gate |
| Platform | `devops-platform-engineer`, `sre-observability-engineer`, `model-operations-engineer` | Pre-prod delivery / prod reliability / model ops & cost |
| Incident | `incident-debug-engineer` | Triage, RCA, fix prep, postmortem |
| Review | `senior-code-reviewer` | Independent review (never the implementer) |
| Release | `release-manager` | Verify the Release Gate, mark `READY_FOR_HUMAN_APPROVAL` |

The **Human Founder** is not an agent. Every agent's `escalation_to` ultimately
reaches the Human Founder.

## How the roster was decided

Full analysis: [`../research/role-gap-analysis.md`](../research/role-gap-analysis.md).
Summary:

- Started from the 17 candidate roles in the build specification.
- **KEEP all 17.** Each owns a distinct responsibility domain. Merges considered and
  rejected: PM+BA, QA Lead + Test Automation, DevOps + SRE (each pair has different
  time horizons and a separation-of-duties reason to stay apart).
- **ADD 1:** `model-operations-engineer`. Build-spec sections 10, 11, 22, 23 create
  a large ongoing body of work (model tiering/routing, the model gateway, prompt
  evals, model-call cost & quality telemetry) that no candidate role owned. Giving it
  to the Engineering Director would make that a universal agent (forbidden).
- **No merges, no splits, no removals.** 18 total.
- Roles considered and **not** added now (no current gap an existing role can't
  hold): dedicated documentation writer, data/analytics engineer, compliance/privacy
  officer. The last is flagged `PLANNED` for when Cleaning Commerce handles real
  customer PII.

## Structural guarantees

1. **One role, one responsibility domain.** Enforced through `non_responsibilities`
   and independent review.
2. **The Engineering Director coordinates; it does not implement.** Its
   `non_responsibilities` forbid feature code and specialist work.
3. **Reviewer independence is structural.** `senior-code-reviewer` lacks `fs.write`
   and `github.create_pr` capabilities, so it *cannot* become the implementer.
   Workflows put a different agent on the review step than the implementation step;
   `tests/test_workflows.py` checks it.
4. **The Release Manager prepares, the Human Founder approves.** The Release Manager
   lacks all deploy and merge capabilities and never owns a mutating production step.

## Hand-off graph

Each agent declares `handoff_from` and `handoff_to`. The feature-development workflow
walks: Product Manager → Business Analyst → Solution Architect → UX/UI Designer →
Engineering Director (plan) → engineers → Senior Code Reviewer → Test Automation →
QA Lead → Application Security Engineer → DevOps → QA Lead (staging verify) → Release
Manager → **Human Founder** → (production) → SRE.
