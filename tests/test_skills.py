"""Skill definition validation."""
import unittest

from _common import skill_files, load_yaml, validator, skills_by_id, agents_by_id


class TestSkills(unittest.TestCase):
    def test_schema_valid(self):
        v = validator("skill.schema.json")
        for p in skill_files():
            data = load_yaml(p)
            errors = sorted(v.iter_errors(data), key=lambda e: list(e.path))
            with self.subTest(skill=p.name):
                self.assertEqual(
                    errors, [],
                    "\n".join(f"{list(e.path)}: {e.message}" for e in errors),
                )

    def test_unique_ids_and_filename(self):
        ids = [load_yaml(p)["id"] for p in skill_files()]
        self.assertEqual(len(ids), len(set(ids)), "duplicate skill id")
        for p in skill_files():
            self.assertEqual(load_yaml(p)["id"], p.stem)

    def test_every_skill_is_used_by_an_agent(self):
        referenced = set()
        for a in agents_by_id().values():
            referenced.update(a["required_skills"])
        for sid in skills_by_id():
            with self.subTest(skill=sid):
                self.assertIn(sid, referenced, f"skill {sid} is defined but no agent uses it")

    def test_active_skills_have_source_influences(self):
        for sid, s in skills_by_id().items():
            if s["status"] == "ACTIVE":
                self.assertTrue(s["source_influences"], f"{sid} missing source_influences")


if __name__ == "__main__":
    unittest.main()
