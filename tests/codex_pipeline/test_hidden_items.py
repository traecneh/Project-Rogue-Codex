import unittest


class HiddenItemRulesTests(unittest.TestCase):
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
            }
        )

        self.assertTrue(rules.is_hidden_record("weapons", {"name": "Super Duper Bow"}))
        self.assertTrue(rules.is_hidden_image("weapons", "Super Duper Bow-1037.png"))
        self.assertTrue(rules.is_hidden_image("weapons", "GM Deathbringer.png"))
        self.assertTrue(rules.is_hidden_image("armors", "Stone of Jordan.gif"))
        self.assertFalse(rules.is_hidden_image("weapons", "Rune Sword.png"))
        self.assertFalse(rules.is_hidden_record("monsters", {"name": "Dretch"}))


if __name__ == "__main__":
    unittest.main()
