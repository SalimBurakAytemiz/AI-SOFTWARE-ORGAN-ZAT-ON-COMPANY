"""Permission model: default deny, capability-scoped, no forbidden grants."""
import unittest

from _common import agents_by_id, capabilities, NON_GRANTABLE_EXPECTED


class TestPermissions(unittest.TestCase):
    def test_all_referenced_capabilities_exist(self):
        known = set(capabilities())
        for aid, a in agents_by_id().items():
            for cap in a.get("allowed_tools", []) + a.get("forbidden_tools", []):
                with self.subTest(agent=aid, cap=cap):
                    self.assertIn(cap, known)

    def test_no_agent_is_granted_a_non_grantable_capability(self):
        caps = capabilities()
        for aid, a in agents_by_id().items():
            for cap in a.get("allowed_tools", []):
                with self.subTest(agent=aid, cap=cap):
                    self.assertTrue(
                        caps[cap]["grantable"],
                        f"{aid} is granted non-grantable capability {cap}",
                    )

    def test_known_critical_capabilities_never_granted(self):
        for aid, a in agents_by_id().items():
            granted = set(a.get("allowed_tools", []))
            leaked = granted & NON_GRANTABLE_EXPECTED
            with self.subTest(agent=aid):
                self.assertEqual(leaked, set(),
                                 f"{aid} granted forbidden capability(ies): {leaked}")

    def test_capability_within_agent_risk_ceiling(self):
        caps = capabilities()
        for aid, a in agents_by_id().items():
            ceiling = a["risk_level"]
            for cap in a.get("allowed_tools", []):
                with self.subTest(agent=aid, cap=cap):
                    self.assertLessEqual(
                        caps[cap]["risk_level"], ceiling,
                        f"{aid} (ceiling {ceiling}) granted {cap} "
                        f"(risk {caps[cap]['risk_level']})",
                    )

    def test_forbidden_beats_allowed(self):
        for aid, a in agents_by_id().items():
            overlap = set(a.get("allowed_tools", [])) & set(a.get("forbidden_tools", []))
            with self.subTest(agent=aid):
                self.assertEqual(overlap, set(),
                                 f"{aid} lists {overlap} in both allowed and forbidden")

    def test_reviewer_cannot_implement(self):
        rev = agents_by_id()["senior-code-reviewer"]
        for forbidden in ("fs.write", "github.create_pr", "github.merge"):
            self.assertNotIn(forbidden, rev["allowed_tools"])

    def test_release_manager_has_no_write_or_deploy(self):
        rm = agents_by_id()["release-manager"]
        for forbidden in ("fs.write", "deploy.staging", "deploy.production",
                          "github.merge", "db.migrate_production"):
            self.assertNotIn(forbidden, rm["allowed_tools"])


if __name__ == "__main__":
    unittest.main()
