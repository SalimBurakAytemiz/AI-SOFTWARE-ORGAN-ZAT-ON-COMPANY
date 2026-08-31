"""Organizational security tests (build spec section 27).

Each test name maps to a named organizational invariant. They fail if a future
configuration change accidentally violates the rule.
"""
import unittest

from _common import agents_by_id, workflows_by_id, policies_by_id, capabilities


def _agents_with_capability(cap):
    return [aid for aid, a in agents_by_id().items()
            if cap in a.get("allowed_tools", [])]


def _agents_with_allowed_action(action):
    return [aid for aid, a in agents_by_id().items()
            if action in a.get("allowed_actions", [])]


class OrgSecurity(unittest.TestCase):

    def test_NO_AGENT_CAN_DEPLOY_PRODUCTION_WITHOUT_APPROVAL(self):
        self.assertEqual(_agents_with_capability("deploy.production"), [])
        self.assertEqual(_agents_with_allowed_action("production_deployment"), [])
        # and the capability is structurally non-grantable
        self.assertFalse(capabilities()["deploy.production"]["grantable"])
        # every production workflow routes through human approval
        for wid, w in workflows_by_id().items():
            if w.get("reaches_production"):
                self.assertTrue(any(s.get("human_approval") for s in w["steps"]), wid)

    def test_NO_AGENT_CAN_DELETE_PRODUCTION_DATA_WITHOUT_APPROVAL(self):
        for act in ("production_data_deletion",
                    "production_database_destructive_operation"):
            self.assertEqual(_agents_with_allowed_action(act), [])
        self.assertFalse(capabilities()["db.migrate_production"]["grantable"])
        ha = policies_by_id()["human-approval"]
        acts = {a for r in ha["rules"] if r["effect"] == "REQUIRE_APPROVAL"
                for a in r.get("actions", [])}
        self.assertIn("production_data_deletion", acts)
        self.assertIn("production_database_destructive_operation", acts)

    def test_NO_AGENT_CAN_MERGE_PROTECTED_MAIN_WITHOUT_APPROVAL(self):
        self.assertEqual(_agents_with_capability("github.merge"), [])
        self.assertEqual(_agents_with_allowed_action("merge_protected_main"), [])
        self.assertFalse(capabilities()["github.merge"]["grantable"])
        git = policies_by_id()["git"]
        rule = next(r for r in git["rules"] if r["id"] == "PROTECTED_MAIN")
        self.assertEqual(rule["effect"], "DENY")

    def test_NO_AGENT_CAN_ACCESS_PRODUCTION_SECRETS_BY_DEFAULT(self):
        self.assertEqual(_agents_with_capability("secrets.production"), [])
        self.assertEqual(_agents_with_capability("secrets.rotate"), [])
        self.assertFalse(capabilities()["secrets.production"]["grantable"])
        secrets = policies_by_id()["secrets"]
        rule = next(r for r in secrets["rules"]
                    if r["id"] == "NO_PRODUCTION_SECRET_BY_DEFAULT")
        self.assertEqual(rule["effect"], "DENY")

    def test_NO_AGENT_CAN_CHANGE_AD_BUDGET_WITHOUT_APPROVAL(self):
        self.assertEqual(_agents_with_allowed_action("advertising_budget_modification"), [])
        ha = policies_by_id()["human-approval"]
        acts = {a for r in ha["rules"] if r["effect"] == "REQUIRE_APPROVAL"
                for a in r.get("actions", [])}
        self.assertIn("advertising_budget_modification", acts)

    def test_NO_AGENT_CAN_EXECUTE_REAL_FINANCIAL_TRANSACTION_WITHOUT_APPROVAL(self):
        for act in ("real_refund_or_financial_transaction", "supplier_or_vendor_payment"):
            self.assertEqual(_agents_with_allowed_action(act), [])
        for cap in ("payments.configure", "finance.execute"):
            self.assertFalse(capabilities()[cap]["grantable"])

    def test_EVERY_AGENT_ESCALATES_TO_A_KNOWN_AUTHORITY(self):
        known = set(agents_by_id()) | {"human-founder"}
        for aid, a in agents_by_id().items():
            self.assertIn(a["escalation_to"], known)

    def test_INDEPENDENT_REVIEWER_EXISTS_AND_IS_ISOLATED(self):
        rev = agents_by_id()["senior-code-reviewer"]
        self.assertNotIn("fs.write", rev["allowed_tools"])
        self.assertNotIn("github.create_pr", rev["allowed_tools"])
        self.assertEqual(rev["department"], "review")

    def test_HUMAN_FOUNDER_IS_NOT_AN_AGENT(self):
        self.assertNotIn("human-founder", agents_by_id())


if __name__ == "__main__":
    unittest.main()
