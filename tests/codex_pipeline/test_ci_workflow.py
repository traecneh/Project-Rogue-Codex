import unittest
from pathlib import Path


class GitHubActionsWorkflowTests(unittest.TestCase):
    def test_codex_data_checks_workflow_runs_tests_and_validation(self):
        workflow_path = Path(".github/workflows/codex-data-checks.yml")

        self.assertTrue(workflow_path.is_file(), "missing Codex data checks workflow")
        workflow = workflow_path.read_text(encoding="utf-8")

        self.assertIn("pull_request:", workflow)
        self.assertIn("push:", workflow)
        self.assertIn("actions/checkout@v4", workflow)
        self.assertIn("actions/setup-python@v5", workflow)
        self.assertIn("actions/setup-node@v4", workflow)
        self.assertIn("cache: \"npm\"", workflow)
        self.assertIn("npm ci", workflow)
        self.assertIn("python -m unittest discover -s tests -v", workflow)
        self.assertIn("python -m tools.codex_pipeline validate", workflow)
        self.assertIn(
            "python -m tools.codex_pipeline smoke-site --smoke-timeout-ms 60000",
            workflow,
        )
        self.assertIn("git diff --check", workflow)
