"""Model tier / routing / risk-policy validation."""
import unittest

from _common import load_yaml, validator, MODELS_DIR, VALID_TIERS


class TestModels(unittest.TestCase):
    def test_tiers_schema_valid(self):
        v = validator("model-tier.schema.json")
        data = load_yaml(MODELS_DIR / "tiers.yml")
        errors = sorted(v.iter_errors(data), key=lambda e: list(e.path))
        self.assertEqual(errors, [],
                         "\n".join(f"{list(e.path)}: {e.message}" for e in errors))

    def test_all_five_tiers_present(self):
        data = load_yaml(MODELS_DIR / "tiers.yml")
        names = {t["name"] for t in data["tiers"]}
        self.assertEqual(names, VALID_TIERS)

    def test_no_tier_requires_human_founder(self):
        # Model tier must never substitute for human approval.
        data = load_yaml(MODELS_DIR / "tiers.yml")
        for t in data["tiers"]:
            self.assertFalse(t.get("requires_human_founder", False),
                             f"tier {t['name']} sets requires_human_founder")

    def test_routing_risk_floor_covers_0_to_5(self):
        routing = load_yaml(MODELS_DIR / "routing.yml")
        floor = routing["risk_floor"]
        for level in range(0, 6):
            self.assertIn(level, floor, f"risk_floor missing level {level}")
            self.assertIn(floor[level], VALID_TIERS)

    def test_risk_floor_is_monotonic_non_decreasing(self):
        routing = load_yaml(MODELS_DIR / "routing.yml")
        order = {name: i for i, name in enumerate(
            ["NO_AI", "LOW_COST", "STANDARD_CODING", "ADVANCED_REASONING", "CRITICAL_REVIEW"])}
        floor = routing["risk_floor"]
        seq = [order[floor[l]] for l in range(0, 6)]
        self.assertEqual(seq, sorted(seq), "risk_floor tiers decrease as risk rises")

    def test_risk_policy_scale_complete(self):
        rp = load_yaml(MODELS_DIR / "risk-policy.yml")
        levels = {row["level"] for row in rp["scale"]}
        self.assertEqual(levels, set(range(0, 6)))
        for row in rp["scale"]:
            if row["level"] == 5:
                self.assertRegex(str(row["human_founder"]).lower(), r"required|yes")

    def test_no_hardcoded_required_provider(self):
        """routing must reference tiers, not a named required provider."""
        text = (MODELS_DIR / "routing.yml").read_text().lower()
        for banned in ("openai", "anthropic", "claude-", "gpt-4", "gemini", "required_provider:"):
            self.assertNotIn(banned, text,
                             f"routing.yml names a concrete provider/model: {banned}")


if __name__ == "__main__":
    unittest.main()
