# Validation & Organizational Security Test Suite

Pure Python (stdlib `unittest`) + `PyYAML` + `jsonschema`. No `pytest` required.

## Run

```bash
python3 tests/run_all.py
# or
python3 -m unittest discover -s tests -t tests -v
```

CI runs this on every pull request (`.github/workflows/validate.yml`).

## What each file checks

| File | Focus |
|---|---|
| `test_yaml_json_valid.py` | Every YAML/JSON file parses; every schema is a valid Draft 2020-12 schema |
| `test_schemas.py` | Expected schema set; fixture round-trips (valid passes, invalid fails); `project-state/current.yml` validates |
| `test_agents.py` | 18 agents; schema-valid; unique ids; skill/tool/handoff/escalation references resolve; model tiers valid; **no risk ceiling of 5**; reviewer independence |
| `test_skills.py` | Schema-valid; unique ids; every skill is used by an agent; active skills cite influences |
| `test_tools.py` | Registry schema-valid; unique ids; capabilities map to real tools; non-grantable capabilities are risk 5 |
| `test_permissions.py` | Default-deny; capability-scoped; no agent granted a non-grantable capability; capability risk ≤ agent ceiling; forbidden beats allowed; reviewer & release-manager cannot write/deploy/merge |
| `test_workflows.py` | 9 mandated workflows; schema-valid; unique step ids; transitions & owners resolve; no unreachable steps; gates emit audit events; **human approval unbypassable before production**; production steps owned by the Human Founder; reviewer ≠ implementer |
| `test_models.py` | `tiers.yml` schema-valid; 5 tiers; no tier requires the Human Founder; `risk_floor` covers 0–5 and is monotonic; no hard-coded provider |
| `test_policies.py` | 14 mandated policies; schema-valid; authority = Human Founder; default DENY; related-policy references resolve |
| `test_human_authority.py` | **The load-bearing safety tests** — no agent lists/holds a critical action or capability; `human-approval.yml` covers all 15 critical actions; workflows cannot bypass approval |
| `test_org_security.py` | The named organizational invariants from build-spec §27 (`NO_AGENT_CAN_DEPLOY_PRODUCTION_WITHOUT_APPROVAL`, …) |
| `test_docs_and_terminology.py` | Required docs/research/top-level files exist; relative Markdown links resolve; no unresolved placeholder markers; terminology consistency |

## The 15 critical actions

Defined once in `tests/_common.py::CRITICAL_ACTIONS`, mirroring
`constitution/AI_SOFTWARE_COMPANY_CONSTITUTION.md` Article 3 and
`policies/human-approval.yml`. Changing that set is a governance change.
