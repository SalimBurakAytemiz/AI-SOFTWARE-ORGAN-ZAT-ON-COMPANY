"""The schemas themselves, plus fixture round-trips (valid passes, invalid fails)."""
import json
import unittest

from jsonschema import Draft202012Validator

from _common import SCHEMAS_DIR, REPO, validator

EXPECTED_SCHEMAS = {
    "agent.schema.json", "skill.schema.json", "tool.schema.json",
    "workflow.schema.json", "policy.schema.json", "model-tier.schema.json",
    "audit-event.schema.json", "project-state.schema.json",
}
FIX = REPO / "tests" / "fixtures"


class TestSchemas(unittest.TestCase):
    def test_expected_schemas_exist(self):
        present = {p.name for p in SCHEMAS_DIR.glob("*.json")}
        self.assertEqual(present, EXPECTED_SCHEMAS)

    def test_each_schema_is_valid(self):
        for p in SCHEMAS_DIR.glob("*.json"):
            with self.subTest(schema=p.name):
                Draft202012Validator.check_schema(json.loads(p.read_text()))

    def test_audit_event_fixture_valid(self):
        v = validator("audit-event.schema.json")
        data = json.loads((FIX / "audit-event.valid.json").read_text())
        errors = sorted(v.iter_errors(data), key=lambda e: list(e.path))
        self.assertEqual(errors, [],
                         "\n".join(f"{list(e.path)}: {e.message}" for e in errors))

    def test_audit_event_invalid_fixture_rejected(self):
        v = validator("audit-event.schema.json")
        data = json.loads((FIX / "audit-event.invalid.json").read_text())
        self.assertTrue(list(v.iter_errors(data)),
                        "the invalid audit-event fixture unexpectedly passed validation")

    def test_project_state_current_valid(self):
        v = validator("project-state.schema.json")
        import yaml
        data = yaml.safe_load((REPO / "project-state" / "current.yml").read_text())
        errors = sorted(v.iter_errors(data), key=lambda e: list(e.path))
        self.assertEqual(errors, [],
                         "\n".join(f"{list(e.path)}: {e.message}" for e in errors))


if __name__ == "__main__":
    unittest.main()
