# Beginner's Guide to the Agent Runtime

New here? Read [`../beginner-guide.md`](../beginner-guide.md) first — it explains the
company. This guide is about the **runtime**: the program that makes the company
actually do work.

## The one-sentence version

You type a task; the runtime picks the right process, walks it through the right AI
specialists one at a time, checks every permission, writes down everything it does,
and then **stops and waits for you** before anything risky happens.

## Try it

```
cd runtime
npm install
node bin/ai-company.js doctor        # should say "healthy"
node bin/ai-company.js proof         # runs a safe demo task end to end
```

The `proof` output shows a chain like:

```
idea            product-manager
architecture    solution-architect
implementation  backend-engineer
code_review     senior-code-reviewer      <- a different agent than the implementer
qa              qa-lead
security        application-security-engineer
release_review  release-manager
```

…and then it **stops** at `HUMAN_APPROVAL_REQUIRED`. That stop is the whole point.

## Give it your own task

```
node bin/ai-company.js task run "Add a GET /health endpoint to the demo service"
```

It prints an approval id and stops. To see what it wants you to approve:

```
node bin/ai-company.js approvals show <that-id>
```

You will see the impact, the test summary, the security summary, the rollback plan,
and the estimated cost — in plain language. Then:

```
node bin/ai-company.js approvals approve <that-id> --note "looks good"
#   or
node bin/ai-company.js approvals reject  <that-id> --note "not yet"
```

## The emergency brake

```
node bin/ai-company.js pause "something looks wrong"
node bin/ai-company.js resume
```

While paused, nothing can be written or changed. No AI agent can un-pause it — only
you.

## What it will never do without you

Deploy to production, merge to the main branch, run a production database migration,
touch secrets, move money, message customers in bulk, export customer data, or change
who is allowed to do what. For all of those it prepares the work and then asks.

## Where to go next

- [`../agent-runtime.md`](../agent-runtime.md) — the full overview
- [`../runtime-operations.md`](../runtime-operations.md) — everyday commands
- [`../runtime-troubleshooting.md`](../runtime-troubleshooting.md) — when something looks off
