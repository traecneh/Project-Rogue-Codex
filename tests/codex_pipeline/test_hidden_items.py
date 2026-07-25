import json
import unittest

from tools.codex_pipeline.config import ALLOWLISTS_PATH


class HiddenItemRulesTests(unittest.TestCase):
    def test_site_allowlist_blocks_super_duper_bow_by_exact_name(self):
        allowlists = json.loads(ALLOWLISTS_PATH.read_text(encoding="utf-8"))

        self.assertIn("Super Duper Bow", allowlists["weapons"]["block"])

    def test_allowlist_block_rules_match_records_and_image_variants(self):
        from tools.codex_pipeline.hidden_items import HiddenItemRules

        rules = HiddenItemRules.from_allowlists(
            {
                "weapons": {
                    "block": [
                        "Super Duper",
                        "GM Deathbringer",
                    ]
                },
                "armors": {"block": ["stone of jordan"]},
                "monsters": {"block_ids": [23]},
            }
        )

        self.assertTrue(rules.is_hidden_record("weapons", {"name": "Super Duper Bow"}))
        self.assertTrue(rules.is_hidden_image("weapons", "Super Duper Bow-1037.png"))
        self.assertTrue(rules.is_hidden_image("weapons", "GM Deathbringer.png"))
        self.assertTrue(rules.is_hidden_image("armors", "Stone of Jordan.gif"))
        self.assertFalse(rules.is_hidden_image("weapons", "Rune Sword.png"))
        self.assertTrue(rules.is_hidden_record("monsters", {"id": 23, "name": "Zombie"}))
        self.assertTrue(rules.is_hidden_image("monsters", "Zombie-23.gif"))
        self.assertFalse(rules.is_hidden_record("monsters", {"id": 94, "name": "Zombie"}))
        self.assertFalse(rules.is_hidden_image("monsters", "Zombie-94.gif"))
        self.assertFalse(rules.is_hidden_record("monsters", {"name": "Dretch"}))


if __name__ == "__main__":
    unittest.main()
