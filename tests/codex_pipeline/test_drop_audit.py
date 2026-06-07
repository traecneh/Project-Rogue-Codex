import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data), encoding="utf-8")


class DropSourceAuditTests(unittest.TestCase):
    def test_build_drop_source_audit_report_summarizes_item_and_monster_views(self):
        from tools.codex_pipeline.drop_audit import build_drop_source_audit_report

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            drop_sources = root / "drop_sources.json"
            armors = root / "armors.json"
            weapons = root / "weapons.json"
            monsters = root / "monsters.json"
            write_json(
                drop_sources,
                {
                    "schemaVersion": 1,
                    "armors": {
                        "Iceburst Amulet": ["Ice Devil", "Greater Yeti"],
                        "Rune Armor": ["Balron"],
                    },
                    "weapons": {"Rune Sword": ["Balron", "Demon Lord"]},
                },
            )
            write_json(armors, [{"name": "Iceburst Amulet"}, {"name": "Rune Armor"}])
            write_json(weapons, [{"name": "Rune Sword"}])
            write_json(monsters, [{"name": "Ice Devil"}, {"name": "Greater Yeti"}, {"name": "Balron"}, {"name": "Demon Lord"}])

            report = build_drop_source_audit_report(
                drop_sources_path=drop_sources,
                armor_data_path=armors,
                weapon_data_path=weapons,
                monster_data_path=monsters,
            )

        self.assertEqual(3, report.item_override_count)
        self.assertEqual(4, report.monster_count)
        self.assertEqual([], report.validation_issues)
        self.assertEqual(
            [
                ("armors", "Iceburst Amulet", ["Ice Devil", "Greater Yeti"]),
                ("armors", "Rune Armor", ["Balron"]),
                ("weapons", "Rune Sword", ["Balron", "Demon Lord"]),
            ],
            [(item.kind, item.item_name, item.monster_names) for item in report.item_overrides],
        )

        monster_rows = {
            monster.monster_name: (monster.monster_slug, monster.armors, monster.weapons)
            for monster in report.monster_loot
        }
        self.assertEqual(("balron", ["Rune Armor"], ["Rune Sword"]), monster_rows["Balron"])
        self.assertEqual(("demon-lord", [], ["Rune Sword"]), monster_rows["Demon Lord"])
        self.assertEqual(("greater-yeti", ["Iceburst Amulet"], []), monster_rows["Greater Yeti"])
        self.assertEqual(("ice-devil", ["Iceburst Amulet"], []), monster_rows["Ice Devil"])

    def test_build_drop_source_audit_report_includes_validation_issues(self):
        from tools.codex_pipeline.drop_audit import build_drop_source_audit_report

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            drop_sources = root / "drop_sources.json"
            armors = root / "armors.json"
            weapons = root / "weapons.json"
            monsters = root / "monsters.json"
            write_json(
                drop_sources,
                {
                    "schemaVersion": 1,
                    "armors": {"Unknown Amulet": ["Missing Monster"]},
                    "weapons": {},
                },
            )
            write_json(armors, [{"name": "Iceburst Amulet"}])
            write_json(weapons, [{"name": "Rune Sword"}])
            write_json(monsters, [{"name": "Ice Devil"}])

            report = build_drop_source_audit_report(
                drop_sources_path=drop_sources,
                armor_data_path=armors,
                weapon_data_path=weapons,
                monster_data_path=monsters,
            )

        messages = "\n".join(issue.message for issue in report.validation_issues)
        self.assertIn("armors drop override item not found: Unknown Amulet", messages)
        self.assertIn("armors drop override monster not found: Missing Monster", messages)

    def test_cli_prints_drop_report(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.drop_audit import (
            DropSourceAuditReport,
            DropSourceItemReport,
            DropSourceMonsterReport,
        )

        report = DropSourceAuditReport(
            drop_sources_path=Path("drop_sources.json"),
            item_overrides=[
                DropSourceItemReport("armors", "Iceburst Amulet", ["Ice Devil", "Greater Yeti"]),
                DropSourceItemReport("weapons", "Rune Sword", ["Balron"]),
            ],
            monster_loot=[
                DropSourceMonsterReport("Balron", "balron", [], ["Rune Sword"]),
                DropSourceMonsterReport("Ice Devil", "ice-devil", ["Iceburst Amulet"], []),
            ],
            validation_issues=[],
        )
        output = io.StringIO()
        with (
            patch.object(cli, "build_drop_source_audit_report", return_value=report),
            patch("sys.stdout", output),
        ):
            exit_code = cli.main(["drop-report"])

        self.assertEqual(0, exit_code)
        printed = output.getvalue()
        self.assertIn("DROP SOURCES: 2 item override(s), 2 monster loot view(s)", printed)
        self.assertIn("DROP VALIDATION: 0 issue(s)", printed)
        self.assertIn("ITEM armors Iceburst Amulet: Ice Devil, Greater Yeti", printed)
        self.assertIn("MONSTER Balron [balron]: weapons=Rune Sword", printed)
