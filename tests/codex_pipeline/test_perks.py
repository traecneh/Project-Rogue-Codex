import json
import tempfile
import unittest
from pathlib import Path

from tools.codex_pipeline.config import PERK_LABEL_OVERRIDES_PATH, REPO_ROOT
from tools.codex_pipeline.perk_catalog import PERK_NAMES_BY_BASE_CODE


def write_temp_json(data):
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False) as temp_file:
        json.dump(data, temp_file)
        return Path(temp_file.name)


class PerkLabelOverrideTests(unittest.TestCase):
    def test_perk_label_override_file_is_ready_for_future_exceptions(self):
        self.assertEqual(
            PERK_LABEL_OVERRIDES_PATH,
            REPO_ROOT / "data" / "codex-overrides" / "perk_labels.json",
        )
        self.assertTrue(PERK_LABEL_OVERRIDES_PATH.is_file())

        from tools.codex_pipeline.perks import load_perk_label_overrides

        self.assertEqual({}, load_perk_label_overrides(PERK_LABEL_OVERRIDES_PATH))

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


class PerkCatalogTests(unittest.TestCase):
    def test_perks_page_matches_confirmed_client_catalog(self):
        data = json.loads(
            (REPO_ROOT / "pages" / "systems" / "perks.json").read_text(encoding="utf-8")
        )
        perks = data["perks"]
        names = [perk["name"] for perk in perks]
        slugs = [perk["slug"] for perk in perks]

        self.assertEqual(set(PERK_NAMES_BY_BASE_CODE.values()), set(names))
        self.assertEqual(len(names), len(set(names)))
        self.assertEqual(len(slugs), len(set(slugs)))

    def test_confirmed_monster_tatter_labels_have_perk_cards(self):
        perk_data = json.loads(
            (REPO_ROOT / "pages" / "systems" / "perks.json").read_text(encoding="utf-8")
        )
        monster_data = json.loads(
            (REPO_ROOT / "pages" / "enemies" / "monsters_data03.json").read_text(
                encoding="utf-8"
            )
        )
        perk_names = {perk["name"] for perk in perk_data["perks"]}
        tatter_labels = {
            fields[field_name]
            for monster in monster_data
            for fields in [monster.get("fields", {})]
            for field_name in ("uncommon_tatter_label", "rare_tatter_label")
            if fields.get(field_name) not in (None, "None")
        }

        self.assertTrue(tatter_labels)
        self.assertTrue(tatter_labels.issubset(perk_names))


if __name__ == "__main__":
    unittest.main()
