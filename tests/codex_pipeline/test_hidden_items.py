import json
import unittest
from pathlib import Path

from tools.codex_pipeline.config import ALLOWLISTS_PATH, MONSTERS_DATA_PATH, MONSTER_IMAGES_DIR


AUDITED_COMBAT_MONSTERS = {
    "Abberation",
    "Abyssal Ravager",
    "Bee",
    "Blue Druid",
    "Bug Swarm",
    "Carrion Crawler",
    "Duskmaw",
    "Fire Fiend",
    "Forest Troll",
    "Frost Goblin",
    "Frozen Skull",
    "Goblin",
    "Greater Goblin",
    "Grimlock",
    "Haunting",
    "Kelumna",
    "Lesser Ettin",
    "Lesser Giant",
    "Malevolence",
    "Mimic",
    "Mummy",
    "Purple Druid",
    "Queen Spider",
    "Reaper",
    "Reindeer",
    "Scorpion",
    "Shock Bat",
    "Stoneclaw",
    "Troll Shaman",
    "Visage",
    "Void Disciple",
    "Voidmaw",
    "Wolf",
}


class HiddenItemRulesTests(unittest.TestCase):
    def test_audited_combat_monsters_are_visible_and_complete(self):
        allowlists = json.loads(ALLOWLISTS_PATH.read_text(encoding="utf-8"))
        allowed_monsters = set(allowlists["monsters"]["allow"])
        held_monsters = {"Cow", "Chicken", "Dragon Spire", "Winter Spire", "Master Spire"}

        self.assertLessEqual(AUDITED_COMBAT_MONSTERS, allowed_monsters)
        self.assertTrue(held_monsters.isdisjoint(allowed_monsters))
        self.assertIn(23, allowlists["monsters"]["block_ids"])

        records = json.loads(MONSTERS_DATA_PATH.read_text(encoding="utf-8"))
        records_by_name = {record["name"]: record for record in records}
        manifest = json.loads((MONSTER_IMAGES_DIR / "manifest.json").read_text(encoding="utf-8"))
        image_names = {Path(path).stem for path in manifest}

        for name in AUDITED_COMBAT_MONSTERS:
            with self.subTest(monster=name):
                record = records_by_name[name]
                fields = record["fields"]
                self.assertGreater(fields["level"], 0)
                self.assertGreater(fields["health"], 0)
                self.assertGreater(fields["max_damage"], 0)
                self.assertGreater(fields["movement_speed"], 0)
                self.assertGreater(fields["attack_speed"], 0)
                self.assertIn(name, image_names)

    def test_site_allowlist_blocks_super_duper_bow_by_exact_name(self):
        allowlists = json.loads(ALLOWLISTS_PATH.read_text(encoding="utf-8"))

        self.assertIn("Super Duper Bow", allowlists["weapons"]["block"])
        for name in ["Wooden Bow", "Crossbow", "Small Crossbow", "Four Elements Crossbow", "Dragon Fire Gauntlets"]:
            self.assertIn(name, allowlists["weapons"]["block"])
        for name in [
            "Sword of Rage",
            "Dagger of Rage",
            "Axe of Rage",
            "Warmace of Rage",
            "Spear of Rage",
            "Sword of Divinity",
            "Dagger of Divinity",
            "Axe of Divinity",
            "Warmace of Divinity",
            "Spear of Divinity",
        ]:
            self.assertIn(name, allowlists["weapons"]["block"])

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
