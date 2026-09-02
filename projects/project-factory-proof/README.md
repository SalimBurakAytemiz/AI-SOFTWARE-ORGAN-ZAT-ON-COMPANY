# Project Factory Proof

> Project workspace created by **Project Factory V0.1**. This is a project
> *definition*, not a built application. Runtime V1.1's Software Factory
> executes it only after an explicit Human Founder build authorization.

- **Slug:** project-factory-proof
- **Lifecycle state:** READY_FOR_BUILD
- **Type:** api_service  |  **Business model:** other  |  **Market:** unspecified
- **Risk level:** 2  |  **Security level:** standard
- **Requested workflow:** feature-development
- **Build authorized:** no - awaiting Human Founder

## Layout

```
project-factory-proof/
  project.yml                  canonical project definition
  README.md                    this file
  product/                     brief, requirements, business rules, user stories, acceptance criteria
  architecture/                architecture notes (filled during an authorised build)
  plans/                       build plan
  decisions/                   project decision log
  state/                       lifecycle transition log
  artifacts/runtime-handoff.json   immutable Runtime execution package
```

## Governance (inherited from Runtime V1.1)

- Human Founder approval before any production step
- Global kill switch and append-only audit apply
- Capability gates and secret protection apply
- No automatic production deployment, no financial actions, no destructive production operations
