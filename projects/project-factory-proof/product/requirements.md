---
generated_by: project-factory@0.1
project: project-factory-proof
title: "Project Factory Proof - Requirements"
lifecycle_state: DISCOVERY
note: >
  Deterministic scaffold generated from project.yml. Runtime V1.1 agents
  refine this during an authorised build. Not the final specification.
---
# Project Factory Proof - Requirements

## Functional requirements

### FR-001. A simple API service with a GET /health endpoint

- **Priority:** must
- **Rationale:** supports the business goal ("Deliver a working first version of Project Factory Proof for end users.").
- **Verification:** an automated test proves this feature behaves as specified.

## Non-functional requirements

- NFR-001. The system runs on: api.
- NFR-002. Security level is "standard"; no secret is committed or logged.
- NFR-003. All changes go through the feature-development workflow with an independent review and a QA gate.
- NFR-004. No production deployment, migration, or financial action occurs without explicit Human Founder approval.

## Open questions for Discovery
- Confirm the priority order of the core features with the Human Founder
- Confirm the target market and any locale / regulatory constraints
- Identify any third-party integrations the first version needs
