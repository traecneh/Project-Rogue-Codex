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
        self.assertIn("assertBuildPlannerSuggestionDeltas", runner)
        self.assertIn(".suggestion-deltas", runner)
        self.assertIn("data-delta-direction", runner)
        self.assertIn("assertBuildPlannerSummaryTooltips", runner)
        self.assertIn("Build Details", runner)
        self.assertIn("#calc-dr", runner)
        self.assertIn("assertBuildPlannerIssueIndicators", runner)
        self.assertIn("#build-issues", runner)
        self.assertIn("Dark Sword", runner)
        self.assertIn("runPerksSpec", runner)
        self.assertIn("/pages/systems/perks.html?perk=Runic", runner)
        self.assertIn("assertPerkSources", runner)
        self.assertIn("#perk-search", runner)
        self.assertIn("#perk-type-filter", runner)
        self.assertIn("#perk-speed-context", runner)
        self.assertIn("assertPerkMathTooltip", runner)
        self.assertIn("procs/min", runner)
        self.assertIn('!runic.classList.contains("perk-selected")', runner)
        self.assertIn('!params.has("perk")', runner)
        self.assertIn("runAscendSpec", runner)
        self.assertIn("/pages/systems/ascend.html", runner)
        self.assertIn("SMOKE OK ascend", runner)
        self.assertIn(".ascend-compare-grid", runner)
        self.assertIn("Promotion Cost", runner)
        self.assertIn("runCraftSpec", runner)
        self.assertIn("/pages/systems/craft.html", runner)
        self.assertIn("SMOKE OK craft", runner)
        self.assertIn(".craft-shop-grid", runner)
        self.assertIn("runImbuementsSpec", runner)
        self.assertIn("/pages/systems/imbuements.html", runner)
        self.assertIn("SMOKE OK imbuements", runner)
        self.assertIn(".imbuement-flow", runner)
        self.assertIn("pages/enemies/monsters.html?monster=hell-spawn", runner)
        self.assertIn("runPurgeSpec", runner)
        self.assertIn("/pages/systems/purge.html", runner)
        self.assertIn("SMOKE OK purge", runner)
        self.assertIn(".purge-compare-grid", runner)
        self.assertIn("pages/systems/corruption.html", runner)
        self.assertIn("runCorruptionSpec", runner)
        self.assertIn("/pages/systems/corruption.html", runner)
        self.assertIn("SMOKE OK corruption", runner)
        self.assertIn(".corruption-compare-grid", runner)
        self.assertIn("pages/systems/purge.html", runner)
        self.assertIn("assertMobilePageFirstNavigation", runner)
        self.assertIn("Mobile navigation should start collapsed", runner)
        self.assertIn("[data-collapse-toggle]", runner)
        self.assertIn("runEncounterSpec", runner)
        self.assertIn("/pages/systems/encounter.html", runner)
        self.assertIn("SMOKE OK encounter", runner)
        self.assertIn(".encounter-variant-grid", runner)
        self.assertIn("pages/systems/corruption.html", runner)
        self.assertIn("runPvpSpec", runner)
        self.assertIn("/pages/systems/pvp-system.html", runner)
        self.assertIn("SMOKE OK pvp", runner)
        self.assertIn(".pvp-flow", runner)
        self.assertIn("pages/systems/anti-zerg.html", runner)
        self.assertIn("runCraftingSpec", runner)
        self.assertIn("/pages/systems/crafting.html", runner)
        self.assertIn("SMOKE OK crafting", runner)
        self.assertIn("[data-set-option=\"black\"]", runner)
        self.assertIn("[data-materials-range]", runner)
