# Tool System

Two layers:

1. **`tools/registry.yml`** — every external tool the company uses or has evaluated,
   with full metadata and a research-decided status.
2. **`tools/capabilities.yml`** — each tool decomposed into named, risk-rated
   **capabilities**. Agents are granted capabilities, never whole tools.

Both validate in CI (`tests/test_tools.py`).

## Tool status

| Status | Meaning |
|---|---|
| `ADOPTED` | In use now, or committed for the next phase with no open questions |
| `OPTIONAL` | Approved where a team/agent chooses it; not mandatory |
| `DEFERRED` | Will adopt later; the design already accounts for it |
| `REJECTED` | Evaluated, not adopted, reason recorded |
| `RESEARCH` | Still under evaluation |

Status comes from research (`research/repositories/`), **not** from a tool being
named in the build prompt. Current picture:

- **ADOPTED:** Git, GitHub + Actions, Claude Code, Repomix, LiteLLM, promptfoo,
  OpenTelemetry (as contract), Semgrep (OSS), Trivy, gitleaks, Playwright, Renovate,
  Docker/OCI, PostgreSQL, working-tree filesystem.
- **OPTIONAL:** spec-kit, opencode, superpowers plugin, pr-agent, osv-scanner,
  Playwright MCP, OPA.
- **DEFERRED:** Langfuse, credential proxy (Infisical Agent Vault / Agent Proxy),
  OpenTofu, Trigger.dev, OWASP ZAP (until a staging app exists), execution sandbox
  (E2B / Daytona / OpenHands runtime), deployment target, payment provider, n8n.
- **REJECTED:** MetaGPT & BMAD as runtimes, aider as a company harness, Continue.
- **RESEARCH:** LangGraph, Mastra, OpenHands (runtime-phase decisions).

## Capability model

Format: `<tool>.<capability>` (e.g. `github.create_pr`, `db.migrate_staging`). Each
capability has:

- `tool` — must resolve in `registry.yml`
- `risk_level` — 0–5
- `grantable` — if `false`, **no agent may ever list it in `allowed_tools`**; it
  exists so the system can name and forbid it explicitly (default deny)

### Non-grantable capabilities (critical actions)

`github.merge`, `deploy.production`, `db.migrate_production`,
`infra.production_apply`, `secrets.production`, `secrets.rotate`,
`payments.configure`, `finance.execute`, `ci.configure_production`. All are
`risk_level: 5` and map to Human-Founder-only actions.

### Example: capability scoping in action

The Frontend Engineer holds `git.branch`, `git.commit`, `github.create_branch`,
`github.create_pr` — but not `github.review` or `github.merge`. The Senior Code
Reviewer holds `github.review` — but not `fs.write` or `github.create_pr`, so it
cannot implement the change it reviews.

## Rules

- A capability's `risk_level` must be ≤ the granting agent's `risk_level` ceiling
  (`tests/test_permissions.py`).
- `forbidden_tools` beats `allowed_tools`.
- Changes to `capabilities.yml` are governance changes → Human Founder review.
- Prefer external dependencies and adapters over forking. Do not copy third-party
  source into this repository.
