import unittest
from pathlib import Path


class PipelineDocumentationTests(unittest.TestCase):
    def test_release_flow_documents_static_assets_release_check_and_deploy_verification(self):
        readme = Path("README.md").read_text(encoding="utf-8")
        architecture = Path("docs/codex-pipeline-architecture.md").read_text(encoding="utf-8")

        for document in [readme, architecture]:
            self.assertIn("python -m tools.codex_pipeline bump-static-version", document)
            self.assertIn("python -m tools.codex_pipeline release-check", document)
            self.assertIn("python -m tools.codex_pipeline verify-deploy", document)

        self.assertIn("static asset", readme.lower())
        self.assertIn("GitHub Actions runs `release-check`", architecture)


if __name__ == "__main__":
    unittest.main()
