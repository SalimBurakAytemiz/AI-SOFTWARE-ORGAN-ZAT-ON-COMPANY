"""Human Founder authority - the load-bearing safety tests.

These assert that the ORGANIZATION DESIGN gives no AI agent unrestricted production
authority, and that there is no configured path around Human Founder approval for a
critical action. If a future edit weakens this, the build fails here.
"""
import unittest

from _common import (
    agents_by_id, policies_by_id, workflows_by_id, capabilities,
    CRITICAL_ACTIONS, NON_GRANTABLE_EXPECTED,
)


class TestNoAgentHasCriticalAuthority(unittest.TestCase):
    def test_no_agent_lists_a_critical_action_in_allowed_actions(self):
        for aid, a in agents_by_id().items():
            leaked = set(a["allowed_actions"]) & CRITICAL_ACTIONS
            with self.subTest(agent=aid):
                self.assertEqual(
                    leaked, set(),
                    f"{aid} lists critical action(s) in allowed_actions: {leaked}",
                )

    def test_every_agent_forbids_all_critical_actions(self):
        for aid, a in agents_by_id().items():
            missing = CRITICAL_ACTIONS - set(a["forbidden_actions"])
            with self.subTest(agent=aid):
                self.assertEqual(
                    missing, set(),
                    f"{aid} does not forbid critical action(s): {missing}",
                )

    def test_human_approval_required_is_a_subset_of_critical_actions(self):
        for aid, a in agents_by_id().items():
            extra = set(a.get("human_approval_required", [])) - CRITICAL_ACTIONS
            with self.subTest(agent=aid):
                self.assertEqual(
                    extra, set(),
                    f"{aid} human_approval_required has non-critical entries: {extra}",
                )

    def test_no_agent_granted_a_critical_capability(self):
        for aid, a in agents_by_id().items():
            leaked = set(a.get("allowed_tools", [])) & NON_GRANTABLE_EXPECTED
            with self.subTest(agent=aid):
                self.assertEqual(leaked, set(),
                                 f"{aid} granted critical capability(ies): {leaked}")

    def test_no_agent_risk_ceiling_is_five(self):
        for aid, a in agents_by_id().items():
            with self.subTest(agent=aid):
                self.assertLess(a["risk_level"], 5)


class TestHumanApprovalPolicyIsComplete(unittest.TestCase):
    def test_all_fifteen_critical_actions_require_approval(self):
        ha = policies_by_id()["human-approval"]
        covered = {}
        for rule in ha["rules"]:
            if rule["effect"] == "REQUIRE_APPROVAL":
                for act in rule.get("actions", []):
                    covered[act] = rule.get("approver")
        for act in CRITICAL_ACTIONS:
            with self.subTest(action=act):
                self.assertIn(act, covered,
                              f"human-approval.yml does not REQUIRE_APPROVAL for {act}")
                self.assertEqual(covered[act], "human-founder",
                                 f"{act} approver is not human-founder")

    def test_no_standing_delegation_rule_present(self):
        ha = policies_by_id()["human-approval"]
        texts = " ".join(r["statement"].lower() for r in ha["rules"])
        self.assertIn("no standing delegation", texts)

    def test_approved_by_only_human_founder_or_null(self):
        # The audit schema must not allow an arbitrary approver string.
        import json
        from _common import SCHEMAS_DIR
        sch = json.loads((SCHEMAS_DIR / "audit-event.schema.json").read_text())
        approved_by = sch["properties"]["approved_by"]
        self.assertIn("null", approved_by["type"])


class TestWorkflowsCannotBypassApproval(unittest.TestCase):
    def test_every_production_workflow_has_human_approval_before_production(self):
        for wid, w in workflows_by_id().items():
            if not w.get("reaches_production"):
                continue
            barriers = [s for s in w["steps"] if s.get("human_approval")]
            prod = [s for s in w["steps"] if s.get("project_state") == "PRODUCTION"]
            with self.subTest(workflow=wid):
                self.assertTrue(barriers, f"{wid} has no human_approval step")
                self.assertTrue(prod, f"{wid} reaches_production but has no PRODUCTION step")
                first_barrier_idx = min(w["steps"].index(s) for s in barriers)
                first_prod_idx = min(w["steps"].index(s) for s in prod)
                self.assertLess(
                    first_barrier_idx, first_prod_idx,
                    f"{wid}: a PRODUCTION step is defined before any human_approval step",
                )

    def test_production_owner_is_human_founder(self):
        for wid, w in workflows_by_id().items():
            for s in w["steps"]:
                if s.get("project_state") == "PRODUCTION" and s.get("risk_level") == 5:
                    with self.subTest(workflow=wid, step=s["id"]):
                        self.assertEqual(s["owner"], "human-founder")

    def test_release_manager_never_executes_or_approves_production(self):
        """The Release Manager may verify (read-only) but never owns a mutating
        (RISK 5) production step or a human_approval step."""
        for wid, w in workflows_by_id().items():
            for s in w["steps"]:
                mutating_prod = (
                    s.get("project_state") == "PRODUCTION" and s.get("risk_level") == 5
                )
                if mutating_prod or s.get("human_approval"):
                    with self.subTest(workflow=wid, step=s["id"]):
                        self.assertNotEqual(
                            s["owner"], "release-manager",
                            f"{wid}.{s['id']}: Release Manager executes/approves production",
                        )


if __name__ == "__main__":
    unittest.main()
