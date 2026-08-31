# Beginner Guide

Plain language. No jargon where it can be avoided.

## What is this?

This repository is the **rulebook and org chart** for an AI-powered software company.
The company does not exist as running software yet. What exists is: a written
constitution, a defined set of AI "employees" (agents), the exact permissions each
one has, the step-by-step processes they must follow, and automated tests that check
none of the rules have holes in them.

A later project will build the *runtime* — the program that actually runs the agents
according to these rules. A project after that will build the first product, a
cleaning-services commerce platform. Neither is built here.

## Why does it exist?

So that when AI agents start doing real engineering work, they do it **safely**:

- The **Human Founder** (you) is always in charge. Agents cannot deploy to
  production, spend money, touch customer data, or change security on their own.
- Every risky action stops and waits for your explicit "yes".
- Everything important is written down and logged, so you can always see what
  happened and why.
- The company stays cheap to run and is not locked into one AI vendor.

## What should the Human Founder check?

1. **The constitution** — `constitution/AI_SOFTWARE_COMPANY_CONSTITUTION.md`. Do you
   agree with the top-level rules? This is the one document you should read fully.
2. **The critical-action list** — `policies/human-approval.yml`. These are the things
   no agent may ever do without you. Is anything missing?
3. **The agent roster** — `agents/software-company/README.md`. 18 roles. Does the
   set make sense? (Reasoning: `research/role-gap-analysis.md`.)
4. **The workflows** — `workflows/`. Especially that every path to production has a
   "Human Founder approval" step. The tests check this, but skim `docs/workflows.md`.
5. **The final report** the build produced (in the chat), and
   `research/final-recommendations.md` — the recommendation for the next phase and
   the four open questions for you.

## What should the Human Founder never need to edit manually?

Almost everything else, day to day:

- Individual agent capability lists (governed by policy + tests)
- Schema files
- Research evaluations (institutional memory; append, don't rewrite)
- Model tier-to-provider mappings (those live in gateway config in a later phase)

You *approve changes* to these via pull requests; you rarely *author* them.

## How do I know it is working?

Run:

```bash
python3 tests/run_all.py
```

All tests pass → the organization is internally consistent and the safety invariants
hold. CI runs the same check on every proposed change.

## How do I know it is broken?

- `python3 tests/run_all.py` fails.
- A pull request changes `constitution/`, `policies/human-approval.yml`,
  `policies/agent-permissions.yml`, `tools/capabilities.yml`, or a workflow's
  approval step **without** being flagged for your review.
- Any file claims an integration "works" that has not been built (should be labeled
  `PLANNED` / `DEFERRED` / etc.).
- An agent definition lists a critical action under `allowed_actions` (the tests
  catch this).

## What requires Human Founder approval?

The 15 critical actions in `policies/human-approval.yml`, summarized: production
deploys, merges to `main`, production database changes, production infrastructure
changes, any secret change, anything touching money (payments, refunds, ad budgets,
supplier payments), bulk customer messaging, customer-data export, permission
changes, and critical security-architecture changes.

Agents can do all the *preparation* for these and then hand you a clear decision.
