"""Agent definition validation: schema, uniqueness, and cross-references."""
import unittest

from _common import (
    agent_files, load_yaml, validator, agents_by_id, skills_by_id,
    capabilities, VALID_TIERS, SPECIAL_OWNERS,
)

EXPECTED_ROSTER = {
    "engineering-director", "product-manager", "business-analyst", "ux-ui-designer",
    "solution-architect", "frontend-engineer", "backend-engineer", "database-engineer",
    "integration-engineer", "qa-lead", "test-automation-engineer",
    "application-security-engineer", "devops-platform-engineer",
    "sre-observability-engineer", "model-operations-engineer",
    "incident-debug-engineer", "senior-code-reviewer", "release-manager",
}


class TestAgents(unittest.TestCase):
    def test_files_exist(self):
        self.assertEqual(len(agent_files()), 18, "expected 18 agent definitions")

    def test_schema_valid(self):
        v = validator("agent.schema.json")
        for p in agent_files():
            data = load_yaml(p)
            errors = sorted(v.iter_errors(data), key=lambda e: e.path)
            with self.subTest(agent=p.name):
                self.assertEqual(
                    errors, [],
                    "\n".join(f"{list(e.path)}: {e.message}" for e in errors),
                )

    def test_unique_ids_and_roster(self):
        ids = [load_yaml(p)["id"] for p in agent_files()]
        self.assertEqual(len(ids), len(set(ids)), "duplicate agent id")
        self.assertEqual(set(ids), EXPECTED_ROSTER)

    def test_id_matches_filename(self):
        for p in agent_files():
            self.assertEqual(load_yaml(p)["id"], p.stem)

    def test_skill_references_resolve(self):
        known = set(skills_by_id())
        for aid, a in agents_by_id().items():
            for s in a["required_skills"]:
                with self.subTest(agent=aid, skill=s):
                    self.assertIn(s, known, f"{aid} references unknown skill {s}")

    def test_tool_references_resolve(self):
        known = set(capabilities())
        for aid, a in agents_by_id().items():
            for cap in a.get("allowed_tools", []) + a.get("forbidden_tools", []):
                with self.subTest(agent=aid, cap=cap):
                    self.assertIn(cap, known, f"{aid} references unknown capability {cap}")

    def test_handoff_and_escalation_references_resolve(self):
        known = set(agents_by_id()) | SPECIAL_OWNERS
        for aid, a in agents_by_id().items():
            for ref in a.get("handoff_from", []) + a.get("handoff_to", []):
                with self.subTest(agent=aid, ref=ref):
                    self.assertIn(ref, known, f"{aid} handoff references unknown {ref}")
            esc = a["escalation_to"]
            self.assertIn(esc, known, f"{aid} escalates to unknown {esc}")

    def test_model_tiers_valid(self):
        for aid, a in agents_by_id().items():
            self.assertIn(a["preferred_model_tier"], VALID_TIERS)
            self.assertIn(a["fallback_model_tier"], VALID_TIERS)

    def test_risk_ceiling_never_five(self):
        for aid, a in agents_by_id().items():
            with self.subTest(agent=aid):
                self.assertLessEqual(a["risk_level"], 4,
                                     f"{aid} has risk ceiling 5; RISK 5 always needs the Human Founder")
                self.assertGreaterEqual(a["risk_level"], 0)

    def test_reviewer_is_independent(self):
        rev = agents_by_id()["senior-code-reviewer"]
        self.assertNotIn("fs.write", rev["allowed_tools"])
        self.assertNotIn("github.create_pr", rev["allowed_tools"])
        self.assertNotIn("senior-code-reviewer", rev.get("handoff_from", []))


if __name__ == "__main__":
    unittest.main()
