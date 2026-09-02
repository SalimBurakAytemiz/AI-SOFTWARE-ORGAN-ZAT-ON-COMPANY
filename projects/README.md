# projects/

Project workspaces created by **Project Factory V0.1** (`runtime/src/project-factory/`,
docs: `../docs/project-factory.md`).

Each subdirectory is one project **definition** - not a built application. The
Human Founder describes a project in natural language; Project Factory turns it
into a structured, persistent workspace and a validated, immutable Runtime
handoff package, then **stops** at the `READY_FOR_BUILD` lifecycle state and
waits for an explicit Human Founder build authorization. Runtime V1.1's Software
Factory executes a project only after that authorization, and always stops again
at `HUMAN_APPROVAL_REQUIRED` before any production step.

## Layout of a project

```
<slug>/
  project.yml                      canonical, schema-validated project definition
  README.md                        per-project summary
  product/
    brief.md                       product brief
    requirements.md                functional + non-functional requirements
    business-rules.md              business rules
    user-stories.md                user stories
    acceptance-criteria.md         Given/When/Then acceptance criteria
    intake-assumptions.md          every field Project Factory inferred/defaulted
  architecture/                    filled by Runtime agents during an authorised build
  plans/build-plan.md              initial build plan
  decisions/decision-log.md        project decision log
  state/lifecycle.md               lifecycle transition log
  artifacts/runtime-handoff.json   immutable, checksum-protected Runtime execution package
```

## Lifecycle

`DRAFT -> INTAKE -> DISCOVERY -> SPEC_READY -> PLAN_READY -> READY_FOR_BUILD`

`READY_FOR_BUILD` is terminal for Project Factory. Entering BUILD needs
`ai-company project authorize-build <slug>` by the Human Founder.

## Governance

Every project inherits Runtime V1.1 governance and cannot weaken it: Human
Founder approval before any production step, the global kill switch, the
append-only audit ledger, capability gates, secret protection, and no automatic
production deployment / financial actions / destructive production operations.

## Contents

- `project-factory-proof/` - the V0.1 acceptance sample (a `GET /health` API
  service). It proves project creation only; its build is not authorized.
