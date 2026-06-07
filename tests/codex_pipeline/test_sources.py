import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tools.codex_pipeline.exports import ExportTarget


class SourceDoctorTests(unittest.TestCase):
    def test_default_export_targets_use_repo_owned_extractors_and_client_data(self):
        from tools.codex_pipeline.config import CLIENT_DATA_DIR, REPO_ROOT
        from tools.codex_pipeline.exports import DEFAULT_EXPORT_TARGETS

        extractors_dir = REPO_ROOT / "tools" / "codex_pipeline" / "extractors"

        for target in DEFAULT_EXPORT_TARGETS.values():
            self.assertTrue(
                target.extractor_script.is_relative_to(extractors_dir),
                f"{target.name} extractor is not repo-owned: {target.extractor_script}",
            )
            self.assertTrue(
                target.source_data.is_relative_to(CLIENT_DATA_DIR),
                f"{target.name} source data should remain in client data: {target.source_data}",
            )

    def test_validate_export_sources_reports_ready_target(self):
        from tools.codex_pipeline.sources import validate_export_sources

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            script = root / "extract_fake.py"
            source = root / "source.dat"
            site_path = root / "site" / "fake.json"
            script.write_text("print('ready')\n", encoding="utf-8")
            source.write_bytes(b"data")
            site_path.parent.mkdir()
            target = ExportTarget("fake", script, source, "fake.json", site_path)

            results = validate_export_sources([target])

        self.assertTrue(all(result.ok for result in results), results)
        self.assertIn("extractor", {result.check for result in results})
        self.assertIn("source data", {result.check for result in results})
        self.assertIn("site destination", {result.check for result in results})
        self.assertIn("extractor syntax", {result.check for result in results})

    def test_validate_export_sources_reports_missing_files_and_syntax_errors(self):
        from tools.codex_pipeline.sources import validate_export_sources

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            script = root / "broken.py"
            source = root / "missing.dat"
            site_path = root / "missing_site" / "fake.json"
            script.write_text("def broken(:\n", encoding="utf-8")
            target = ExportTarget("fake", script, source, "fake.json", site_path)

            results = validate_export_sources([target])

        failures = "\n".join(result.message for result in results if not result.ok)
        self.assertIn("source data not found", failures)
        self.assertIn("site destination parent not found", failures)
        self.assertIn("extractor syntax error", failures)

    def test_cli_doctor_prints_results_and_fails_for_errors(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.sources import SourceCheckResult

        output = io.StringIO()
        with (
            patch.object(
                cli,
                "validate_export_sources",
                return_value=[
                    SourceCheckResult("weapons", "extractor", Path("extract.py"), True, "extractor found"),
                    SourceCheckResult(
                        "weapons",
                        "source data",
                        Path("data05.dat"),
                        False,
                        "source data not found: data05.dat",
                    ),
                ],
            ),
            patch("sys.stdout", output),
        ):
            exit_code = cli.main(["doctor", "--target", "weapons"])

        self.assertEqual(1, exit_code)
        printed = output.getvalue()
        self.assertIn("DOCTOR OK weapons extractor: extractor found", printed)
        self.assertIn("DOCTOR ERROR weapons source data: source data not found", printed)
