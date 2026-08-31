<!-- Every PR in this repository changes governance. Fill this in. -->

## What changes and why

<!-- Link the spec / ADR / issue / workflow run. -->

## Type

- [ ] Agent definition
- [ ] Skill
- [ ] Tool / capability registry
- [ ] Model tier / routing / risk policy
- [ ] Workflow
- [ ] Policy
- [ ] Schema
- [ ] Research / documentation
- [ ] Tests

## Risk level

<!-- 0–5 per models/risk-policy.yml. Anything touching the critical-action set,
     human-approval enforcement, permissions, or the constitution is RISK 5. -->

## Checklist

- [ ] `python3 tests/run_all.py` passes locally
- [ ] No secret added (gitleaks clean)
- [ ] If this touches `constitution/`, `policies/human-approval.yml`,
      `policies/agent-permissions.yml`, `tools/capabilities.yml`, or any workflow's
      approval gate — the description explains the governance impact and this PR is
      for **Human Founder** review
- [ ] New agent/skill/tool/workflow/policy is referenced by something and validated
- [ ] Decisions are recorded with rationale (research/ or an ADR)

## Human Founder approval

- [ ] Not required (non-critical change)
- [ ] Required — this PR must not be merged without explicit Human Founder approval
