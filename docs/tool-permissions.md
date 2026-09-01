# Tool Permissions (runtime)

Implements [`../policies/agent-permissions.yml`](../policies/agent-permissions.yml)
and [`../tools/capabilities.yml`](../tools/capabilities.yml). See ADR-002.

## A tool is not a permission

GitHub is a tool. `github.read`, `github.create_pr`, `github.review`, `github.merge`
are capabilities. An agent granted `github.read` does not get `github.merge`.
`tools/capabilities.yml` decomposes every tool into named, risk-rated capabilities.

## Grantable vs reserved

Capabilities with `grantable: false` may **never** appear in any agent's
`allowed_tools`. They exist so the system can name and forbid them:

```
github.merge          deploy.production      db.migrate_production
infra.production_apply secrets.production    secrets.rotate
payments.configure    finance.execute        ci.configure_production
```

The registry loader rejects startup if any agent is granted one of these; the
`PolicyEngine` denies them unconditionally at call time.

## The Capability Gateway

Every consequential tool call passes through `CapabilityGateway.authorize`, which:

1. resolves the calling agent (or `null` for a system caller),
2. reads the global pause flag,
3. calls `PolicyEngine.evaluate`,
4. writes an audit event `tool_request:<action>` with the decision, then
5. returns `{ allowed, approvalRequired, decision, commandClass }`.

### PolicyEngine decision order

1. A **critical action** (the 15 in `human-approval.yml`) ⇒ `APPROVAL_REQUIRED`,
   approver `human-founder`.
2. Pure preparation (`analyze`, `plan`, `propose`, `prepare`, `draft`,
   `request_approval`) ⇒ `ALLOW`.
3. Capability checks (all default-deny):
   - unknown capability ⇒ `DENY`
   - `grantable: false` ⇒ `DENY`
   - non-agent caller ⇒ `DENY`
   - in the agent's `forbidden_tools` ⇒ `DENY` (forbidden beats allowed)
   - not in the agent's `allowed_tools` ⇒ `DENY`
   - capability risk > agent risk ceiling ⇒ `DENY`
   - global pause engaged and the capability writes ⇒ `DENY`
   - `PRODUCTION_WRITE` or `FINANCIAL` command class ⇒ `APPROVAL_REQUIRED`
   - write to `production` environment ⇒ `APPROVAL_REQUIRED`
4. RISK 5 work ⇒ `APPROVAL_REQUIRED`.
5. Otherwise ⇒ `ALLOW`.

## Command safety classes

Each capability also carries a coarse class used by the sandbox and the gateway:
`READ_ONLY`, `DEVELOPMENT_WRITE`, `DESTRUCTIVE`, `EXTERNAL_WRITE`, `PRODUCTION_WRITE`,
`FINANCIAL`. The `LocalSandbox` permits only `READ_ONLY` and (with explicit grant)
`DEVELOPMENT_WRITE`; it hard-blocks destructive, production and network-egress
commands (`rm -rf /`, `git push`, `curl | sh`, `terraform apply`, …).

## Reviewer independence

`senior-code-reviewer` is denied `fs.write` and `github.create_pr` in
`agent-permissions.yml`; the registry loader and `test/security-policy.test.ts`
assert it. The `WorkflowEngine` additionally refuses a `code_review` / `review` step
outcome from any agent that appears as an implementer in the run history.
