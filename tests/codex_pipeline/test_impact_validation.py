import json
from pathlib import Path
import tempfile
import unittest

from tools.codex_pipeline.exports import DataDiffReport, ExportTarget, FieldChange, RecordChange
from tools.codex_pipeline.gameplay_impact import build_gameplay_impact_report, gameplay_impact_digest
from tools.codex_pipeline.impact_validation import (
    build_impact_validation_plan,
    build_impact_validation_plan_json,
    write_impact_validation_plan_json,
)


def target(name: str) -> ExportTarget:
    return ExportTarget(
        name=name,
        extractor_script=Path(f"extract_{name}.py"),
        source_data=Path(f"client/{name}.json"),
        output_filename=f"{name}.json",
        site_path=Path(f"site/{name}.json"),
    )


def diff(
    name: str,
    *,
    added: list[str] | None = None,
    removed: list[str] | None = None,
    changes: list[FieldChange] | None = None,
) -> DataDiffReport:
    changed = []
    if changes:
        changed.append(RecordChange(key="id:1", label=f"Changed {name} (1)", field_changes=changes))
    return DataDiffReport(
        target=target(name),
        generated_path=Path(f"generated/{name}.json"),
        site_path=Path(f"site/{name}.json"),
        added=added or [],
        removed=removed or [],
        changed=changed,
    )


class ImpactValidationTests(unittest.TestCase):
    def test_public_inventory_changes_route_each_target_page_and_shared_checks(self):
        expected_page_checks = {
            "weapons": "weapons-page",
            "armors": "armors-page",
            "monsters": "monsters-page",
            "collectables": "collectables-page",
            "useables": "useables-page",
        }
        shared_checks = {"asset-coverage", "data-integrity", "deep-links", "item-relationships", "site-search"}

        for target_name, page_check in expected_page_checks.items():
            with self.subTest(target=target_name):
                impact = build_gameplay_impact_report(
                    [diff(target_name, added=[f"New {target_name} record (1)"])]
                )
                plan = build_impact_validation_plan(
                    impact,
                    report_digest=gameplay_impact_digest(impact),
                )
                check_ids = {check.check_id for check in plan.checks}

                self.assertIn(page_check, check_ids)
                self.assertTrue(shared_checks.issubset(check_ids))

    def test_routes_elements_perks_and_public_inventory_changes(self):
        impact = build_gameplay_impact_report(
            [
                diff(
                    "weapons",
                    added=["Crystal Sword (2)"],
                    changes=[
                        FieldChange("fields.element_label", "Fire", "Holy"),
                        FieldChange("fields.perk_label", "Runic", "Slayer"),
                    ],
                ),
                diff(
                    "armors",
                    changes=[FieldChange("fields.dark_resistance", 0, 15)],
                ),
                diff(
                    "monsters",
                    changes=[FieldChange("fields.rare_tatter_label", "Parry", "Finisher")],
                ),
            ]
        )
        report_digest = gameplay_impact_digest(impact)
        plan = build_impact_validation_plan(impact, report_digest=report_digest)
        by_id = {check.check_id: check for check in plan.checks}

        self.assertEqual(report_digest, plan.report_digest)
        self.assertTrue(plan.requires_browser_smoke)
        self.assertEqual(("game-update-report", "validate", "smoke-site"), plan.automated_runners)
        for check_id in (
            "armors-page",
            "asset-coverage",
            "build-planner",
            "data-integrity",
            "deep-links",
            "item-relationships",
            "monster-recommendations",
            "monsters-page",
            "perk-sources",
            "resistance-matchups",
            "site-search",
            "weapons-page",
        ):
            self.assertIn(check_id, by_id)
        self.assertTrue(any("element or resistance" in trigger for trigger in by_id["resistance-matchups"].triggers))
        self.assertTrue(any("perk or tatter" in trigger for trigger in by_id["perk-sources"].triggers))
        self.assertTrue(any("public records +1 -0" in trigger for trigger in by_id["site-search"].triggers))

        payload = json.loads(build_impact_validation_plan_json(plan))
        self.assertEqual(2, payload["schemaVersion"])
        self.assertEqual(report_digest, payload["reportDigest"])
        self.assertTrue(payload["summary"]["browserSmokeRequired"])
        self.assertEqual(len(plan.checks), payload["summary"]["checkCount"])
        self.assertEqual(len(plan.affected_records), payload["summary"]["affectedRecordCount"])
        self.assertEqual(
            {
                "addedRecords": "all",
                "removedRecords": "all",
                "changedRecordsPerTarget": 5,
            },
            payload["browserProbePolicy"],
        )
        self.assertEqual(
            {
                "target": "weapons",
                "changeType": "added",
                "label": "Crystal Sword (2)",
                "name": "Crystal Sword",
                "queryValue": "2",
                "querySource": "id",
            },
            next(record for record in payload["affectedRecords"] if record["changeType"] == "added"),
        )

    def test_routes_routine_target_changes_to_integrity_and_item_page(self):
        impact = build_gameplay_impact_report(
            [diff("weapons", changes=[FieldChange("fields.value", 100, 200)])]
        )
        plan = build_impact_validation_plan(impact, report_digest=gameplay_impact_digest(impact))

        self.assertEqual(["data-integrity", "weapons-page"], [check.check_id for check in plan.checks])
        self.assertTrue(plan.requires_browser_smoke)

    def test_no_changes_produces_empty_plan_and_writes_deterministic_json(self):
        impact = build_gameplay_impact_report([])
        plan = build_impact_validation_plan(impact, report_digest=gameplay_impact_digest(impact))

        self.assertEqual([], plan.checks)
        self.assertEqual([], plan.affected_records)
        self.assertFalse(plan.requires_browser_smoke)
        self.assertEqual((), plan.automated_runners)
        with tempfile.TemporaryDirectory() as tmp_dir:
            path = Path(tmp_dir) / "impact_validation_plan.json"
            write_impact_validation_plan_json(plan, path)
            first = path.read_text(encoding="utf-8")
            write_impact_validation_plan_json(plan, path)
            second = path.read_text(encoding="utf-8")
        self.assertEqual(first, second)


if __name__ == "__main__":
    unittest.main()
