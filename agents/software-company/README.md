# Agent Workforce — `agents/software-company/`

One YAML file per AI employee, validated against `../../schemas/agent.schema.json`.

**An agent is never just a prompt.** Each definition binds:

```
AGENT = ROLE + SKILLS + MODEL + TOOLS + PERMISSIONS + POLICIES + CONTEXT + MEMORY
      + QUALITY GATES + METRICS
```

## Roster (18 agents)

| Department | Agent id | Title | Risk ceiling |
|---|---|---|---|
| leadership | `engineering-director` | AI Engineering Director / CTO | 4 |
| product | `product-manager` | AI Product Manager | 2 |
| product | `business-analyst` | AI Business Analyst | 2 |
| design | `ux-ui-designer` | AI UX/UI Designer | 2 |
| architecture | `solution-architect` | AI Solution Architect | 4 |
| engineering | `frontend-engineer` | AI Frontend Engineer | 3 |
| engineering | `backend-engineer` | AI Backend Engineer | 4 |
| engineering | `database-engineer` | AI Database Engineer | 4 |
| engineering | `integration-engineer` | AI Integration Engineer | 4 |
| quality | `qa-lead` | AI QA Lead | 3 |
| quality | `test-automation-engineer` | AI Test Automation Engineer | 3 |
| security | `application-security-engineer` | AI Application Security Engineer | 4 |
| platform | `devops-platform-engineer` | AI DevOps / Platform Engineer | 4 |
| platform | `sre-observability-engineer` | AI SRE / Observability Engineer | 4 |
| platform | `model-operations-engineer` | AI Model Operations Engineer | 3 |
| incident | `incident-debug-engineer` | AI Incident / Debug Engineer | 4 |
| review | `senior-code-reviewer` | AI Senior Code Reviewer | 4 |
| release | `release-manager` | AI Release Manager | 4 |

**Risk ceiling** is the highest risk level of work an agent may autonomously drive.
No agent has a ceiling of 5: RISK 5 work always additionally requires the Human
Founder (constitution Article 3). No agent lists any of the 15 critical actions in
`allowed_actions`; agents that may *prepare* a critical action list it under
`human_approval_required`.

The **Human Founder** is not in this roster — the Human Founder is the authority the
workforce reports to (`escalation_to: human-founder`).

See `../../docs/agent-system.md` for field semantics and the performance-metric
contract, and `../../research/role-gap-analysis.md` for why the roster looks like
this.
