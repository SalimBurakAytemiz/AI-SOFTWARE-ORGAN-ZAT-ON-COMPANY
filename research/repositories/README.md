# Repository Research Index

Each file in this directory evaluates one third-party project against the standard in
`../../docs/repository-research.md` (see also the build spec, section 3). Two
independent decisions are recorded per project:

- **knowledge_adoption** — do we learn from it? `ADOPT | PARTIAL | REJECT`
- **runtime_decision** — do we install/depend on it (now or as a committed plan)?
  `ADOPT | OPTIONAL | DEFER | REJECT`

Learning from a project never implies installing it. We do **not** copy third-party
source into this repository and we do **not** fork unless forced.

## Summary table

| Project | Category | knowledge_adoption | runtime_decision | One-line reason |
|---|---|---|---|---|
| FoundationAgents/MetaGPT | method | ADOPT | REJECT | Great role/SOP lessons; no governance, too opinionated to run |
| bmad-code-org/BMAD-METHOD | method | ADOPT | REJECT | Closest prior art ("org as files"); we extend it with enforcement |
| github/spec-kit | method | ADOPT | OPTIONAL | Clean spec→plan→tasks front end; usable, not mandatory |
| obra/superpowers | method | ADOPT | PARTIAL | Skill-as-file pattern; reproduce natively, plugin optional |
| garrytan/gstack | method | PARTIAL | DEFER | Stack starter; belongs to future Product Architecture |
| langchain-ai/langgraph | agent-framework | ADOPT | ADOPT | Durable state + human-in-the-loop interrupts = approval primitive |
| mastra-ai/mastra | agent-framework | ADOPT | OPTIONAL | Best TS option; deterministic workflows + suspend/resume + evals |
| agno-agi/agno | agent-framework | ADOPT | OPTIONAL | Declarative agent-as-unit; runtime candidate, HITL less proven |
| microsoft/agent-framework | agent-framework | PARTIAL | DEFER | Solid, but value concentrates on Azure/Foundry |
| crewAIInc/crewAI | agent-framework | PARTIAL | OPTIONAL | Fast prototyping; too loose for governed production core |
| All-Hands-AI/OpenHands | agent-harness | ADOPT | OPTIONAL/DEFER | Reference execution runtime: sandbox + event stream + tests-as-feedback |
| SWE-agent/SWE-agent | agent-harness | ADOPT | DEFER | ACI thesis: constrained, logged tool interfaces beat raw shell |
| anomalyco/opencode | agent-harness | ADOPT | OPTIONAL | Model-agnostic, client/server, per-action approval; avoid monoculture |
| aider-ai/aider | agent-harness | ADOPT | REJECT | Repo-map context + commit discipline; not a company harness |
| block/goose | agent-harness | PARTIAL | OPTIONAL | MCP-first, clean permission modes; not a differentiator |
| yamadashy/repomix | code-context | ADOPT | ADOPT | Cheap repo packing + secret pre-flight; ideal external dep |
| qodo-ai/pr-agent | code-review | ADOPT | OPTIONAL | First-pass PR review feeding the independent reviewer; never merges |
| continuedev/continue | code-context | PARTIAL | REJECT | IDE tool for humans; orthogonal to an agent-run company |
| microsoft/playwright | qa | ADOPT | ADOPT | E2E of record; MCP mode for agent UI checks (domain allowlist) |
| aquasecurity/trivy | security | ADOPT | ADOPT | One binary: SCA + IaC + secrets + SBOM; SECURITY gate |
| semgrep/semgrep | security | ADOPT | ADOPT | OSS SAST; custom rules encode our invariants (Pro deferred) |
| zaproxy/zaproxy | security | ADOPT | OPTIONAL→ADOPT | DAST once there is a staging app; staging-only, scoped |
| Infisical/agent-vault | secrets | ADOPT | DEFER | Credential-proxy pattern is mandatory design; tool is preview |
| gitleaks/gitleaks | security | ADOPT | ADOPT | Cheap pre-commit + CI secret gate; defense in depth |
| google/osv-scanner | security | ADOPT | OPTIONAL | Precise SCA + guided remediation; overlaps Trivy SCA |
| BerriAI/litellm | model-ops | ADOPT | ADOPT | Model gateway: provider abstraction + per-agent budgets + spend logs |
| langfuse/langfuse | observability | ADOPT | OPTIONAL/DEFER | Adopt when there is agent traffic; contract stays OTel-native |
| promptfoo/promptfoo | model-ops | ADOPT | ADOPT | Prompt/agent eval gate + OWASP-LLM red teaming |
| Docker / OCI | infrastructure | ADOPT | ADOPT | Mandatory isolation substrate; Engine/Compose, not Desktop |
| GitHub + Actions | ci-cd | ADOPT | ADOPT | Branch protection + required checks + environment approvals |
| OpenTelemetry | observability | ADOPT | ADOPT | Vendor-neutral observability contract wire format |
| renovatebot/renovate | ci-cd | ADOPT | ADOPT | Dependency-update engine; conservative auto-merge only |
| opentofu/opentofu | infrastructure | ADOPT | DEFER | Open IaC; plan=proposal, apply=RISK 5; no infra yet |
| open-policy-agent/opa | policy | ADOPT | OPTIONAL→ADOPT | Default-deny decision engine for policies/ in the runtime |
| n8n-io/n8n | automation | PARTIAL | DEFER | Wrong layer + fair-code license; maybe business-ops glue later |
| triggerdotdev/trigger.dev | infrastructure | ADOPT | DEFER | Durable execution + approval waits; evaluate with TS runtime |
| daytonaio/daytona | sandbox | PARTIAL | DEFER | Agent sandbox option; compare in runtime phase |
| e2b-dev/E2B | sandbox | ADOPT | DEFER | Firecracker microVM isolation for hostile generated code |

See `../runtime-comparison.md`, `../security-comparison.md`, `../adopted-practices.md`,
`../rejected-practices.md`, `../architecture-decisions.md` and
`../final-recommendations.md` for the synthesis.
