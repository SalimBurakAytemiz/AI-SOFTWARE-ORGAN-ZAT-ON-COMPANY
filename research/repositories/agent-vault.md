# Infisical/agent-vault — Evaluation

- **Repository:** Infisical/agent-vault
- **Source:** https://github.com/Infisical/agent-vault
- **Purpose:** An HTTP credential proxy and vault for AI agents: the agent uses
  credentials **without ever holding them**. The proxy matches the outbound
  destination and injects the right secret at the network layer.
- **Architecture:** A local forward proxy (typically via `HTTPS_PROXY`). The agent
  keeps using normal APIs/CLIs/SDKs/MCP; Agent Vault injects credentials for matching
  hosts and forwards upstream. AES-256-GCM at rest, scoped sessions, request logging,
  sandboxed-container support; can be backed by an external store (Infisical) for
  dynamic secrets.
- **Development activity / maintenance health:** New; **research preview**, active.
  Infisical also ships a GA "Agent Proxy" in its platform.
- **License:** Open source (verify exact license at integration — Infisical core is
  MIT-style with some enterprise components).
- **Security considerations:** This *is* a security control. Caveats: it is
  explicitly **not production-ready** yet; the proxy becomes a high-value target and
  a single point of trust; TLS interception for injection needs careful CA handling.
- **Dependencies:** The proxy process; optional Infisical backend.
- **Complexity:** Medium (proxy + cert + host-matching config).
- **Cost implications:** OSS free; Infisical Cloud tiers optional.
- **Self-hosting:** Yes.
- **Vendor lock-in:** Low (OSS); higher if backed by Infisical Cloud.
- **Agent model:** Agent-agnostic (Claude Code, Cursor, Codex, custom harnesses).
- **Human-in-the-loop capability:** Session scoping + request logs give humans an
  audit and revocation point.
- **Permissions model:** Per-session, per-destination credential scoping — exactly the
  "no production secret by default" primitive we need.
- **Workflow capability:** N/A (infrastructure).
- **Checkpoint / resume:** N/A.
- **Observability:** Request logging is built in — feeds our audit trail.
- **Usefulness to our company:** High conceptually. It is the reference
  implementation of Constitution Article 8 ("credentials injected at the boundary,
  never handed to agents").
- **Overlap with our own design:** None — it is the enforcement mechanism for our
  secrets policy.
- **Maintenance burden if adopted:** Medium, and elevated while it is a research
  preview.

### Decisions

- **knowledge_adoption:** ADOPT
- **runtime_decision:** DEFER (design the secrets architecture around the
  credential-proxy pattern now; adopt Agent Vault or an equivalent — possibly
  Infisical's GA Agent Proxy — when the runtime exists and the tool is production-ready)
- **Rationale:** The pattern is exactly right and we commit to it in policy. The
  specific tool is a research preview, so we do not take a runtime dependency yet;
  `policies/secrets.yml` is written to be satisfiable by Agent Vault, Infisical Agent
  Proxy, or a comparable proxy.
- **What we take:** Credential-proxy pattern as mandatory design; per-session
  per-destination scoping; boundary injection; proxy request logs as audit input.
- **What we deliberately do not take (yet):** A hard runtime dependency on a
  research-preview component.
- **Data checked:** Web search Aug 2026 (Infisical blog, docs.agent-vault.dev, PRWeb
  announcements); prior knowledge.
