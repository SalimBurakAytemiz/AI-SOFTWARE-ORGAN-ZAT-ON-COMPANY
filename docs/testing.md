# Testing

The suite validates the organization and asserts the safety invariants. Pure Python —
`unittest` + `PyYAML` + `jsonschema` (+ `referencing`). No `pytest`.

```bash
python3 -m pip install pyyaml jsonschema referencing
python3 tests/run_all.py            # or: python3 -m unittest discover -s tests -t tests -v
```

CI: `.github/workflows/validate.yml` runs it on every pull request and push to `main`.

## Coverage (build-spec sections 26 & 27)

| Requirement | Test |
|---|---|
| Invalid YAML / JSON | `test_yaml_json_valid.py` |
| Invalid schema | `test_yaml_json_valid.py`, `test_schemas.py` |
| Missing required fields | schema validation in `test_agents/skills/tools/workflows/policies/models` |
| Duplicate agent IDs | `test_agents.py` |
| Duplicate tool IDs | `test_tools.py` |
| Unknown agent handoff | `test_agents.py::test_handoff_and_escalation_references_resolve` |
| Unknown tool reference | `test_agents.py`, `test_permissions.py` |
| Unknown skill reference | `test_agents.py::test_skill_references_resolve` |
| Unknown workflow references (steps/owners/transitions) | `test_workflows.py` |
| Invalid risk level | schema + `test_agents.py::test_risk_ceiling_never_five` |
| Invalid model tier | `test_agents.py`, `test_models.py` |
| Invalid workflow state | `test_workflows.py::test_project_states_valid` |
| Unreachable workflow state | `test_workflows.py::test_no_unreachable_steps` |
| Critical action without approval | `test_workflows.py`, `test_human_authority.py` |
| Agent allowed a forbidden capability | `test_permissions.py`, `test_human_authority.py` |
| Invalid permission reference | `test_permissions.py` |
| Forbidden production authority | `test_human_authority.py`, `test_org_security.py` |
| Human Founder approval bypass | `test_human_authority.py::test_every_production_workflow_has_human_approval_before_production` + reachability check in `test_workflows.py` |
| Documentation links | `test_docs_and_terminology.py` |
| Inconsistent terminology / placeholders | `test_docs_and_terminology.py` |

## Named organizational-security tests (section 27)

In `tests/test_org_security.py`:

- `test_NO_AGENT_CAN_DEPLOY_PRODUCTION_WITHOUT_APPROVAL`
- `test_NO_AGENT_CAN_DELETE_PRODUCTION_DATA_WITHOUT_APPROVAL`
- `test_NO_AGENT_CAN_MERGE_PROTECTED_MAIN_WITHOUT_APPROVAL`
- `test_NO_AGENT_CAN_ACCESS_PRODUCTION_SECRETS_BY_DEFAULT`
- `test_NO_AGENT_CAN_CHANGE_AD_BUDGET_WITHOUT_APPROVAL`
- `test_NO_AGENT_CAN_EXECUTE_REAL_FINANCIAL_TRANSACTION_WITHOUT_APPROVAL`

Each fails the build if a future configuration change violates the rule.

## The single source of truth for critical actions

`tests/_common.py::CRITICAL_ACTIONS` — 15 entries mirroring Constitution Article 3
and `policies/human-approval.yml`. Changing that set is a governance change.

## Fixtures

`tests/fixtures/audit-event.valid.json` must validate; `…invalid.json` must fail —
this proves the audit schema actually rejects a bad record (e.g. `approved_by` set to
a non-Human-Founder value).
