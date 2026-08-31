# `architecture/`

Home for **Architecture Decision Records (ADRs)** produced by the Solution Architect
and the `architecture-review` skill, and for system architecture specifications for
the company's products.

## Current contents

- `adr-template.md` — the template every ADR follows.
- The **organization-level ADR log** for this repository lives in
  [`../research/architecture-decisions.md`](../research/architecture-decisions.md)
  (ADR-001 … ADR-013). Product ADRs will be filed here as `adr-NNNN-<slug>.md` once
  product work begins.

## Why ADRs

Decisions record their rationale, alternatives, and consequences so a future session
understands not just *what* was chosen but *why* (Constitution Article 12). An ADR is
immutable once accepted; a superseding ADR references the one it replaces.

## Lifecycle

`PROPOSED` → `ACCEPTED` (Human Founder for RISK 4–5) → `SUPERSEDED` / `DEPRECATED`.
ADRs are created via `workflows/architecture-change.yml`.
