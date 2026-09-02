# Project Factory V0.1 - Human Founder workflow

Project Factory lets the Human Founder describe a software project in natural
language and have AI Company turn it into a **structured, persistent project
workspace** plus a **validated, immutable Runtime handoff package** - ready to be
executed later by Runtime V1.1's Software Factory, but only after an explicit
Human Founder build authorization.

Project Factory V0.1 **does not build the application**. It creates the project
definition and prepares it for Runtime execution.

Related: [`../projects/README.md`](../projects/README.md),
[`real-agent-execution.md`](real-agent-execution.md),
[`agent-runtime.md`](agent-runtime.md).

---

## 1. Create a project

From a name + description:

```
ai-company new cleaning-commerce \
  --name "Cleaning Commerce" \
  --description "An e-commerce system selling cleaning supplies to individual and business customers in Türkiye."
```

Or from a natural-language brief file (labelled fields and/or free prose):

```
ai-company new cleaning-commerce --brief-file ./brief.txt
```

The equivalent through Claude Code is: *"Create a new project through AI Company.
Project name: Cleaning Commerce. I want an e-commerce system selling cleaning
supplies to individual and business customers in Türkiye."* Claude runs the same
`ai-company new` command.

Creation is **deterministic**: no model call, no paid API, and Codex is never
required to create a project. Project Factory parses the brief into the
structured fields the schema requires (`project-model.ts`), inferring anything
not stated and recording every inference in `product/intake-assumptions.md`.

By default `new` walks the whole lifecycle to `READY_FOR_BUILD` and generates the
Runtime handoff package. Use `--stop-at <STATE>` to halt earlier.

## 2. What gets created

`projects/<slug>/` with `project.yml`, a `README.md`, the `product/` document
set, `plans/build-plan.md`, `decisions/`, `state/`, and
`artifacts/runtime-handoff.json`. See [`../projects/README.md`](../projects/README.md)
for the full layout.

## 3. Lifecycle

```
DRAFT -> INTAKE -> DISCOVERY -> SPEC_READY -> PLAN_READY -> READY_FOR_BUILD
```

Transitions are linear and forward-only in V0.1. Step through them manually with
`ai-company project advance <slug>`. BUILD is **never** entered automatically.

Inspect state at any time:

```
ai-company project list
ai-company project status <slug>
ai-company project show <slug>       # prints project.yml
ai-company project verify <slug>     # validates the definition + handoff package
```

## 4. Review and correct

Read `projects/<slug>/product/intake-assumptions.md` and the generated
documents. Correct anything by editing `project.yml` directly (it re-validates
against the schema on the next command).

## 5. Authorize the build (Human Founder only)

```
ai-company project authorize-build <slug> --note "Approved for build"
```

Only `human-founder` may run this. It records a RISK 5, approval-required audit
event, flips the build gate in `project.yml`, and regenerates the handoff
package with the authorization embedded. **It does not start a build** - Runtime
V1.1 executes the project separately, under Human Founder control, and stops at
`HUMAN_APPROVAL_REQUIRED` before any production step.

## 6. Budget policy

Each project carries a per-project AI budget policy (`budget_policy` in
`project.yml`):

| field | default | meaning |
| --- | --- | --- |
| `free_first` | `true` | always try the free proof-provider chain first (cannot be disabled) |
| `max_real_provider_requests` | `30` (`60` for risk >= 4 / high security) | hard ceiling on real free-provider requests per Runtime execution |
| `max_premium_invocations` | `0` | hard ceiling on premium (paid / Codex) invocations; `0` = premium disabled |
| `premium_authorization_required` | `true` | premium always needs a separate per-run Human Founder authorization (cannot be disabled) |
| `provider_fallback_allowed` | `true` | whether the free-first Groq -> NVIDIA fallback may engage |

Override at creation with `--` flags is not exposed in V0.1; edit `project.yml`
and re-run `ai-company project verify <slug>`.

## 7. The Runtime handoff package

`artifacts/runtime-handoff.json` is the **contract** between Project Factory and
Runtime V1.1: project identity, the product spec as markdown, constraints,
integrations, risk classification, the budget policy, the inherited governance
controls, and the build authorization. A SHA-256 `checksum` over the canonical
body makes it tamper-evident - Runtime recomputes it and refuses to execute a
package whose checksum, governance, or build authorization does not check out
(`verifyHandoffPackage` in `runtime/src/project-factory/runtime-handoff.ts`).

Project Factory produces the package; **Runtime consumes it later**. The two are
not coupled to any model provider.

## 8. Governance (inherited, non-negotiable)

Every project inherits and cannot weaken: Human Founder approval before any
production step, the global kill switch, the append-only audit ledger,
capability gates, secret protection, and no automatic production deployment / no
financial actions / no destructive production operations. Project Factory never
bypasses Runtime V1.1 governance.

## Expected end-to-end usage

```
ai-company new cleaning-commerce --name "Cleaning Commerce" --description "..."
```

then AI Company:

1. creates the project workspace under `projects/cleaning-commerce/`,
2. structures the requirements into the `product/` document set,
3. prepares the immutable Runtime handoff package, and
4. waits for `ai-company project authorize-build cleaning-commerce` by the Human
   Founder before Runtime implementation begins.
