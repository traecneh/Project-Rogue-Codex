import copy
import json
import unittest

from tools.codex_pipeline.config import QUESTS_DATA_PATH
from tools.codex_pipeline.quests import _entity_indexes, ENTITY_DATA_PATHS, validate_quest_data


class QuestDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads(QUESTS_DATA_PATH.read_text(encoding="utf-8"))
        cls.entity_indexes, cls.index_issues = _entity_indexes(ENTITY_DATA_PATHS)

    def test_current_quest_data_is_valid(self):
        self.assertEqual([], self.index_issues)
        self.assertEqual([], validate_quest_data(self.data, entity_indexes=self.entity_indexes))

    def test_investigate_the_undead_has_confirmed_final_quantities(self):
        quest = next(quest for quest in self.data["quests"] if quest["id"] == "investigate-the-undead")
        final_objectives = quest["stages"][1]["objectives"]

        self.assertEqual(
            [("Kill Dark Mages", 3), ("Kill Skeleton Wolf", 1)],
            [(objective["text"], objective["quantity"]) for objective in final_objectives],
        )

    def test_zombie_objectives_reference_the_level_ten_export_record(self):
        for quest_id in ("mastery-of-silvest", "investigate-the-undead"):
            quest = next(quest for quest in self.data["quests"] if quest["id"] == quest_id)
            zombie = next(
                objective
                for stage in quest["stages"]
                for objective in stage["objectives"]
                if objective["text"] == "Kill Zombies"
            )
            self.assertEqual(
                ("monster", 94, "Zombie", "images/monsters/Zombie-94.gif"),
                (
                    zombie["target"]["entity"]["type"],
                    zombie["target"]["entity"]["id"],
                    zombie["target"]["entity"]["name"],
                    zombie["target"]["entity"]["image"],
                ),
            )

    def test_requested_field_notes_and_snake_export_note_are_removed(self):
        explorer = next(quest for quest in self.data["quests"] if quest["id"] == "silvest-explorer")
        mastery = next(quest for quest in self.data["quests"] if quest["id"] == "mastery-of-silvest")
        snack = next(quest for quest in self.data["quests"] if quest["id"] == "a-snack-for-a-snack")
        snake_objective = snack["stages"][1]["objectives"][0]

        self.assertEqual([], explorer["notes"])
        self.assertEqual([], mastery["notes"])
        self.assertNotIn(
            "The current game export names the linked item Snake Meat.",
            snake_objective["notes"],
        )

    def test_gold_entries_reference_the_collectable_sprite_record(self):
        service = next(service for service in self.data["services"] if service["id"] == "create-a-guild")

        self.assertEqual(
            {"type": "collectable", "id": 0, "name": "Gold"},
            service["costs"][0]["entity"],
        )

    def test_missing_prerequisite_and_entity_are_reported(self):
        data = copy.deepcopy(self.data)
        data["quests"][0]["prerequisites"] = ["missing-quest"]
        data["quests"][0]["stages"][0]["objectives"][0]["target"]["entity"] = {
            "type": "monster",
            "id": 999999,
            "name": "Missing Monster",
        }

        messages = "\n".join(
            issue.message for issue in validate_quest_data(data, entity_indexes=self.entity_indexes)
        )

        self.assertIn("references missing prerequisite: missing-quest", messages)
        self.assertIn("references missing monster ID 999999", messages)

    def test_gold_without_collectable_relationship_is_reported(self):
        data = copy.deepcopy(self.data)
        del data["services"][0]["costs"][0]["entity"]

        messages = "\n".join(
            issue.message for issue in validate_quest_data(data, entity_indexes=self.entity_indexes)
        )

        self.assertIn("gold entries must reference collectable ID 0 (Gold)", messages)

    def test_missing_entity_image_is_reported(self):
        data = copy.deepcopy(self.data)
        mastery = next(quest for quest in data["quests"] if quest["id"] == "mastery-of-silvest")
        zombie = next(
            objective
            for stage in mastery["stages"]
            for objective in stage["objectives"]
            if objective["text"] == "Kill Zombies"
        )
        zombie["target"]["entity"]["image"] = "images/monsters/missing-zombie.png"

        messages = "\n".join(
            issue.message for issue in validate_quest_data(data, entity_indexes=self.entity_indexes)
        )

        self.assertIn("references missing entity image: images/monsters/missing-zombie.png", messages)


if __name__ == "__main__":
    unittest.main()
