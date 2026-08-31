# Workflow Gap Analysis

The build spec mandates nine workflows (section 12). This document checks that the
set is complete, non-overlapping, and that every production-reaching workflow has a
human-approval gate before any production step.

## Mandated workflows and their distinct purpose

| Workflow | Trigger | Distinct from | Reaches production? |
|---|---|---|---|
| `feature-development` | New product intent / feature request | bugfix (no defect), hotfix (not urgent) | Yes |
| `bugfix` | Confirmed defect, non-urgent | feature (adds value vs restores intended behavior); hotfix (SLA/severity) | Yes |
| `incident` | Live production degradation / outage / security event | bugfix (not live-impacting); hotfix (planned urgent fix vs active incident) | Yes |
| `hotfix` | Urgent fix needed outside normal release cadence, no active incident | bugfix (cadence), incident (no live firefight) | Yes |
| `release` | A change set is ready to ship | It is the gate all others funnel through | Yes |
| `dependency-update` | Renovate PR / advisory | bugfix (no product defect); security-finding (no known vuln) | Yes (via release) |
| `security-finding` | SAST/DAST/SCA/secret finding or disclosure | incident (not necessarily live-exploited); dependency-update (finding vs routine bump) | Yes (via release) |
| `architecture-change` | Solution Architect proposes a structural change | feature (behavioral) — this changes boundaries/tech | Sometimes (via feature + release) |
| `database-migration` | Schema change required | Sub-flow invoked by feature/bugfix/architecture-change; isolated because prod migration is RISK 5 | Yes (prod migration = Human Founder) |

**Overlap check:** the three "fix" workflows (bugfix / hotfix / incident) are
differentiated by *urgency and live impact*, not by activity. `security-finding` and
`dependency-update` both feed `release` but differ on whether a vulnerability is
known. `database-migration` is deliberately a callable sub-workflow, not a peer,
because its prod step has a unique risk level. No redundant workflow.

## Invariant: human approval before production

Every workflow with `reaches_production: true` MUST contain a step with
`human_approval: true` whose `on_pass` leads to the first `project_state: PRODUCTION`
step, and there must be **no** edge into a PRODUCTION step that bypasses it. This is
checked by `tests/test_workflows.py::test_human_approval_before_production` and
`tests/test_human_authority.py`.

`architecture-change` that stays design-only (no code shipped) may end at
`APPROVAL` → documentation without a PRODUCTION step; if it produces shippable code it
hands off to `feature-development` / `release` and inherits their gate.

## Gaps considered

- **Rollback / incident-of-a-release workflow** — covered inside `incident` (a bad
  release is an incident) and by `release`'s mandatory `ROLLBACK_CHECK`. No separate
  workflow.
- **Spike / research workflow** — low risk, no production path; handled as a
  time-boxed task under `feature-development`'s IDEA→SPEC front end. Not a separate
  workflow.
- **Design-only / UX workflow** — the DESIGN state inside `feature-development`
  covers it; a standalone design workflow would just duplicate those steps.
- **Data-privacy / DSAR / customer-data-export workflow** — `PLANNED` for the
  Cleaning Commerce phase; customer data export is already a critical action in
  `policies/human-approval.yml`, so it is safe by default until then.
- **Cost-overrun / budget-breach workflow** — handled as an alert + auto-pause in
  `policies/cost.yml` rather than a delivery workflow.

## Conclusion

The nine mandated workflows are complete and non-overlapping for the current scope.
Two future workflows (`data-privacy-request`, and a dedicated `infra-change` once
OpenTofu is adopted) are recorded as `PLANNED` and not implemented now.
