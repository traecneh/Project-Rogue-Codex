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

    def test_grave_consequences_has_confirmed_jeel_details(self):
        quest = next(quest for quest in self.data["quests"] if quest["id"] == "grave-consequences")
        objectives = quest["stages"][0]["objectives"]

        self.assertEqual(("Jeel", "Jeel - Mayor's House", 12), (
            quest["region"],
            quest["area"],
            quest["min_level"],
        ))
        self.assertEqual(
            {"name": "Mayor of Jeel", "coordinates": [3766, 3232], "markers": "!?"},
            quest["giver"],
        )
        self.assertEqual([], quest["prerequisites"])
        self.assertEqual(
            [
                ("Kill Skeletons", 25, 46),
                ("Kill Skeleton Warriors", 15, 120),
                ("Kill Undead Warriors", 10, 96),
            ],
            [
                (objective["text"], objective["quantity"], objective["target"]["entity"]["id"])
                for objective in objectives
            ],
        )
        self.assertEqual(
            [{"type": "experience", "amount": 4250, "label": "Experience"}],
            quest["rewards"]["guaranteed"],
        )

    def test_new_regional_quests_have_confirmed_requirements_and_rewards(self):
        expected = {
            "the-backroom": ("Hothbra", 18, "Lyrael", [3572, 3026], 15000),
            "the-highwaymans-due": ("Hothbra", 10, "Town Crier", [3572, 3013], 3250),
            "scurvy-dogs": ("Wilderness", 25, "Jack Sparrow", [3388, 2961], 17500),
            "lotors-ettin-slayer": ("Lotor's Castle", 32, "King Lotor", [3848, 2969], 27500),
            "wailing-souls": ("New Korelth", 18, "Guard Captain", [3761, 2614], 10000),
            "the-scared-guard": ("New Korelth", 15, "Scared Guard", [3742, 2647], 3250),
        }

        for quest_id, details in expected.items():
            quest = next(quest for quest in self.data["quests"] if quest["id"] == quest_id)
            actual = (
                quest["region"],
                quest["min_level"],
                quest["giver"]["name"],
                quest["giver"]["coordinates"],
                quest["rewards"]["guaranteed"][0]["amount"],
            )
            self.assertEqual(details, actual, quest_id)
            self.assertEqual([], quest["prerequisites"], quest_id)
            self.assertFalse(quest["repeatable"], quest_id)

    def test_new_regional_quest_entities_use_canonical_records(self):
        expected = {
            "the-backroom": [
                ("Kill Zombies", 5, "monster", 94),
                ("Kill Undead Warriors", 5, "monster", 96),
                ("Kill Hell Hounds", 20, "monster", 99),
                ("Kill Imps", 20, "monster", 103),
            ],
            "the-highwaymans-due": [
                ("Kill Thieves", 15, "monster", 116),
                ("Kill Fighters", 10, "monster", 117),
            ],
            "scurvy-dogs": [
                ("Kill Pirates", 25, "monster", 85),
                ("Kill Swashbucklers", 10, "monster", 86),
                ("Kill Pirate Captains", 5, "monster", 84),
            ],
            "lotors-ettin-slayer": [
                ("Kill Ettins", 50, "monster", 82),
                ("Provide Uncooked Ribs for Lotor", 10, "collectable", 96),
            ],
            "wailing-souls": [
                ("Kill Ghosts", 25, "monster", 90),
                ("Kill Wraiths", 15, "monster", 101),
            ],
            "the-scared-guard": [
                ("Kill Undead Warriors", 29, "monster", 96),
                ("Kill Zombies", 15, "monster", 94),
            ],
        }

        for quest_id, expected_entities in expected.items():
            quest = next(quest for quest in self.data["quests"] if quest["id"] == quest_id)
            objectives = [
                objective
                for stage in quest["stages"]
                for objective in stage["objectives"]
                if objective["target"].get("entity")
            ]
            actual = [
                (
                    objective["text"],
                    objective["quantity"],
                    objective["target"]["entity"]["type"],
                    objective["target"]["entity"]["id"],
                )
                for objective in objectives
            ]
            self.assertEqual(expected_entities, actual, quest_id)

    def test_backroom_retains_all_phases_and_confirmed_coordinates(self):
        quest = next(quest for quest in self.data["quests"] if quest["id"] == "the-backroom")
        objectives = [objective for stage in quest["stages"] for objective in stage["objectives"]]
        route = objectives[0]["target"]
        fire_portal = objectives[3]["target"]
        guard = objectives[6]["target"]

        self.assertEqual([1, 2, 3, 4, 5], [stage["number"] for stage in quest["stages"]])
        self.assertEqual(list(range(1, 8)), [objective["number"] for objective in objectives])
        self.assertEqual(
            ([3576, 3031], [7695, 3018], "Scared Thief", "*"),
            (
                route["coordinates"],
                route["destination_coordinates"],
                route["destination_label"],
                route["markers"],
            ),
        )
        self.assertEqual(
            ("Fire Portal", [7687, 2961]),
            (fire_portal["label"], fire_portal["coordinates"]),
        )
        self.assertEqual(
            ("Guard Captain of Hothbra", [3576, 3015], "?*"),
            (guard["label"], guard["coordinates"], guard["markers"]),
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
