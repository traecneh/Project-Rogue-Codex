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
    def test_perk_label_override_file_lists_current_unresolved_corrupted_perks(self):
        self.assertEqual(
            PERK_LABEL_OVERRIDES_PATH,
            REPO_ROOT / "data" / "codex-overrides" / "perk_labels.json",
        )
        self.assertTrue(PERK_LABEL_OVERRIDES_PATH.is_file())

        from tools.codex_pipeline.perks import load_perk_label_overrides

        overrides = load_perk_label_overrides(PERK_LABEL_OVERRIDES_PATH)
        for code in (2, 24, 41, 544, 553):
            self.assertIn(code, overrides)
            self.assertIsNone(overrides[code])

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
