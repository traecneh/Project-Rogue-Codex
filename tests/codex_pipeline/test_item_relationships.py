import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch


def _write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value), encoding="utf-8")


class ItemRelationshipInventoryTests(unittest.TestCase):
    def test_build_item_relationship_inventory_classifies_confirmed_candidates_and_gaps(self):
        from tools.codex_pipeline.item_relationships import build_item_relationship_inventory

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_json(
                root / "pages" / "items" / "collectables_data.json",
                [
                    {"id": 1, "name": "Ice Crystal", "fields": {"use_type": 12}},
                    {"id": 2, "name": "Golden Ore", "fields": {"use_type": 11, "crafting_material_type": 15}},
                    {"id": 3, "name": "Golden Ingot", "fields": {"use_type": 12}},
                    {"id": 4, "name": "Holiday Gift", "fields": {"use_type": 0}},
                    {"id": 5, "name": "Odd Relic", "fields": {"use_type": 99}},
                ],
            )
            _write_json(
                root / "pages" / "items" / "useables_data.json",
                [
                    {"id": 10, "name": "Pickaxe", "fields": {"use_type": 10}},
                    {"id": 11, "name": "Scroll of Imbuement", "fields": {"use_type": 0}},
                ],
            )
            systems = root / "pages" / "systems"
            systems.mkdir(parents=True)
            (systems / "crafting.html").write_text(
                "<h1>Crafting System</h1><p>Ice Crystal crafts Frost armor.</p>",
                encoding="utf-8",
            )
            (systems / "craft.html").write_text(
                "<h1>Craft System</h1><p>Scroll of Imbuement uses tattereds.</p>",
                encoding="utf-8",
            )

            report = build_item_relationship_inventory(repo_root=root)

        self.assertEqual(7, report.total_items)
        self.assertEqual(2, report.confirmed_count)
        self.assertEqual(3, report.candidate_count)
        self.assertEqual(2, report.gap_count)

        by_name = {record.item_name: record for record in report.records}
        self.assertEqual("confirmed", by_name["Ice Crystal"].status)
        self.assertIn("Crafting System", by_name["Ice Crystal"].confirmed[0].target)
        self.assertEqual("confirmed", by_name["Scroll of Imbuement"].status)
        self.assertEqual("candidate", by_name["Golden Ore"].status)
        self.assertIn("Golden Ingot", by_name["Golden Ore"].candidates[0].target)
        self.assertEqual("candidate", by_name["Golden Ingot"].status)
        self.assertEqual("gap", by_name["Holiday Gift"].status)
        self.assertEqual("candidate", by_name["Pickaxe"].status)
        self.assertEqual([99], [group.value for group in report.unknown_use_types])
        self.assertEqual(["Odd Relic"], report.unknown_use_types[0].item_names)

    def test_build_item_relationship_inventory_applies_manual_overrides(self):
        from tools.codex_pipeline.item_relationships import build_item_relationship_inventory

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_json(
                root / "pages" / "items" / "collectables_data.json",
                [{"id": 4, "name": "Holiday Gift", "fields": {"use_type": 0}}],
            )
            _write_json(
                root / "pages" / "items" / "useables_data.json",
                [
                    {"id": 75, "name": "Scroll of Imbuement", "fields": {"use_type": 0}},
                    {"id": 76, "name": "Scroll of Imbuement", "fields": {"use_type": 0}},
                ],
            )
            _write_json(
                root / "data" / "codex-overrides" / "item_relationships.json",
                {
                    "schemaVersion": 1,
                    "relationships": [
                        {
                            "kind": "collectable",
                            "name": "Holiday Gift",
                            "relationships": [
                                {
                                    "type": "related_system",
                                    "target": "Seasonal Events",
                                    "evidence": "manual review",
                                }
                            ],
                        },
                        {
                            "kind": "useable",
                            "id": 76,
                            "name": "Scroll of Imbuement",
                            "relationships": [
                                {
                                    "type": "used_in",
                                    "target": "Imbuements System",
                                    "evidence": "manual review",
                                }
                            ],
                        },
                    ],
                },
            )

            report = build_item_relationship_inventory(repo_root=root)

        by_key = {(record.item_kind, record.item_id): record for record in report.records}
        holiday = by_key[("collectable", "4")]
        scroll_75 = by_key[("useable", "75")]
        scroll_76 = by_key[("useable", "76")]

        self.assertEqual("confirmed", holiday.status)
        self.assertEqual("Seasonal Events", holiday.confirmed[0].target)
        self.assertEqual("manual override: manual review", holiday.confirmed[0].evidence)
        self.assertEqual("gap", scroll_75.status)
        self.assertEqual("confirmed", scroll_76.status)
        self.assertEqual("used_in", scroll_76.confirmed[0].relationship_type)

    def test_build_item_relationship_inventory_reports_target_coverage(self):
        from tools.codex_pipeline.item_relationships import build_item_relationship_inventory

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_json(
                root / "pages" / "items" / "collectables_data.json",
                [
                    {"id": 1, "name": "Ascendancy Shard", "fields": {}},
                    {"id": 2, "name": "Balron Skull", "fields": {}},
                    {"id": 3, "name": "Ship Deed", "fields": {}},
                    {"id": 4, "name": "Broken Charm", "fields": {}},
                ],
            )
            _write_json(root / "pages" / "items" / "useables_data.json", [])
            _write_json(
                root / "data" / "codex-overrides" / "item_relationships.json",
                {
                    "schemaVersion": 1,
                    "relationships": [
                        {
                            "kind": "collectable",
                            "name": "Ascendancy Shard",
                            "relationships": [{"type": "used_in", "target": "Ascend System"}],
                        },
                        {
                            "kind": "collectable",
                            "name": "Balron Skull",
                            "relationships": [{"type": "found_from", "target": "Monster loot"}],
                        },
                        {
                            "kind": "collectable",
                            "name": "Ship Deed",
                            "relationships": [{"type": "related_system", "target": "Travel"}],
                        },
                        {
                            "kind": "collectable",
                            "name": "Broken Charm",
                            "relationships": [{"type": "related_system", "target": "Missing Page"}],
                        },
                    ],
                },
            )
            _write_json(
                root / "data" / "codex-overrides" / "item_relationship_targets.json",
                {
                    "schemaVersion": 1,
                    "targets": [
                        {"target": "Ascend System", "href": "pages/systems/ascend.html"},
                        {
                            "target": "Monster loot",
                            "textOnly": True,
                            "reason": "No item-to-monster source page yet",
                        },
                        {"target": "Missing Page", "href": "pages/systems/missing.html"},
                    ],
                },
            )
            systems = root / "pages" / "systems"
            systems.mkdir(parents=True)
            (systems / "ascend.html").write_text("<h1>Ascend System</h1>", encoding="utf-8")

            report = build_item_relationship_inventory(repo_root=root)

        by_target = {coverage.target: coverage for coverage in report.target_coverage}
        self.assertEqual("linked", by_target["Ascend System"].status)
        self.assertEqual("pages/systems/ascend.html", by_target["Ascend System"].href)
        self.assertEqual(1, by_target["Ascend System"].relationship_count)
        self.assertEqual("text_only", by_target["Monster loot"].status)
        self.assertEqual("No item-to-monster source page yet", by_target["Monster loot"].reason)
        self.assertEqual("unclassified", by_target["Travel"].status)
        self.assertEqual("broken_link", by_target["Missing Page"].status)
        self.assertEqual(1, report.linked_target_count)
        self.assertEqual(1, report.text_only_target_count)
        self.assertEqual(2, report.target_issue_count)

    def test_build_item_relationship_inventory_reports_text_only_target_reviews(self):
        from tools.codex_pipeline.item_relationships import build_item_relationship_inventory

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_json(
                root / "pages" / "items" / "collectables_data.json",
                [
                    {"id": 1, "name": "Feather", "fields": {}},
                    {"id": 2, "name": "Holiday Gift", "fields": {}},
                ],
            )
            _write_json(
                root / "pages" / "items" / "useables_data.json",
                [{"id": 3, "name": "Ship Deed", "fields": {}}],
            )
            _write_json(
                root / "data" / "codex-overrides" / "item_relationships.json",
                {
                    "schemaVersion": 1,
                    "relationships": [
                        {
                            "kind": "collectable",
                            "name": "Feather",
                            "relationships": [{"type": "found_from", "target": "Monster loot"}],
                        },
                        {
                            "kind": "collectable",
                            "name": "Holiday Gift",
                            "relationships": [{"type": "related_system", "target": "Seasonal Events"}],
                        },
                        {
                            "kind": "useable",
                            "name": "Ship Deed",
                            "relationships": [{"type": "related_system", "target": "Travel"}],
                        },
                    ],
                },
            )
            _write_json(
                root / "data" / "codex-overrides" / "item_relationship_targets.json",
                {
                    "schemaVersion": 1,
                    "targets": [
                        {
                            "target": "Monster loot",
                            "textOnly": True,
                            "reason": "ambiguous source",
                            "reviewNextStep": "Review client loot data for exact monster sources.",
                            "reviewEvidence": "Current VPACK has no item-to-monster drop table.",
                        },
                        {
                            "target": "Seasonal Events",
                            "textOnly": True,
                            "reason": "no event page",
                            "reviewNextStep": "Create or confirm a seasonal-events destination.",
                        },
                        {
                            "target": "Travel",
                            "textOnly": True,
                            "reason": "no travel page",
                            "reviewNextStep": "Create or confirm a travel destination.",
                        },
                    ],
                },
            )

            report = build_item_relationship_inventory(repo_root=root)

        by_target = {review.target: review for review in report.target_reviews}
        self.assertEqual(3, report.target_review_count)
        self.assertEqual(3, report.target_review_relationship_count)
        self.assertEqual(["collectable Feather"], by_target["Monster loot"].item_labels)
        self.assertEqual("ambiguous source", by_target["Monster loot"].reason)
        self.assertEqual("Review client loot data for exact monster sources.", by_target["Monster loot"].next_step)
        self.assertEqual("Current VPACK has no item-to-monster drop table.", by_target["Monster loot"].evidence)
        self.assertEqual(["collectable Holiday Gift"], by_target["Seasonal Events"].item_labels)
        self.assertEqual(["useable Ship Deed"], by_target["Travel"].item_labels)

    def test_build_item_relationship_inventory_rejects_missing_target_anchor(self):
        from tools.codex_pipeline.item_relationships import build_item_relationship_inventory

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_json(
                root / "pages" / "items" / "collectables_data.json",
                [{"id": 1, "name": "Fishing Bait", "fields": {}}],
            )
            _write_json(root / "pages" / "items" / "useables_data.json", [])
            _write_json(
                root / "data" / "codex-overrides" / "item_relationships.json",
                {
                    "schemaVersion": 1,
                    "relationships": [
                        {
                            "kind": "collectable",
                            "name": "Fishing Bait",
                            "relationships": [{"type": "used_in", "target": "Fishing"}],
                        }
                    ],
                },
            )
            _write_json(
                root / "data" / "codex-overrides" / "item_relationship_targets.json",
                {
                    "schemaVersion": 1,
                    "targets": [{"target": "Fishing", "href": "pages/stats/skills.html#fishing"}],
                },
            )
            stats = root / "pages" / "stats"
            stats.mkdir(parents=True)
            (stats / "skills.html").write_text('<section id="carpentry"></section>', encoding="utf-8")

            report = build_item_relationship_inventory(repo_root=root)

        by_target = {coverage.target: coverage for coverage in report.target_coverage}
        self.assertEqual("broken_link", by_target["Fishing"].status)
        self.assertIn("missing target anchor: #fishing", by_target["Fishing"].issue)

    def test_build_item_relationship_inventory_rejects_missing_monster_route(self):
        from tools.codex_pipeline.item_relationships import build_item_relationship_inventory

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_json(
                root / "pages" / "items" / "collectables_data.json",
                [{"id": 1, "name": "Balron Skull", "fields": {}}],
            )
            _write_json(root / "pages" / "items" / "useables_data.json", [])
            _write_json(
                root / "pages" / "enemies" / "monsters_data03.json",
                [{"id": 93, "name": "Balron"}],
            )
            enemies = root / "pages" / "enemies"
            enemies.mkdir(parents=True, exist_ok=True)
            (enemies / "monsters.html").write_text("<h1>Monsters</h1>", encoding="utf-8")
            _write_json(
                root / "data" / "codex-overrides" / "item_relationships.json",
                {
                    "schemaVersion": 1,
                    "relationships": [
                        {
                            "kind": "collectable",
                            "name": "Balron Skull",
                            "relationships": [{"type": "found_from", "target": "Balron"}],
                        }
                    ],
                },
            )
            _write_json(
                root / "data" / "codex-overrides" / "item_relationship_targets.json",
                {
                    "schemaVersion": 1,
                    "targets": [
                        {"target": "Balron", "href": "pages/enemies/monsters.html?monster=missing-balron"}
                    ],
                },
            )

            report = build_item_relationship_inventory(repo_root=root)

        by_target = {coverage.target: coverage for coverage in report.target_coverage}
        self.assertEqual("broken_link", by_target["Balron"].status)
        self.assertIn("missing monster route: missing-balron", by_target["Balron"].issue)

    def test_build_item_relationship_inventory_rejects_stale_manual_overrides(self):
        from tools.codex_pipeline.exports import ExportError
        from tools.codex_pipeline.item_relationships import build_item_relationship_inventory

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_json(root / "pages" / "items" / "collectables_data.json", [])
            _write_json(root / "pages" / "items" / "useables_data.json", [])
            _write_json(
                root / "data" / "codex-overrides" / "item_relationships.json",
                {
                    "schemaVersion": 1,
                    "relationships": [
                        {
                            "kind": "useable",
                            "name": "Missing Tool",
                            "relationships": [{"type": "used_in", "target": "Tinkering"}],
                        }
                    ],
                },
            )

            with self.assertRaisesRegex(ExportError, "does not match any item"):
                build_item_relationship_inventory(repo_root=root)

    def test_item_relationship_override_file_references_existing_items(self):
        from tools.codex_pipeline.item_relationships import build_item_relationship_inventory

        report = build_item_relationship_inventory()

        by_name = {record.item_name: record for record in report.records}
        holiday = by_name["Holiday Gift"]
        hammer = by_name["Hammer"]
        balron_skull = by_name["Balron Skull"]
        beholder_eye = by_name["Beholder Eye"]
        demon_skull = by_name["Demon Skull"]
        feather = by_name["Feather"]
        human_bones = by_name["Human Bones"]

        self.assertEqual("confirmed", holiday.status)
        self.assertTrue(
            any(
                relationship.target == "Seasonal Events"
                and relationship.evidence == "manual override: reviewed holiday item family"
                for relationship in holiday.confirmed
            )
        )
        self.assertTrue(
            any(
                relationship.relationship_type == "used_in" and relationship.target == "Blacksmithing"
                for relationship in hammer.confirmed
            )
        )
        self.assertTrue(
            any(
                relationship.relationship_type == "found_from" and relationship.target == "Balron"
                for relationship in balron_skull.confirmed
            )
        )
        self.assertTrue(
            any(
                relationship.relationship_type == "found_from" and relationship.target == "Beholder"
                for relationship in beholder_eye.confirmed
            )
        )
        self.assertTrue(
            any(
                relationship.relationship_type == "found_from" and relationship.target == "Demon"
                for relationship in demon_skull.confirmed
            )
        )
        self.assertTrue(
            any(
                relationship.target == "Monster loot"
                and relationship.evidence == "manual override: reviewed current VPACK; exact monster source not exported"
                for relationship in feather.confirmed
            )
        )
        self.assertTrue(
            any(
                relationship.target == "Monster loot"
                and relationship.evidence == "manual override: reviewed current VPACK; exact monster source not exported"
                for relationship in human_bones.confirmed
            )
        )

    def test_cli_prints_item_relationship_inventory(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.item_relationships import (
            ItemRelationship,
            ItemRelationshipRecord,
            ItemRelationshipReport,
            UnknownUseTypeGroup,
        )

        report = ItemRelationshipReport(
            records=[
                ItemRelationshipRecord(
                    item_kind="collectable",
                    item_id="1",
                    item_name="Ice Crystal",
                    status="confirmed",
                    confirmed=[
                        ItemRelationship(
                            relationship_type="related_system",
                            target="Crafting System",
                            evidence="mentioned in pages/systems/crafting.html",
                        )
                    ],
                    candidates=[],
                ),
                ItemRelationshipRecord(
                    item_kind="collectable",
                    item_id="2",
                    item_name="Holiday Gift",
                    status="gap",
                    confirmed=[],
                    candidates=[],
                ),
            ],
            unknown_use_types=[UnknownUseTypeGroup(item_kind="collectable", field_name="use_type", value=99, item_names=["Odd Relic"])],
        )

        with patch.object(cli, "build_item_relationship_inventory", return_value=report):
            stdout = io.StringIO()
            with redirect_stdout(stdout):
                exit_code = cli.main(["item-relationships"])

        self.assertEqual(0, exit_code)
        output = stdout.getvalue()
        self.assertIn("RELATIONSHIP SUMMARY: 2 items, 1 confirmed, 0 candidates, 1 gaps", output)
        self.assertIn(
            "CONFIRMED collectable Ice Crystal: related_system -> Crafting System "
            "(mentioned in pages/systems/crafting.html)",
            output,
        )
        self.assertIn("GAP collectable Holiday Gift: no relationship evidence", output)
        self.assertIn("UNKNOWN collectable use_type 99: 1 item(s): Odd Relic", output)

    def test_cli_prints_item_relationship_target_coverage(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.item_relationships import (
            ItemRelationshipReport,
            ItemRelationshipTargetCoverage,
            ItemRelationshipTargetReview,
        )

        report = ItemRelationshipReport(
            records=[],
            target_coverage=[
                ItemRelationshipTargetCoverage(
                    target="Crafting System",
                    status="linked",
                    relationship_count=2,
                    href="pages/systems/crafting.html",
                    item_labels=["collectable Ice Crystal", "useable Hammer"],
                ),
                ItemRelationshipTargetCoverage(
                    target="Monster loot",
                    status="text_only",
                    relationship_count=1,
                    reason="No item-to-monster source page yet",
                    item_labels=["collectable Balron Skull"],
                ),
                ItemRelationshipTargetCoverage(
                    target="Travel",
                    status="unclassified",
                    relationship_count=1,
                    item_labels=["useable Ship Deed"],
                    issue="not listed in item_relationship_targets.json",
                ),
            ],
            target_reviews=[
                ItemRelationshipTargetReview(
                    target="Monster loot",
                    relationship_count=1,
                    reason="No item-to-monster source page yet",
                    item_labels=["collectable Balron Skull"],
                    next_step="Review client loot data for exact monster sources.",
                    evidence="Current VPACK has no item-to-monster drop table.",
                )
            ],
        )

        with patch.object(cli, "build_item_relationship_inventory", return_value=report):
            stdout = io.StringIO()
            with redirect_stdout(stdout):
                exit_code = cli.main(["item-relationships"])

        self.assertEqual(0, exit_code)
        output = stdout.getvalue()
        self.assertIn("TARGET COVERAGE: 3 targets, 1 linked, 1 text-only, 1 issue(s)", output)
        self.assertIn("TARGET LINKED Crafting System: pages/systems/crafting.html (2 relationship(s))", output)
        self.assertIn(
            "TARGET TEXT-ONLY Monster loot: No item-to-monster source page yet (1 relationship(s))",
            output,
        )
        self.assertIn(
            "TARGET UNCLASSIFIED Travel: not listed in item_relationship_targets.json (1 relationship(s))",
            output,
        )
        self.assertIn("TARGET REVIEW: 1 text-only target(s), 1 relationship(s) need source confirmation", output)
        self.assertIn(
            "TARGET REVIEW Monster loot: Review client loot data for exact monster sources. "
            "(1 relationship(s): collectable Balron Skull)",
            output,
        )
        self.assertIn(
            "TARGET REVIEW EVIDENCE Monster loot: Current VPACK has no item-to-monster drop table.",
            output,
        )

    def test_cli_prints_duplicate_item_ids_when_names_repeat(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.item_relationships import ItemRelationshipRecord, ItemRelationshipReport

        report = ItemRelationshipReport(
            records=[
                ItemRelationshipRecord(
                    item_kind="useable",
                    item_id="75",
                    item_name="Scroll of Imbuement",
                    status="gap",
                    confirmed=[],
                    candidates=[],
                ),
                ItemRelationshipRecord(
                    item_kind="useable",
                    item_id="76",
                    item_name="Scroll of Imbuement",
                    status="gap",
                    confirmed=[],
                    candidates=[],
                ),
            ],
        )

        with patch.object(cli, "build_item_relationship_inventory", return_value=report):
            stdout = io.StringIO()
            with redirect_stdout(stdout):
                exit_code = cli.main(["item-relationships"])

        self.assertEqual(0, exit_code)
        output = stdout.getvalue()
        self.assertIn("GAP useable Scroll of Imbuement #75: no relationship evidence", output)
        self.assertIn("GAP useable Scroll of Imbuement #76: no relationship evidence", output)


if __name__ == "__main__":
    unittest.main()
