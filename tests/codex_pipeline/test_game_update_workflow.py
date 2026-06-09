import io
import unittest
from unittest.mock import patch


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
