# Human Approval

The Human Founder is the supreme authority. This document explains what needs
approval and how the requirement is enforced in multiple independent layers.

Source of truth: [`../policies/human-approval.yml`](../policies/human-approval.yml)
(enforced) and [`../constitution/AI_SOFTWARE_COMPANY_CONSTITUTION.md`](../constitution/AI_SOFTWARE_COMPANY_CONSTITUTION.md)
Article 3 (authoritative).

## The 15 critical actions

No AI agent may **independently execute** any of these:

1. Production deployment
2. Merge to the protected `main` branch
3. Production database migration
4. Production database destructive operation
5. Production data deletion
6. Production infrastructure modification
7. Secret creation, rotation, or revocation
8. Payment provider configuration modification
9. Real refund or real financial transaction
10. Advertising / marketing budget modification
11. Supplier or vendor payment
12. Bulk customer messaging
13. Customer data export
14. Access-control escalation (granting or widening any permission)
15. Critical security architecture change

This list is a **floor**. It may grow; it may not shrink without a constitutional
amendment by the Human Founder.

## What agents may do instead

Analyze, plan, propose, draft, and **prepare** any of the above — then stop and
request approval, with a clear recommendation and the evidence. The Release Manager
may mark a release `READY_FOR_HUMAN_APPROVAL`; it may not approve it.

## Enforcement layers

| Layer | Mechanism |
|---|---|
| **Agent definitions** | No agent lists a critical action in `allowed_actions`; every agent lists all 15 in `forbidden_actions`. Agents that may *prepare* one list it under `human_approval_required`. |
| **Capabilities** | The capabilities that would perform critical actions (`deploy.production`, `github.merge`, `db.migrate_production`, `secrets.rotate`, `payments.configure`, `finance.execute`, …) are `grantable: false` — impossible to grant. |
| **Workflows** | Every production-reaching workflow has a `human_approval` step (owned by `human-founder`) before any `PRODUCTION` step. Graph reachability proves it cannot be bypassed. |
| **Policy** | `policies/human-approval.yml` records each action with `effect: REQUIRE_APPROVAL` and `approver: human-founder`, plus a `NO_STANDING_DELEGATION` rule. |
| **Forge** | GitHub branch protection on `main`; a GitHub Environment "production" whose required reviewer is the Human Founder pauses the pipeline. |
| **Runtime (future)** | An OPA default-deny decision point in front of every tool call, with decision logs feeding the audit trail. |
| **Tests** | `tests/test_human_authority.py` and `tests/test_org_security.py` fail the build if any layer is weakened. |

## Incident containment exception

During a live incident, the Incident Engineer may take **pre-authorized** containment
actions immediately (`policies/incident.yml` — feature-flag off, scale within a
ceiling, rate-limit, block an abusive IP, read-only mode). Anything beyond that
envelope — especially another critical action — still requires the Human Founder.

## "Absence is not consent"

If the Human Founder is unavailable, critical actions **wait**. There is no timeout
that auto-approves.
