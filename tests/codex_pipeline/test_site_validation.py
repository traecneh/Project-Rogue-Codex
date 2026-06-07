import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tools.codex_pipeline.config import DROP_SOURCES_PATH


class SiteValidationTests(unittest.TestCase):
    def test_manifest_self_reference_is_an_error(self):
        from tools.codex_pipeline.validators.site import validate_manifest_entries

        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            (folder / "Axe.gif").write_bytes(b"gif")
            issues = validate_manifest_entries(folder, ["images/weapons/Axe.gif", "images/weapons/manifest.json"])

        self.assertIn("manifest includes itself", "\n".join(issue.message for issue in issues))

    def test_drop_overrides_reference_existing_data(self):
        from tools.codex_pipeline.validators.site import validate_drop_references
        from tools.codex_pipeline.drops import load_drop_sources

        sources = load_drop_sources(DROP_SOURCES_PATH)
        issues = validate_drop_references(
            sources,
            armor_names={
                "Iceburst Amulet",
                "Mystic Robe",
                "Rune Armor",
                "Rune Lord's Robe",
                "Rune Helmet",
                "Rune Shield",
                "Rune Leggings",
                "Rune Gauntlets",
                "Banished Gauntlets",
                "Banished Shield",
                "Banished Platemail",
                "Banished Helmet",
                "Banished Leggings",
            },
            weapon_names={"Rune Sword", "Vengeance Hammer"},
            monster_names={
                "Ice Devil",
                "Greater Yeti",
                "Dark Monk",
                "Hell Spawn",
                "Werewolf",
                "Demon",
                "Infernal",
                "Banished Spirit",
                "Banished Soldier",
                "Rune Warrior",
                "Balron",
                "Demon Lord",
                "Banished Knight",
                "Banished Warden",
            },
        )

        self.assertEqual([], issues)

    def test_drop_overrides_report_missing_item_and_monster(self):
        from tools.codex_pipeline.validators.site import validate_drop_references

        issues = validate_drop_references(
            {"armors": {"Unknown Amulet": ["Unknown Monster"]}, "weapons": {}},
            armor_names={"Iceburst Amulet"},
            weapon_names={"Rune Sword"},
            monster_names={"Ice Devil"},
        )

        messages = "\n".join(issue.message for issue in issues)
        self.assertIn("armors drop override item not found: Unknown Amulet", messages)
        self.assertIn("armors drop override monster not found: Unknown Monster", messages)

    def test_inline_script_parser_reports_syntax_errors(self):
        from tools.codex_pipeline.validators.site import validate_inline_scripts

        html = "<html><body><script>const x = ;</script></body></html>"
        issues = validate_inline_scripts("broken.html", html)

        self.assertEqual(len(issues), 1)
        self.assertIn("broken.html inline script #1", issues[0].message)

    def test_inline_script_parser_reports_missing_node(self):
        from tools.codex_pipeline.validators.site import validate_inline_scripts

        html = "<html><body><script>const x = 1;</script></body></html>"
        with patch("tools.codex_pipeline.validators.site.subprocess.run", side_effect=FileNotFoundError):
            issues = validate_inline_scripts("missing-node.html", html)

        self.assertEqual(len(issues), 1)
        self.assertIn("node executable not found", issues[0].message)

    def test_inline_script_parser_handles_empty_node_error_output(self):
        from subprocess import CompletedProcess

        from tools.codex_pipeline.validators.site import validate_inline_scripts

        html = "<html><body><script>const x = 1;</script></body></html>"
        completed = CompletedProcess(args=["node"], returncode=1, stdout="", stderr="")
        with patch("tools.codex_pipeline.validators.site.subprocess.run", return_value=completed):
            issues = validate_inline_scripts("quiet-node.html", html)

        self.assertEqual(len(issues), 1)
        self.assertIn("node --check returned no output", issues[0].message)

    def test_cli_reports_missing_and_malformed_inputs_as_errors(self):
        from tools.codex_pipeline import cli

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            weapons_data = root / "weapons.json"
            armors_data = root / "armors.json"
            monsters_data = root / "missing_monsters.json"
            drop_sources = root / "drop_sources.json"
            html = root / "missing.html"
            weapon_images = root / "weapons"
            armor_images = root / "armors"
            monster_images = root / "monsters"
            for folder in [weapon_images, armor_images, monster_images]:
                folder.mkdir()

            weapons_data.write_text("not json", encoding="utf-8")
            armors_data.write_text("[]", encoding="utf-8")
            drop_sources.write_text('{"schemaVersion": 1, "armors": {}, "weapons": {}}', encoding="utf-8")
            (weapon_images / "manifest.json").write_text('"not a list"', encoding="utf-8")
            (armor_images / "manifest.json").write_text("[", encoding="utf-8")

            with (
                patch.object(cli, "DROP_SOURCES_PATH", drop_sources),
                patch.object(cli, "WEAPONS_DATA_PATH", weapons_data),
                patch.object(cli, "ARMORS_DATA_PATH", armors_data),
                patch.object(cli, "MONSTERS_DATA_PATH", monsters_data),
                patch.object(cli, "WEAPON_IMAGES_DIR", weapon_images),
                patch.object(cli, "ARMOR_IMAGES_DIR", armor_images),
                patch.object(cli, "MONSTER_IMAGES_DIR", monster_images),
                patch.object(cli, "VALIDATED_HTML_PATHS", [html]),
            ):
                issues = cli.collect_validation_issues()

        messages = "\n".join(issue.message for issue in issues)
        self.assertIn("failed to read data JSON", messages)
        self.assertIn("missing_monsters.json", messages)
        self.assertIn("manifest must be a list", messages)
        self.assertIn("failed to read manifest", messages)
        self.assertIn("failed to read HTML", messages)
