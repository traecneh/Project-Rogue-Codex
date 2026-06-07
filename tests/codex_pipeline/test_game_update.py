import io
import json
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path
from unittest.mock import patch

from tools.codex_pipeline.exports import ExportTarget
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
            )

            self.assertFalse(report.has_errors)
            self.assertTrue(report.has_changes)
            self.assertTrue(report.safe_to_sync)
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
        self.assertIn("DROP SUMMARY: 1 item override(s), 0 monster loot view(s), 0 issue(s)", printed)
        self.assertIn("UPDATE ISSUE WARNING: sample warning", printed)
        self.assertIn("SKIPPED: drop report requires generated weapons, armors, and monsters", printed)
        self.assertIn("SYNC READINESS: OK", printed)
