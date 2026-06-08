import io
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch


class SiteSmokeTests(unittest.TestCase):
    def test_cli_runs_site_smoke_command(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.site_smoke import SiteSmokeRun

        with patch.object(
            cli,
            "run_site_smoke_command",
            return_value=SiteSmokeRun(returncode=0, stdout="SMOKE OK weapons\n", stderr=""),
        ) as run_smoke:
            with redirect_stdout(io.StringIO()):
                exit_code = cli.main(["smoke-site", "--smoke-timeout-ms", "12345"])

        self.assertEqual(0, exit_code)
        run_smoke.assert_called_once_with(timeout_ms=12345)

    def test_cli_runs_live_site_smoke_command(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.site_smoke import SiteSmokeRun

        with patch.object(
            cli,
            "run_site_smoke_command",
            return_value=SiteSmokeRun(returncode=0, stdout="SMOKE OK site\n", stderr=""),
        ) as run_smoke:
            with redirect_stdout(io.StringIO()):
                exit_code = cli.main(
                    [
                        "smoke-site",
                        "--live",
                        "--site-url",
                        "https://example.test/codex/",
                        "--smoke-timeout-ms",
                        "12345",
                    ]
                )

        self.assertEqual(0, exit_code)
        run_smoke.assert_called_once_with(timeout_ms=12345, base_url="https://example.test/codex/")

    def test_site_smoke_reports_missing_node(self):
        from tools.codex_pipeline.site_smoke import run_site_smoke

        with patch("tools.codex_pipeline.site_smoke.subprocess.run", side_effect=FileNotFoundError):
            result = run_site_smoke(node_executable="missing-node")

        self.assertEqual(1, result.returncode)
        self.assertIn("node executable not found", result.stderr)

    def test_site_smoke_invokes_node_runner(self):
        from subprocess import CompletedProcess

        from tools.codex_pipeline.site_smoke import run_site_smoke

        completed = CompletedProcess(args=["node"], returncode=0, stdout="SMOKE OK\n", stderr="")
        with patch("tools.codex_pipeline.site_smoke.subprocess.run", return_value=completed) as run:
            result = run_site_smoke(timeout_ms=20000)

        self.assertEqual(0, result.returncode)
        self.assertEqual("SMOKE OK\n", result.stdout)
        args = run.call_args.args[0]
        self.assertEqual("node", args[0])
        self.assertTrue(str(args[1]).endswith("site_smoke.mjs"))
        self.assertIn("--timeout-ms", args)
        self.assertIn("20000", args)

    def test_site_smoke_invokes_node_runner_with_base_url(self):
        from subprocess import CompletedProcess

        from tools.codex_pipeline.site_smoke import run_site_smoke

        completed = CompletedProcess(args=["node"], returncode=0, stdout="SMOKE OK\n", stderr="")
        with patch("tools.codex_pipeline.site_smoke.subprocess.run", return_value=completed) as run:
            result = run_site_smoke(timeout_ms=20000, base_url="https://example.test/codex/")

        self.assertEqual(0, result.returncode)
        args = run.call_args.args[0]
        self.assertIn("--base-url", args)
        self.assertIn("https://example.test/codex/", args)

    def test_node_runner_includes_build_planner_flow(self):
        from tools.codex_pipeline.config import REPO_ROOT

        runner = (REPO_ROOT / "tools" / "codex_pipeline" / "site_smoke.mjs").read_text(encoding="utf-8")

        self.assertIn("runBuildPlannerSpec", runner)
        self.assertIn("SMOKE OK build planner", runner)
        self.assertIn("/pages/General/build-planner.html", runner)
        self.assertIn("Rune Sword", runner)
        self.assertIn("#reset-build", runner)
        self.assertIn('[data-quick-stat="dps"]', runner)
        self.assertIn("assertBuildPlannerItemLinks", runner)
        self.assertIn(".suggestion-link", runner)
        self.assertIn("pages/items/weapons.html?weapon=Rune%20Sword", runner)
