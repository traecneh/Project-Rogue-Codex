import io
import json
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path
from unittest.mock import patch

from tools.codex_pipeline.exports import DataDiffReport, ExportTarget, FieldChange, RecordChange
from tools.codex_pipeline.assets import AssetChangeReport, AssetTarget
from tools.codex_pipeline.drop_audit import DropSourceAuditReport, DropSourceItemReport
from tools.codex_pipeline.sources import SourceCheckResult
from tools.codex_pipeline.unknowns import UnknownFieldReport, UnknownFieldTargetReport
from tools.codex_pipeline.validators.site import ValidationIssue


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data), encoding="utf-8")


def write_json_copy_extractor(path: Path) -> None:
    path.write_text(
        textwrap.dedent(
            """
            import json
            import sys
            from pathlib import Path

            source = Path(sys.argv[1])
            output = Path(sys.argv[2])
            output.write_text(json.dumps(json.loads(source.read_text(encoding="utf-8"))), encoding="utf-8")
            """
        ).strip()
        + "\n",
        encoding="utf-8",
    )


class GameUpdateReportTests(unittest.TestCase):
    def test_build_game_update_report_exports_and_summarizes_review_changes(self):
        from tools.codex_pipeline.game_update import build_game_update_report

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            output_dir = root / "generated"
            extractor = root / "extract_json.py"
            write_json_copy_extractor(extractor)
            client_assets = root / "client-assets" / "Weapons"
            site_assets = root / "site-assets" / "weapons"
            client_assets.mkdir(parents=True)
            site_assets.mkdir(parents=True)
            (client_assets / "Rune Sword.gif").write_bytes(b"new image")
            (site_assets / "Rune Sword.gif").write_bytes(b"old image")
            (client_assets / "New Sword.gif").write_bytes(b"same image")
            (site_assets / "New Sword.gif").write_bytes(b"same image")
            (site_assets / "manifest.json").write_text(
                json.dumps(
                    [
                        "images/weapons/New Sword.gif",
                        "images/weapons/Rune Sword.gif",
                    ]
                ),
                encoding="utf-8",
            )

            weapon_source = root / "sources" / "weapons.dat"
            armor_source = root / "sources" / "armors.dat"
            monster_source = root / "sources" / "monsters.dat"
            write_json(
                weapon_source,
                [
                    {"id": 1, "name": "Rune Sword", "fields": {"damage": 11, "unknown_9": 3}},
                    {"id": 3, "name": "New Sword", "fields": {"damage": 30}},
                ],
            )
            write_json(
                armor_source,
                [{"id": 1, "name": "Iceburst Amulet", "fields": {"armor": 2, "unknown_7": 5}}],
            )
            write_json(monster_source, [{"id": 1, "name": "Ice Devil", "fields": {"level": 20}}])

            weapon_site = root / "site" / "weapons.json"
            armor_site = root / "site" / "armors.json"
            monster_site = root / "site" / "monsters.json"
            write_json(
                weapon_site,
                [
                    {"id": 1, "name": "Rune Sword", "fields": {"damage": 10}},
                    {"id": 2, "name": "Old Sword", "fields": {"damage": 20}},
                ],
            )
            write_json(armor_site, [{"id": 1, "name": "Iceburst Amulet", "fields": {"armor": 2}}])
            write_json(monster_site, [{"id": 1, "name": "Ice Devil", "fields": {"level": 20}}])

            drop_sources = root / "drop_sources.json"
            perk_labels = root / "perk_labels.json"
            write_json(
                drop_sources,
                {
                    "schemaVersion": 1,
                    "armors": {"Iceburst Amulet": ["Ice Devil"]},
                    "weapons": {"Rune Sword": ["Ice Devil"]},
                },
            )
            write_json(perk_labels, {"schemaVersion": 1, "corruptedPerkLabels": {}})

            targets = [
                ExportTarget("weapons", extractor, weapon_source, "weapons.json", weapon_site),
                ExportTarget("armors", extractor, armor_source, "armors.json", armor_site),
                ExportTarget("monsters", extractor, monster_source, "monsters.json", monster_site),
            ]

            report = build_game_update_report(
                targets,
                output_dir=output_dir,
                python_executable=sys.executable,
                drop_sources_path=drop_sources,
                perk_label_overrides_path=perk_labels,
                asset_targets=[AssetTarget("weapons", client_assets, site_assets)],
            )

            self.assertFalse(report.has_errors)
            self.assertTrue(report.has_changes)
            self.assertFalse(report.safe_to_sync)
            self.assertEqual(["weapons", "armors", "monsters"], [result.target.name for result in report.export_results])
            self.assertTrue((output_dir / "weapons.json").is_file())

            weapon_diff = next(diff for diff in report.diff_reports if diff.target.name == "weapons")
            self.assertEqual(["New Sword (3)"], weapon_diff.added)
            self.assertEqual(["Old Sword (2)"], weapon_diff.removed)
            self.assertEqual("Rune Sword (1)", weapon_diff.changed[0].label)
            self.assertIn("fields.damage", [change.path for change in weapon_diff.changed[0].field_changes])

            weapon_unknowns = next(unknown for unknown in report.unknown_reports if unknown.target_name == "weapons")
            self.assertEqual(["unknown_9"], [field.name for field in weapon_unknowns.fields])
            self.assertEqual([], report.validation_issues)
            self.assertIsNotNone(report.drop_report)
            self.assertEqual(2, report.drop_report.item_override_count)
            self.assertEqual(["Rune Sword.gif"], report.asset_reports[0].changed)

    def test_build_game_update_report_warns_about_generated_data_image_mismatches(self):
        from tools.codex_pipeline.game_update import build_game_update_report

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            output_dir = root / "generated"
            extractor = root / "extract_json.py"
            write_json_copy_extractor(extractor)

            client_assets = root / "client-assets" / "Weapons"
            site_assets = root / "site-assets" / "weapons"
            client_assets.mkdir(parents=True)
            site_assets.mkdir(parents=True)
            for image_name in ["Rune Sword.gif", "Orphan Sword.png"]:
                (client_assets / image_name).write_bytes(b"same image")
                (site_assets / image_name).write_bytes(b"same image")
            (site_assets / "manifest.json").write_text(
                json.dumps(
                    [
                        "images/weapons/Orphan Sword.png",
                        "images/weapons/Rune Sword.gif",
                    ]
                ),
                encoding="utf-8",
            )

            weapon_source = root / "sources" / "weapons.dat"
            write_json(
                weapon_source,
                [
                    {"id": 1, "name": "Rune Sword", "fields": {}},
                    {"id": 2, "name": "Missing Sword", "fields": {}},
                ],
            )
            weapon_site = root / "site" / "weapons.json"
            write_json(weapon_site, [{"id": 1, "name": "Rune Sword", "fields": {}}])

            perk_labels = root / "perk_labels.json"
            write_json(perk_labels, {"schemaVersion": 1, "corruptedPerkLabels": {}})
            target = ExportTarget("weapons", extractor, weapon_source, "weapons.json", weapon_site)

            report = build_game_update_report(
                [target],
                output_dir=output_dir,
                python_executable=sys.executable,
                perk_label_overrides_path=perk_labels,
                asset_targets=[AssetTarget("weapons", client_assets, site_assets)],
            )

        messages = "\n".join(issue.message for issue in report.validation_issues)
        self.assertIn("weapons asset/data parity: data record has no matching image: Missing Sword", messages)
        self.assertIn("weapons asset/data parity: image has no matching data record: Orphan Sword.png", messages)
        self.assertFalse(report.has_errors)

    def test_build_game_update_report_stops_before_export_when_source_checks_fail(self):
        from tools.codex_pipeline.game_update import build_game_update_report

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            extractor = root / "extract.py"
            extractor.write_text("print('not used')\n", encoding="utf-8")
            site_path = root / "site" / "weapons.json"
            site_path.parent.mkdir()
            target = ExportTarget("weapons", extractor, root / "missing.dat", "weapons.json", site_path)

            report = build_game_update_report([target], output_dir=root / "generated")

        self.assertTrue(report.has_errors)
        self.assertFalse(report.safe_to_sync)
        self.assertEqual([], report.export_results)
        self.assertIn("source data not found", "\n".join(check.message for check in report.source_checks if not check.ok))

    def test_cli_prints_game_update_report_summary(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.game_update import GameUpdateReport

        report = GameUpdateReport(
            output_dir=Path("generated"),
            source_checks=[
                SourceCheckResult("weapons", "source data", Path("data05.dat"), True, "source data found"),
            ],
            export_results=[],
            diff_reports=[],
            unknown_reports=[
                UnknownFieldTargetReport(
                    target_name="weapons",
                    data_path=Path("generated/weapons.json"),
                    record_count=2,
                    fields=[
                        UnknownFieldReport("unknown_9", 1, 1, [3], ["Rune Sword=3"]),
                        UnknownFieldReport("unknown_10", 1, 0, [0], []),
                    ],
                )
            ],
            asset_reports=[
                AssetChangeReport(
                    target_name="weapons",
                    client_dir=Path("client/Weapons"),
                    site_dir=Path("images/weapons"),
                    client_count=2,
                    site_count=2,
                    manifest_count=2,
                    added=[],
                    removed=[],
                    changed=["Rune Sword.gif"],
                    issues=[],
                )
            ],
            drop_report=DropSourceAuditReport(
                drop_sources_path=Path("drop_sources.json"),
                item_overrides=[DropSourceItemReport("weapons", "Rune Sword", ["Ice Devil"])],
                monster_loot=[],
                validation_issues=[],
            ),
            validation_issues=[ValidationIssue("warning", "sample warning")],
            export_errors=[],
            skipped_sections=["drop report requires generated weapons, armors, and monsters"],
        )
        output = io.StringIO()
        with (
            patch.object(cli, "resolve_targets", return_value=[]),
            patch.object(cli, "build_game_update_report", return_value=report),
            patch("sys.stdout", output),
        ):
            exit_code = cli.main(["game-update-report"])

        self.assertEqual(0, exit_code)
        printed = output.getvalue()
        self.assertIn("GAME UPDATE REPORT: generated", printed)
        self.assertIn("SOURCE OK weapons source data: source data found", printed)
        self.assertIn("UNKNOWN SUMMARY weapons: 2 field(s), 1 with nonzero values", printed)
        self.assertIn("ASSET SUMMARY weapons: +0 -0 ~1, manifest entries=2, issues=0", printed)
        self.assertIn("DROP SUMMARY: 1 item override(s), 0 monster loot view(s), 0 issue(s)", printed)
        self.assertIn("UPDATE ISSUE WARNING: sample warning", printed)
        self.assertIn("SKIPPED: drop report requires generated weapons, armors, and monsters", printed)
        self.assertIn("SYNC READINESS: BLOCKED", printed)

    def test_cli_prints_player_facing_game_update_summary(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.game_update import GameUpdateReport

        weapon_target = ExportTarget(
            "weapons",
            Path("extract_weapons.py"),
            Path("data05.dat"),
            "weapons.json",
            Path("site/weapons.json"),
        )
        armor_target = ExportTarget(
            "armors",
            Path("extract_armors.py"),
            Path("data06.dat"),
            "armors.json",
            Path("site/armors.json"),
        )
        report = GameUpdateReport(
            output_dir=Path("generated"),
            source_checks=[],
            export_results=[],
            diff_reports=[
                DataDiffReport(
                    target=weapon_target,
                    generated_path=Path("generated/weapons.json"),
                    site_path=Path("site/weapons.json"),
                    added=["New Sword (3)"],
                    removed=["Old Sword (2)"],
                    changed=[
                        RecordChange(
                            key="id:1",
                            label="Rune Sword (1)",
                            field_changes=[
                                FieldChange("fields.damage", 10, 11),
                                FieldChange("fields.speed", 1250, 1000),
                            ],
                        )
                    ],
                ),
                DataDiffReport(
                    target=armor_target,
                    generated_path=Path("generated/armors.json"),
                    site_path=Path("site/armors.json"),
                    added=[],
                    removed=[],
                    changed=[
                        RecordChange(
                            key="id:7",
                            label="Iceburst Amulet (7)",
                            field_changes=[FieldChange("fields.armor", 4, 5)],
                        )
                    ],
                ),
            ],
            unknown_reports=[],
            asset_reports=[
                AssetChangeReport(
                    target_name="weapons",
                    client_dir=Path("client/Weapons"),
                    site_dir=Path("images/weapons"),
                    client_count=3,
                    site_count=3,
                    manifest_count=3,
                    added=["New Sword.gif"],
                    removed=["Old Sword.gif"],
                    changed=["Rune Sword.gif"],
                    issues=[],
                )
            ],
            drop_report=None,
            validation_issues=[],
            export_errors=[],
            skipped_sections=[],
        )
        output = io.StringIO()
        with (
            patch.object(cli, "resolve_targets", return_value=[]),
            patch.object(cli, "build_game_update_report", return_value=report),
            patch("sys.stdout", output),
        ):
            exit_code = cli.main(["game-update-report"])

        self.assertEqual(0, exit_code)
        printed = output.getvalue()
        self.assertIn("PLAYER CHANGE SUMMARY: data +1 -1 ~2, images +1 -1 ~1", printed)
        self.assertIn("PLAYER DATA weapons: +1 -1 ~1", printed)
        self.assertIn("  added: New Sword (3)", printed)
        self.assertIn("  removed: Old Sword (2)", printed)
        self.assertIn("  changed: Rune Sword (1): fields.damage, fields.speed", printed)
        self.assertIn("PLAYER DATA armors: +0 -0 ~1", printed)
        self.assertIn("  changed: Iceburst Amulet (7): fields.armor", printed)
        self.assertIn("PLAYER IMAGES weapons: +1 -1 ~1", printed)
        self.assertIn("  added: New Sword.gif", printed)
        self.assertIn("  removed: Old Sword.gif", printed)
        self.assertIn("  changed: Rune Sword.gif", printed)

    def test_cli_can_write_game_update_markdown_summary_artifact(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.game_update import GameUpdateReport

        weapon_target = ExportTarget(
            "weapons",
            Path("extract_weapons.py"),
            Path("data05.dat"),
            "weapons.json",
            Path("site/weapons.json"),
        )
        with tempfile.TemporaryDirectory() as tmp:
            output_dir = Path(tmp) / "generated"
            report = GameUpdateReport(
                output_dir=output_dir,
                source_checks=[],
                export_results=[],
                diff_reports=[
                    DataDiffReport(
                        target=weapon_target,
                        generated_path=output_dir / "weapons.json",
                        site_path=Path("site/weapons.json"),
                        added=["New Sword (3)"],
                        removed=[],
                        changed=[
                            RecordChange(
                                key="id:1",
                                label="Rune Sword (1)",
                                field_changes=[FieldChange("fields.damage", 10, 11)],
                            )
                        ],
                    )
                ],
                unknown_reports=[],
                asset_reports=[
                    AssetChangeReport(
                        target_name="weapons",
                        client_dir=Path("client/Weapons"),
                        site_dir=Path("images/weapons"),
                        client_count=2,
                        site_count=2,
                        manifest_count=2,
                        added=[],
                        removed=[],
                        changed=["Rune Sword.gif"],
                        issues=[],
                    )
                ],
                drop_report=None,
                validation_issues=[ValidationIssue("warning", "sample warning")],
                export_errors=[],
                skipped_sections=[],
            )
            output = io.StringIO()
            with (
                patch.object(cli, "resolve_targets", return_value=[]),
                patch.object(cli, "build_game_update_report", return_value=report),
                patch("sys.stdout", output),
            ):
                exit_code = cli.main(["game-update-report", "--write-summary", "--output-dir", str(output_dir)])

            summary_path = output_dir / "game_update_summary.md"
            self.assertEqual(0, exit_code)
            self.assertTrue(summary_path.is_file())
            printed = output.getvalue()
            self.assertIn(f"WROTE SUMMARY: {summary_path}", printed)
            markdown = summary_path.read_text(encoding="utf-8")
            self.assertIn("# Project Rogue Codex Game Update Summary", markdown)
            self.assertIn("- Data: +1 -0 ~1", markdown)
            self.assertIn("- Images: +0 -0 ~1", markdown)
            self.assertIn("## Data Changes", markdown)
            self.assertIn("### Weapons", markdown)
            self.assertIn("- Added: New Sword (3)", markdown)
            self.assertIn("- Changed: Rune Sword (1): fields.damage", markdown)
            self.assertIn("## Image Changes", markdown)
            self.assertIn("- Changed: Rune Sword.gif", markdown)
            self.assertIn("## Review Notes", markdown)
            self.assertIn("- WARNING: sample warning", markdown)
