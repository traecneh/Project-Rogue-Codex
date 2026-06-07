import re
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tools.codex_pipeline.config import DROP_SOURCES_PATH


class SiteValidationTests(unittest.TestCase):
    def test_inline_style_parser_reports_unmatched_closing_brace(self):
        from tools.codex_pipeline.validators.site import validate_inline_styles

        html = "<html><head><style>.ok { color: red; } } .lost { color: blue; }</style></head></html>"
        issues = validate_inline_styles("broken-style.html", html)

        self.assertEqual(1, len(issues))
        self.assertIn("unexpected closing brace", issues[0].message)

    def test_monsters_table_wrapper_keeps_scroll_container_style(self):
        from tools.codex_pipeline.config import REPO_ROOT
        from tools.codex_pipeline.validators.site import validate_inline_styles

        html_path = REPO_ROOT / "pages" / "enemies" / "monsters.html"
        html = html_path.read_text(encoding="utf-8")
        issues = validate_inline_styles("pages/enemies/monsters.html", html)
        wrapper_match = re.search(r"\.monsters-table-wrapper\s*\{(?P<body>[^}]*)\}", html)

        self.assertEqual([], issues)
        self.assertIsNotNone(wrapper_match)
        wrapper_body = wrapper_match.group("body") if wrapper_match else ""
        self.assertIn("overflow: auto;", wrapper_body)
        self.assertIn("max-height: 70vh;", wrapper_body)

    def test_monsters_page_uses_external_page_script(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        html_path = REPO_ROOT / "pages" / "enemies" / "monsters.html"
        script_path = REPO_ROOT / "js" / "monsters-page.js"
        html = html_path.read_text(encoding="utf-8")
        inline_scripts = [
            script.strip()
            for script in re.findall(
                r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>",
                html,
                flags=re.IGNORECASE,
            )
            if script.strip()
        ]

        self.assertIn('<script src="js/monsters-page.js" defer></script>', html)
        self.assertTrue(script_path.is_file())
        self.assertIn(script_path, cli.VALIDATED_SCRIPT_PATHS)
        self.assertEqual([], inline_scripts)

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

    def test_corrupted_perk_validation_requires_unknown_overrides_for_unlabeled_codes(self):
        from tools.codex_pipeline.validators.site import validate_corrupted_perk_labels

        item_data = {
            "weapons": [
                {
                    "id": 1,
                    "name": "Grips of Winter",
                    "fields": {"corrupted_perk": 41},
                }
            ],
            "armors": [],
        }

        issues = validate_corrupted_perk_labels(item_data, corrupted_perk_overrides={})
        self.assertIn("unmapped corrupted perk code 41", "\n".join(issue.message for issue in issues))

        self.assertEqual(
            [],
            validate_corrupted_perk_labels(item_data, corrupted_perk_overrides={41: None}),
        )

    def test_corrupted_perk_validation_checks_explicit_label_overrides(self):
        from tools.codex_pipeline.validators.site import validate_corrupted_perk_labels

        item_data = {
            "weapons": [
                {
                    "id": 1,
                    "name": "Mapped Label",
                    "fields": {"corrupted_perk": 41, "corrupted_perk_label": "Wrong Label"},
                },
                {
                    "id": 2,
                    "name": "Known Unknown",
                    "fields": {"corrupted_perk": 24, "corrupted_perk_label": "Should Not Exist"},
                },
            ],
            "armors": [],
        }

        issues = validate_corrupted_perk_labels(
            item_data,
            corrupted_perk_overrides={41: "Mapped Frost Effect", 24: None},
        )

        messages = "\n".join(issue.message for issue in issues)
        self.assertIn("expected corrupted perk 41 label", messages)
        self.assertIn("configured as unknown but has label", messages)

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

    def test_cli_validates_configured_external_javascript_files(self):
        from tools.codex_pipeline import cli

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            weapons_data = root / "weapons.json"
            armors_data = root / "armors.json"
            monsters_data = root / "monsters.json"
            drop_sources = root / "drop_sources.json"
            html = root / "page.html"
            script = root / "broken.js"
            weapon_images = root / "weapons"
            armor_images = root / "armors"
            monster_images = root / "monsters"
            for folder in [weapon_images, armor_images, monster_images]:
                folder.mkdir()
                (folder / "manifest.json").write_text("[]", encoding="utf-8")

            weapons_data.write_text("[]", encoding="utf-8")
            armors_data.write_text("[]", encoding="utf-8")
            monsters_data.write_text("[]", encoding="utf-8")
            drop_sources.write_text('{"schemaVersion": 1, "armors": {}, "weapons": {}}', encoding="utf-8")
            html.write_text("<html><body><script>const ok = 1;</script></body></html>", encoding="utf-8")
            script.write_text("const broken = ;", encoding="utf-8")

            with (
                patch.object(cli, "DROP_SOURCES_PATH", drop_sources),
                patch.object(cli, "WEAPONS_DATA_PATH", weapons_data),
                patch.object(cli, "ARMORS_DATA_PATH", armors_data),
                patch.object(cli, "MONSTERS_DATA_PATH", monsters_data),
                patch.object(cli, "WEAPON_IMAGES_DIR", weapon_images),
                patch.object(cli, "ARMOR_IMAGES_DIR", armor_images),
                patch.object(cli, "MONSTER_IMAGES_DIR", monster_images),
                patch.object(cli, "VALIDATED_HTML_PATHS", [html]),
                patch.object(cli, "VALIDATED_SCRIPT_PATHS", [script]),
            ):
                issues = cli.collect_validation_issues()

        messages = "\n".join(issue.message for issue in issues)
        self.assertIn("broken.js failed parse", messages)
