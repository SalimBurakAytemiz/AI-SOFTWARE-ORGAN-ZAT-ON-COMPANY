# microsoft/playwright — Evaluation

- **Repository:** microsoft/playwright (+ Playwright Test, + MCP server)
- **Source:** https://github.com/microsoft/playwright
- **Purpose:** Cross-browser (Chromium, Firefox, WebKit) end-to-end browser automation
  and testing, with auto-waiting, tracing, parallelism, fixtures, and a first-class
  test runner. A **Playwright MCP** server exposes structured browser control to
  agents via the accessibility tree.
- **Architecture:** Node core (bindings for Python/.NET/Java); browser drivers;
  `@playwright/test` runner; `trace.zip` viewer; `playwright/mcp` for agent-driven
  navigation without pixel-based hacks.
- **Development activity / maintenance health:** Extremely active, Microsoft-backed,
  the de-facto modern E2E standard.
- **License:** Apache-2.0.
- **Security considerations:** Drives real browsers — run in CI/sandbox; MCP mode can
  reach arbitrary sites (SSRF/prompt-injection surface) so scope target domains.
- **Dependencies:** Node; downloaded browser binaries.
- **Complexity:** Low–medium.
- **Cost implications:** Free; CI compute for browser runs.
- **Self-hosting:** Runs anywhere; optional hosted grids not required.
- **Vendor lock-in:** None.
- **Agent model:** N/A (test tool); MCP makes it agent-consumable.
- **Human-in-the-loop capability:** N/A; codegen + trace viewer aid humans.
- **Permissions model:** N/A; restrict via network policy and allowed domains.
- **Workflow capability:** Test projects, sharding, retries, fixtures.
- **Checkpoint / resume:** Trace + video + screenshots per test; retry-with-trace.
- **Testing approach:** This is the QA backbone — E2E, component, API request testing,
  visual comparisons.
- **Debugging approach:** Trace viewer (time-travel, DOM snapshots, network) — best in
  class.
- **Review approach:** N/A.
- **Context management:** Accessibility-tree snapshots for agents (structured, cheap).
- **Observability:** Rich per-test artifacts; JUnit/JSON/HTML reporters.
- **Usefulness to our company:** Very high. The default E2E and browser-automation
  tool for the Test Automation Engineer and QA Lead; MCP mode gives agents a safe,
  structured way to verify UI.
- **Overlap with our own design:** None — fills the E2E gap.
- **Maintenance burden if adopted:** Low.

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** ADOPT (E2E test tool of record; Playwright MCP OPTIONAL for
  agent-driven UI verification with a domain allowlist)
- **Rationale:** Best-in-class, Apache-2.0, self-hostable, agent-consumable via MCP,
  with the strongest debugging story (trace viewer) of any E2E tool.
- **What we take:** `@playwright/test` as the E2E/component/API-request runner;
  trace-on-retry as the standard failure-evidence artifact; accessibility-tree
  snapshots as cheap structured UI context for agents.
- **What we deliberately do not take:** Unrestricted MCP browsing — target domains
  must be allowlisted.
- **Data checked:** Prior knowledge; general web awareness Aug 2026.
