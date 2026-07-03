import io
import hashlib
import os
import subprocess
import sys
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

    def test_validate_export_sources_reports_legacy_dat_source(self):
        from tools.codex_pipeline.sources import validate_export_sources

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            script = root / "extract_fake.py"
            source = root / "data" / "data05.dat"
            site_path = root / "site" / "fake.json"
            script.write_text("print('ready')\n", encoding="utf-8")
            source.parent.mkdir()
            source.write_bytes(b"data")
            site_path.parent.mkdir()
            target = ExportTarget("weapons", script, source, "fake.json", site_path)

            results = validate_export_sources([target])

        source_check = next(result for result in results if result.check == "source data")
        self.assertTrue(source_check.ok)
        self.assertIn("legacy .dat source data found", source_check.message)

    def test_validate_export_sources_reports_packed_vpack_source_blocker(self):
        from tools.codex_pipeline.sources import validate_export_sources

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            script = root / "extract_fake.py"
            source = root / "data" / "data05.dat"
            vpack = root / "data" / "ClientPack" / "rogue_data.vpack"
            site_path = root / "site" / "fake.json"
            script.write_text("print('ready')\n", encoding="utf-8")
            vpack.parent.mkdir(parents=True)
            vpack.write_bytes(b"VPACK\x01")
            site_path.parent.mkdir()
            target = ExportTarget("weapons", script, source, "fake.json", site_path)

            results = validate_export_sources([target])

        source_check = next(result for result in results if result.check == "source data")
        self.assertFalse(source_check.ok)
        self.assertEqual(source, source_check.path)
        self.assertIn("source data not found", source_check.message)
        self.assertIn("packed VPACK source found", source_check.message)
        self.assertIn(str(vpack), source_check.message)
        self.assertIn("legacy .dat extractors cannot read packed VPACK JSON yet", source_check.message)

    def test_inspect_export_source_package_reports_vpack_metadata(self):
        from tools.codex_pipeline.sources import inspect_export_source_package

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "data" / "data05.dat"
            vpack = root / "data" / "ClientPack" / "rogue_data.vpack"
            payload = b"VPACK\x01example payload"
            vpack.parent.mkdir(parents=True)
            vpack.write_bytes(payload)
            target = ExportTarget("weapons", root / "extract_fake.py", source, "fake.json", root / "site" / "fake.json")

            report = inspect_export_source_package([target])

        self.assertFalse(report.export_ready)
        self.assertEqual(0, report.legacy_source_count)
        self.assertEqual(1, report.missing_source_count)
        self.assertEqual(1, len(report.vpack_sources))
        source_info = report.vpack_sources[0]
        self.assertEqual(vpack, source_info.path)
        self.assertTrue(source_info.exists)
        self.assertTrue(source_info.is_vpack)
        self.assertEqual(len(payload), source_info.size_bytes)
        self.assertEqual(hashlib.sha256(payload).hexdigest().upper(), source_info.sha256)
        self.assertEqual(payload[:16].hex().upper(), source_info.header_hex)

    def test_cli_source_inventory_prints_packed_source_blocker(self):
        from tools.codex_pipeline import cli

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "data" / "data05.dat"
            vpack = root / "data" / "ClientPack" / "rogue_data.vpack"
            vpack.parent.mkdir(parents=True)
            vpack.write_bytes(b"VPACK\x01example payload")
            target = ExportTarget("weapons", root / "extract_fake.py", source, "fake.json", root / "site" / "fake.json")

            output = io.StringIO()
            with patch.object(cli, "resolve_targets", return_value=[target]), patch("sys.stdout", output):
                exit_code = cli.main(["source-inventory", "--target", "weapons"])

        self.assertEqual(1, exit_code)
        printed = output.getvalue()
        self.assertIn("SOURCE INVENTORY: 0 legacy .dat source(s), 1 missing source(s)", printed)
        self.assertIn("VPACK FOUND", printed)
        self.assertIn(str(vpack), printed)
        self.assertIn("EXPORT READINESS: BLOCKED", printed)
        self.assertIn("legacy .dat extractors cannot read packed VPACK JSON yet", printed)

    def test_config_accepts_project_rogue_client_root_override(self):
        with tempfile.TemporaryDirectory() as tmp:
            client_root = Path(tmp) / "Project Rogue" / "Client"
            env = os.environ.copy()
            env["PROJECT_ROGUE_CLIENT_ROOT"] = str(client_root)

            completed = subprocess.run(
                [
                    sys.executable,
                    "-c",
                    "from tools.codex_pipeline.config import CLIENT_ROOT, CLIENT_DATA_DIR; "
                    "print(CLIENT_ROOT); print(CLIENT_DATA_DIR)",
                ],
                cwd=Path(__file__).resolve().parents[2],
                env=env,
                text=True,
                capture_output=True,
                check=True,
            )

        lines = completed.stdout.strip().splitlines()
        self.assertEqual(str(client_root), lines[0])
        self.assertEqual(str(client_root / "data"), lines[1])

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
