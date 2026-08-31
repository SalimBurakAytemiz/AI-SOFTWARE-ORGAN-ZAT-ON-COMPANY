# Rejected / Deferred Practices

Techniques and patterns we deliberately did **not** adopt, with the reason. Recorded
so a future session does not re-introduce them by accident.

| Practice / pattern | Source | Decision | Reason |
|---|---|---|---|
| Autonomy-first agent loops that take actions without gates | MetaGPT, CrewAI autonomous crews | **REJECT** | Violates constitution Art. 3, 5.3, 14. Every autonomous run must be workflow-bounded, risk-scoped, budgeted and audited. |
| Hierarchical auto-delegation where an agent spawns sub-agents freely | CrewAI hierarchical process | **REJECT** | Unbounded sub-agent spawning is forbidden (Art. 14). Delegation is explicit in workflow definitions. |
| A single "universal" senior agent that does PM + arch + code + review | tempting simplification | **REJECT** | Art. 5.1–5.2. Destroys reviewer independence and responsibility boundaries. |
| Same agent implements and reviews a change | common in simple setups | **REJECT** | Art. 5.2 — reviewer independence is structural. |
| Persona prompts as a substitute for full agent definitions | BMAD persona style | **REJECT (as substitute)** | Adopted the *file* idea; an agent is ROLE+SKILLS+MODEL+TOOLS+PERMISSIONS+POLICIES+CONTEXT+MEMORY+GATES+METRICS, never just a prompt. |
| Copying third-party source into the repo / forking to customize | general temptation | **REJECT** | Build spec §3. Prefer external deps + adapters; forks are maintenance debt. |
| Adopting every tool named in the build prompt | build prompt itself says not to | **REJECT** | §9 — research determines status. Many are OPTIONAL/DEFERRED/REJECTED. |
| Hard-wiring the company to one AI provider | convenience | **REJECT** | Art. 13. Model access is abstracted; tiers are conceptual. |
| Expensive models for deterministic tasks | convenience | **REJECT** | Art. 11. RISK 0 work is done by ordinary software (`NO_AI` tier). |
| Committing to an orchestration framework now | eagerness | **DEFER** | No runtime is built this phase (§0, §33). `runtime-comparison.md` narrows it; the choice is a runtime-phase decision. |
| Building the multi-agent runtime, Control Tower, CRM, ERP, marketing agents | scope creep | **DEFER** | Explicitly out of scope (§33). This phase is governance foundation only. |
| Selecting a commerce platform (Vendure / Medusa / Saleor) or a stack (gstack) | build prompt | **DEFER** | §32 — separate Product Architecture decision. |
| n8n as the engineering workflow engine | it has workflows | **DEFER / REJECT for engineering** | Wrong layer (glue automation), lacks risk/approval/audit semantics, non-OSI fair-code license. |
| Standing up Langfuse / OTel Collector / LiteLLM proxy now | "observability is good" | **DEFER** | No agent traffic exists to observe. Define the OTel contract now; run the stack when the runtime does. |
| Semgrep Pro / AppSec Platform, Snyk, commercial security SaaS | richer features | **DEFER** | OSS engines cover the current need; revisit on concrete gaps, mindful of code-egress and lock-in. |
| Auto-merging major dependency bumps or security-sensitive packages | speed | **REJECT** | Renovate auto-merge is limited to lockfile-only patch/minor of non-sensitive deps that pass all gates. |
| Unrestricted agent web browsing / Playwright MCP against any domain | capability | **REJECT** | SSRF + prompt-injection surface. Target domains must be allowlisted. |
| Giving CI tokens broad default permissions | GitHub default | **REJECT** | Least-privilege `permissions:` per job; `GITHUB_TOKEN` scoped down. |
| Storing long-lived cloud keys as CI secrets | common | **REJECT** | OIDC short-lived credentials only. |
| Treating "files were created" as task completion | LLM failure mode | **REJECT** | Art. 5.4 — working, tested, verified output with evidence is required. |
| IDE-centric assistant tooling (Continue) as company infrastructure | it is popular | **REJECT** | The workforce is agents in a governed pipeline, not humans in an editor. |
| A dedicated documentation-writer agent, data-analytics agent, compliance agent (now) | role inflation | **DEFER** | No current responsibility gap that an existing role cannot hold; revisit for the Cleaning Commerce phase. |
