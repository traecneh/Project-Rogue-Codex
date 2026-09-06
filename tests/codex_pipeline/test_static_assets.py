import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


class StaticAssetVersionTests(unittest.TestCase):
    def test_versions_local_css_and_js_references_without_touching_other_urls(self):
        from tools.codex_pipeline.static_assets import version_local_static_assets_in_html

        html = "\n".join(
            [
                '<link rel="stylesheet" href="css/styles.css" />',
                '<script src="js/site-search.js?v=old-token" defer></script>',
                '<img src="images/project-rogue-favicon.ico" />',
                '<script src="https://example.com/js/app.js"></script>',
            ]
        )

        updated, replacement_count = version_local_static_assets_in_html(html, "codex-test")

        self.assertEqual(2, replacement_count)
        self.assertIn('href="css/styles.css?v=codex-test"', updated)
        self.assertIn('src="js/site-search.js?v=codex-test"', updated)
        self.assertIn('src="images/project-rogue-favicon.ico"', updated)
        self.assertIn('src="https://example.com/js/app.js"', updated)

    def test_cli_bump_static_version_updates_configured_pages_and_version_file(self):
        from tools.codex_pipeline import cli

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            html_path = root / "page.html"
            version_path = root / "static_asset_version.txt"
            html_path.write_text(
                "\n".join(
                    [
                        "<!DOCTYPE html>",
                        '<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />',
                        '<link rel="stylesheet" href="css/styles.css?v=old-token" />',
                        '<script src="js/site-search.js" defer></script>',
                        "</head><body></body></html>",
                    ]
                ),
                encoding="utf-8",
            )
            version_path.write_text("old-token\n", encoding="utf-8")

            with (
                patch.object(cli, "VALIDATED_HTML_PATHS", [html_path]),
                patch.object(cli, "STATIC_ASSET_VERSION_PATH", version_path),
                patch("sys.stdout", new_callable=io.StringIO) as stdout,
            ):
                exit_code = cli.main(["bump-static-version", "--asset-version", "codex-test"])

            html = html_path.read_text(encoding="utf-8")
            version_text = version_path.read_text(encoding="utf-8")
            output = stdout.getvalue()

        self.assertEqual(0, exit_code)
        self.assertEqual("codex-test\n", version_text)
        self.assertIn('href="css/styles.css?v=codex-test"', html)
        self.assertIn('src="js/site-search.js?v=codex-test"', html)
        self.assertIn('<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />', html)
        self.assertIn("STATIC ASSET VERSION UPDATED: old-token -> codex-test", output)
        self.assertIn("STATIC ASSET UPDATED page.html: 2 asset reference(s)", output)

    def test_cli_bump_static_version_dry_run_reports_without_writing(self):
        from tools.codex_pipeline import cli

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            html_path = root / "page.html"
            version_path = root / "static_asset_version.txt"
            original_html = '<html><head><link rel="stylesheet" href="css/styles.css?v=old-token" /></head></html>'
            html_path.write_text(original_html, encoding="utf-8")
            version_path.write_text("old-token\n", encoding="utf-8")

            with (
                patch.object(cli, "VALIDATED_HTML_PATHS", [html_path]),
                patch.object(cli, "STATIC_ASSET_VERSION_PATH", version_path),
                patch("sys.stdout", new_callable=io.StringIO) as stdout,
            ):
                exit_code = cli.main(["bump-static-version", "--asset-version", "codex-test", "--dry-run"])

            output = stdout.getvalue()
            html_after = html_path.read_text(encoding="utf-8")
            version_text = version_path.read_text(encoding="utf-8")

        self.assertEqual(0, exit_code)
        self.assertEqual(original_html, html_after)
        self.assertEqual("old-token\n", version_text)
        self.assertIn("STATIC ASSET VERSION DRY-RUN: old-token -> codex-test", output)
        self.assertIn("STATIC ASSET WOULD UPDATE page.html: 1 asset reference(s)", output)


if __name__ == "__main__":
    unittest.main()
