import io
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch


class SiteCoverageTests(unittest.TestCase):
    def test_build_site_coverage_report_reconciles_nav_search_validation_and_smoke(self):
        from tools.codex_pipeline.site_coverage import build_site_coverage_report

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "js").mkdir()
            (root / "pages").mkdir()
            (root / "tools" / "codex_pipeline").mkdir(parents=True)
            for page in ["index.html", "pages/one.html", "pages/two.html", "pages/search-only.html"]:
                path = root / page
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("<!doctype html><title>ok</title>", encoding="utf-8")

            (root / "nav.html").write_text(
                """
                <a class="nav-link" href="pages/one.html">One</a>
                <a class="nav-link" href="pages/two.html">Two</a>
                <a class="nav-link" href="https://example.test/map">Map</a>
                """,
                encoding="utf-8",
            )
            (root / "js" / "site-search.js").write_text(
                """
                const SITE_SEARCH_INDEX = [
                  { title: "Home", url: "index.html", category: "Overview" },
                  { title: "One", url: "pages/one.html", category: "General" },
                  { title: "Search Only", url: "pages/search-only.html", category: "General" },
                  { title: "Map", url: "https://example.test/map", category: "Tools" },
                ];
                """,
                encoding="utf-8",
            )
            (root / "tools" / "codex_pipeline" / "site_smoke.mjs").write_text(
                """
                const smokeSpecs = [{ label: "one", listPath: "/pages/one.html" }];
                await page.goto(joinUrl(baseUrl, "/pages/search-only.html"), { waitUntil: "load" });
                """,
                encoding="utf-8",
            )

            report = build_site_coverage_report(root, validated_html_paths=[root / "pages" / "one.html"])

        self.assertEqual([], report.missing_files)
        self.assertEqual(["pages/two.html"], [page.path for page in report.nav_only_pages])
        self.assertEqual(["index.html", "pages/search-only.html"], [page.path for page in report.search_only_pages])
        self.assertEqual(
            ["index.html", "pages/search-only.html", "pages/two.html"],
            [page.path for page in report.unvalidated_pages],
        )
        self.assertEqual(["index.html", "pages/two.html"], [page.path for page in report.unsmoked_pages])
        self.assertEqual(4, report.linked_page_count)
        self.assertEqual(1, report.validated_count)
        self.assertEqual(2, report.smoked_count)

    def test_current_site_coverage_report_marks_modern_and_remaining_pages(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT
        from tools.codex_pipeline.site_coverage import build_site_coverage_report

        report = build_site_coverage_report(REPO_ROOT, validated_html_paths=cli.VALIDATED_HTML_PATHS)
        unvalidated = {page.path for page in report.unvalidated_pages}
        unsmoked = {page.path for page in report.unsmoked_pages}
        linked_pages = {page.path for page in report.pages}

        self.assertEqual([], report.missing_files)
        self.assertNotIn("pages/systems/experience.html", unvalidated)
        self.assertNotIn("pages/systems/experience.html", unsmoked)
        self.assertNotIn("pages/General/build-planner.html", unvalidated)
        self.assertNotIn("pages/General/play-the-game.html", unvalidated)
        self.assertNotIn("pages/General/play-the-game.html", unsmoked)
        self.assertNotIn("pages/stats/level.html", unvalidated)
        self.assertNotIn("pages/stats/level.html", unsmoked)
        self.assertNotIn("pages/stats/skills.html", unvalidated)
        self.assertNotIn("pages/stats/skills.html", unsmoked)
        self.assertNotIn("pages/stats/races.html", unvalidated)
        self.assertNotIn("pages/stats/races.html", unsmoked)
        self.assertNotIn("pages/stats/strength.html", unvalidated)
        self.assertNotIn("pages/stats/strength.html", unsmoked)
        self.assertNotIn("pages/stats/constitution.html", unvalidated)
        self.assertNotIn("pages/stats/constitution.html", unsmoked)
        self.assertNotIn("pages/stats/dexterity.html", unvalidated)
        self.assertNotIn("pages/stats/dexterity.html", unsmoked)
        self.assertNotIn("pages/stats/resistances.html", unvalidated)
        self.assertNotIn("pages/stats/resistances.html", unsmoked)
        self.assertNotIn("pages/General/endless-hunt.html", linked_pages)

    def test_cli_prints_site_coverage_report(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.site_coverage import CoveredPage, SiteCoverageReport

        report = SiteCoverageReport(
            pages=[
                CoveredPage(path="pages/one.html", title="One", in_navigation=True, in_search=True, exists=True),
                CoveredPage(path="pages/two.html", title="Two", in_navigation=True, in_search=False, exists=True),
            ],
            external_links=["https://example.test/map"],
            smoke_paths={"pages/one.html"},
            validated_paths={"pages/one.html"},
        )

        with patch.object(cli, "build_site_coverage_report", return_value=report):
            stdout = io.StringIO()
            with redirect_stdout(stdout):
                exit_code = cli.main(["site-coverage"])

        self.assertEqual(0, exit_code)
        output = stdout.getvalue()
        self.assertIn("SITE COVERAGE: 2 linked page(s), 1 validated, 1 smoked", output)
        self.assertIn("NAV ONLY pages/two.html: Two", output)
        self.assertIn("UNVALIDATED pages/two.html: Two", output)
        self.assertIn("UNSMOKED pages/two.html: Two", output)
