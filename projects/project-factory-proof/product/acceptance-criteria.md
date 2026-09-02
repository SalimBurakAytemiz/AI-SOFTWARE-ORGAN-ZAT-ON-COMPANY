---
generated_by: project-factory@0.1
project: project-factory-proof
title: "Project Factory Proof - Acceptance Criteria"
lifecycle_state: SPEC_READY
note: >
  Deterministic scaffold generated from project.yml. Runtime V1.1 agents
  refine this during an authorised build. Not the final specification.
---
# Project Factory Proof - Acceptance Criteria

### AC-001 - A simple API service with a GET /health endpoint

- **Given** Project Factory Proof is running
- **When** a end users exercises "A simple API service with a GET /health endpoint"
- **Then** the system responds correctly and an automated test proves it
- **And** no unrelated behaviour changes and no secret is exposed

## Global acceptance gates (inherited from Runtime V1.1)
- The full automated test suite passes (real exit code, not a claim)
- An independent reviewer (never the implementer) approves the change
- The deterministic security checks pass (no secret, no new risky dependency)
- The run STOPS at HUMAN_APPROVAL_REQUIRED before any production step
