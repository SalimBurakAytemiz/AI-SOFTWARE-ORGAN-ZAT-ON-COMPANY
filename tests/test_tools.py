"""Tool registry and capability registry validation."""
import unittest

from _common import (
    load_yaml, validator, tool_registry, capabilities, TOOLS_DIR,
    NON_GRANTABLE_EXPECTED,
)

VALID_STATUS = {"ADOPTED", "OPTIONAL", "DEFERRED", "REJECTED", "RESEARCH"}


class TestToolRegistry(unittest.TestCase):
    def test_registry_entries_validate(self):
        v = validator("tool.schema.json")
        data = load_yaml(TOOLS_DIR / "registry.yml")
        for t in data["tools"]:
            errors = sorted(v.iter_errors(t), key=lambda e: list(e.path))
            with self.subTest(tool=t.get("id")):
                self.assertEqual(
                    errors, [],
                    "\n".join(f"{list(e.path)}: {e.message}" for e in errors),
                )

    def test_unique_tool_ids(self):
        ids = list(tool_registry())
        self.assertEqual(len(ids), len(set(ids)), "duplicate tool id in registry")

    def test_status_values(self):
        for tid, t in tool_registry().items():
            self.assertIn(t["status"], VALID_STATUS)

    def test_no_tool_adopted_only_because_it_is_famous(self):
        # sanity: not everything is ADOPTED - research must have discriminated
        statuses = {t["status"] for t in tool_registry().values()}
        self.assertIn("REJECTED", statuses)
        self.assertIn("DEFERRED", statuses)


class TestCapabilities(unittest.TestCase):
    def test_capability_ids_unique(self):
        data = load_yaml(TOOLS_DIR / "capabilities.yml")
        ids = [c["id"] for c in data["capabilities"]]
        self.assertEqual(len(ids), len(set(ids)), "duplicate capability id")

    def test_every_capability_names_a_known_tool(self):
        tools = set(tool_registry())
        for cid, c in capabilities().items():
            with self.subTest(capability=cid):
                self.assertIn(c["tool"], tools,
                              f"capability {cid} references unknown tool {c['tool']}")

    def test_expected_non_grantable_are_marked_non_grantable(self):
        caps = capabilities()
        for cid in NON_GRANTABLE_EXPECTED:
            with self.subTest(capability=cid):
                self.assertIn(cid, caps, f"{cid} missing from capabilities.yml")
                self.assertFalse(caps[cid]["grantable"],
                                 f"{cid} must be grantable: false")
                self.assertIn("reason_not_grantable", caps[cid])

    def test_non_grantable_capabilities_are_high_risk(self):
        for cid, c in capabilities().items():
            if not c["grantable"]:
                self.assertGreaterEqual(c["risk_level"], 5,
                                        f"{cid} is non-grantable but risk_level < 5")


if __name__ == "__main__":
    unittest.main()
