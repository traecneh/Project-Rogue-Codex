import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image

from tools.codex_pipeline.asset_review import AssetImageReviewArtifact
from tools.codex_pipeline.assets import AssetChangeReport
from tools.codex_pipeline.client_inventory import ClientInventoryDiffEntry, ClientInventoryDiffReport
from tools.codex_pipeline.exports import DataDiffReport, ExportTarget, FieldChange, RecordChange
from tools.codex_pipeline.game_update import GameUpdateReport
from tools.codex_pipeline.unknowns import UnknownFieldReport, UnknownFieldTargetReport


def blocked_asset_change_report() -> GameUpdateReport:
    return GameUpdateReport(
        output_dir=Path("generated"),
        source_checks=[],
        export_results=[],
        diff_reports=[],
        unknown_reports=[],
        asset_reports=[
            AssetChangeReport(
                target_name="weapons",
                client_dir=Path("client/Weapons"),
                site_dir=Path("images/weapons"),
                client_count=1,
                site_count=0,
                manifest_count=0,
                added=["New Sword.gif"],
                removed=[],
                changed=[],
                issues=[],
            )
        ],
        drop_report=None,
        validation_issues=[],
        export_errors=[],
        skipped_sections=[],
    )


def workflow_summary_report() -> GameUpdateReport:
    target = ExportTarget(
        name="weapons",
        extractor_script=Path("tools/extract_weapons.py"),
        source_data=Path("client/data05.dat"),
        output_filename="weapons_data05.json",
        site_path=Path("site/data/weapons.json"),
    )
    return GameUpdateReport(
        output_dir=Path("generated"),
        source_checks=[],
        export_results=[],
        diff_reports=[
            DataDiffReport(
                target=target,
                generated_path=Path("generated/weapons_data05.json"),
                site_path=Path("site/data/weapons.json"),
                added=["Frost Bow"],
                removed=[],
                changed=[
                    RecordChange(
                        key="1",
                        label="Iron Sword",
                        field_changes=[FieldChange("damage", 8, 9)],
                    )
                ],
            )
        ],
        unknown_reports=[
            UnknownFieldTargetReport(
                target_name="weapons",
                data_path=Path("generated/weapons_data05.json"),
                record_count=2,
                fields=[
                    UnknownFieldReport(
                        name="unknown_12",
                        record_count=2,
                        nonzero_count=1,
                        values=[0, 1],
                        samples=["Frost Bow"],
                    )
                ],
            )
        ],
        asset_reports=[
            AssetChangeReport(
                target_name="weapons",
                client_dir=Path("client/Weapons"),
                site_dir=Path("images/weapons"),
                client_count=2,
                site_count=1,
                manifest_count=1,
                added=["Frost Bow.gif"],
                removed=[],
                changed=[],
                issues=[],
            )
        ],
        drop_report=None,
        validation_issues=[],
        export_errors=[],
        skipped_sections=[],
    )


