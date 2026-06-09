import io
from pathlib import Path
import unittest
from unittest.mock import patch

from tools.codex_pipeline.assets import AssetChangeReport
from tools.codex_pipeline.game_update import GameUpdateReport


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


class GameUpdateWorkflowTests(unittest.TestCase):
    def test_cli_game_update_workflow_runs_review_steps_in_order(self):
        from tools.codex_pipeline import cli

        events = []

        def record(name):
            def inner(args):
                events.append((name, getattr(args, "dry_run", None)))
                return 0

            return inner

        output = io.StringIO()
        with (
            patch.object(cli, "run_doctor", record("doctor")),
            patch.object(cli, "run_game_update_report", record("game-update-report")),
            patch.object(cli, "run_sync_generated", record("sync-generated")),
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
                ("doctor", False),
                ("game-update-report", False),
                ("sync-generated", True),
                ("sync-assets", True),
            ],
            events,
        )
        self.assertIn("WORKFLOW STEP doctor", output.getvalue())

    def test_cli_game_update_workflow_apply_and_verify_runs_post_review_steps(self):
        from tools.codex_pipeline import cli

        events = []

        def record(name):
            def inner(args=None):
                events.append((name, getattr(args, "dry_run", None)))
                return 0

            return inner

        with (
            patch.object(cli, "run_doctor", record("doctor")),
            patch.object(cli, "run_game_update_report", record("game-update-report")),
            patch.object(cli, "run_sync_generated", record("sync-generated")),
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
                ("doctor", False),
                ("game-update-report", False),
                ("sync-generated", True),
                ("sync-assets", True),
                ("sync-generated", False),
                ("sync-assets", False),
                ("refresh-manifest", None),
                ("validate", None),
                ("verify-live", False),
            ],
            events,
        )

    def test_cli_game_update_workflow_can_request_review_checklist(self):
        from tools.codex_pipeline import cli

        events = []

        def record(name):
            def inner(args):
                events.append((name, getattr(args, "review_checklist", None), getattr(args, "dry_run", None)))
                return 0

            return inner

        with (
            patch.object(cli, "run_doctor", record("doctor")),
            patch.object(cli, "run_game_update_report", record("game-update-report")),
            patch.object(cli, "run_sync_generated", record("sync-generated")),
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
                ("doctor", True, False),
                ("game-update-report", True, False),
                ("sync-generated", True, True),
                ("sync-assets", True, True),
            ],
            events,
        )

    def test_cli_game_update_workflow_apply_stops_when_sync_readiness_is_blocked(self):
        from tools.codex_pipeline import cli

        blocked_report = blocked_asset_change_report()
        events = []

        def record_sync(name):
            def inner(args):
                events.append((name, getattr(args, "dry_run", None)))
                return 0

            return inner

        output = io.StringIO()
        with (
            patch.object(cli, "run_doctor", lambda args: 0),
            patch.object(cli, "resolve_targets", return_value=[]),
            patch.object(cli, "build_game_update_report", return_value=blocked_report),
            patch.object(cli, "run_sync_generated", record_sync("sync-generated")),
            patch.object(cli, "run_sync_assets", record_sync("sync-assets")),
            patch.object(cli, "run_refresh_manifest", side_effect=AssertionError("refresh-manifest should not run")),
            patch.object(cli, "run_validate", side_effect=AssertionError("validate should not run")),
            patch("sys.stdout", output),
        ):
            exit_code = cli.main(["game-update-workflow", "--apply"])

        self.assertEqual(1, exit_code)
        self.assertEqual(
            [
                ("sync-generated", True),
                ("sync-assets", True),
            ],
            events,
        )
        self.assertIn("SYNC READINESS: BLOCKED", output.getvalue())
        self.assertIn("WORKFLOW STOP apply: sync readiness BLOCKED; rerun with --force-apply to override", output.getvalue())

    def test_cli_game_update_workflow_force_apply_overrides_blocked_sync_readiness(self):
        from tools.codex_pipeline import cli

        blocked_report = blocked_asset_change_report()
        events = []

        def record(name):
            def inner(args=None):
                events.append((name, getattr(args, "dry_run", None)))
                return 0

            return inner

        output = io.StringIO()
        with (
            patch.object(cli, "run_doctor", lambda args: 0),
            patch.object(cli, "resolve_targets", return_value=[]),
            patch.object(cli, "build_game_update_report", return_value=blocked_report),
            patch.object(cli, "run_sync_generated", record("sync-generated")),
            patch.object(cli, "run_sync_assets", record("sync-assets")),
            patch.object(cli, "run_refresh_manifest", record("refresh-manifest")),
            patch.object(cli, "run_validate", record("validate")),
            patch("sys.stdout", output),
        ):
            exit_code = cli.main(["game-update-workflow", "--apply", "--force-apply"])

        self.assertEqual(0, exit_code)
        self.assertEqual(
            [
                ("sync-generated", True),
                ("sync-assets", True),
                ("sync-generated", False),
                ("sync-assets", False),
                ("refresh-manifest", None),
                ("validate", None),
            ],
            events,
        )
        self.assertIn("WORKFLOW OVERRIDE apply: sync readiness BLOCKED; continuing because --force-apply was provided", output.getvalue())
