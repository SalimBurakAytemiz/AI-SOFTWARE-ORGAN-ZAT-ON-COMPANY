# Runtime Troubleshooting

## `doctor` shows a FAIL row

| Row | Meaning | Fix |
|---|---|---|
| `node runtime` | Node older than 22.6 | Install Node 22.6+ (needs `node:sqlite` + type stripping) |
| `config registries` | A definition under `agents/`, `skills/`, `tools/`, `workflows/`, `policies/`, `models/` is invalid or has a broken reference | Read the error detail — it names the file and the problem. Run `python3 tests/run_all.py` for the organization view. |
| `state store` | The SQLite file is unwritable or corrupt | Check `AI_COMPANY_DATA_DIR` permissions; move the file aside to recreate it |

`NOT_CONFIGURED`, `OPTIONAL` and `DEFERRED` rows are **not** failures.

## A task run stops with `stopped because: blocked`

A gate returned `FAIL` or a step required an approval that was not present.
`ai-company task status <task-id>` shows which step and its result; `ai-company audit`
shows the reason (`workflow_blocked_no_approval`, a `FAIL` step outcome, …).

## A task run stops with `stopped because: blocked_no_approval`

The workflow reached a RISK 5 / PRODUCTION / Human-Founder-owned step without an
`APPROVED` record for the run. This is correct behaviour when the approval was
rejected or never granted. Approve the pending request, or accept that the run is
done.

## `RUNTIME_PAUSED` on `task run`

The global pause is engaged. `ai-company status` shows the reason. `ai-company resume`
to lift it.

## `NOT_HUMAN_FOUNDER` on `approvals approve`

Only the identity `human-founder` can decide an approval. The CLI always uses that
identity; this error means something else tried (an agent, a script). That is the
system working as designed.

## `ALL_PROVIDERS_FAILED` on a model call

No ready provider served the required tier. In V1 the `MockModelProvider` serves
every tier, so this should not happen offline. If you configured `LiteLlmProvider`,
check the gateway URL / key and that the per-tier model env vars are set — `ai-company
doctor` shows which tiers it can serve.

## Tests fail after editing configuration

The runtime re-validates the organization on every start. If you changed a file under
`agents/`, `skills/`, `tools/`, `workflows/`, `policies/` or `schemas/`, run both:

```
python3 tests/run_all.py
npm --prefix runtime run check
```

A schema or approval-gate change is a RISK 5 governance change (see
[`../CLAUDE.md`](../CLAUDE.md) section 14).

## Reset everything

Delete `runtime/.data/runtime.sqlite`. Tasks, runs, approvals and audit history are
cleared; the organization configuration (the git repo) is untouched.
