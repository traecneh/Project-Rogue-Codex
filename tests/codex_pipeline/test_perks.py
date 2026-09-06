import json
import tempfile
import unittest
from pathlib import Path

from tools.codex_pipeline.config import PERK_LABEL_OVERRIDES_PATH, REPO_ROOT


def write_temp_json(data):
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False) as temp_file:
        json.dump(data, temp_file)
        return Path(temp_file.name)


class PerkLabelOverrideTests(unittest.TestCase):
    def test_previously_unresolved_perks_are_decoded_without_overrides(self):
        self.assertEqual(
            PERK_LABEL_OVERRIDES_PATH,
            REPO_ROOT / "data" / "codex-overrides" / "perk_labels.json",
        )
        self.assertTrue(PERK_LABEL_OVERRIDES_PATH.is_file())

        from tools.codex_pipeline.perks import load_perk_label_overrides

        overrides = load_perk_label_overrides(PERK_LABEL_OVERRIDES_PATH)
        from tools.codex_pipeline.extractors.item_metadata import resolve_corrupted_perk_label

        for code, label in {2: "Bloodthirster (Tier 1)", 24: "Tourniquet (Tier 1)",
                            41: "Demonsbane (Tier 1)", 544: "Tenacity (Tier 3)",
                            553: "Demonsbane (Tier 3)"}.items():
            self.assertNotIn(code, overrides)
            self.assertEqual(label, resolve_corrupted_perk_label(code, 518))
        self.assertIsNone(resolve_corrupted_perk_label(9999, 518))

    def test_load_perk_label_overrides_accepts_strings_and_known_unknowns(self):
        from tools.codex_pipeline.perks import load_perk_label_overrides

        temp_path = write_temp_json(
            {
                "schemaVersion": 1,
                "corruptedPerkLabels": {
                    "41": None,
                    "357": "Vengeance (Tier 2)",
                },
            }
        )

        try:
            self.assertEqual(
                {41: None, 357: "Vengeance (Tier 2)"},
                load_perk_label_overrides(temp_path),
            )
        finally:
            temp_path.unlink()

    def test_load_perk_label_overrides_rejects_invalid_keys_and_values(self):
        from tools.codex_pipeline.perks import load_perk_label_overrides

        for data in (
            {"schemaVersion": 2, "corruptedPerkLabels": {}},
            {"schemaVersion": 1, "corruptedPerkLabels": {"abc": None}},
            {"schemaVersion": 1, "corruptedPerkLabels": {"41": ""}},
        ):
            temp_path = write_temp_json(data)
            try:
                with self.assertRaises(ValueError):
                    load_perk_label_overrides(temp_path)
            finally:
                temp_path.unlink()


if __name__ == "__main__":
    unittest.main()
