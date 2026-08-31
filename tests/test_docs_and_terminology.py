"""Documentation completeness, internal links, and terminology consistency."""
import re
import unittest

from _common import REPO

REQUIRED_DOCS = [
    "docs/architecture.md", "docs/organization.md", "docs/agent-system.md",
    "docs/tool-system.md", "docs/model-system.md", "docs/workflows.md",
    "docs/security.md", "docs/human-approval.md", "docs/testing.md",
    "docs/repository-research.md", "docs/future-runtime.md", "docs/beginner-guide.md",
]
REQUIRED_RESEARCH = [
    "research/role-gap-analysis.md", "research/tool-gap-analysis.md",
    "research/workflow-gap-analysis.md", "research/runtime-comparison.md",
    "research/security-comparison.md", "research/adopted-practices.md",
    "research/rejected-practices.md", "research/architecture-decisions.md",
    "research/final-recommendations.md",
]
TOP_LEVEL = ["README.md", "CLAUDE.md",
             "constitution/AI_SOFTWARE_COMPANY_CONSTITUTION.md",
             "project-state/current.yml",
             "future-projects/cleaning-commerce.md"]

LINK_RE = re.compile(r"\[[^\]]+\]\(([^)]+)\)")


class TestDocs(unittest.TestCase):
    def test_required_files_exist(self):
        for rel in REQUIRED_DOCS + REQUIRED_RESEARCH + TOP_LEVEL:
            with self.subTest(path=rel):
                self.assertTrue((REPO / rel).is_file(), f"missing {rel}")

    def test_relative_markdown_links_resolve(self):
        md_files = [p for p in REPO.rglob("*.md")
                    if ".git" not in p.parts and "node_modules" not in p.parts]
        for p in md_files:
            text = p.read_text(encoding="utf-8")
            for m in LINK_RE.finditer(text):
                target = m.group(1).split("#")[0].strip()
                if not target or target.startswith(("http://", "https://", "mailto:")):
                    continue
                resolved = (p.parent / target).resolve()
                with self.subTest(doc=str(p.relative_to(REPO)), link=target):
                    self.assertTrue(resolved.exists(),
                                    f"{p.relative_to(REPO)} -> broken link {target}")

    def test_no_unresolved_placeholder_markers(self):
        # Actual code-style placeholder markers are not allowed anywhere outside
        # tests/. Explicit lifecycle labels (PLANNED / DEFERRED / ...) are fine.
        marker = re.compile(r"(TODO:|FIXME:|XXX:|\bTBD\b|<placeholder>|lorem ipsum)", re.I)
        offenders = []
        for p in list(REPO.rglob("*.md")) + list(REPO.rglob("*.yml")) + list(REPO.rglob("*.json")):
            if ".git" in p.parts or "node_modules" in p.parts or "tests" in p.parts:
                continue
            for i, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
                if marker.search(line):
                    offenders.append(f"{p.relative_to(REPO)}:{i}: {line.strip()}")
        self.assertEqual(offenders, [], "unresolved placeholder markers found:\n" +
                         "\n".join(offenders))

    def test_terminology_human_founder_not_owner_or_ceo(self):
        # The supreme authority is the "Human Founder" - not "owner", "CEO", "admin".
        const = (REPO / "constitution" / "AI_SOFTWARE_COMPANY_CONSTITUTION.md").read_text()
        self.assertIn("Human Founder", const)
        self.assertNotRegex(const, r"\bthe CEO\b")


if __name__ == "__main__":
    unittest.main()
