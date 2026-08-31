"""Every YAML and JSON file in the repository parses."""
import json
import unittest
import pathlib

import yaml

from _common import REPO, all_config_files, all_json_files, SCHEMAS_DIR

SKIP_DIRS = {".git", "node_modules", ".github"}


class TestYamlParses(unittest.TestCase):
    def test_all_tracked_yaml_parses(self):
        yml = [
            p for p in REPO.rglob("*.y*ml")
            if not any(part in SKIP_DIRS for part in p.parts)
        ]
        self.assertGreater(len(yml), 30, "expected many YAML files")
        for p in yml:
            with self.subTest(path=str(p.relative_to(REPO))):
                with open(p, "r", encoding="utf-8") as fh:
                    yaml.safe_load(fh)

    def test_all_json_parses(self):
        js = [
            p for p in REPO.rglob("*.json")
            if not any(part in SKIP_DIRS for part in p.parts)
        ]
        for p in js:
            with self.subTest(path=str(p.relative_to(REPO))):
                with open(p, "r", encoding="utf-8") as fh:
                    json.load(fh)


class TestSchemasAreValidDraft2020(unittest.TestCase):
    def test_each_schema_is_a_valid_schema(self):
        from jsonschema import Draft202012Validator

        schemas = sorted(SCHEMAS_DIR.glob("*.json"))
        self.assertGreaterEqual(len(schemas), 8)
        for p in schemas:
            with self.subTest(schema=p.name):
                with open(p, "r", encoding="utf-8") as fh:
                    Draft202012Validator.check_schema(json.load(fh))


if __name__ == "__main__":
    unittest.main()
