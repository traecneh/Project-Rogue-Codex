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
                asset_targets=[],
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
                asset_targets=[],
                fetch_text=fetch_text,
            )

        messages = "\n".join(result.message for result in results if not result.ok)
        self.assertIn("armors live JSON differs from pages/items/armors_data06.json", messages)

    def test_verify_live_site_compares_public_image_manifest_and_hashes(self):
        from tools.codex_pipeline.deploy import LiveAssetTarget, verify_live_site

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            image_dir = root / "images" / "weapons"
            image_dir.mkdir(parents=True)
            (image_dir / "Rune Sword.gif").write_bytes(b"rune sword image")
            (image_dir / "Axe.png").write_bytes(b"axe image")
            manifest_path = image_dir / "manifest.json"
            manifest_path.write_text(
                json.dumps(
                    [
                        "images/weapons/Rune Sword.gif",
                        "images/weapons/Axe.png",
                    ]
                ),
                encoding="utf-8",
            )
            target = LiveAssetTarget(
                "weapons",
                image_dir,
                manifest_path,
                "images/weapons/manifest.json",
            )
            seen_binary_urls = []

            def fetch_text(url, timeout_seconds):
                if url == "https://example.test/codex/":
                    return "<title>Project Rogue Codex</title>"
                if url == "https://example.test/codex/images/weapons/manifest.json":
                    return manifest_path.read_text(encoding="utf-8")
                raise OSError(f"unexpected text URL: {url}")

            def fetch_bytes(url, timeout_seconds):
                seen_binary_urls.append((url, timeout_seconds))
                if url == "https://example.test/codex/images/weapons/Rune%20Sword.gif":
                    return b"rune sword image"
                if url == "https://example.test/codex/images/weapons/Axe.png":
                    return b"axe image"
                raise OSError(f"unexpected binary URL: {url}")

            results = verify_live_site(
                "https://example.test/codex",
                targets=[],
                asset_targets=[target],
                fetch_text=fetch_text,
                fetch_bytes=fetch_bytes,
                timeout_seconds=5,
            )

        self.assertTrue(all(result.ok for result in results), results)
        self.assertEqual(
            [
                ("https://example.test/codex/images/weapons/Axe.png", 5),
                ("https://example.test/codex/images/weapons/Rune%20Sword.gif", 5),
            ],
            seen_binary_urls,
        )
        self.assertIn("weapons images match manifest and local hashes (2 checked)", results[-1].message)

    def test_verify_live_site_reports_mismatched_public_image(self):
        from tools.codex_pipeline.deploy import LiveAssetTarget, verify_live_site

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            image_dir = root / "images" / "armors"
            image_dir.mkdir(parents=True)
            (image_dir / "Iceburst Amulet.gif").write_bytes(b"local image")
            manifest_path = image_dir / "manifest.json"
            manifest_path.write_text(
                json.dumps(["images/armors/Iceburst Amulet.gif"]),
                encoding="utf-8",
            )
            target = LiveAssetTarget(
                "armors",
                image_dir,
                manifest_path,
                "images/armors/manifest.json",
            )

            def fetch_text(url, timeout_seconds):
                if url.endswith("/"):
                    return "<title>Project Rogue Codex</title>"
                return manifest_path.read_text(encoding="utf-8")

            def fetch_bytes(url, timeout_seconds):
                return b"deployed image"

            results = verify_live_site(
                "https://example.test/codex/",
                targets=[],
                asset_targets=[target],
                fetch_text=fetch_text,
                fetch_bytes=fetch_bytes,
            )

        messages = "\n".join(result.message for result in results if not result.ok)
        self.assertIn("armors live image differs from images/armors/Iceburst Amulet.gif", messages)

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

    def test_cli_verify_deploy_waits_then_runs_live_checks(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.deploy import LiveCheckResult, WorkflowRunStatus
        from tools.codex_pipeline.site_smoke import SiteSmokeRun

        output = io.StringIO()
        with (
            patch.object(cli, "resolve_git_commit", return_value="abc123"),
            patch.object(
                cli,
                "wait_for_github_workflows",
                return_value=[
                    WorkflowRunStatus(
                        "Codex Data Checks",
                        "completed",
                        "success",
                        "https://github.test/runs/checks",
                    ),
                    WorkflowRunStatus(
                        "pages build and deployment",
                        "completed",
                        "success",
                        "https://github.test/runs/pages",
                    ),
                ],
            ) as wait_for_workflows,
            patch.object(
                cli,
                "verify_live_site",
                return_value=[
                    LiveCheckResult("site", "https://example.test/codex/", True, "site reachable"),
                ],
            ) as verify_live,
            patch.object(
                cli,
                "run_site_smoke_command",
                return_value=SiteSmokeRun(returncode=0, stdout="SMOKE OK site\n", stderr=""),
            ) as smoke_site,
            patch("sys.stdout", output),
        ):
            exit_code = cli.main(
                [
                    "verify-deploy",
                    "--site-url",
                    "https://example.test/codex/",
                    "--deploy-timeout-seconds",
                    "12",
                    "--poll-seconds",
                    "0",
                ]
            )

        self.assertEqual(0, exit_code)
        wait_for_workflows.assert_called_once_with(
            "traecneh/Project-Rogue-Codex",
            "main",
            "abc123",
            timeout_seconds=12,
            poll_seconds=0,
        )
        verify_live.assert_called_once_with("https://example.test/codex/", timeout_seconds=20)
        smoke_site.assert_called_once_with(timeout_ms=20000, base_url="https://example.test/codex/")
        printed = output.getvalue()
        self.assertIn("DEPLOY OK Codex Data Checks: completed success", printed)
        self.assertIn("WORKFLOW STEP verify-live", printed)
        self.assertIn("WORKFLOW STEP smoke-site --live", printed)

    def test_wait_for_github_workflows_reports_matching_completed_runs(self):
        from tools.codex_pipeline.deploy import wait_for_github_workflows

        def fetch_runs(repo, branch, timeout_seconds):
            return {
                "workflow_runs": [
                    {
                        "name": "Codex Data Checks",
                        "head_sha": "abc123",
                        "status": "completed",
                        "conclusion": "success",
                        "html_url": "https://github.test/runs/checks",
                    },
                    {
                        "name": "pages build and deployment",
                        "head_sha": "abc123",
                        "status": "completed",
                        "conclusion": "success",
                        "html_url": "https://github.test/runs/pages",
                    },
                ]
            }

        results = wait_for_github_workflows(
            "owner/repo",
            "main",
            "abc123",
            workflow_names=("Codex Data Checks", "pages build and deployment"),
            fetch_runs=fetch_runs,
            sleep=lambda seconds: None,
        )

        self.assertTrue(all(result.ok for result in results), results)
        self.assertEqual(["Codex Data Checks", "pages build and deployment"], [result.name for result in results])
