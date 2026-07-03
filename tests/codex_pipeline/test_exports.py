import json
import os
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path
from unittest.mock import patch

from tools.codex_pipeline.exports import (
    ExportTarget,
    build_generated_diff_report,
    export_client_data,
    resolve_targets,
    sync_generated_outputs,
)


class ExportCommandTests(unittest.TestCase):
    def test_resolve_targets_defaults_to_site_data_exports(self):
        targets = resolve_targets()
        self.assertEqual([target.name for target in targets], ["monsters", "weapons", "armors"])

    def test_export_client_data_writes_generated_output_not_site_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            script = root / "extract_fake.py"
            source = root / "source.dat"
            site_path = root / "site" / "fake.json"
            output_dir = root / "generated"
            source.write_bytes(b"fake source")
            script.write_text(
                textwrap.dedent(
                    """
                    import json
                    import sys
                    from pathlib import Path

                    source = Path(sys.argv[1])
                    output = Path(sys.argv[2])
                    output.write_text(json.dumps([{"name": source.name}]), encoding="utf-8")
                    """
                ).strip()
                + "\n",
                encoding="utf-8",
            )
            target = ExportTarget(
                name="fake",
                extractor_script=script,
                source_data=source,
                output_filename="fake.json",
                site_path=site_path,
            )

            results = export_client_data([target], output_dir=output_dir, python_executable=sys.executable)

            self.assertEqual(output_dir / "fake.json", results[0].generated_path)
            self.assertTrue((output_dir / "fake.json").is_file())
            self.assertFalse(site_path.exists())
            data = json.loads((output_dir / "fake.json").read_text(encoding="utf-8"))
            self.assertEqual([{"name": "source.dat"}], data)

    def test_export_client_data_resolves_relative_output_dir_before_subprocess(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            script_dir = root / "scripts"
            data_dir = root / "data"
            script_dir.mkdir()
            data_dir.mkdir()
            script = script_dir / "extract_fake.py"
            source = data_dir / "source.dat"
            site_path = root / "site" / "fake.json"
            source.write_bytes(b"fake source")
            script.write_text(
                textwrap.dedent(
                    """
                    import json
                    import sys
                    from pathlib import Path

                    source = Path(sys.argv[1])
                    output = Path(sys.argv[2])
                    output.write_text(json.dumps([{"name": source.name}]), encoding="utf-8")
                    """
                ).strip()
                + "\n",
                encoding="utf-8",
            )
            target = ExportTarget(
                name="fake",
                extractor_script=script,
                source_data=source,
                output_filename="fake.json",
                site_path=site_path,
            )

            previous_cwd = Path.cwd()
            try:
                os.chdir(root)
                results = export_client_data([target], output_dir=Path("generated"), python_executable=sys.executable)
            finally:
                os.chdir(previous_cwd)

            self.assertEqual(root / "generated" / "fake.json", results[0].generated_path)
            self.assertTrue((root / "generated" / "fake.json").is_file())
            self.assertFalse((script_dir / "generated" / "fake.json").exists())

    def test_export_client_data_uses_packed_vpack_json_when_legacy_source_is_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            script = root / "extract_weapons.py"
            source = root / "data" / "data05.dat"
            vpack = root / "data" / "ClientPack" / "rogue_data.vpack"
            site_path = root / "site" / "weapons.json"
            output_dir = root / "generated"
            script.write_text("raise SystemExit('legacy extractor should not run')\n", encoding="utf-8")
            vpack.parent.mkdir(parents=True)
            vpack.write_bytes(b"VPACK placeholder")
            site_path.parent.mkdir()
            site_path.write_text(
                json.dumps([{"id": 200, "name": "Short Sword", "fields": {"weight": 1}}]),
                encoding="utf-8",
            )
            packed_files = {
                "weapons.json": {
                    "weapons": [
                        {
                            "type": 1,
                            "items": [
                                {
                                    "id": 0,
                                    "name": "Short Sword",
                                    "dam_min": 1,
                                    "dam_max": 9,
                                    "value": 400,
                                    "speed": 1000,
                                    "use_req_amnt": 0,
                                    "use_req_type": 0,
                                    "subtype": 1,
                                    "level": 5,
                                    "elemental_damage_type": 0,
                                    "elemental_damage_max": 0,
                                    "maximum_rarity": 0,
                                    "shards_deconstruction": 0,
                                    "shards_promotion": 0,
                                    "innate_special_effect": 0,
                                    "frames": [],
                                }
                            ],
                        }
                    ]
                }
            }
            target = ExportTarget(
                name="weapons",
                extractor_script=script,
                source_data=source,
                output_filename="weapons.json",
                site_path=site_path,
            )

            with patch("tools.codex_pipeline.exports.read_packed_json_files", return_value=packed_files):
                results = export_client_data([target], output_dir=output_dir, python_executable=sys.executable)

            self.assertIn("mapped packed VPACK JSON source", results[0].stdout)
            exported = json.loads((output_dir / "weapons.json").read_text(encoding="utf-8"))
            self.assertEqual(200, exported[0]["id"])
            self.assertEqual("Short Sword", exported[0]["name"])
            self.assertEqual(1, exported[0]["fields"]["min_damage"])
            self.assertEqual(9, exported[0]["fields"]["max_damage"])
            self.assertEqual(400, exported[0]["fields"]["value"])
            self.assertEqual(1, exported[0]["fields"]["weight"])

    def test_sync_generated_outputs_copies_generated_json_to_site_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            output_dir = root / "generated"
            generated = output_dir / "fake.json"
            site_path = root / "site" / "fake.json"
            output_dir.mkdir()
            generated.write_text('[{"name": "Generated"}]', encoding="utf-8")
            target = ExportTarget(
                name="fake",
                extractor_script=root / "unused.py",
                source_data=root / "unused.dat",
                output_filename="fake.json",
                site_path=site_path,
            )

            results = sync_generated_outputs([target], output_dir=output_dir)

            self.assertTrue(results[0].changed)
            self.assertEqual(generated.read_text(encoding="utf-8"), site_path.read_text(encoding="utf-8"))

    def test_sync_generated_outputs_dry_run_does_not_copy(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            output_dir = root / "generated"
            generated = output_dir / "fake.json"
            site_path = root / "site" / "fake.json"
            output_dir.mkdir()
            generated.write_text('[{"name": "Generated"}]', encoding="utf-8")
            target = ExportTarget(
                name="fake",
                extractor_script=root / "unused.py",
                source_data=root / "unused.dat",
                output_filename="fake.json",
                site_path=site_path,
            )

            results = sync_generated_outputs([target], output_dir=output_dir, dry_run=True)

            self.assertTrue(results[0].changed)
            self.assertFalse(site_path.exists())

    def test_sync_generated_outputs_ignores_formatting_only_differences(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            output_dir = root / "generated"
            generated = output_dir / "fake.json"
            site_path = root / "site" / "fake.json"
            output_dir.mkdir()
            site_path.parent.mkdir()
            data = [{"id": 1, "name": "Same", "fields": {"level": 10}}]
            generated.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
            site_path.write_text(json.dumps(data, indent=2), encoding="utf-8", newline="\n")
            target = ExportTarget(
                name="fake",
                extractor_script=root / "unused.py",
                source_data=root / "unused.dat",
                output_filename="fake.json",
                site_path=site_path,
            )

            results = sync_generated_outputs([target], output_dir=output_dir, dry_run=True)

            self.assertFalse(results[0].changed)
            self.assertEqual(site_path.read_bytes(), generated.read_bytes())

    def test_sync_generated_outputs_ignores_key_order_only_differences(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            output_dir = root / "generated"
            generated = output_dir / "fake.json"
            site_path = root / "site" / "fake.json"
            output_dir.mkdir()
            site_path.parent.mkdir()
            generated.write_text(
                json.dumps(
                    [
                        {
                            "fields": {"level": 10, "damage": 3},
                            "name": "Same",
                            "id": 1,
                        }
                    ],
                    indent=2,
                ),
                encoding="utf-8",
                newline="\n",
            )
            site_path.write_text(
                json.dumps(
                    [
                        {
                            "id": 1,
                            "name": "Same",
                            "fields": {"damage": 3, "level": 10},
                        }
                    ],
                    indent=2,
                ),
                encoding="utf-8",
                newline="\n",
            )
            target = ExportTarget(
                name="fake",
                extractor_script=root / "unused.py",
                source_data=root / "unused.dat",
                output_filename="fake.json",
                site_path=site_path,
            )

            results = sync_generated_outputs([target], output_dir=output_dir, dry_run=True)

            self.assertFalse(results[0].changed)

    def test_export_client_data_normalizes_audited_armor_unknown_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            script = root / "extract_armors.py"
            source = root / "source.dat"
            site_path = root / "site" / "armors.json"
            output_dir = root / "generated"
            source.write_bytes(b"fake source")
            site_path.parent.mkdir()
            site_path.write_text(
                json.dumps(
                    [
                        {
                            "id": 1,
                            "name": "Chainmail",
                            "fields": {"unknown_26": 0, "unknown_27": 0, "armor": 5},
                        }
                    ]
                ),
                encoding="utf-8",
            )
            script.write_text(
                textwrap.dedent(
                    """
                    import json
                    import sys
                    from pathlib import Path

                    output = Path(sys.argv[2])
                    output.write_text(json.dumps([
                        {
                            "id": 1,
                            "name": "Chainmail",
                            "fields": {
                                "unknown_26": 55,
                                "unknown_27": 5,
                                "unknown_29": 0,
                                "armor": 5,
                                "corrupted_perk": 6
                            }
                        },
                        {
                            "id": 2,
                            "name": "Generated Only",
                            "fields": {
                                "unknown_26": 55,
                                "unknown_27": 5,
                                "unknown_29": 0,
                                "armor": 10
                            }
                        }
                    ]), encoding="utf-8")
                    """
                ).strip()
                + "\n",
                encoding="utf-8",
            )
            target = ExportTarget(
                name="armors",
                extractor_script=script,
                source_data=source,
                output_filename="armors.json",
                site_path=site_path,
            )

            export_client_data([target], output_dir=output_dir, python_executable=sys.executable)

            exported = json.loads((output_dir / "armors.json").read_text(encoding="utf-8"))
            self.assertEqual(0, exported[0]["fields"]["unknown_26"])
            self.assertEqual(0, exported[0]["fields"]["unknown_27"])
            self.assertNotIn("unknown_29", exported[0]["fields"])
            self.assertEqual(6, exported[0]["fields"]["corrupted_perk"])
            self.assertNotIn("unknown_26", exported[1]["fields"])
            self.assertNotIn("unknown_27", exported[1]["fields"])
            self.assertNotIn("unknown_29", exported[1]["fields"])

    def test_sync_generated_outputs_normalizes_audited_armor_unknown_fields_before_copying(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            output_dir = root / "generated"
            generated = output_dir / "armors.json"
            site_path = root / "site" / "armors.json"
            output_dir.mkdir()
            site_path.parent.mkdir()
            site_path.write_text(
                json.dumps(
                    [
                        {
                            "id": 1,
                            "name": "Chainmail",
                            "fields": {"unknown_26": 0, "unknown_27": 0, "armor": 5},
                        }
                    ]
                ),
                encoding="utf-8",
            )
            generated.write_text(
                json.dumps(
                    [
                        {
                            "id": 1,
                            "name": "Chainmail",
                            "fields": {
                                "unknown_26": 55,
                                "unknown_27": 5,
                                "unknown_29": 0,
                                "armor": 5,
                                "corrupted_perk": 6,
                            },
                        }
                    ]
                ),
                encoding="utf-8",
            )
            target = ExportTarget(
                name="armors",
                extractor_script=root / "unused.py",
                source_data=root / "unused.dat",
                output_filename="armors.json",
                site_path=site_path,
            )

            sync_generated_outputs([target], output_dir=output_dir)

            synced = json.loads(site_path.read_text(encoding="utf-8"))
            self.assertEqual(0, synced[0]["fields"]["unknown_26"])
            self.assertEqual(0, synced[0]["fields"]["unknown_27"])
            self.assertNotIn("unknown_29", synced[0]["fields"])
            self.assertEqual(6, synced[0]["fields"]["corrupted_perk"])
            self.assertNotIn(b"\r\n", generated.read_bytes())
            self.assertNotIn(b"\r\n", site_path.read_bytes())

    def test_export_client_data_removes_untrusted_corrupted_perk_labels(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            script = root / "extract_weapons.py"
            source = root / "source.dat"
            site_path = root / "site" / "weapons.json"
            output_dir = root / "generated"
            source.write_bytes(b"fake source")
            script.write_text(
                textwrap.dedent(
                    """
                    import json
                    import sys
                    from pathlib import Path

                    output = Path(sys.argv[2])
                    output.write_text(json.dumps([
                        {
                            "id": 1,
                            "name": "Fallback Label",
                            "fields": {
                                "perk": 22,
                                "perk_label": "Frozen Heart (Tier 1)",
                                "corrupted_perk": 41,
                                "corrupted_perk_label": "Frozen Heart (Tier 1)"
                            }
                        },
                        {
                            "id": 2,
                            "name": "Derived Label",
                            "fields": {
                                "perk": 101,
                                "perk_label": "Vengeance (Tier 1)",
                                "corrupted_perk": 357,
                                "corrupted_perk_label": "Vengeance (Tier 2)"
                            }
                        }
                    ]), encoding="utf-8")
                    """
                ).strip()
                + "\n",
                encoding="utf-8",
            )
            target = ExportTarget(
                name="weapons",
                extractor_script=script,
                source_data=source,
                output_filename="weapons.json",
                site_path=site_path,
            )

            export_client_data([target], output_dir=output_dir, python_executable=sys.executable)

            exported = json.loads((output_dir / "weapons.json").read_text(encoding="utf-8"))
            self.assertNotIn("corrupted_perk_label", exported[0]["fields"])
            self.assertEqual(41, exported[0]["fields"]["corrupted_perk"])
            self.assertEqual("Vengeance (Tier 2)", exported[1]["fields"]["corrupted_perk_label"])

    def test_export_client_data_applies_explicit_corrupted_perk_label_overrides(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            script = root / "extract_weapons.py"
            source = root / "source.dat"
            site_path = root / "site" / "weapons.json"
            output_dir = root / "generated"
            override_path = root / "perk_labels.json"
            source.write_bytes(b"fake source")
            override_path.write_text(
                json.dumps({"schemaVersion": 1, "corruptedPerkLabels": {"41": "Mapped Frost Effect"}}),
                encoding="utf-8",
            )
            script.write_text(
                textwrap.dedent(
                    """
                    import json
                    import sys
                    from pathlib import Path

                    output = Path(sys.argv[2])
                    output.write_text(json.dumps([
                        {
                            "id": 1,
                            "name": "Mapped Label",
                            "fields": {
                                "perk": 22,
                                "perk_label": "Frozen Heart (Tier 1)",
                                "corrupted_perk": 41,
                                "corrupted_perk_label": "Frozen Heart (Tier 1)"
                            }
                        }
                    ]), encoding="utf-8")
                    """
                ).strip()
                + "\n",
                encoding="utf-8",
            )
            target = ExportTarget(
                name="weapons",
                extractor_script=script,
                source_data=source,
                output_filename="weapons.json",
                site_path=site_path,
            )

            with patch("tools.codex_pipeline.exports.PERK_LABEL_OVERRIDES_PATH", override_path):
                export_client_data([target], output_dir=output_dir, python_executable=sys.executable)

            exported = json.loads((output_dir / "weapons.json").read_text(encoding="utf-8"))
            self.assertEqual("Mapped Frost Effect", exported[0]["fields"]["corrupted_perk_label"])

    def test_build_generated_diff_report_normalizes_untrusted_corrupted_perk_labels(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            output_dir = root / "generated"
            generated = output_dir / "weapons.json"
            site_path = root / "site" / "weapons.json"
            output_dir.mkdir()
            site_path.parent.mkdir()
            site_path.write_text(
                json.dumps(
                    [
                        {
                            "id": 1,
                            "name": "Fallback Label",
                            "fields": {"perk": 22, "corrupted_perk": 0},
                        }
                    ]
                ),
                encoding="utf-8",
            )
            generated.write_text(
                json.dumps(
                    [
                        {
                            "id": 1,
                            "name": "Fallback Label",
                            "fields": {
                                "perk": 22,
                                "perk_label": "Frozen Heart (Tier 1)",
                                "corrupted_perk": 41,
                                "corrupted_perk_label": "Frozen Heart (Tier 1)",
                            },
                        }
                    ]
                ),
                encoding="utf-8",
            )
            target = ExportTarget(
                name="weapons",
                extractor_script=root / "unused.py",
                source_data=root / "unused.dat",
                output_filename="weapons.json",
                site_path=site_path,
            )

            report = build_generated_diff_report(target, output_dir=output_dir)

            changed_paths = [change.path for change in report.changed[0].field_changes]
            self.assertIn("fields.corrupted_perk", changed_paths)
            self.assertNotIn("fields.corrupted_perk_label", changed_paths)

    def test_build_generated_diff_report_summarizes_added_removed_and_changed_records(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            output_dir = root / "generated"
            generated = output_dir / "fake.json"
            site_path = root / "site" / "fake.json"
            output_dir.mkdir()
            site_path.parent.mkdir()
            site_path.write_text(
                json.dumps(
                    [
                        {"id": 1, "name": "Same", "fields": {"level": 10, "damage": 3}},
                        {"id": 2, "name": "Removed", "fields": {"level": 20}},
                    ]
                ),
                encoding="utf-8",
            )
            generated.write_text(
                json.dumps(
                    [
                        {"id": 1, "name": "Same", "fields": {"level": 11, "damage": 3}},
                        {"id": 3, "name": "Added", "fields": {"level": 30}},
                    ]
                ),
                encoding="utf-8",
            )
            target = ExportTarget(
                name="fake",
                extractor_script=root / "unused.py",
                source_data=root / "unused.dat",
                output_filename="fake.json",
                site_path=site_path,
            )

            report = build_generated_diff_report(target, output_dir=output_dir)

            self.assertEqual(["Added (3)"], report.added)
            self.assertEqual(["Removed (2)"], report.removed)
            self.assertEqual(1, len(report.changed))
            self.assertEqual("Same (1)", report.changed[0].label)
            self.assertEqual("fields.level", report.changed[0].field_changes[0].path)
            self.assertEqual(10, report.changed[0].field_changes[0].old_value)
            self.assertEqual(11, report.changed[0].field_changes[0].new_value)
