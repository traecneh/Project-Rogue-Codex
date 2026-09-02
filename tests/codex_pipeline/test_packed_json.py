import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


class PackedJsonMapperTests(unittest.TestCase):
    def test_maps_collectables_json_to_site_shape(self):
        from tools.codex_pipeline.packed_json import map_packed_json_target

        packed_files = {
            "collectables.json": {
                "schema_version": 1,
                "collectables": [
                    {
                        "id": 24,
                        "name": "Soul of Flame",
                        "value": 5000,
                        "use_type": 0,
                        "crafting_material_type": 0,
                        "crafting_material_amount": 0,
                        "crafting_difficulty": -50,
                        "crafting_requirement": 0,
                        "emits_light": 1,
                        "animated": 1,
                        "animation_frame_count": 5,
                        "animation_type": 1,
                        "frames": [{"x": 3, "y": 4, "w": 16, "h": 16}],
                    },
                    {"id": 99, "name": "Unused", "frames": []},
                    {"id": 100, "name": "", "frames": []},
                ],
            }
        }

        records = map_packed_json_target("collectables", packed_files)

        self.assertEqual(1, len(records))
        record = records[0]
        fields = record["fields"]
        self.assertEqual(24, record["id"])
        self.assertEqual("Soul of Flame", record["name"])
        self.assertEqual(5000, fields["value"])
        self.assertEqual(0, fields["use_type"])
        self.assertEqual(0, fields["crafting_material_type"])
        self.assertEqual(0, fields["crafting_material_amount"])
        self.assertEqual(-50, fields["crafting_difficulty"])
        self.assertEqual(0, fields["crafting_requirement"])
        self.assertEqual(1, fields["emits_light"])
        self.assertEqual(1, fields["animated"])
        self.assertEqual(5, fields["animation_frame_count"])
        self.assertEqual(1, fields["animation_type"])
        self.assertEqual(3, fields["frame_1_x"])
        self.assertEqual(16, fields["frame_1_width"])
        self.assertEqual(0, fields["frame_2_width"])

    def test_maps_useables_json_to_site_shape(self):
        from tools.codex_pipeline.packed_json import map_packed_json_target

        packed_files = {
            "useables.json": {
                "schema_version": 1,
                "useables": [
                    {
                        "id": 10,
                        "name": "Carpentry Saw",
                        "value": 250,
                        "use_type": 15,
                        "crafting_material_type": 0,
                        "crafting_material_amount": 0,
                        "crafting_difficulty": 0,
                        "crafting_requirement": 0,
                        "emits_light": 0,
                        "animated": 0,
                        "animation_frame_count": 0,
                        "animation_type": 0,
                        "frames": [{"x": 8, "y": 9, "w": 16, "h": 16}],
                    }
                ],
            }
        }

        records = map_packed_json_target("useables", packed_files)

        self.assertEqual(1, len(records))
        fields = records[0]["fields"]
        self.assertEqual(10, records[0]["id"])
        self.assertEqual("Carpentry Saw", records[0]["name"])
        self.assertEqual(250, fields["value"])
        self.assertEqual(15, fields["use_type"])
        self.assertEqual(0, fields["crafting_material_type"])
        self.assertEqual(0, fields["crafting_material_amount"])
        self.assertEqual(0, fields["crafting_difficulty"])
        self.assertEqual(0, fields["crafting_requirement"])
        self.assertEqual(0, fields["emits_light"])
        self.assertEqual(0, fields["animated"])
        self.assertEqual(0, fields["animation_frame_count"])
        self.assertEqual(0, fields["animation_type"])
        self.assertEqual(8, fields["frame_1_x"])
        self.assertEqual(16, fields["frame_1_width"])
        self.assertEqual(0, fields["frame_2_width"])

    def test_maps_grouped_weapon_json_to_site_shape_and_preserves_site_only_fields(self):
        from tools.codex_pipeline.packed_json import map_packed_json_target

        packed_files = {
            "weapons.json": {
                "schema_version": 1,
                "weapons": [
                    {
                        "type": 1,
                        "items": [
                            {
                                "id": 27,
                                "name": "Rune Sword",
                                "dam_min": 80,
                                "dam_max": 150,
                                "value": 500000,
                                "speed": 1000,
                                "use_req_amnt": 85,
                                "use_req_type": 1,
                                "subtype": 1,
                                "level": 0,
                                "elemental_damage_type": 0,
                                "elemental_damage_max": 0,
                                "maximum_rarity": 4,
                                "shards_deconstruction": 0,
                                "shards_promotion": 0,
                                "innate_special_effect": 612,
                                "corruption": 307,
                                "item_class": 2,
                                "resistance_fire": 0,
                                "resistance_cold": 0,
                                "resistance_electric": 0,
                                "resistance_holy": 2,
                                "resistance_acid": 0,
                                "resistance_poison": 0,
                                "resistance_disease": 0,
                                "resistance_dark": 3,
                                "bonus_strength": 8,
                                "bonus_dexterity": 0,
                                "bonus_constitution": 0,
                                "to_hit": 7,
                                "emits_light": 1,
                                "animated": 1,
                                "animation_frame_count": 2,
                                "animation_type": 0,
                                "frames": [{"x": 10, "y": 20, "w": 16, "h": 16}],
                            }
                        ],
                    }
                ],
            }
        }
        site_records = [
            {
                "id": 227,
                "name": "Rune Sword",
                "fields": {
                    "weight": 6,
                    "specialty": 1,
                    "specialty_amount": 2,
                    "unknown_78": 9,
                    "corrupted_perk": 553,
                    "perk_label": "stale label",
                },
            }
        ]

        records = map_packed_json_target("weapons", packed_files, site_records=site_records)

        self.assertEqual(1, len(records))
        record = records[0]
        fields = record["fields"]
        self.assertEqual(227, record["id"])
        self.assertEqual("Rune Sword", record["name"])
        self.assertEqual(80, fields["min_damage"])
        self.assertEqual(150, fields["max_damage"])
        self.assertEqual(41248, fields["value_low"])
        self.assertEqual(7, fields["value_high"])
        self.assertEqual(500000, fields["value"])
        self.assertEqual(1000, fields["attack_speed"])
        self.assertEqual(85, fields["skill_requirement"])
        self.assertEqual(1, fields["unknown_21"])
        self.assertEqual("Sword", fields["subtype_label"])
        self.assertEqual("Ascendant", fields["max_rarity_label"])
        self.assertEqual("Runic (Tier 3)", fields["perk_label"])
        self.assertEqual(307, fields["corrupted_perk"])
        self.assertEqual("Critical Aegis (Tier 2)", fields["corrupted_perk_label"])
        self.assertEqual(2, fields["item_class"])
        self.assertEqual(1, fields["emits_light"])
        self.assertEqual(6, fields["weight"])
        self.assertEqual("Strength", fields["specialty_label"])
        self.assertEqual(9, fields["unknown_78"])
        self.assertEqual(1, fields["unknown_34"])
        self.assertEqual(2, fields["unknown_35"])
        self.assertEqual(2, fields["holy_resistance"])
        self.assertEqual(3, fields["dark_resistance"])
        self.assertEqual(10, fields["frame_1_x"])
        self.assertEqual(16, fields["frame_1_width"])
        self.assertEqual(0, fields["frame_2_width"])

    def test_maps_armor_json_with_official_corruption_and_item_class(self):
        from tools.codex_pipeline.packed_json import map_packed_json_target

        packed_files = {
            "armors.json": {
                "schema_version": 1,
                "armors": [
                    {
                        "type": 5,
                        "items": [
                            {
                                "id": 0,
                                "name": "Iceburst Amulet",
                                "ac": 0,
                                "value": 0,
                                "use_req_amnt": 0,
                                "use_req_type": 0,
                                "subtype": 18,
                                "level": 0,
                                "maximum_rarity": 6,
                                "shards_deconstruction": 20,
                                "shards_promotion": 100,
                                "innate_special_effect": 17,
                                "corruption": 553,
                                "item_class": 1,
                                "resistance_fire": 0,
                                "resistance_cold": 5,
                                "resistance_electric": 0,
                                "resistance_holy": 1,
                                "resistance_acid": 0,
                                "resistance_poison": 0,
                                "resistance_disease": 0,
                                "resistance_dark": 2,
                                "bonus_strength": 0,
                                "bonus_dexterity": 0,
                                "bonus_constitution": 0,
                                "to_hit": 0,
                                "emits_light": 0,
                                "animation_frame_count": 1,
                                "animation_type": 0,
                                "frames": [{"x": 4, "y": 8, "w": 16, "h": 16}],
                            }
                        ],
                    }
                ],
            }
        }
        site_records = [
            {
                "id": 1000,
                "name": "Iceburst Amulet",
                "fields": {"weight": 1, "corrupted_perk": 278, "unknown_26": 0},
            }
        ]

        records = map_packed_json_target("armors", packed_files, site_records=site_records)

        fields = records[0]["fields"]
        self.assertEqual(1000, records[0]["id"])
        self.assertEqual(0, fields["armor"])
        self.assertEqual("Cosmetic", fields["slot_label"])
        self.assertEqual("Iceburst (Tier 1)", fields["perk_label"])
        self.assertEqual(553, fields["corrupted_perk"])
        self.assertEqual("Demonsbane (Tier 3)", fields["corrupted_perk_label"])
        self.assertEqual(1, fields["item_class"])
        self.assertNotIn("emits_light", fields)
        self.assertEqual(1, fields["weight"])
        self.assertEqual(0, fields["unknown_30"])
        self.assertEqual(1, fields["unknown_31"])
        self.assertEqual(1, fields["holy_resistance"])
        self.assertEqual(2, fields["dark_resistance"])

    def test_maps_monster_json_preserving_site_ids_by_name_level_and_type(self):
        from tools.codex_pipeline.packed_json import map_packed_json_target

        packed_files = {
            "monsters.json": {
                "schema_version": 1,
                "monsters": [
                    {
                        "id": 255,
                        "name": "Dune Lord",
                        "used": True,
                        "mon_type": 11,
                        "dam_min": 225,
                        "dam_max": 875,
                        "hp_max": 3250,
                        "moving_speed": 195,
                        "attack_speed": 600,
                        "monster_level": 85,
                        "flags": 229888,
                        "element": 8,
                        "chaos_mode_special_effect_uncommon": 60,
                        "chaos_mode_special_effect_rare": 56,
                        "animated": 1,
                        "animation_frame_count": 4,
                        "animation_type": 2,
                        "frames": [{"x": 1, "y": 2, "w": 20, "h": 24}],
                    }
                ],
            }
        }
        site_records = [
            {
                "id": 149,
                "name": "Dune Lord",
                "fields": {"level": 85, "type": 11, "status_effect": 5122, "uncommon_tatter": 51, "rare_tatter": 35},
            }
        ]

        records = map_packed_json_target("monsters", packed_files, site_records=site_records)

        fields = records[0]["fields"]
        self.assertEqual(149, records[0]["id"])
        self.assertEqual(33280, fields["total_flags"])
        self.assertEqual(3, fields["unknown_27"])
        self.assertEqual(516, fields["unknown_168"])
        self.assertEqual("Disease Beast", fields["type_label"])
        self.assertEqual("Disease", fields["elemental_attack_label"])
        self.assertEqual("Disease", fields["status_effect_label"])
        self.assertEqual(60, fields["uncommon_tatter"])
        self.assertEqual(56, fields["rare_tatter"])
        self.assertEqual("Rampage", fields["uncommon_tatter_label"])
        self.assertEqual("Shadowstrike", fields["rare_tatter_label"])
        self.assertTrue(fields["is_target_when_hit_ranged_trapped"])
        self.assertTrue(fields["is_flying"])

    def test_new_monsters_do_not_reuse_reserved_site_ids(self):
        from tools.codex_pipeline.packed_json import map_packed_json_target

        packed_files = {
            "monsters.json": {
                "monsters": [
                    {"id": 100, "name": "Obsidian Ravager", "used": True, "monster_level": 85, "mon_type": 5},
                    {"id": 101, "name": "Cinderbone Harrower", "used": True, "monster_level": 80, "mon_type": 5},
                    {"id": 217, "name": "Ice Devil", "used": True, "monster_level": 40, "mon_type": 9},
                    {"id": 181, "name": "Wraith", "used": True, "monster_level": 30, "mon_type": 8},
                ]
            }
        }
        site_records = [
            {"id": 100, "name": "Ice Devil", "fields": {"level": 40, "type": 9}},
            {"id": 101, "name": "Wraith", "fields": {"level": 30, "type": 8}},
            {"id": 255, "name": "Reserved Historic Monster", "fields": {"level": 1, "type": 1}},
        ]

        records = map_packed_json_target("monsters", packed_files, site_records=site_records)
        ids_by_name = {record["name"]: record["id"] for record in records}

        self.assertEqual(100, ids_by_name["Ice Devil"])
        self.assertEqual(101, ids_by_name["Wraith"])
        self.assertEqual(256, ids_by_name["Obsidian Ravager"])
        self.assertEqual(257, ids_by_name["Cinderbone Harrower"])
        self.assertEqual(len(records), len(set(ids_by_name.values())))

    def test_read_packed_json_files_reads_json_members_from_vpack(self):
        from tools.codex_pipeline.packed_json import read_packed_json_files
        from tools.codex_pipeline.vpack import VpackDecryptionResult, VpackExtractedFile, VpackInspectionReport

        with tempfile.TemporaryDirectory() as tmp:
            pack_path = Path(tmp) / "rogue_data.vpack"
            pack_path.write_bytes(b"VPACK placeholder")
            extracted = VpackDecryptionResult(
                report=VpackInspectionReport(path=pack_path, exists=True, header_valid=True),
                manifest={},
                files=[
                    VpackExtractedFile(
                        "weapons.json",
                        json.dumps({"weapons": []}).encode("utf-8"),
                        15,
                        10,
                        0,
                        "",
                        True,
                        True,
                    ),
                    VpackExtractedFile("notes.txt", b"not json", 8, 8, 0, "", True, True),
                ],
            )

            with patch("tools.codex_pipeline.packed_json.decrypt_vpack", return_value=extracted):
                files = read_packed_json_files(pack_path)

        self.assertEqual({"weapons.json": {"weapons": []}}, files)


if __name__ == "__main__":
    unittest.main()
