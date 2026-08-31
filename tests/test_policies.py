"""Policy validation: schema, mandated set, default-deny, cross-references."""
import unittest

from _common import policy_files, load_yaml, validator, policies_by_id

MANDATED = {
    "human-approval", "agent-permissions", "development", "git", "qa", "security",
    "production", "database", "secrets", "model-routing", "cost", "audit",
    "incident", "release",
}


class TestPolicies(unittest.TestCase):
    def test_mandated_set_present(self):
        self.assertEqual(set(policies_by_id()), MANDATED)

    def test_schema_valid(self):
        v = validator("policy.schema.json")
        for p in policy_files():
            data = load_yaml(p)
            errors = sorted(v.iter_errors(data), key=lambda e: list(e.path))
            with self.subTest(policy=p.name):
                self.assertEqual(
                    errors, [],
                    "\n".join(f"{list(e.path)}: {e.message}" for e in errors),
                )

    def test_authority_is_human_founder(self):
        for pid, p in policies_by_id().items():
            self.assertEqual(p["authority"], "human-founder",
                             f"{pid} authority is not human-founder")

    def test_default_is_deny(self):
        for pid, p in policies_by_id().items():
            self.assertEqual(p["default"], "DENY", f"{pid} is not default-deny")

    def test_related_policies_resolve(self):
        known = set(policies_by_id())
        for pid, p in policies_by_id().items():
            for rel in p.get("related_policies", []):
                with self.subTest(policy=pid, rel=rel):
                    self.assertIn(rel, known, f"{pid} references unknown policy {rel}")

    def test_rule_ids_unique_within_policy(self):
        for pid, p in policies_by_id().items():
            ids = [r["id"] for r in p["rules"]]
            self.assertEqual(len(ids), len(set(ids)), f"{pid} has duplicate rule ids")


if __name__ == "__main__":
    unittest.main()