def write_pixel_image(path: Path, pixel: tuple[int, int, int, int]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image = Image.new("RGBA", (1, 1), pixel)
    image.save(path)


class GameUpdateWorkflowTests(unittest.TestCase):
    def test_build_game_update_workflow_summary_markdown_includes_review_sections(self):
        from tools.codex_pipeline import cli

        inventory_diff = ClientInventoryDiffReport(
            entries=[
                ClientInventoryDiffEntry(
                    section="packed_json",
                    key="weapons.json",
                    change_type="changed",
                    summary="fields added: holyResist, darkResist",
                )
            ],
            issues=[],
        )
        markdown = cli.build_game_update_workflow_summary_markdown(
            inventory_diff,
            workflow_summary_report(),
            apply_requested=False,
        )

        self.assertIn("# Project Rogue Codex Workflow Summary", markdown)
        self.assertIn("## Recommended Next Action", markdown)
        self.assertIn("- Sync readiness: BLOCKED", markdown)
        self.assertIn("- Client inventory: 1 change(s), 0 issue(s)", markdown)
        self.assertIn("- Data: +1 -0 ~1", markdown)
        self.assertIn("- Images: +1 -0 ~0", markdown)
        self.assertIn("- Changed: packed_json weapons.json: fields added: holyResist, darkResist", markdown)
        self.assertIn("- Added: Frost Bow", markdown)
        self.assertIn("- Changed: Iron Sword: damage", markdown)
        self.assertIn("- weapons: 1 unknown field(s), 1 with nonzero values across 2 record(s)", markdown)

    def test_build_game_update_workflow_summary_includes_hidden_exclusions(self):
        from tools.codex_pipeline import cli

        target = ExportTarget(
            name="weapons",
            extractor_script=Path("tools/extract_weapons.py"),
            source_data=Path("client/data05.dat"),
            output_filename="weapons_data05.json",
            site_path=Path("site/data/weapons.json"),
        )
        report = GameUpdateReport(
            output_dir=Path("generated"),
            source_checks=[],
            export_results=[],
            diff_reports=[
                DataDiffReport(
                    target=target,
                    generated_path=Path("generated/weapons_data05.json"),
                    site_path=Path("site/data/weapons.json"),
                    added=[],
                    removed=[],
                    changed=[],
                    hidden_added=["Super Duper Bow (1037)", "Super Duper Bow (1038)"],
                    hidden_removed=["Super Duper Bow (999)"],
                    hidden_changed=[
                        RecordChange(
                            key="id:100",
                            label="Super Duper Axe (100)",
                            field_changes=[FieldChange("fields.damage", 900, 1000)],
                        )
                    ],
                )
            ],
            unknown_reports=[],
            asset_reports=[
                AssetChangeReport(
                    target_name="weapons",
                    client_dir=Path("client/Weapons"),
                    site_dir=Path("images/weapons"),
                    client_count=2,
                    site_count=1,
                    manifest_count=1,
                    added=[],
                    removed=[],
                    changed=[],
                    issues=[],
                    hidden_added=["Super Duper Bow-1037.png", "Super Duper Bow-1038.png"],
                    hidden_removed=["Super Duper Bow.png"],
                    hidden_changed=[],
                )
            ],
            drop_report=None,
            validation_issues=[],
            export_errors=[],
            skipped_sections=[],
        )

        markdown = cli.build_game_update_workflow_summary_markdown(
            None,
            report,
            apply_requested=False,
        )

        self.assertIn("## Hidden Exclusions", markdown)
        self.assertIn("- Data hidden by `data/allowlists.json`: +2 -1 ~1", markdown)
        self.assertIn("- Images hidden by `data/allowlists.json`: +2 -1 ~0", markdown)
        self.assertIn("- Weapons data: +2 -1 ~1", markdown)
        self.assertIn("- Weapons images: +2 -1 ~0", markdown)
        self.assertNotIn("Super Duper Bow-1037.png", markdown)

    def test_build_game_update_workflow_summary_links_image_review_artifacts(self):
        from tools.codex_pipeline import cli

        summary_path = Path("generated-output/codex-data/game_update_workflow_summary.md")
        artifact = AssetImageReviewArtifact(
            markdown_path=Path("generated-output/image-review/asset_image_review.md"),
            sheet_paths=[
                Path("generated-output/image-review/weapons_contact_sheet.png"),
                Path("generated-output/image-review/weapons_priority_contact_sheet.png"),
            ],
        )

        markdown = cli.build_game_update_workflow_summary_markdown(
            None,
            workflow_summary_report(),
            apply_requested=False,
            image_review_artifact=artifact,
            summary_path=summary_path,
        )

        self.assertIn("## Image Review Artifacts", markdown)
        self.assertIn("- Full image review: [asset_image_review.md](../image-review/asset_image_review.md)", markdown)
        self.assertIn("- Contact sheet: [weapons_contact_sheet.png](../image-review/weapons_contact_sheet.png)", markdown)
        self.assertIn(
            "- Contact sheet: [weapons_priority_contact_sheet.png](../image-review/weapons_priority_contact_sheet.png)",
            markdown,
        )

    def test_build_game_update_workflow_summary_classifies_priority_image_changes(self):
        from tools.codex_pipeline import cli

        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            client_dir = root / "client" / "weapons"
            site_dir = root / "site" / "weapons"
            write_pixel_image(site_dir / "Meaningful.png", (255, 0, 0, 255))
            write_pixel_image(client_dir / "Meaningful.png", (0, 0, 255, 255))
            write_pixel_image(site_dir / "Background.png", (255, 0, 255, 255))
            write_pixel_image(client_dir / "Background.png", (0, 0, 0, 0))
            write_pixel_image(site_dir / "Encoding.png", (10, 20, 30, 255))
            write_pixel_image(client_dir / "Encoding.png", (10, 20, 30, 255))

            report = GameUpdateReport(
                output_dir=root / "generated",
                source_checks=[],
                export_results=[],
                diff_reports=[],
                unknown_reports=[],
                asset_reports=[
                    AssetChangeReport(
                        target_name="weapons",
                        client_dir=client_dir,
                        site_dir=site_dir,
                        client_count=4,
                        site_count=4,
                        manifest_count=4,
                        added=["New Bow.png"],
                        removed=["Old Sword.png"],
                        changed=["Background.png", "Encoding.png", "Meaningful.png"],
                        issues=[],
                    )
                ],
                drop_report=None,
                validation_issues=[],
                export_errors=[],
                skipped_sections=[],
            )

            markdown = cli.build_game_update_workflow_summary_markdown(
                None,
                report,
                apply_requested=False,
            )
            capped_markdown = cli.build_game_update_workflow_summary_markdown(
                None,
                report,
                apply_requested=False,
                max_records=2,
            )

        self.assertIn("## Image Review Decision", markdown)
        self.assertIn("- Priority image changes: 3 (+1 -1 ~1)", markdown)
        self.assertIn("- Low-priority changed images: 2 (background-only=1, encoding-only=1)", markdown)
        self.assertIn(
            "- Recommended apply command: python -m tools.codex_pipeline game-update-workflow --apply --force-apply --image-sync-scope priority",
            markdown,
        )
        self.assertIn("- Weapons: priority=3, low-priority=2, changed classifications: meaningful=1, background-only=1, encoding-only=1, unreadable=0", markdown)
        self.assertIn("## Priority Image Details", markdown)
        self.assertIn("- Weapons added: New Bow.png", markdown)
        self.assertIn("- Weapons removed: Old Sword.png", markdown)
        self.assertIn("- Weapons changed meaningful: Meaningful.png", markdown)
        self.assertNotIn("Background.png", markdown.split("## Priority Image Details", 1)[1].split("## Image Diff", 1)[0])
        self.assertIn("- ... 1 more priority image change(s)", capped_markdown)
        self.assertNotIn("- Weapons changed meaningful: Meaningful.png", capped_markdown)

    def test_low_priority_image_churn_does_not_block_sync_readiness(self):
        from tools.codex_pipeline import cli

        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            client_dir = root / "client" / "weapons"
            site_dir = root / "site" / "weapons"
            write_pixel_image(site_dir / "Encoding.png", (10, 20, 30, 255))
            write_pixel_image(client_dir / "Encoding.png", (10, 20, 30, 255))
            write_pixel_image(site_dir / "Background.png", (255, 0, 255, 255))
            write_pixel_image(client_dir / "Background.png", (0, 0, 0, 0))
            report = GameUpdateReport(
                output_dir=root / "generated",
                source_checks=[],
                export_results=[],
                diff_reports=[],
                unknown_reports=[],
                asset_reports=[
                    AssetChangeReport(
                        target_name="weapons",
                        client_dir=client_dir,
                        site_dir=site_dir,
                        client_count=2,
                        site_count=2,
                        manifest_count=2,
                        added=[],
                        removed=[],
                        changed=["Background.png", "Encoding.png"],
                        issues=[],
                    )
                ],
                drop_report=None,
                validation_issues=[],
                export_errors=[],
                skipped_sections=[],
            )

            markdown = cli.build_game_update_workflow_summary_markdown(
                None,
                report,
                apply_requested=False,
            )
            has_changes = report.has_changes
            safe_to_sync = report.safe_to_sync

        self.assertTrue(has_changes)
        self.assertTrue(safe_to_sync)
        self.assertIn(
            "- Only low-priority image churn remains; no apply step is needed unless you intentionally want to sync it.",
            markdown,
        )
        self.assertIn("- Sync readiness: OK", markdown)
        self.assertIn("- Priority image changes: 0 (+0 -0 ~0)", markdown)
        self.assertIn("- Low-priority changed images: 2 (background-only=1, encoding-only=1)", markdown)
        self.assertIn(
            "- Recommended apply command: skip apply unless you intentionally want to sync low-priority changed-image churn.",
            markdown,
        )
        self.assertIn("- No priority image changes.", markdown)
        self.assertIn("- No blockers or skipped review sections.", markdown)
        self.assertNotIn("SYNC READINESS: image changes require human review before applying.", markdown)

    def test_cli_game_update_workflow_writes_summary_artifact(self):
        from tools.codex_pipeline import cli

        inventory_diff = ClientInventoryDiffReport(
            entries=[
                ClientInventoryDiffEntry(
                    section="vpack",
                    key="rogue_data.vpack",
                    change_type="changed",
                    summary="sha256 changed",
                )
            ],
            issues=[],
        )
        report = workflow_summary_report()

        def record_inventory(args):
            setattr(args, "_client_inventory_diff_report", inventory_diff)
            return 0

        def record_game_update_report(args):
            setattr(args, "_game_update_report", report)
            setattr(args, "_game_update_report_safe_to_sync", report.safe_to_sync)
            return 0

        with tempfile.TemporaryDirectory() as tmp_dir:
            output_dir = Path(tmp_dir)
            image_review_dir = output_dir.parent / "image-review"
            image_artifact = AssetImageReviewArtifact(
                markdown_path=image_review_dir / "asset_image_review.md",
                sheet_paths=[image_review_dir / "weapons_priority_contact_sheet.png"],
            )

            def record_game_update_report_with_artifact(args):
                record_game_update_report(args)
                setattr(args, "_asset_image_review_artifact", image_artifact)
                return 0

            output = io.StringIO()
            with (
                patch.object(cli, "run_client_inventory", record_inventory),
                patch.object(cli, "run_doctor", lambda args: 0),
                patch.object(cli, "run_game_update_report", record_game_update_report_with_artifact),
                patch.object(cli, "run_sync_generated", lambda args: 0),
                patch.object(cli, "run_extract_atlas_assets", lambda args: 0),
                patch.object(cli, "run_sync_assets", lambda args: 0),
                patch.object(cli, "run_refresh_manifest", side_effect=AssertionError("refresh-manifest should not run")),
                patch.object(cli, "run_validate", side_effect=AssertionError("validate should not run")),
                patch.object(cli, "run_verify_live", side_effect=AssertionError("verify-live should not run")),
                patch("sys.stdout", output),
            ):
                exit_code = cli.main(["game-update-workflow", "--write-summary", "--output-dir", str(output_dir)])

            summary_path = output_dir / "game_update_workflow_summary.md"
            self.assertEqual(0, exit_code)
            self.assertTrue(summary_path.is_file())
            self.assertIn("WROTE WORKFLOW SUMMARY:", output.getvalue())
            self.assertIn("sha256 changed", summary_path.read_text(encoding="utf-8"))
            self.assertIn("../image-review/asset_image_review.md", summary_path.read_text(encoding="utf-8"))

    def test_cli_game_update_workflow_runs_review_steps_in_order(self):
        from tools.codex_pipeline import cli

        events = []

        def record(name):
            def inner(args):
                events.append(
                    (
                        name,
                        getattr(args, "dry_run", None),
                        getattr(args, "asset_source", None),
                        getattr(args, "diff_snapshot", None),
                        getattr(args, "write_snapshot", None),
                    )
                )
                return 0

            return inner

        output = io.StringIO()
        with (
            patch.object(cli, "run_client_inventory", record("client-inventory")),
            patch.object(cli, "run_doctor", record("doctor")),
            patch.object(cli, "run_game_update_report", record("game-update-report")),
            patch.object(cli, "run_sync_generated", record("sync-generated")),
            patch.object(cli, "run_extract_atlas_assets", record("extract-atlas-assets")),
            patch.object(cli, "run_sync_assets", record("sync-assets")),
            patch.object(cli, "run_refresh_manifest", side_effect=AssertionError("refresh-manifest should not run")),
            patch.object(cli, "run_validate", side_effect=AssertionError("validate should not run")),
            patch.object(cli, "run_verify_live", side_effect=AssertionError("verify-live should not run")),
            patch("sys.stdout", output),
        ):
            exit_code = cli.main(["game-update-workflow"])

        self.assertEqual(0, exit_code)
        self.assertEqual(
            [
                ("client-inventory", False, "auto", True, False),
                ("doctor", False, "auto", False, False),
                ("game-update-report", False, "atlas", False, False),
                ("sync-generated", True, "auto", False, False),
                ("extract-atlas-assets", False, "atlas", False, False),
                ("sync-assets", True, "atlas", False, False),
            ],
            events,
        )
        self.assertIn("WORKFLOW STEP client-inventory --diff-snapshot", output.getvalue())

    def test_cli_game_update_workflow_apply_and_verify_runs_post_review_steps(self):
        from tools.codex_pipeline import cli

        events = []

        def record(name):
            def inner(args=None):
                events.append(
                    (
                        name,
                        getattr(args, "dry_run", None),
                        getattr(args, "asset_source", None),
                        getattr(args, "diff_snapshot", None),
                        getattr(args, "write_snapshot", None),
                    )
                )
                return 0

            return inner

        with (
            patch.object(cli, "run_client_inventory", record("client-inventory")),
            patch.object(cli, "run_doctor", record("doctor")),
            patch.object(cli, "run_game_update_report", record("game-update-report")),
            patch.object(cli, "run_sync_generated", record("sync-generated")),
            patch.object(cli, "run_extract_atlas_assets", record("extract-atlas-assets")),
            patch.object(cli, "run_sync_assets", record("sync-assets")),
            patch.object(cli, "run_refresh_manifest", record("refresh-manifest")),
            patch.object(cli, "run_validate", record("validate")),
            patch.object(cli, "run_verify_live", record("verify-live")),
            patch("sys.stdout", io.StringIO()),
        ):
            exit_code = cli.main(["game-update-workflow", "--apply", "--verify-live"])

        self.assertEqual(0, exit_code)
        self.assertEqual(
            [
                ("client-inventory", False, "auto", True, False),
                ("doctor", False, "auto", False, False),
                ("game-update-report", False, "atlas", False, False),
                ("sync-generated", True, "auto", False, False),
                ("extract-atlas-assets", False, "atlas", False, False),
                ("sync-assets", True, "atlas", False, False),
                ("sync-generated", False, "auto", False, False),
                ("extract-atlas-assets", False, "atlas", False, False),
                ("sync-assets", False, "atlas", False, False),
                ("refresh-manifest", None, None, None, None),
                ("validate", None, None, None, None),
                ("client-inventory", False, "auto", False, True),
                ("verify-live", False, "auto", False, False),
            ],
            events,
        )

    def test_cli_game_update_workflow_apply_defaults_asset_sync_to_priority_scope(self):
        from tools.codex_pipeline import cli

        scopes = []

        def record_sync_assets(args):
            scopes.append((getattr(args, "dry_run", None), getattr(args, "image_sync_scope", None)))
            return 0

        with (
            patch.object(cli, "run_client_inventory", lambda args: 0),
            patch.object(cli, "run_doctor", lambda args: 0),
            patch.object(cli, "run_game_update_report", lambda args: 0),
            patch.object(cli, "run_sync_generated", lambda args: 0),
            patch.object(cli, "run_extract_atlas_assets", lambda args: 0),
            patch.object(cli, "run_sync_assets", record_sync_assets),
            patch.object(cli, "run_refresh_manifest", lambda: 0),
            patch.object(cli, "run_validate", lambda: 0),
            patch("sys.stdout", io.StringIO()),
        ):
            exit_code = cli.main(["game-update-workflow", "--apply"])

        self.assertEqual(0, exit_code)
        self.assertEqual([(True, "priority"), (False, "priority")], scopes)

    def test_cli_game_update_workflow_can_opt_into_full_image_sync_scope(self):
        from tools.codex_pipeline import cli

        scopes = []

        def record_sync_assets(args):
            scopes.append((getattr(args, "dry_run", None), getattr(args, "image_sync_scope", None)))
            return 0

        with (
            patch.object(cli, "run_client_inventory", lambda args: 0),
            patch.object(cli, "run_doctor", lambda args: 0),
            patch.object(cli, "run_game_update_report", lambda args: 0),
            patch.object(cli, "run_sync_generated", lambda args: 0),
            patch.object(cli, "run_extract_atlas_assets", lambda args: 0),
            patch.object(cli, "run_sync_assets", record_sync_assets),
            patch.object(cli, "run_refresh_manifest", lambda: 0),
            patch.object(cli, "run_validate", lambda: 0),
            patch("sys.stdout", io.StringIO()),
        ):
            exit_code = cli.main(["game-update-workflow", "--apply", "--image-sync-scope", "all"])

        self.assertEqual(0, exit_code)
        self.assertEqual([(True, "all"), (False, "all")], scopes)

    def test_cli_game_update_workflow_can_request_review_checklist(self):
        from tools.codex_pipeline import cli

        events = []

        def record(name):
            def inner(args):
                events.append(
                    (
                        name,
                        getattr(args, "review_checklist", None),
                        getattr(args, "dry_run", None),
                        getattr(args, "asset_source", None),
                    )
                )
                return 0

            return inner

        with (
            patch.object(cli, "run_client_inventory", record("client-inventory")),
            patch.object(cli, "run_doctor", record("doctor")),
            patch.object(cli, "run_game_update_report", record("game-update-report")),
            patch.object(cli, "run_sync_generated", record("sync-generated")),
            patch.object(cli, "run_extract_atlas_assets", record("extract-atlas-assets")),
            patch.object(cli, "run_sync_assets", record("sync-assets")),
            patch.object(cli, "run_refresh_manifest", side_effect=AssertionError("refresh-manifest should not run")),
            patch.object(cli, "run_validate", side_effect=AssertionError("validate should not run")),
            patch.object(cli, "run_verify_live", side_effect=AssertionError("verify-live should not run")),
            patch("sys.stdout", io.StringIO()),
        ):
            exit_code = cli.main(["game-update-workflow", "--review-checklist"])

        self.assertEqual(0, exit_code)
        self.assertEqual(
            [
                ("client-inventory", True, False, "auto"),
                ("doctor", True, False, "auto"),
                ("game-update-report", True, False, "atlas"),
                ("sync-generated", True, True, "auto"),
                ("extract-atlas-assets", True, False, "atlas"),
                ("sync-assets", True, True, "atlas"),
            ],
            events,
        )

    def test_cli_game_update_workflow_apply_stops_when_sync_readiness_is_blocked(self):
        from tools.codex_pipeline import cli

        blocked_report = blocked_asset_change_report()
        events = []
        inventory_events = []

        def record_sync(name):
            def inner(args):
                events.append((name, getattr(args, "dry_run", None), getattr(args, "asset_source", None)))
                return 0

            return inner

        def record_inventory(args):
            inventory_events.append((getattr(args, "diff_snapshot", None), getattr(args, "write_snapshot", None)))
            return 0

        output = io.StringIO()
        with (
            patch.object(cli, "run_client_inventory", record_inventory),
            patch.object(cli, "run_doctor", lambda args: 0),
            patch.object(cli, "resolve_targets", return_value=[]),
            patch.object(cli, "build_game_update_report", return_value=blocked_report),
            patch.object(cli, "run_sync_generated", record_sync("sync-generated")),
            patch.object(cli, "run_extract_atlas_assets", record_sync("extract-atlas-assets")),
            patch.object(cli, "run_sync_assets", record_sync("sync-assets")),
            patch.object(cli, "run_refresh_manifest", side_effect=AssertionError("refresh-manifest should not run")),
            patch.object(cli, "run_validate", side_effect=AssertionError("validate should not run")),
            patch("sys.stdout", output),
        ):
            exit_code = cli.main(["game-update-workflow", "--apply"])

        self.assertEqual(1, exit_code)
        self.assertEqual(
            [
                ("sync-generated", True, "auto"),
                ("extract-atlas-assets", False, "atlas"),
                ("sync-assets", True, "atlas"),
            ],
            events,
        )
        self.assertEqual([(True, False)], inventory_events)
        self.assertIn("SYNC READINESS: BLOCKED", output.getvalue())
        self.assertIn("WORKFLOW STOP apply: sync readiness BLOCKED; rerun with --force-apply to override", output.getvalue())

    def test_cli_game_update_workflow_force_apply_overrides_blocked_sync_readiness(self):
        from tools.codex_pipeline import cli

        blocked_report = blocked_asset_change_report()
        events = []

        def record(name):
            def inner(args=None):
                events.append((name, getattr(args, "dry_run", None), getattr(args, "asset_source", None)))
                return 0

            return inner

        output = io.StringIO()
        with (
            patch.object(cli, "run_client_inventory", lambda args: 0),
            patch.object(cli, "run_doctor", lambda args: 0),
            patch.object(cli, "resolve_targets", return_value=[]),
            patch.object(cli, "build_game_update_report", return_value=blocked_report),
            patch.object(cli, "run_sync_generated", record("sync-generated")),
            patch.object(cli, "run_extract_atlas_assets", record("extract-atlas-assets")),
            patch.object(cli, "run_sync_assets", record("sync-assets")),
            patch.object(cli, "run_refresh_manifest", record("refresh-manifest")),
            patch.object(cli, "run_validate", record("validate")),
            patch("sys.stdout", output),
        ):
            exit_code = cli.main(["game-update-workflow", "--apply", "--force-apply"])

        self.assertEqual(0, exit_code)
        self.assertEqual(
            [
                ("sync-generated", True, "auto"),
                ("extract-atlas-assets", False, "atlas"),
                ("sync-assets", True, "atlas"),
                ("sync-generated", False, "auto"),
                ("extract-atlas-assets", False, "atlas"),
                ("sync-assets", False, "atlas"),
                ("refresh-manifest", None, None),
                ("validate", None, None),
            ],
            events,
        )
        self.assertIn("WORKFLOW OVERRIDE apply: sync readiness BLOCKED; continuing because --force-apply was provided", output.getvalue())

    def test_cli_game_update_workflow_apply_does_not_refresh_snapshot_when_validation_fails(self):
        from tools.codex_pipeline import cli

        events = []

        def record(name):
            def inner(args=None):
                events.append((name, getattr(args, "diff_snapshot", None), getattr(args, "write_snapshot", None)))
                return 0

            return inner

        output = io.StringIO()
        with (
            patch.object(cli, "run_client_inventory", record("client-inventory")),
            patch.object(cli, "run_doctor", record("doctor")),
            patch.object(cli, "run_game_update_report", record("game-update-report")),
            patch.object(cli, "run_sync_generated", record("sync-generated")),
            patch.object(cli, "run_extract_atlas_assets", record("extract-atlas-assets")),
            patch.object(cli, "run_sync_assets", record("sync-assets")),
            patch.object(cli, "run_refresh_manifest", record("refresh-manifest")),
            patch.object(cli, "run_validate", return_value=1),
            patch("sys.stdout", output),
        ):
            exit_code = cli.main(["game-update-workflow", "--apply"])

        self.assertEqual(1, exit_code)
        self.assertEqual(1, sum(1 for event in events if event == ("client-inventory", True, False)))
        self.assertNotIn(("client-inventory", False, True), events)
