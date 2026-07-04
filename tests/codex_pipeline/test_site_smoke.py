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
        self.assertIn("runPlayTheGameSpec", runner)
        self.assertIn("/pages/General/play-the-game.html", runner)
        self.assertIn("SMOKE OK play the game", runner)
        self.assertIn(".play-discord-panel", runner)
        self.assertIn('a[href="https://discord.gg/DW6zcWy"]', runner)
        self.assertIn("runHomeSpec", runner)
        self.assertIn("/index.html", runner)
        self.assertIn("SMOKE OK home", runner)
        self.assertNotIn(".wipe-status-panel", runner)
        self.assertIn("Home page still contains removed wipe text", runner)
        self.assertIn(".home-link-grid", runner)
        self.assertNotIn("Nocturne Blight", runner)
        self.assertNotIn(".home-entry-grid", runner)
        self.assertNotIn("assertHomeFreshness", runner)
        self.assertNotIn(".home-freshness-panel", runner)
        self.assertNotIn("data-freshness-content-hash", runner)
        self.assertIn("assertHomeTimelineFilter", runner)
        self.assertIn('[data-era-filter="project-rogue"]', runner)
        self.assertIn("data-home-result-count", runner)
        self.assertNotIn("runEndlessHuntSpec", runner)
        self.assertNotIn("/pages/General/endless-hunt.html", runner)
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
        self.assertIn("runAntiZergSpec", runner)
        self.assertIn("/pages/systems/anti-zerg.html", runner)
        self.assertIn("SMOKE OK anti-zerg", runner)
        self.assertIn(".anti-zerg-calculator", runner)
        self.assertIn("assertAntiZergCalculator", runner)
        self.assertIn("runMonsterDamageReductionSpec", runner)
        self.assertIn("/pages/systems/monster-damage-reduction.html", runner)
        self.assertIn("SMOKE OK monster damage reduction", runner)
        self.assertIn(".monster-dr-calculator", runner)
        self.assertIn("assertMonsterDamageReductionCalculator", runner)
        self.assertIn("[data-monster-input]", runner)
        self.assertIn("runExperienceSpec", runner)
        self.assertIn("/pages/systems/experience.html", runner)
        self.assertIn("SMOKE OK experience", runner)
        self.assertIn(".experience-sim-widget", runner)
        self.assertIn("assertExperienceSimulator", runner)
        self.assertIn("[data-xp-run-tick]", runner)
        self.assertIn("runLevelSpec", runner)
        self.assertIn("/pages/stats/level.html", runner)
        self.assertIn("SMOKE OK level", runner)
        self.assertIn(".level-xp-widget", runner)
        self.assertIn("assertLevelXpWidget", runner)
        self.assertIn("[data-level-boost=\"pool\"]", runner)
        self.assertIn("runSkillsSpec", runner)
        self.assertIn("/pages/stats/skills.html", runner)
        self.assertIn("SMOKE OK skills", runner)
        self.assertIn(".skills-requirement-widget", runner)
        self.assertIn("assertSkillsRequirementWidget", runner)
        self.assertIn("[data-skill-race-toggle]", runner)
        self.assertIn("runRacesSpec", runner)
        self.assertIn("/pages/stats/races.html", runner)
        self.assertIn("SMOKE OK races", runner)
        self.assertIn(".races-preview-widget", runner)
        self.assertIn("assertRacesPreview", runner)
        self.assertIn("[data-race-option", runner)
        self.assertIn("runStrengthSpec", runner)
        self.assertIn("/pages/stats/strength.html", runner)
        self.assertIn("SMOKE OK strength", runner)
        self.assertIn(".strength-calculator-widget", runner)
        self.assertIn("assertStrengthCalculator", runner)
        self.assertIn("[data-strength-str-slider]", runner)
        self.assertIn("runConstitutionSpec", runner)
        self.assertIn("/pages/stats/constitution.html", runner)
        self.assertIn("SMOKE OK constitution", runner)
        self.assertIn(".constitution-calculator-widget", runner)
        self.assertIn("assertConstitutionCalculator", runner)
        self.assertIn("[data-constitution-con-slider]", runner)
        self.assertIn("runDexteritySpec", runner)
        self.assertIn("/pages/stats/dexterity.html", runner)
        self.assertIn("SMOKE OK dexterity", runner)
        self.assertIn(".dexterity-calculator-widget", runner)
        self.assertIn("assertDexterityCalculator", runner)
        self.assertIn("[data-dexterity-dex-slider]", runner)
        self.assertIn("runResistancesSpec", runner)
        self.assertIn("/pages/stats/resistances.html", runner)
        self.assertIn("SMOKE OK resistances", runner)
        self.assertIn(".resistance-calculator-widget", runner)
        self.assertIn("assertResistanceCalculator", runner)
        self.assertIn("[data-resistance-value-slider]", runner)
        self.assertIn("assertResistanceNeutralToggle", runner)
        self.assertIn("runGuildSpec", runner)
        self.assertIn("/pages/systems/guild.html", runner)
        self.assertIn("SMOKE OK guild", runner)
        self.assertIn(".guild-party-preview", runner)
        self.assertIn("assertGuildPartyPreview", runner)
        self.assertIn('[data-party-option="B"]', runner)
        self.assertIn("runChatSpec", runner)
        self.assertIn("/pages/systems/chat.html", runner)
        self.assertIn("SMOKE OK chat", runner)
        self.assertIn(".chat-mode-preview", runner)
        self.assertIn("assertChatModePreview", runner)
        self.assertIn('[data-chat-mode="Global"]', runner)
        self.assertIn("runFloorCleanupSpec", runner)
        self.assertIn("/pages/systems/floor-cleanup.html", runner)
        self.assertIn("SMOKE OK floor cleanup", runner)
        self.assertIn(".floor-cleanup-preview", runner)
        self.assertIn("assertFloorCleanupPreview", runner)
        self.assertIn('[data-cleanup-scenario="after"]', runner)
        self.assertIn("runCraftingSpec", runner)
        self.assertIn("/pages/systems/crafting.html", runner)
        self.assertIn("SMOKE OK crafting", runner)
        self.assertIn("[data-set-option=\"black\"]", runner)
        self.assertIn("[data-materials-range]", runner)

    def test_smoke_specs_include_collectables_and_useables(self):
        from tools.codex_pipeline.config import REPO_ROOT

        runner = (REPO_ROOT / "tools" / "codex_pipeline" / "site_smoke.mjs").read_text(encoding="utf-8")

        for expected in [
            'detailName: "Ascendancy Shard"',
            'detailQuery: "54"',
            'duplicateRoute: { id: "36", detailName: "Demonic Remains" }',
            'detailTextIncludes: ["Relationships", "Used In", "Ascend System", "Found From", "Deconstruct System"]',
            'detailHrefIncludes: ["pages/systems/ascend.html", "pages/systems/deconstruct.html"]',
            'label: "collectables"',
            'detailName: "Carpentry Saw"',
            'detailQuery: "10"',
            'duplicateRoute: { id: "76", detailName: "Scroll of Imbuement" }',
            'detailTextIncludes: ["Relationships", "Used In", "Carpentry"]',
            'detailHrefIncludes: ["pages/stats/skills.html"]',
            'label: "useables"',
            "/pages/items/collectables.html",
            "/pages/items/useables.html",
            'detailSelector: "#item-details"',
            'rowSelector: "#items-body tr[data-id]"',
            'detailLinkSelector: ""',
            "assertDuplicateRouteStability",
            "assertDetailTextIncludes",
            "assertDetailHrefIncludes",
            'queryKey: "collectable"',
            'queryKey: "useable"',
        ]:
            self.assertIn(expected, runner)
