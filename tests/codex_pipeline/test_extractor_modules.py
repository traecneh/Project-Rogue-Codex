import json
import struct
import tempfile
import unittest
from pathlib import Path


class ExtractorModuleTests(unittest.TestCase):
    def test_shared_helpers_parse_args_and_diff_records(self):
        from tools.codex_pipeline.extractors.shared import diff_records_by_id, parse_extractor_args

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data_path = root / "data.dat"
            out_path = root / "out.json"
            diff_path = root / "diff.txt"

            parsed = parse_extractor_args([str(data_path), str(out_path), f"--diff-out={diff_path}"])

        self.assertEqual(data_path, parsed.data_path)
        self.assertEqual(out_path, parsed.out_path)
        self.assertEqual(diff_path, parsed.diff_out_path)

        lines = diff_records_by_id(
            [{"id": 1, "name": "Old Name", "fields": {"damage": 1}}],
            [{"id": 1, "name": "New Name", "fields": {"damage": 2, "speed": 3}}],
            record_label="Weapon",
        )

        self.assertIn("Weapon 1: Old Name -> New Name", lines)
        self.assertIn("  ~ fields.damage: 1 -> 2", lines)
        self.assertIn("  + fields.speed: 3", lines)

    def test_shared_file_helpers_hash_and_fallback_to_unified_diff(self):
        from tools.codex_pipeline.extractors.shared import diff_json_records_by_id, file_hash

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            old_path = root / "old.txt"
            new_path = root / "new.txt"
            old_path.write_text("one\n", encoding="utf-8")
            new_path.write_text("two\n", encoding="utf-8")

            self.assertNotEqual(file_hash(old_path), file_hash(new_path))
            lines = diff_json_records_by_id(old_path, new_path, record_label="Item")

        self.assertIn("-one", lines)
        self.assertIn("+two", lines)

    def test_shared_binary_helpers_decode_records_and_extract_names(self):
        from tools.codex_pipeline.extractors.shared import (
            extract_ascii_name,
            find_varying_indices,
            load_xor_encoded_records,
            split_words_into_records,
        )

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "fixture.dat"
            decoded_words = [0x6F43, 0x646C, 0x0000, 10, 0x6142, 0x6472, 0x0000, 20]
            encoded_words = [word ^ 0xD4D4 for word in decoded_words]
            path.write_bytes(struct.pack(f"<{len(encoded_words)}H", *encoded_words))

            records = load_xor_encoded_records(path, words_per_record=4, xor_key=0xD4D4)

        self.assertEqual(split_words_into_records(decoded_words, 4), records)
        self.assertEqual([[0x6F43, 0x646C, 0x0000, 10], [0x6142, 0x6472, 0x0000, 20]], records)
        self.assertEqual([0, 1, 3], find_varying_indices(records))
        self.assertEqual("Cold", extract_ascii_name(records[0]))
        self.assertEqual("Bard", extract_ascii_name(records[1]))

    def test_item_extractors_share_metadata_labels(self):
        from tools.codex_pipeline.extractors.item_metadata import (
            ARMOR_SLOT_LABELS,
            PERK_LABELS,
            RARITY_LABELS,
            WEAPON_ELEMENT_LABELS,
            WEAPON_SPECIALTY_LABELS,
            WEAPON_SUBTYPE_LABELS,
            enrich_armor_fields,
            enrich_weapon_fields,
            resolve_corrupted_perk_label,
        )

        self.assertEqual("Frozen Heart (Tier 1)", PERK_LABELS[22])
        self.assertEqual("Frozen Heart (Tier 2)", resolve_corrupted_perk_label(278, 22))
        self.assertEqual("Rare", RARITY_LABELS[2])
        self.assertEqual("Cold", WEAPON_ELEMENT_LABELS[4])
        self.assertEqual("Strength", WEAPON_SPECIALTY_LABELS[1])
        self.assertEqual("Sword", WEAPON_SUBTYPE_LABELS[1])
        self.assertEqual("Helmet", ARMOR_SLOT_LABELS[10])
        weapon_fields = {
            "value_low": 500,
            "value_high": 1,
            "subtype": 1,
            "specialty": 1,
            "element": 4,
            "max_rarity": 3,
            "perk": 22,
            "corrupted_perk": 278,
        }
        armor_fields = {
            "value_low": 300,
            "value_high": 0,
            "slot": 10,
            "max_rarity": 2,
            "perk": 22,
            "corrupted_perk": 278,
        }

        enrich_weapon_fields(weapon_fields)
        enrich_armor_fields(armor_fields)

        self.assertEqual(66036, weapon_fields["value"])
        self.assertEqual("Sword", weapon_fields["subtype_label"])
        self.assertEqual("Strength", weapon_fields["specialty_label"])
        self.assertEqual("Cold", weapon_fields["element_label"])
        self.assertEqual("Epic", weapon_fields["max_rarity_label"])
        self.assertEqual("Frozen Heart (Tier 1)", weapon_fields["perk_label"])
        self.assertEqual("Frozen Heart (Tier 2)", weapon_fields["corrupted_perk_label"])
        self.assertEqual(300, armor_fields["value"])
        self.assertEqual("Helmet", armor_fields["slot_label"])
        self.assertEqual("Rare", armor_fields["max_rarity_label"])
        self.assertEqual("Frozen Heart (Tier 1)", armor_fields["perk_label"])
        self.assertEqual("Frozen Heart (Tier 2)", armor_fields["corrupted_perk_label"])

        extractors_dir = Path("tools/codex_pipeline/extractors")
        weapon_source = (extractors_dir / "extract_weapons_data05.py").read_text(encoding="utf-8")
        armor_source = (extractors_dir / "extract_armors_data06.py").read_text(encoding="utf-8")
        for source in (weapon_source, armor_source):
            self.assertIn("from tools.codex_pipeline.extractors.item_metadata import", source)
            self.assertNotIn("PERK_LABELS = {", source)
            self.assertNotIn("def resolve_corrupted_perk_label(", source)
            self.assertNotIn("rarity_labels = {", source)
            self.assertNotIn("element_labels = {", source)
            self.assertNotIn('fields["value"] =', source)
            self.assertNotIn('fields["perk_label"] =', source)
            self.assertNotIn('fields["corrupted_perk_label"] =', source)
            self.assertNotIn("add_field_label(fields", source)
        self.assertIn("enrich_weapon_fields(fields)", weapon_source)
        self.assertIn("enrich_armor_fields(fields)", armor_source)

    def test_monster_extractor_uses_shared_metadata_enrichment(self):
        from tools.codex_pipeline.extractors.monster_metadata import (
            ELEMENTAL_LABELS,
            FLAG_BOSS,
            FLAG_FLYING,
            FLAG_THORNS,
            STATUS_EFFECT_LABELS,
            TATTER_LABELS,
            TYPE_LABELS,
            enrich_monster_fields,
        )

        self.assertEqual("Demon", TYPE_LABELS[3])
        self.assertEqual("Cold", ELEMENTAL_LABELS[4])
        self.assertEqual("Freeze", STATUS_EFFECT_LABELS[3856])
        self.assertEqual("Frozen Heart", TATTER_LABELS[22])
        fields = {
            "type": 3,
            "elemental_attack": 4,
            "status_effect": 3856,
            "uncommon_tatter": 22,
            "rare_tatter": 999,
            "total_flags": FLAG_FLYING | FLAG_BOSS | FLAG_THORNS | 0x0020,
        }

        warnings = enrich_monster_fields(fields, "Test Monster")

        self.assertEqual("Demon", fields["type_label"])
        self.assertEqual("Cold", fields["elemental_attack_label"])
        self.assertEqual("Freeze", fields["status_effect_label"])
        self.assertEqual("Frozen Heart", fields["uncommon_tatter_label"])
        self.assertTrue(fields["is_flying"])
        self.assertTrue(fields["is_boss"])
        self.assertTrue(fields["has_thorns"])
        self.assertFalse(fields["is_ethereal"])
        self.assertEqual(
            [
                "Test Monster: unknown flag bits set in total_flags = 0x4260 "
                "(extra 0x0020)",
                "Test Monster: unknown tatter label(s): rare_tatter=999",
            ],
            warnings,
        )

        source = Path("tools/codex_pipeline/extractors/extract_monsters_data03.py").read_text(
            encoding="utf-8"
        )
        self.assertIn("from tools.codex_pipeline.extractors.monster_metadata import", source)
        self.assertIn("enrich_monster_fields(fields, name)", source)
        self.assertNotIn("TYPE_LABELS = {", source)
        self.assertNotIn("ELEMENTAL_LABELS = {", source)
        self.assertNotIn("STATUS_EFFECT_LABELS = {", source)
        self.assertNotIn("TATTER_LABELS = {", source)
        self.assertNotIn("unknown_tatters = []", source)
        self.assertNotIn("unknown_status_effect", source)
        self.assertNotIn('fields["is_flying"] =', source)

    def test_extractors_use_named_field_schemas(self):
        from tools.codex_pipeline.extractors.field_schemas import (
            ARMOR_FIELD_NAMES,
            MONSTER_FIELD_NAMES,
            WEAPON_FIELD_NAMES,
            build_fields,
            field_name,
        )

        self.assertEqual("min_damage", MONSTER_FIELD_NAMES[16])
        self.assertEqual("frame_1_x", MONSTER_FIELD_NAMES[130])
        self.assertEqual("unknown_777", field_name(MONSTER_FIELD_NAMES, 777))
        self.assertEqual("subtype", WEAPON_FIELD_NAMES[22])
        self.assertEqual("proc_chance", WEAPON_FIELD_NAMES[28])
        self.assertEqual("armor", ARMOR_FIELD_NAMES[13])
        self.assertEqual("player_level_requirement", ARMOR_FIELD_NAMES[17])
        record_words = [0] * 1000
        record_words[22] = 7
        record_words[777] = 99
        self.assertEqual(
            {"subtype": 7, "unknown_777": 99},
            build_fields(record_words, [22, 777], WEAPON_FIELD_NAMES),
        )

        extractors_dir = Path("tools/codex_pipeline/extractors")
        for script_path in extractors_dir.glob("extract_*_data*.py"):
            source = script_path.read_text(encoding="utf-8")
            self.assertIn("from tools.codex_pipeline.extractors.field_schemas import", source)
            self.assertIn("build_fields(", source)
            self.assertNotIn("known_names = {", source)
            self.assertNotIn("def field_name(", source)
            self.assertNotIn("fields = {}\n        for i in varying_indices:", source)

    def test_extractor_scripts_use_shared_helpers_and_expose_parsers(self):
        from tools.codex_pipeline.extractors import (
            extract_armors_data06,
            extract_monsters_data03,
            extract_weapons_data05,
        )

        extractors_dir = Path("tools/codex_pipeline/extractors")
        for script_path in extractors_dir.glob("extract_*_data*.py"):
            source = script_path.read_text(encoding="utf-8")
            self.assertIn("from tools.codex_pipeline.extractors.shared import", source)
            self.assertNotIn("def file_hash(", source)
            self.assertNotIn("def make_backup_path(", source)
            self.assertNotIn("def diff_files(", source)
            self.assertNotIn("def parse_args(", source)

        self.assertTrue(callable(extract_monsters_data03.parse_data03))
        self.assertTrue(callable(extract_weapons_data05.parse_data05))
        self.assertTrue(callable(extract_armors_data06.parse_data06))
