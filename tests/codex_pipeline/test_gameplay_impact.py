import json
from pathlib import Path
import tempfile
import unittest

from tools.codex_pipeline.exports import DataDiffReport, ExportTarget, FieldChange, RecordChange
from tools.codex_pipeline.gameplay_impact import (
    build_gameplay_impact_json,
    build_gameplay_impact_markdown,
    build_gameplay_impact_report,
    gameplay_impact_digest,
    gameplay_risk_policy,
)


def target(name: str) -> ExportTarget:
    return ExportTarget(
        name=name,
        extractor_script=Path(f"extract_{name}.py"),
        source_data=Path(f"client/{name}.json"),
        output_filename=f"{name}.json",
        site_path=Path(f"site/{name}.json"),
    )


class GameplayImpactTests(unittest.TestCase):
    def test_report_keeps_gameplay_changes_and_quantifies_filtered_noise(self):
        report = build_gameplay_impact_report(
            [
                DataDiffReport(
                    target=target("weapons"),
                    generated_path=Path("generated/weapons.json"),
                    site_path=Path("site/weapons.json"),
                    added=["Crystal Sword (3)"],
                    removed=["Old Sword (2)"],
                    changed=[
                        RecordChange(
                            key="id:1",
                            label="Rune Sword (1)",
                            field_changes=[
                                FieldChange("name", "Runed Sword", "Rune Sword"),
                                FieldChange("fields.min_damage", 10, 12),
                                FieldChange("fields.element", 1, 2),
                                FieldChange("fields.element_label", "Fire", "Cold"),
                                FieldChange("fields.perk", 1, 59),
                                FieldChange("fields.perk_label", "Lifesteal (Tier 1)", "Berserker (Tier 1)"),
                                FieldChange("fields.value", 100, 200),
                                FieldChange("fields.frame_1_x", 16, 32),
                                FieldChange("fields.unknown_9", 0, 1),
                                FieldChange("fields.emits_light", None, 1),
                            ],
                        ),
                        RecordChange(
                            key="id:4",
                            label="Price-Only Sword (4)",
                            field_changes=[
                                FieldChange("fields.value_low", 10, 20),
                                FieldChange("fields.frame_1_y", 0, 16),
                            ],
                        ),
                    ],
                ),
                DataDiffReport(
                    target=target("armors"),
                    generated_path=Path("generated/armors.json"),
                    site_path=Path("site/armors.json"),
                    added=[],
                    removed=[],
                    changed=[
                        RecordChange(
                            key="id:7",
                            label="Holy Plate (7)",
                            field_changes=[
                                FieldChange("fields.armor", 10, 12),
                                FieldChange("fields.holy_resistance", 0, 15),
                                FieldChange("fields.deconstruction", 5, 8),
                                FieldChange("fields.value", 500, 750),
                            ],
                        )
                    ],
                ),
                DataDiffReport(
                    target=target("monsters"),
                    generated_path=Path("generated/monsters.json"),
                    site_path=Path("site/monsters.json"),
                    added=["Cinderbone Harrower (205)"],
                    removed=[],
                    changed=[
                        RecordChange(
                            key="id:10",
                            label="Hellfiend (10)",
                            field_changes=[
                                FieldChange("fields.level", 75, 90),
                                FieldChange("fields.health", 500, 650),
                                FieldChange("fields.rare_tatter", 11, 58),
                                FieldChange("fields.rare_tatter_label", "Parry", "Finisher"),
                                FieldChange("fields.total_flags", 1, 3),
                            ],
                        )
                    ],
                ),
            ]
        )

        self.assertEqual(2, report.added_count)
        self.assertEqual(1, report.removed_count)
        self.assertEqual(3, report.changed_record_count)
        self.assertEqual(10, report.changed_field_count)
        self.assertEqual(1, report.routine_only_record_count)
        self.assertEqual(11, report.omitted_field_change_count)
        self.assertEqual(3, report.omitted_counts["duplicate numeric codes"])
        self.assertEqual(3, report.omitted_counts["price fields"])
        self.assertEqual(2, report.omitted_counts["animation coordinates"])
        self.assertEqual(1, report.omitted_counts["unknown/raw fields"])
        self.assertEqual(2, report.omitted_counts["metadata enrichment"])
        self.assertEqual("high", report.highest_risk)
        self.assertEqual({"high": 9, "medium": 5, "low": 10}, report.risk_counts)
        markdown = build_gameplay_impact_markdown(report)
        self.assertIn("- Review risk: HIGH (high=9, medium=5, low=10)", markdown)
        report_digest = gameplay_impact_digest(report)
        self.assertRegex(report_digest, r"^sha256:[0-9a-f]{64}$")
        self.assertIn(f"- Report digest: `{report_digest}`", markdown)
        self.assertIn("**Level:** `75` -> `90`", markdown)
        self.assertNotIn("**Item level:** `75` -> `90`", markdown)

        payload = json.loads(build_gameplay_impact_json(report))
        self.assertEqual(1, payload["schemaVersion"])
        self.assertEqual(report_digest, payload["reportDigest"])
        self.assertEqual(report_digest, gameplay_impact_digest(report))
        self.assertEqual("high", payload["summary"]["highestRisk"])
        self.assertEqual({"high": 9, "medium": 5, "low": 10}, payload["summary"]["riskCounts"])
        self.assertEqual("acknowledgement_required", payload["summary"]["reviewDecision"]["status"])
        self.assertEqual(
            ["--write-summary", "--acknowledge-impact <report-digest>"],
            payload["summary"]["reviewDecision"]["requiredFlagsWhenEnforced"],
        )
        self.assertEqual(
            {"high": 0, "medium": 1, "low": 7},
            payload["targets"][0]["filtered"]["riskCounts"],
        )
        self.assertRegex(payload["targets"][0]["sourceDigest"], r"^sha256:[0-9a-f]{64}$")
        rune_sword = payload["targets"][0]["changed"][0]
        self.assertEqual("high", rune_sword["highestRisk"])
        self.assertEqual("medium", rune_sword["changes"][0]["risk"])
        self.assertEqual("high", rune_sword["changes"][1]["risk"])

    def test_markdown_uses_readable_values_and_excludes_raw_noise(self):
        source = DataDiffReport(
            target=target("weapons"),
            generated_path=Path("generated/weapons.json"),
            site_path=Path("site/weapons.json"),
            added=[],
            removed=[],
            changed=[
                RecordChange(
                    key="id:1",
                    label="Rune Sword (1)",
                    field_changes=[
                        FieldChange("fields.level_requirement", 75, 50),
                        FieldChange("fields.corrupted_perk", 41, 59),
                        FieldChange("fields.corrupted_perk_label", "Demonsbane (Tier 1)", "Berserker (Tier 1)"),
                        FieldChange("fields.value_low", 500, 1000),
                        FieldChange("fields.frame_1_x", 16, 32),
                        FieldChange("fields.unknown_9", 0, 1),
                    ],
                )
            ],
        )

        markdown = build_gameplay_impact_markdown(build_gameplay_impact_report([source]))

        self.assertIn("# Project Rogue Codex Gameplay Impact", markdown)
        self.assertIn("**Item level:** `75` -> `50`", markdown)
        self.assertIn(
            "**Corrupted perk:** `Demonsbane (Tier 1)` -> `Berserker (Tier 1)`",
            markdown,
        )
        self.assertIn("price fields=1", markdown)
        self.assertNotIn("fields.value_low", markdown)
        self.assertNotIn("fields.frame_1_x", markdown)
        self.assertNotIn("fields.unknown_9", markdown)
        self.assertNotIn("41", markdown)

    def test_risk_policy_distinguishes_none_low_and_medium(self):
        none_report = build_gameplay_impact_report([])
        self.assertEqual("no_changes", gameplay_risk_policy(none_report).status)

        medium_report = build_gameplay_impact_report(
            [
                DataDiffReport(
                    target=target("weapons"),
                    generated_path=Path("generated/weapons.json"),
                    site_path=Path("site/weapons.json"),
                    added=["Crystal Sword (3)"],
                    removed=[],
                    changed=[],
                )
            ]
        )
        medium_policy = gameplay_risk_policy(medium_report)
        self.assertEqual("summary_required", medium_policy.status)
        self.assertEqual(("--write-summary",), medium_policy.required_flags_when_enforced)

        low_report = build_gameplay_impact_report(
            [
                DataDiffReport(
                    target=target("weapons"),
                    generated_path=Path("generated/weapons.json"),
                    site_path=Path("site/weapons.json"),
                    added=[],
                    removed=[],
                    changed=[
                        RecordChange(
                            key="id:1",
                            label="Rune Sword (1)",
                            field_changes=[FieldChange("fields.value", 100, 200)],
                        )
                    ],
                )
            ]
        )
        low_policy = gameplay_risk_policy(low_report)
        self.assertEqual("automatic_apply_allowed", low_policy.status)
        self.assertEqual((), low_policy.required_flags_when_enforced)

    def test_report_digest_changes_when_generated_source_content_changes(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            generated_path = root / "generated.json"
            site_path = root / "site.json"
            generated_path.write_text('[{"ID": 1, "name": "New Sword"}]', encoding="utf-8")
            site_path.write_text("[]", encoding="utf-8")
            diff = DataDiffReport(
                target=target("weapons"),
                generated_path=generated_path,
                site_path=site_path,
                added=["New Sword (1)"],
                removed=[],
                changed=[],
            )

            first_report = build_gameplay_impact_report([diff])
            first_digest = gameplay_impact_digest(first_report)
            first_source_digest = first_report.targets[0].source_digest
            generated_path.write_text(
                '[{"ID": 1, "name": "New Sword", "fields": {"min_damage": 99}}]',
                encoding="utf-8",
            )
            second_report = build_gameplay_impact_report([diff])

        self.assertNotEqual(first_source_digest, second_report.targets[0].source_digest)
        self.assertNotEqual(first_digest, gameplay_impact_digest(second_report))


if __name__ == "__main__":
    unittest.main()
