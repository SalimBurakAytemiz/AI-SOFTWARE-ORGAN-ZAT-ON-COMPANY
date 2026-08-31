"""Workflow validation: schema, reachability, reviewer independence, human gate."""
import unittest

from _common import (
    workflow_files, load_yaml, validator, workflows_by_id, agents_by_id,
    WORKFLOW_TERMINALS, SPECIAL_OWNERS, VALID_PROJECT_STATES,
)

MANDATED = {
    "feature-development", "bugfix", "incident", "hotfix", "release",
    "dependency-update", "security-finding", "architecture-change",
    "database-migration",
}


class TestWorkflows(unittest.TestCase):
    def test_mandated_set_present(self):
        self.assertEqual(set(workflows_by_id()), MANDATED)

    def test_schema_valid(self):
        v = validator("workflow.schema.json")
        for p in workflow_files():
            data = load_yaml(p)
            errors = sorted(v.iter_errors(data), key=lambda e: list(e.path))
            with self.subTest(workflow=p.name):
                self.assertEqual(
                    errors, [],
                    "\n".join(f"{list(e.path)}: {e.message}" for e in errors),
                )

    def test_step_ids_unique(self):
        for wid, w in workflows_by_id().items():
            ids = [s["id"] for s in w["steps"]]
            with self.subTest(workflow=wid):
                self.assertEqual(len(ids), len(set(ids)), "duplicate step id")

    def test_transitions_resolve(self):
        for wid, w in workflows_by_id().items():
            ids = {s["id"] for s in w["steps"]} | WORKFLOW_TERMINALS
            for s in w["steps"]:
                for key in ("on_pass", "on_fail"):
                    with self.subTest(workflow=wid, step=s["id"], edge=key):
                        self.assertIn(s[key], ids,
                                      f"{wid}.{s['id']}.{key} -> unknown '{s[key]}'")

    def test_owners_resolve(self):
        known = set(agents_by_id()) | SPECIAL_OWNERS
        for wid, w in workflows_by_id().items():
            for s in w["steps"]:
                with self.subTest(workflow=wid, step=s["id"]):
                    self.assertIn(s["owner"], known,
                                  f"{wid}.{s['id']} owner '{s['owner']}' unknown")

    def test_project_states_valid(self):
        for wid, w in workflows_by_id().items():
            for s in w["steps"]:
                ps = s.get("project_state")
                if ps is not None:
                    with self.subTest(workflow=wid, step=s["id"]):
                        self.assertIn(ps, VALID_PROJECT_STATES)

    def test_no_unreachable_steps(self):
        for wid, w in workflows_by_id().items():
            steps = {s["id"]: s for s in w["steps"]}
            first = w["steps"][0]["id"]
            reachable = {first}
            frontier = [first]
            while frontier:
                cur = frontier.pop()
                for key in ("on_pass", "on_fail"):
                    nxt = steps[cur][key]
                    if nxt in steps and nxt not in reachable:
                        reachable.add(nxt)
                        frontier.append(nxt)
            unreachable = set(steps) - reachable
            with self.subTest(workflow=wid):
                self.assertEqual(unreachable, set(),
                                 f"{wid} has unreachable steps: {unreachable}")

    def test_gate_steps_emit_audit(self):
        for wid, w in workflows_by_id().items():
            for s in w["steps"]:
                if s.get("gate"):
                    with self.subTest(workflow=wid, step=s["id"]):
                        self.assertTrue(s.get("audit_event"),
                                        f"{wid}.{s['id']} is a gate but does not emit an audit event")

    def test_human_approval_precedes_production(self):
        """Removing every human_approval ("barrier") step must make the first
        PRODUCTION-state step unreachable from the workflow start. i.e. there is no
        path to production that bypasses Human Founder approval."""
        for wid, w in workflows_by_id().items():
            if not w.get("reaches_production"):
                continue
            steps = w["steps"]
            barriers = {s["id"] for s in steps if s.get("human_approval")}
            prod_steps = [s["id"] for s in steps
                          if s.get("project_state") == "PRODUCTION"]
            with self.subTest(workflow=wid):
                self.assertTrue(prod_steps, f"{wid} has no PRODUCTION step")
                self.assertTrue(barriers, f"{wid} has no human_approval step")
                first_prod = prod_steps[0]

                adj = {}
                for s in steps:
                    if s["id"] in barriers:
                        continue
                    outs = []
                    for key in ("on_pass", "on_fail"):
                        tgt = s[key]
                        if tgt not in barriers and any(x["id"] == tgt for x in steps):
                            outs.append(tgt)
                    adj[s["id"]] = outs

                start = steps[0]["id"]
                self.assertNotIn(start, barriers, f"{wid} start step is a barrier")
                seen, frontier = {start}, [start]
                while frontier:
                    cur = frontier.pop()
                    for nxt in adj.get(cur, []):
                        if nxt not in seen:
                            seen.add(nxt)
                            frontier.append(nxt)
                self.assertNotIn(
                    first_prod, seen,
                    f"{wid}: production step '{first_prod}' is reachable without "
                    f"passing a human_approval step - Human Founder approval is bypassable",
                )

    def test_production_steps_owned_by_human_founder(self):
        for wid, w in workflows_by_id().items():
            for s in w["steps"]:
                if s.get("project_state") == "PRODUCTION" and s.get("risk_level") == 5:
                    with self.subTest(workflow=wid, step=s["id"]):
                        self.assertEqual(
                            s["owner"], "human-founder",
                            f"{wid}.{s['id']} is a RISK 5 production step not owned by human-founder",
                        )

    def test_reviewer_not_implementer_in_delivery_workflows(self):
        for wid in ("feature-development", "bugfix", "hotfix", "security-finding",
                    "database-migration", "incident"):
            w = workflows_by_id()[wid]
            steps = {s["id"]: s for s in w["steps"]}
            impl = next((s for s in w["steps"]
                         if s["id"] in ("implementation", "implement", "fix", "design")), None)
            rev = next((s for s in w["steps"]
                        if s["id"] in ("code_review", "review")), None)
            if impl and rev:
                with self.subTest(workflow=wid):
                    self.assertNotEqual(
                        impl["owner"], rev["owner"],
                        f"{wid}: review owner == implement owner ({rev['owner']})",
                    )
                    self.assertEqual(rev["owner"], "senior-code-reviewer")


if __name__ == "__main__":
    unittest.main()
