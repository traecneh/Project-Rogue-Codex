import io
import json
from pathlib import Path
import tempfile
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch


class SiteSmokeTests(unittest.TestCase):
    def test_cli_runs_site_smoke_command(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import GENERATED_OUTPUT_DIR
        from tools.codex_pipeline.site_smoke import SiteSmokeRun

        with patch.object(
            cli,
            "run_site_smoke_command",
            return_value=SiteSmokeRun(returncode=0, stdout="SMOKE OK weapons\n", stderr=""),
        ) as run_smoke:
            with redirect_stdout(io.StringIO()):
                exit_code = cli.main(["smoke-site", "--smoke-timeout-ms", "12345"])

        self.assertEqual(0, exit_code)
        run_smoke.assert_called_once_with(
            timeout_ms=12345,
            results_path=GENERATED_OUTPUT_DIR / "impact_validation_results.json",
        )

    def test_cli_runs_live_site_smoke_command(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import GENERATED_OUTPUT_DIR
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
        run_smoke.assert_called_once_with(
            timeout_ms=12345,
            base_url="https://example.test/codex/",
            results_path=GENERATED_OUTPUT_DIR / "impact_validation_results.json",
        )

    def test_cli_passes_impact_plan_to_site_smoke_command(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import GENERATED_OUTPUT_DIR
        from tools.codex_pipeline.site_smoke import SiteSmokeRun

        with tempfile.TemporaryDirectory() as tmp_dir:
            plan_path = Path(tmp_dir) / "impact_validation_plan.json"
            plan_path.write_text('{"checks": [], "affectedRecords": []}', encoding="utf-8")
            with patch.object(
                cli,
                "run_site_smoke_command",
                return_value=SiteSmokeRun(returncode=0, stdout="SMOKE OK site\n", stderr=""),
            ) as run_smoke:
                with redirect_stdout(io.StringIO()):
                    exit_code = cli.main(["smoke-site", "--impact-plan", str(plan_path)])

        self.assertEqual(0, exit_code)
        run_smoke.assert_called_once_with(
            timeout_ms=20000,
            impact_plan_path=plan_path,
            results_path=GENERATED_OUTPUT_DIR / "impact_validation_results.json",
        )

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

    def test_site_smoke_invokes_node_runner_with_impact_plan(self):
        from subprocess import CompletedProcess

        from tools.codex_pipeline.site_smoke import run_site_smoke

        completed = CompletedProcess(args=["node"], returncode=0, stdout="SMOKE OK\n", stderr="")
        with tempfile.TemporaryDirectory() as tmp_dir:
            plan_path = Path(tmp_dir) / "impact_validation_plan.json"
            plan_path.write_text(
                '{"checks": [], "affectedRecords": [{"target": "weapons"}]}',
                encoding="utf-8",
            )
            with patch("tools.codex_pipeline.site_smoke.subprocess.run", return_value=completed) as run:
                result = run_site_smoke(timeout_ms=20000, impact_plan_path=plan_path)

        self.assertEqual(0, result.returncode)
        args = run.call_args.args[0]
        self.assertIn("--impact-plan", args)
        self.assertIn(str(plan_path.resolve()), args)
        self.assertGreaterEqual(run.call_args.kwargs["timeout"], 35)

    def test_site_smoke_rejects_missing_impact_plan(self):
        from tools.codex_pipeline.site_smoke import run_site_smoke

        result = run_site_smoke(impact_plan_path=Path("missing-impact-plan.json"))

        self.assertEqual(1, result.returncode)
        self.assertIn("impact validation plan not found", result.stderr)

    def test_site_smoke_validates_results_artifact_digest_and_status(self):
        from subprocess import CompletedProcess

        from tools.codex_pipeline.site_smoke import run_site_smoke

        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            plan_path = root / "impact_validation_plan.json"
            results_path = root / "impact_validation_results.json"
            plan_path.write_text(
                '{"reportDigest": "sha256:reviewed", "checks": [], "affectedRecords": []}',
                encoding="utf-8",
            )

            def write_results(command, **kwargs):
                results_path.write_text(
                    '{"schemaVersion": 1, "reportDigest": "sha256:reviewed", "status": "passed"}',
                    encoding="utf-8",
                )
                return CompletedProcess(args=command, returncode=0, stdout="SMOKE OK\n", stderr="")

            with patch("tools.codex_pipeline.site_smoke.subprocess.run", side_effect=write_results):
                result = run_site_smoke(
                    impact_plan_path=plan_path,
                    results_path=results_path,
                )
            evidence = json.loads(results_path.read_text(encoding="utf-8"))

        self.assertEqual(0, result.returncode)
        self.assertEqual(1, evidence["sourceTree"]["schemaVersion"])
        self.assertEqual("sha256-path-content-v1", evidence["sourceTree"]["algorithm"])
        self.assertEqual(64, len(evidence["sourceTree"]["sha256"]))
        self.assertGreater(evidence["sourceTree"]["fileCount"], 0)

    def test_site_smoke_rejects_results_for_a_different_report(self):
        from subprocess import CompletedProcess

        from tools.codex_pipeline.site_smoke import run_site_smoke

        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            plan_path = root / "impact_validation_plan.json"
            results_path = root / "impact_validation_results.json"
            plan_path.write_text(
                '{"reportDigest": "sha256:reviewed", "checks": [], "affectedRecords": []}',
                encoding="utf-8",
            )

            def write_results(command, **kwargs):
                results_path.write_text(
                    '{"schemaVersion": 1, "reportDigest": "sha256:stale", "status": "passed"}',
                    encoding="utf-8",
                )
                return CompletedProcess(args=command, returncode=0, stdout="SMOKE OK\n", stderr="")

            with patch("tools.codex_pipeline.site_smoke.subprocess.run", side_effect=write_results):
                result = run_site_smoke(
                    impact_plan_path=plan_path,
                    results_path=results_path,
                )

        self.assertEqual(1, result.returncode)
        self.assertIn("report digest does not match", result.stderr)

    def test_site_smoke_fails_when_results_artifact_is_missing(self):
        from subprocess import CompletedProcess

        from tools.codex_pipeline.site_smoke import run_site_smoke

        completed = CompletedProcess(args=["node"], returncode=0, stdout="SMOKE OK\n", stderr="")
        with tempfile.TemporaryDirectory() as tmp_dir:
            results_path = Path(tmp_dir) / "impact_validation_results.json"
            with patch("tools.codex_pipeline.site_smoke.subprocess.run", return_value=completed):
                result = run_site_smoke(results_path=results_path)

        self.assertEqual(1, result.returncode)
        self.assertIn("did not write results artifact", result.stderr)

    def test_node_runner_includes_build_planner_flow(self):
        from tools.codex_pipeline.config import REPO_ROOT

        runner = (REPO_ROOT / "tools" / "codex_pipeline" / "site_smoke.mjs").read_text(encoding="utf-8")

        self.assertIn("runBuildPlannerSpec", runner)
        self.assertIn('id: "build planner"', runner)
        self.assertIn("/pages/General/build-planner.html", runner)
        self.assertIn("Rune Sword", runner)
        self.assertIn("#reset-build", runner)
        self.assertIn('[data-quick-stat="dps"]', runner)
        self.assertIn("assertBuildPlannerItemLinks", runner)
        self.assertIn(".suggestion-link", runner)
        self.assertIn("pages/items/weapons.html?weapon=227", runner)
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
        self.assertIn('id: "play the game"', runner)
        self.assertIn(".play-discord-panel", runner)
        self.assertIn('a[href="https://discord.gg/DW6zcWy"]', runner)
        self.assertIn("runQuestsSpec", runner)
        self.assertIn("/pages/General/quests.html?quest=investigate-the-undead", runner)
        self.assertIn("/pages/General/quests.html?quest=mastery-of-silvest", runner)
        self.assertIn("/pages/General/quests.html?quest=grave-consequences", runner)
        self.assertIn("/pages/General/quests.html?quest=the-backroom", runner)
        self.assertIn("/pages/General/quests.html?quest=the-highwaymans-due", runner)
        self.assertIn("/pages/General/quests.html?quest=scurvy-dogs", runner)
        self.assertIn("/pages/General/quests.html?quest=lotors-ettin-slayer", runner)
        self.assertIn("/pages/General/quests.html?quest=wailing-souls", runner)
        self.assertIn("/pages/General/quests.html?quest=the-scared-guard", runner)
        self.assertIn("/pages/General/quests.html?quest=the-approaching-orcs", runner)
        self.assertIn("/pages/General/quests.html?quest=where-theres-smoke", runner)
        self.assertIn("/pages/General/quests.html?quest=a-headless-problem", runner)
        self.assertIn("/pages/General/quests.html?quest=banished-no-more", runner)
        self.assertIn("/pages/General/quests.html?quest=the-fallen-order", runner)
        self.assertIn("/pages/General/quests.html?quest=feathers-and-fury", runner)
        self.assertIn("Map_Combined-preview.webp", runner)
        self.assertIn(".quest-map-preview.is-unavailable", runner)
        self.assertIn("six contextual map previews", runner)
        self.assertIn("for (const quest of questData.quests || [])", runner)
        self.assertIn("still renders numeric coordinate links", runner)
        self.assertIn("Quest list is not ordered by level with stable source ties", runner)
        self.assertIn("Filtered quest list is not ordered by level", runner)
        self.assertIn('id: "quests"', runner)
        self.assertIn('detailQuery: "1006"', runner)
        self.assertIn('detailName: "Bottomless Bag"', runner)
        self.assertIn('pages/items/armors.html?armor=1006', runner)
        self.assertIn("assertArmorResistanceFilters", runner)
        self.assertIn('["holy", 14]', runner)
        self.assertIn('["dark", 15]', runner)
        self.assertIn("assertDetailRouteDoesNotFilterList", runner)
        self.assertIn("Kill Dark Mages", runner)
        self.assertIn("3 required", runner)
        self.assertIn("Kill Skeleton Wolf", runner)
        self.assertIn("1 required", runner)
        self.assertIn("pages/enemies/monsters.html?monster=94", runner)
        self.assertIn("assertMonsterRecommendationEnhancements", runner)
        self.assertIn('targetUrl.searchParams.set("monster", "dark-monk")', runner)
        self.assertIn('targetUrl.searchParams.set("monster", "dusk-mage")', runner)
        self.assertIn('targetUrl.searchParams.set("monster", "dark-druid")', runner)
        self.assertIn('targetUrl.searchParams.set("monster", "ice-dragon")', runner)
        self.assertIn("weapon-ranking-toggle", runner)
        self.assertIn("weapon-ranking-item-level-input", runner)
        self.assertIn("weapon-ranking-type-select", runner)
        self.assertIn("weapon-ranking-perks", runner)
        self.assertIn("armor-ranking-toggle", runner)
        self.assertIn("armor-ranking-level-input", runner)
        self.assertIn("armor-set-card", runner)
        self.assertIn("armor-slot-select", runner)
        self.assertIn('selectOption("Sword")', runner)
        self.assertIn('option[value="Bow"], option[value="Crossbow"]', runner)
        self.assertIn("preferences did not persist across reload", runner)
        self.assertIn("Dark 1.3x", runner)
        self.assertIn("item-level 145 Dark Sword", runner)
        self.assertIn("Dark Sword ranking context was incomplete", runner)
        self.assertIn('data-skill-requirement="50"][data-item-level="50"]', runner)
        self.assertIn("Darkness Falls ranking context was incomplete", runner)
        self.assertIn("Weapon perk damage adjustment was incorrect", runner)
        self.assertIn("Weapon perk toggle did not restore base DPS", runner)
        self.assertIn("Item Lv <= 60", runner)
        self.assertIn("item-level 145 Scabbard of Arcus", runner)
        self.assertIn("Armor rankings still exposed a shield toggle", runner)
        self.assertIn("Armor set rankings still exposed removed columns", runner)
        self.assertIn("Crafted armor recommendation level was incorrect", runner)
        self.assertIn("Armor perk matchup ranking was incorrect", runner)
        self.assertIn("Armor perk toggle did not restore base ranking", runner)
        self.assertIn("Armor recommendation panel overflowed mobile viewport", runner)
        self.assertIn("Monster recommendation panel overflowed mobile viewport", runner)
        self.assertIn("Zombie ID 94", runner)
        self.assertIn('img[src*="Zombie-94.gif"]', runner)
        self.assertIn('rows.length === 1 && rows[0].getAttribute("data-id") === "94"', runner)
        self.assertIn("const url = new URL(originalUrl);", runner)
        self.assertNotIn('new URL("/pages/items/weapons.html", originalUrl)', runner)
        self.assertIn('data-entry-id="create-a-guild"', runner)
        self.assertIn("Guild Master", runner)
        self.assertIn('collectables.html?collectable=0', runner)
        self.assertIn('img[src*="Gold.png"]', runner)
        self.assertIn("Project-Rogue-Map", runner)
        self.assertIn("label=Guild+Master", runner)
        self.assertIn("#site-search-input", runner)
        self.assertIn("runHomeSpec", runner)
        self.assertIn("/index.html", runner)
        self.assertIn('id: "home"', runner)
        self.assertNotIn(".wipe-status-panel", runner)
        self.assertIn("Home page still contains removed wipe text", runner)
        self.assertIn(".home-link-grid", runner)
        self.assertNotIn("Nocturne Blight", runner)
        self.assertNotIn(".home-entry-grid", runner)
        self.assertNotIn("assertHomeFreshness", runner)
        self.assertNotIn(".home-freshness-panel", runner)
        self.assertNotIn("data-freshness-content-hash", runner)
        self.assertIn("assertHomeTimelineFocus", runner)
        self.assertIn("history-story-body", runner)
        self.assertIn("is-timeline-focus", runner)
        self.assertNotIn("runEndlessHuntSpec", runner)
        self.assertNotIn("/pages/General/endless-hunt.html", runner)
        self.assertIn("runPerksSpec", runner)
        self.assertIn("/pages/systems/perks.html?perk=Runic", runner)
        self.assertIn("assertPerkSources", runner)
        self.assertIn("assertPerkTatterSources", runner)
        self.assertIn("assertMobilePerkTatterLayout", runner)
        self.assertIn("Balron,Anubis", runner)
        self.assertIn("Werewolf,Juggernaut,Orcus", runner)
        self.assertIn("#perk-search", runner)
        self.assertIn("#perk-type-filter", runner)
        self.assertIn("#perk-speed-context", runner)
        self.assertIn("assertPerkMathTooltip", runner)
        self.assertIn("procs/min", runner)
        self.assertIn('!runic.classList.contains("perk-selected")', runner)
        self.assertIn('!params.has("perk")', runner)
        self.assertIn("runAscendSpec", runner)
        self.assertIn("/pages/systems/ascend.html", runner)
        self.assertIn('id: "ascend"', runner)
        self.assertIn(".ascend-compare-grid", runner)
        self.assertIn("Promotion Cost", runner)
        self.assertIn("runCraftSpec", runner)
        self.assertIn("/pages/systems/craft.html", runner)
        self.assertIn('id: "craft"', runner)
        self.assertIn(".craft-shop-grid", runner)
        self.assertIn("runImbuementsSpec", runner)
        self.assertIn("/pages/systems/imbuements.html", runner)
        self.assertIn('id: "imbuements"', runner)
        self.assertIn(".imbuement-flow", runner)
        self.assertIn("pages/enemies/monsters.html?monster=hell-spawn", runner)
        self.assertIn("runPurgeSpec", runner)
        self.assertIn("/pages/systems/purge.html", runner)
        self.assertIn('id: "purge"', runner)
        self.assertIn(".purge-compare-grid", runner)
        self.assertIn("pages/systems/corruption.html", runner)
        self.assertIn("runCorruptionSpec", runner)
        self.assertIn("/pages/systems/corruption.html", runner)
        self.assertIn('id: "corruption"', runner)
        self.assertIn(".corruption-compare-grid", runner)
        self.assertIn("pages/systems/purge.html", runner)
        self.assertIn("assertMobilePageFirstNavigation", runner)
        self.assertIn("Mobile navigation should start collapsed", runner)
        self.assertIn("[data-collapse-toggle]", runner)
        self.assertIn("runEncounterSpec", runner)
        self.assertIn("/pages/systems/encounter.html", runner)
        self.assertIn('id: "encounter"', runner)
        self.assertIn(".encounter-variant-grid", runner)
        self.assertIn("pages/systems/corruption.html", runner)
        self.assertIn("runPvpSpec", runner)
        self.assertIn("/pages/systems/pvp-system.html", runner)
        self.assertIn('id: "pvp"', runner)
        self.assertIn(".pvp-flow", runner)
        self.assertIn("pages/systems/anti-zerg.html", runner)
        self.assertIn("runAntiZergSpec", runner)
        self.assertIn("/pages/systems/anti-zerg.html", runner)
        self.assertIn('id: "anti-zerg"', runner)
        self.assertIn(".anti-zerg-calculator", runner)
        self.assertIn("assertAntiZergCalculator", runner)
        self.assertIn("runMonsterDamageReductionSpec", runner)
        self.assertIn("/pages/systems/monster-damage-reduction.html", runner)
        self.assertIn('id: "monster damage reduction"', runner)
        self.assertIn(".monster-dr-calculator", runner)
        self.assertIn("assertMonsterDamageReductionCalculator", runner)
        self.assertIn("[data-monster-input]", runner)
        self.assertIn("runExperienceSpec", runner)
        self.assertIn("/pages/systems/experience.html", runner)
        self.assertIn('id: "experience"', runner)
        self.assertIn(".experience-sim-widget", runner)
        self.assertIn("assertExperienceSimulator", runner)
        self.assertIn("[data-xp-run-tick]", runner)
        self.assertIn("runLevelSpec", runner)
        self.assertIn("/pages/stats/level.html", runner)
        self.assertIn('id: "level"', runner)
        self.assertIn(".level-chart-card", runner)
        self.assertIn("assertLevelCurve", runner)
        self.assertIn("[data-level-curve-level]", runner)
        self.assertIn("runSkillsSpec", runner)
        self.assertIn("/pages/stats/skills.html", runner)
        self.assertIn('id: "skills"', runner)
        self.assertIn(".skills-chart-card", runner)
        self.assertIn("assertSkillCurve", runner)
        self.assertIn("[data-skill-curve-level]", runner)
        self.assertIn("runRacesSpec", runner)
        self.assertIn("/pages/stats/races.html", runner)
        self.assertIn('id: "races"', runner)
        self.assertIn(".races-preview-widget", runner)
        self.assertIn("assertRacesPreview", runner)
        self.assertIn("[data-race-option", runner)
        self.assertIn("runStrengthSpec", runner)
        self.assertIn("/pages/stats/strength.html", runner)
        self.assertIn('id: "strength"', runner)
        self.assertIn(".strength-calculator-widget", runner)
        self.assertIn("assertStrengthCalculator", runner)
        self.assertIn("[data-strength-str-slider]", runner)
        self.assertIn("runConstitutionSpec", runner)
        self.assertIn("/pages/stats/constitution.html", runner)
        self.assertIn('id: "constitution"', runner)
        self.assertIn(".constitution-calculator-widget", runner)
        self.assertIn("assertConstitutionCalculator", runner)
        self.assertIn("[data-constitution-con-slider]", runner)
        self.assertIn("runDexteritySpec", runner)
        self.assertIn("/pages/stats/dexterity.html", runner)
        self.assertIn('id: "dexterity"', runner)
        self.assertIn(".dexterity-calculator-widget", runner)
        self.assertIn("assertDexterityCalculator", runner)
        self.assertIn("[data-dexterity-dex-slider]", runner)
        self.assertIn("runResistancesSpec", runner)
        self.assertIn("/pages/stats/resistances.html", runner)
        self.assertIn('id: "resistances"', runner)
        self.assertIn(".resistance-calculator-widget", runner)
        self.assertIn("assertResistanceCalculator", runner)
        self.assertIn("[data-resistance-value-slider]", runner)
        self.assertIn("assertResistanceNeutralToggle", runner)
        self.assertIn("runGuildSpec", runner)
        self.assertIn("/pages/systems/guild.html", runner)
        self.assertIn('id: "guild"', runner)
        self.assertIn(".guild-party-preview", runner)
        self.assertIn("assertGuildPartyPreview", runner)
        self.assertIn('[data-party-option="B"]', runner)
        self.assertIn("runChatSpec", runner)
        self.assertIn("/pages/systems/chat.html", runner)
        self.assertIn('id: "chat"', runner)
        self.assertIn(".chat-mode-preview", runner)
        self.assertIn("assertChatModePreview", runner)
        self.assertIn('[data-chat-mode="Global"]', runner)
        self.assertIn("runFloorCleanupSpec", runner)
        self.assertIn("/pages/systems/floor-cleanup.html", runner)
        self.assertIn('id: "floor cleanup"', runner)
        self.assertIn(".floor-cleanup-preview", runner)
        self.assertIn("assertFloorCleanupPreview", runner)
        self.assertIn('[data-cleanup-scenario="after"]', runner)
        self.assertIn("runCraftingSpec", runner)
        self.assertIn("/pages/systems/crafting.html", runner)
        self.assertIn('id: "crafting"', runner)
        self.assertIn("[data-set-option=\"black\"]", runner)
        self.assertIn("[data-materials-range]", runner)

    def test_smoke_specs_include_collectables_and_useables(self):
        from tools.codex_pipeline.config import REPO_ROOT

        runner = (REPO_ROOT / "tools" / "codex_pipeline" / "site_smoke.mjs").read_text(encoding="utf-8")

        for expected in [
            'detailName: "Ascendancy Shard"',
            'detailQuery: "54"',
            'duplicateRoute: { id: "37", detailName: "Wraithfire Shard" }',
            'detailTextIncludes: ["Item Context", "Used In", "Ascend System", "Found From", "Deconstruct System"]',
            'detailHrefIncludes: ["pages/systems/ascend.html", "pages/systems/deconstruct.html"]',
            'label: "collectables"',
            'detailName: "Carpentry Saw"',
            'detailQuery: "10"',
            'duplicateRoute: { id: "76", detailName: "Scroll of Imbuement" }',
            'detailTextIncludes: ["Item Context", "Used In", "Carpentry"]',
            'detailHrefIncludes: ["pages/stats/skills.html#carpentry"]',
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

    def test_node_runner_supports_impact_plan_routing_and_record_probes(self):
        from tools.codex_pipeline.config import REPO_ROOT

        runner = (REPO_ROOT / "tools" / "codex_pipeline" / "site_smoke.mjs").read_text(encoding="utf-8")

        for expected in [
            '"--impact-plan"',
            '"--results-path"',
            "loadImpactPlan",
            "validateImpactPlanCoverage",
            "selectImpactRecords",
            "DEFAULT_CHANGED_RECORD_PROBE_LIMIT",
            "browserProbePolicy?.changedRecordsPerTarget",
            "runImpactRecordSpec",
            "assertImpactSearchRecord",
            "assertImpactRecordImage",
            "assertImpactRelationshipLinks",
            "buildSmokeResults",
            "buildGroupResult",
            "buildRecordResult",
            "writeSmokeResults",
            "loadedImpactPlan?.reportDigest",
            'checkIds: ["build-planner"]',
            'checkIds: ["resistance-matchups"]',
            'checkIds: ["perk-sources"]',
        ]:
            self.assertIn(expected, runner)
