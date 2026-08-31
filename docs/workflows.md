# Workflows

Nine gated lifecycles in `workflows/`, each validated against
[`../schemas/workflow.schema.json`](../schemas/workflow.schema.json). The future
runtime executes them; `tests/test_workflows.py` and `tests/test_human_authority.py`
enforce their safety properties now.

| Workflow | Trigger | Reaches production? |
|---|---|---|
| `feature-development` | New product intent | yes |
| `bugfix` | Confirmed non-urgent defect | yes |
| `hotfix` | Urgent fix, no active incident | yes |
| `incident` | Live production degradation / outage / security event | yes |
| `release` | A change set is ready to ship (the gate all others funnel through) | yes |
| `dependency-update` | Renovate PR / advisory | yes |
| `security-finding` | Scanner / red-team / disclosure | yes |
| `architecture-change` | Structural or technology change | sometimes |
| `database-migration` | Schema change (callable sub-workflow) | yes |

Why the set is complete and non-overlapping: [`../research/workflow-gap-analysis.md`](../research/workflow-gap-analysis.md).

## Step anatomy

Each step has `id`, `name`, `owner` (an agent id or `human-founder` / `system` /
`external`), `action`, `on_pass`, `on_fail`, and optionally `project_state`, `gate`,
`human_approval`, `risk_level`, `audit_event`. `on_pass` / `on_fail` point to another
step id or a terminal (`end`, `abort`, `done`).

## The feature-development lifecycle

```
IDEA → PRODUCT_ANALYSIS → BUSINESS_ANALYSIS → SPEC(review) → ARCHITECTURE → DESIGN
     → PLAN(review) → IMPLEMENTATION → SELF_TEST → CODE_REVIEW → AUTOMATED_TEST
     → QA → SECURITY → STAGING → STAGING_VERIFY → RELEASE_REVIEW
     → HUMAN_APPROVAL → PRODUCTION → PRODUCTION_VERIFY → MONITORING
```

## The Release Gate

`workflows/release.yml` + `policies/release.yml`. No production release proceeds
unless every applicable check is `PASS`:

`BUILD`, `LINT`, `UNIT_TEST`, `INTEGRATION_TEST`, `API_TEST`, `E2E_TEST`, `QA`,
`SECURITY`, `MIGRATION_CHECK`, `BACKUP_CHECK`, `ROLLBACK_CHECK`, `RELEASE_REVIEW`

…then `HUMAN_APPROVAL`. A failing gate routes back to the originating workflow, never
toward production. Gates may be waived only with a Human-Founder-approved recorded
exception.

## Enforced invariants (tested)

1. **Human approval is unbypassable.** Removing every `human_approval` step from a
   production-reaching workflow makes the first `PRODUCTION` step unreachable from the
   start — proven by graph reachability in `tests/test_workflows.py`.
2. **Production steps are Human-Founder-owned.** Every RISK 5 `PRODUCTION` step has
   `owner: human-founder`.
3. **Reviewer ≠ implementer.** In every delivery workflow the review step owner
   differs from the implementation step owner and is `senior-code-reviewer`.
4. **No unreachable steps.** Every step is reachable from the start.
5. **Every gate emits an audit event.**
6. **The Release Manager never executes or approves production.**

## Project state machine

States: `IDEA`, `SPEC`, `PLAN`, `DESIGN`, `BUILD`, `REVIEW`, `TEST`, `SECURITY`,
`STAGING`, `APPROVAL`, `PRODUCTION`, `MONITORING`, `IMPROVEMENT` (+
`HUMAN_APPROVAL_REQUIRED` for the repository itself).
Statuses: `WAITING`, `RUNNING`, `PASS`, `FAIL`, `BLOCKED`, `APPROVAL_REQUIRED`.
Schema: `schemas/project-state.schema.json`. Current: `project-state/current.yml`.
