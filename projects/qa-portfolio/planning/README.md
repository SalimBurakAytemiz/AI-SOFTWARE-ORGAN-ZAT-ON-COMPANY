---
project: qa-portfolio
title: "QA Engineer Portfolio Platform — Pre-Development Planning Package"
lifecycle_state: PLAN_READY
status: PLANNING_COMPLETE_AWAITING_BUILD_AUTHORIZATION
generated_by: planning-team (human + Claude Code), not the deterministic Project Factory scaffold
---

# Pre-Development Planning Package

This directory is the **mandatory pre-development planning package** for the
QA Engineer Portfolio Platform. It is the output of the Planning Gate: the
complete specification was analysed and turned into an architecture, a data
model, a route map, wireframes, a design system, a backlog, a sprint plan, a
dependency map, a security plan, a test strategy, a risk register and a content
intake checklist — *before* production implementation begins.

It supplements (does not replace) the deterministic Project Factory scaffold in
`../product/`, `../plans/` and `../artifacts/runtime-handoff.json`.

## Governance position (read first)

- This package is **planning only**. No application code is written here, and
  none may be written yet.
- Per `CLAUDE.md` §13, building any project's actual application code is
  prohibited in this phase.
- Per Project Factory (`docs/project-factory.md`), entering BUILD requires
  `ai-company project authorize-build qa-portfolio` by the **Human Founder**
  (RISK 5, audited). The project is currently `READY_FOR_BUILD` with
  `build_authorization.granted = false`.
- The master spec's "IMPORTANT EXECUTION RULE" (continue to implementation after
  planning) is acknowledged, but it **cannot override** the repository
  constitution. The conflict and its resolution are recorded in
  [`12-risks-open-questions.md`](12-risks-open-questions.md) (OQ-000) and in
  `../decisions/decision-log.md`. Resolution: complete planning, then **stop** at
  the Human Founder build-authorization gate.

## Contents

| # | Document | Covers |
|---|---|---|
| 01 | [System Architecture](01-system-architecture.md) | Components, boundaries, data & control flow, caching, deployment, env |
| 02 | [Database Schema & ER Diagram](02-database-schema.md) | Tables, keys, relationships, translation / publication / RLS strategy |
| 03 | [Page & Route Map](03-page-route-map.md) | Public, admin and auth routes with data source, auth, SEO status |
| 04 | [Public Website Wireframes](04-public-wireframes.md) | Low-fi IA/UX wireframes for the key public pages |
| 05 | [Admin Panel Wireframes](05-admin-wireframes.md) | Low-fi wireframes for the CMS, incl. the project editor & workflow |
| 06 | [Design System Proposal](06-design-system.md) | Typography, colour, spacing, components, motion, QA visual language |
| 07 | [Epic / Story / Task Breakdown](07-epics-stories-tasks.md) | 20 epics → stories → tasks with complexity and acceptance criteria |
| 08 | [Sprint / Development Phase Plan](08-sprint-plan.md) | Sprint 0–8 roadmap driven by technical dependencies |
| 09 | [Dependency Analysis](09-dependency-analysis.md) | Critical-path dependency graph |
| 10 | [Security Plan](10-security-plan.md) | Auth, authz, RLS, uploads, sanitisation, forms, rate limiting, XSS/injection |
| 11 | [Test Strategy](11-test-strategy.md) | Test types, environments, critical business-flow tests |
| 12 | [Risks & Open Questions](12-risks-open-questions.md) | Risk register + open questions + spec contradictions |
| 13 | [Content Intake Checklist](13-content-intake-checklist.md) | Every piece of real professional content the Founder must supply |
| 14 | [Planning Review](14-planning-review.md) | Review from 10 senior perspectives |

## How to read this with the rest of the workspace

```
projects/qa-portfolio/
  project.yml                     canonical definition (type web_app, risk 3, security elevated)
  product/                        deterministic Project Factory scaffold (brief, requirements, ...)
  plans/build-plan.md             deterministic milestone list
  planning/                       <-- THIS PACKAGE (the real pre-dev planning)
  decisions/decision-log.md       ADR-style decisions incl. the planning-gate conflict
  artifacts/runtime-handoff.json  immutable Runtime handoff (checksum-verified, build NOT authorized)
```

## Placeholders and missing content

This portfolio belongs to a real person. Their CV, project list, skills,
certifications and metrics have **not** been supplied. Per the Human Founder's
instruction, planning proceeded with **clearly marked placeholders**
(`[PLACEHOLDER: …]`) and **no invented professional information**.
[`13-content-intake-checklist.md`](13-content-intake-checklist.md) is the
single structured form to fill that gap.

## Estimation model (used throughout 07 and 08)

Complexity is a **T-shirt size of uncertainty × surface area × integration
count**, not a time promise:

| Size | Meaning | Rough guide (one engineer, familiar with the stack) |
|---|---|---|
| **S** | Well understood, one file/area, no new integration | ≤ half a day |
| **M** | Understood, a few files, at most one integration touchpoint | half to 1.5 days |
| **L** | Some unknowns, spans layers (UI + API + DB + RLS) | 2–4 days |
| **XL** | Multiple unknowns or cross-cutting; **must be split** before it enters a sprint | — |

No calendar dates or total durations are given: team size, availability and the
Founder's content-entry pace are unknown (see RISK-013).
