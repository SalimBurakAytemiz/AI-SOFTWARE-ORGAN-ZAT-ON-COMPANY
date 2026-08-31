# promptfoo/promptfoo — Evaluation

- **Repository:** promptfoo/promptfoo
- **Source:** https://github.com/promptfoo/promptfoo
- **Purpose:** Developer-first tool for **evaluating and red-teaming** LLM apps:
  declarative test cases with assertions, side-by-side model/prompt comparison, CI
  integration, and an adversarial security scanner (jailbreaks, prompt injection,
  PII leakage, etc.).
- **Architecture:** Node CLI + local web viewer. YAML config: prompts × providers ×
  test cases; assertion types (exact, regex, JSON schema, model-graded, latency,
  cost, custom JS/Python); `promptfoo redteam` generates attack suites mapped to
  OWASP LLM Top 10 / frameworks.
- **Development activity / maintenance health:** Very active; company-backed; frequent
  releases.
- **License:** MIT (core). Enterprise tier for teams/cloud.
- **Security considerations:** Red-team mode generates adversarial inputs — run
  against your own systems only. Local-first; no code leaves unless you configure a
  remote provider.
- **Dependencies:** Node; provider access (via LiteLLM or direct).
- **Complexity:** Low.
- **Cost implications:** Free; eval runs cost model tokens (budget them).
- **Self-hosting:** Fully local; optional shareable results.
- **Vendor lock-in:** None.
- **Agent model:** N/A — an eval/test harness that can target agents and prompts.
- **Human-in-the-loop capability:** Review UI; model-graded + human-graded assertions.
- **Permissions model:** N/A.
- **Workflow capability:** CI gate; assertion pass/fail thresholds.
- **Checkpoint / resume:** Cached eval results.
- **Testing approach:** This is the "unit tests for prompts/agents" layer we lack.
- **Observability:** Per-case pass/fail, latency, cost, diff view.
- **Usefulness to our company:** High. It is the enforcement tool for a
  prompt/agent-quality gate and for the security team's LLM-specific red-teaming.
- **Overlap with our own design:** Complements — our Python tests validate config;
  promptfoo validates *model behavior*.
- **Maintenance burden if adopted:** Low.

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** ADOPT (agent/prompt evaluation gate + LLM red-team suite,
  owned by the Model Operations Engineer and the Application Security Engineer)
- **Rationale:** MIT, local-first, CI-friendly, and it closes two real gaps:
  regression testing of agent prompts and OWASP-LLM adversarial testing. Cheap to
  adopt.
- **What we take:** promptfoo as the eval harness for every non-trivial agent prompt
  before it ships; `promptfoo redteam` in the `SECURITY` gate for any feature that
  exposes an LLM to untrusted input; cost/latency assertions tie into cost policy.
- **What we deliberately do not take (now):** Enterprise cloud; treating eval scores
  as a substitute for human review on RISK 4–5 work.
- **Data checked:** Prior knowledge; general web awareness Aug 2026.
