import struct
import tempfile
import unittest
from pathlib import Path

from tools.codex_pipeline.extractors import (
    extract_armors_data06,
    extract_monsters_data03,
    extract_weapons_data05,
)


def _record_with_name(name: str, word_count: int) -> list[int]:
    words = [0] * word_count
    name_bytes = name.encode("ascii") + b"\0"
    for word_index in range(0, len(name_bytes), 2):
        chunk = name_bytes[word_index : word_index + 2].ljust(2, b"\0")
        words[word_index // 2] = chunk[0] | (chunk[1] << 8)
    return words


def _write_encoded_records(path: Path, records: list[list[int]]) -> None:
    encoded_words = [
        word ^ extract_monsters_data03.XOR_KEY_WORD for record in records for word in record
    ]
    path.write_bytes(struct.pack(f"<{len(encoded_words)}H", *encoded_words))


class ExtractorBinaryFixtureTests(unittest.TestCase):
    def test_monster_fixture_decodes_names_labels_flags_and_warnings(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "data03.dat"
            first = _record_with_name("Frost Imp", extract_monsters_data03.WORDS_PER_RECORD)
            second = _record_with_name("Stone Ogre", extract_monsters_data03.WORDS_PER_RECORD)
            first[15] = 3
            first[16] = 2
            first[17] = 5
            first[18] = 30
            first[25] = 4
            first[26] = extract_monsters_data03.FLAG_FLYING | extract_monsters_data03.FLAG_BOSS
            first[28] = 4
            first[29] = 3856
            first[174] = 22
            second[15] = 7
            second[16] = 8
            second[17] = 14
            second[18] = 90
            second[25] = 9
            second[26] = extract_monsters_data03.FLAG_THORNS
            second[28] = 1
            second[174] = 1
            _write_encoded_records(path, [first, second])

            monsters, skipped, warnings = extract_monsters_data03.parse_data03(path)

        self.assertEqual(0, skipped)
        self.assertEqual([], warnings)
        self.assertEqual("Frost Imp", monsters[0]["name"])
        fields = monsters[0]["fields"]
        self.assertEqual(2, fields["min_damage"])
        self.assertEqual("Demon", fields["type_label"])
        self.assertEqual("Cold", fields["elemental_attack_label"])
        self.assertEqual("Freeze", fields["status_effect_label"])
        self.assertEqual("Frozen Heart", fields["uncommon_tatter_label"])
        self.assertTrue(fields["is_flying"])
        self.assertTrue(fields["is_boss"])
        self.assertFalse(fields["has_thorns"])

    def test_weapon_fixture_decodes_derived_value_and_labels(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "data05.dat"
            first = _record_with_name("Rune Sword", extract_weapons_data05.WORDS_PER_RECORD)
            second = _record_with_name("Iron Axe", extract_weapons_data05.WORDS_PER_RECORD)
            first[13] = 4
            first[14] = 9
            first[16] = 500
            first[17] = 1
            first[22] = 1
            first[24] = 1
            first[26] = 4
            first[75] = 3
            first[80] = 22
            first[99] = 278
            second[13] = 6
            second[14] = 12
            second[16] = 750
            second[17] = 0
            second[22] = 3
            second[24] = 2
            second[26] = 1
            second[75] = 2
            second[80] = 30
            second[99] = 286
            _write_encoded_records(path, [first, second])

            weapons, skipped = extract_weapons_data05.parse_data05(path)

        self.assertEqual(0, skipped)
        self.assertEqual("Rune Sword", weapons[0]["name"])
        fields = weapons[0]["fields"]
        self.assertEqual(4, fields["min_damage"])
        self.assertEqual(66036, fields["value"])
        self.assertEqual("Sword", fields["subtype_label"])
        self.assertEqual("Strength", fields["specialty_label"])
        self.assertEqual("Cold", fields["element_label"])
        self.assertEqual("Epic", fields["max_rarity_label"])
        self.assertEqual("Frozen Heart (Tier 1)", fields["perk_label"])
        self.assertEqual("Frozen Heart (Tier 2)", fields["corrupted_perk_label"])

    def test_armor_fixture_decodes_derived_value_and_labels(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "data06.dat"
            first = _record_with_name("Frost Helm", extract_armors_data06.WORDS_PER_RECORD)
            second = _record_with_name("Iron Chest", extract_armors_data06.WORDS_PER_RECORD)
            first[13] = 12
            first[14] = 300
            first[15] = 0
            first[19] = 10
            first[71] = 2
            first[76] = 22
            first[79] = 9
            first[95] = 278
            second[13] = 18
            second[14] = 900
            second[15] = 1
            second[19] = 11
            second[71] = 4
            second[76] = 30
            second[79] = 0
            second[95] = 286
            _write_encoded_records(path, [first, second])

            armors, skipped = extract_armors_data06.parse_data06(path)

        self.assertEqual(0, skipped)
        self.assertEqual("Frost Helm", armors[0]["name"])
        fields = armors[0]["fields"]
        self.assertEqual(12, fields["armor"])
        self.assertEqual(300, fields["value"])
        self.assertEqual("Helmet", fields["slot_label"])
        self.assertEqual("Rare", fields["max_rarity_label"])
        self.assertEqual("Frozen Heart (Tier 1)", fields["perk_label"])
        self.assertEqual("Frozen Heart (Tier 2)", fields["corrupted_perk_label"])
        self.assertEqual(9, fields["cold_resistance"])

    def test_single_disabled_weapon_record_is_skipped_even_without_varying_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "data05.dat"
            record = _record_with_name("Hidden Bow", extract_weapons_data05.WORDS_PER_RECORD)
            record[22] = 8
            _write_encoded_records(path, [record])

            weapons, skipped = extract_weapons_data05.parse_data05(path)

        self.assertEqual([], weapons)
        self.assertEqual(1, skipped)

    def test_single_disabled_armor_record_is_skipped_even_without_varying_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "data06.dat"
            record = _record_with_name("Hidden Slot", extract_armors_data06.WORDS_PER_RECORD)
            record[19] = 15
            _write_encoded_records(path, [record])

            armors, skipped = extract_armors_data06.parse_data06(path)

        self.assertEqual([], armors)
        self.assertEqual(1, skipped)
