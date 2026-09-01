# Runtime Security

Companion to [`security.md`](security.md) and the security review section of
[`../architecture/adr-agent-runtime.md`](../architecture/adr-agent-runtime.md).

## Threat model (V1)

The runtime adds **no** production trust boundary, **no** production credential path,
and **no** external write capability. It runs locally / in Codespaces, offline, with
no API keys. The assets it protects are: the integrity of the Human Founder approval
gate, the permission model, and the audit trail.

| Threat | Mitigation |
|---|---|
| An agent bypasses Human Founder approval | Layered: `PolicyEngine` → `APPROVAL_REQUIRED` for every critical action / RISK 5 step; `WorkflowEngine` refuses a RISK 5 / PRODUCTION / Human-Founder-owned step without an `APPROVED` record; `ApprovalEngine` allows only `human-founder` to decide and forbids self-approval; `CapabilityGateway` denies non-grantable capabilities. Each layer independently tested. |
| An agent impersonates the Human Founder | `approve()` / `reject()` compare the approver to the literal `"human-founder"`; every other value (all agent ids included) throws and is audited. |
| An agent escalates its own permissions | No runtime API mutates a loaded agent's permissions. `access_control_escalation` is a critical action ⇒ `APPROVAL_REQUIRED`. |
| Malicious / malformed configuration | Every definition is schema-validated on load; the registry loader fails closed (startup aborts) on any invalid or unresolved reference, any non-grantable grant, any risk-ceiling breach, any dangling workflow transition, any production workflow without an approval barrier. |
| Secret leakage into logs | `redactSecrets` is applied to every audit record and every span attribute. No provider keys are read in V1. |
| Generated code escaping the workspace | `LocalSandbox` confines file operations to a per-run temp directory and hard-blocks destructive / production / network-egress commands. MicroVM isolation (E2B) is the production answer and plugs in behind the `Sandbox` interface. |
| Runaway autonomous activity | Global pause (`ai-company pause`) blocks all writes; per-run transition cap; the orchestrator refuses to run while paused. |

## Secrets

`policies/secrets.yml` is satisfied by design: no production secret reaches any agent.
The `LiteLlmProvider` reads its base URL / key from the environment only, is inert
unless both are set, and is the single legitimate path to real model credentials
(via a gateway with per-agent virtual keys). Claude Code / subscription credentials
are never used as an automated backend.

## Mandatory pre-production decisions (recorded here)

Before **any** project (starting with Cleaning Commerce) handles real customer PII or
touches real production:

1. **Compliance / privacy ownership.** V1 implements compliance/privacy as a future
   policy + skill extension, not a dedicated role (build spec section 37). KVKK /
   GDPR / privacy responsibility must be assigned — a dedicated agent or an explicit
   mandate to the Application Security Engineer — and reviewed by the Human Founder.
2. **Secrets architecture.** Choose and stand up the credential proxy (Agent Vault /
   LiteLLM virtual keys / equivalent). No agent gets a long-lived production secret.
3. **Sandbox isolation.** Replace `LocalSandbox` with microVM isolation for any
   network-connected execution of generated code.
4. **Cloud + database.** Pick the production cloud and move `StateStore` to
   PostgreSQL. Neither is committed in V1 (ADR-014).
5. **Observability backend.** Stand up an OTLP collector with secret/PII redaction
   before export.

## Security tests

`runtime/test/security-policy.test.ts` and `critical-approval.test.ts` cover build
spec sections 34–35: self-approval blocked, permission escalation blocked, developer
cannot merge main, developer cannot read production secrets, release manager cannot
deploy, security agent cannot override a rejection, global pause blocks writes,
unknown capability/tool denied, malformed agent rejected, invalid workflow transition
rejected, missing approval blocks a critical step, secrets redacted from logs.
