import io
import unittest
from pathlib import Path
from unittest.mock import patch


class ReleaseCheckTests(unittest.TestCase):
    def test_release_check_reports_local_readiness_without_live_check_by_default(self):
        from tools.codex_pipeline import cli

        output = io.StringIO()
        with (
            patch.object(cli, "run_validate", return_value=0) as run_validate,
            patch.object(cli, "load_static_asset_version", return_value="codex-test"),
            patch.object(cli, "update_static_asset_versions", return_value=[]) as version_assets,
            patch.object(cli, "git_status_lines", return_value=[]) as git_status,
            patch.object(cli, "run_verify_live", side_effect=AssertionError("verify-live should not run")),
            patch("sys.stdout", output),
        ):
            exit_code = cli.main(["release-check"])

        self.assertEqual(0, exit_code)
        run_validate.assert_called_once_with()
        version_assets.assert_called_once_with(cli.VALIDATED_HTML_PATHS, "codex-test", dry_run=True)
        git_status.assert_called_once_with()
        printed = output.getvalue()
        self.assertIn("RELEASE CHECK validate", printed)
        self.assertIn("RELEASE OK validate", printed)
        self.assertIn("RELEASE OK static-assets: version codex-test", printed)
        self.assertIn("RELEASE OK git-status: clean", printed)
        self.assertIn("RELEASE CHECK COMPLETE: ready", printed)

    def test_release_check_fails_for_static_asset_drift_and_dirty_worktree(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.static_assets import StaticAssetVersionResult

        output = io.StringIO()
        stale_page = StaticAssetVersionResult(
            path=Path("pages/items/weapons.html"),
            changed=True,
            asset_reference_count=3,
            cache_meta_added=False,
        )
        with (
            patch.object(cli, "run_validate", return_value=1),
            patch.object(cli, "load_static_asset_version", return_value="codex-test"),
            patch.object(cli, "update_static_asset_versions", return_value=[stale_page]),
            patch.object(cli, "git_status_lines", return_value=[" M js/weapons-page.js", "?? notes.txt"]),
            patch("sys.stdout", output),
        ):
            exit_code = cli.main(["release-check"])

        self.assertEqual(1, exit_code)
        printed = output.getvalue()
        self.assertIn("RELEASE ERROR validate: exit code 1", printed)
        self.assertIn("RELEASE ERROR static-assets: 1 page(s) would change for version codex-test", printed)
        self.assertIn("RELEASE STALE pages/items/weapons.html: 3 asset reference(s)", printed)
        self.assertIn("RELEASE ERROR git-status: dirty worktree (2 changed path(s))", printed)
        self.assertIn("RELEASE DIRTY M js/weapons-page.js", printed)
        self.assertIn("RELEASE DIRTY ?? notes.txt", printed)
        self.assertIn("RELEASE CHECK COMPLETE: blocked", printed)

    def test_release_check_can_include_live_verification(self):
        from tools.codex_pipeline import cli

        output = io.StringIO()
        with (
            patch.object(cli, "run_validate", return_value=0),
            patch.object(cli, "load_static_asset_version", return_value="codex-test"),
            patch.object(cli, "update_static_asset_versions", return_value=[]),
            patch.object(cli, "git_status_lines", return_value=[]),
            patch.object(cli, "run_verify_live", return_value=1) as verify_live,
            patch("sys.stdout", output),
        ):
            exit_code = cli.main(["release-check", "--verify-live", "--site-url", "https://example.test/codex/"])

        self.assertEqual(1, exit_code)
        verify_live.assert_called_once()
        self.assertEqual("https://example.test/codex/", verify_live.call_args.args[0].site_url)
        printed = output.getvalue()
        self.assertIn("RELEASE CHECK verify-live", printed)
        self.assertIn("RELEASE ERROR verify-live: exit code 1", printed)
        self.assertIn("RELEASE CHECK COMPLETE: blocked", printed)


if __name__ == "__main__":
    unittest.main()
