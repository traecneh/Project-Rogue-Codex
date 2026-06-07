import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


class LiveDeploymentTests(unittest.TestCase):
    def test_verify_live_site_compares_public_data_files(self):
        from tools.codex_pipeline.deploy import LiveDataTarget, verify_live_site

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            weapons = root / "weapons.json"
            weapons.write_text(json.dumps([{"name": "Grips of Winter"}]), encoding="utf-8")
            target = LiveDataTarget("weapons", weapons, "pages/items/weapons_data05.json")
            seen_urls = []

            def fetch_text(url, timeout_seconds):
                seen_urls.append((url, timeout_seconds))
                if url == "https://example.test/codex/":
                    return "<title>Project Rogue Codex</title>"
                if url == "https://example.test/codex/pages/items/weapons_data05.json":
                    return json.dumps([{"name": "Grips of Winter"}])
                raise OSError(f"unexpected URL: {url}")

            results = verify_live_site(
                "https://example.test/codex",
                targets=[target],
                fetch_text=fetch_text,
                timeout_seconds=3,
            )

        self.assertTrue(all(result.ok for result in results), results)
        self.assertEqual(
            [
                ("https://example.test/codex/", 3),
                ("https://example.test/codex/pages/items/weapons_data05.json", 3),
            ],
            seen_urls,
        )

    def test_verify_live_site_reports_mismatched_public_data(self):
        from tools.codex_pipeline.deploy import LiveDataTarget, verify_live_site

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            armors = root / "armors.json"
            armors.write_text(json.dumps([{"name": "Armor of Great Health"}]), encoding="utf-8")
            target = LiveDataTarget("armors", armors, "pages/items/armors_data06.json")

            def fetch_text(url, timeout_seconds):
                if url.endswith("/"):
                    return "<title>Project Rogue Codex</title>"
                return json.dumps([{"name": "Old Armor Data"}])

            results = verify_live_site(
                "https://example.test/codex/",
                targets=[target],
                fetch_text=fetch_text,
            )

        messages = "\n".join(result.message for result in results if not result.ok)
        self.assertIn("armors live JSON differs from pages/items/armors_data06.json", messages)

    def test_cli_verify_live_prints_results_and_returns_failure_for_errors(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.deploy import LiveCheckResult

        output = io.StringIO()
        with (
            patch.object(
                cli,
                "verify_live_site",
                return_value=[
                    LiveCheckResult("site", "https://example.test/codex/", True, "site reachable"),
                    LiveCheckResult(
                        "armors",
                        "https://example.test/codex/pages/items/armors_data06.json",
                        False,
                        "armors live JSON differs from pages/items/armors_data06.json",
                    ),
                ],
            ),
            patch("sys.stdout", output),
        ):
            exit_code = cli.main(["verify-live", "--site-url", "https://example.test/codex/"])

        self.assertEqual(1, exit_code)
        printed = output.getvalue()
        self.assertIn("LIVE OK site: site reachable", printed)
        self.assertIn("LIVE ERROR armors: armors live JSON differs", printed)
