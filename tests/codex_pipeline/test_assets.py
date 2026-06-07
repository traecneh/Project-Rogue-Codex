import json
import tempfile
import unittest
from pathlib import Path


class AssetReportTests(unittest.TestCase):
    def test_build_asset_change_report_compares_client_and_site_images(self):
        from tools.codex_pipeline.assets import AssetTarget, build_asset_change_report

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            client_dir = root / "client" / "Weapons"
            site_dir = root / "site" / "images" / "weapons"
            client_dir.mkdir(parents=True)
            site_dir.mkdir(parents=True)
            (client_dir / "Same.gif").write_bytes(b"same")
            (site_dir / "Same.gif").write_bytes(b"same")
            (client_dir / "Changed.gif").write_bytes(b"new")
            (site_dir / "Changed.gif").write_bytes(b"old")
            (client_dir / "Added.gif").write_bytes(b"added")
            (site_dir / "Removed.gif").write_bytes(b"removed")
            (site_dir / "manifest.json").write_text(
                json.dumps(
                    [
                        "images/weapons/Same.gif",
                        "images/weapons/Changed.gif",
                        "images/weapons/Removed.gif",
                    ]
                ),
                encoding="utf-8",
            )

            report = build_asset_change_report(AssetTarget("weapons", client_dir, site_dir))

        self.assertEqual("weapons", report.target_name)
        self.assertEqual(3, report.client_count)
        self.assertEqual(3, report.site_count)
        self.assertEqual(3, report.manifest_count)
        self.assertEqual(["Added.gif"], report.added)
        self.assertEqual(["Removed.gif"], report.removed)
        self.assertEqual(["Changed.gif"], report.changed)
        self.assertTrue(report.has_changes)
        self.assertEqual([], report.issues)

    def test_build_asset_change_report_reports_manifest_problems(self):
        from tools.codex_pipeline.assets import AssetTarget, build_asset_change_report

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            client_dir = root / "client" / "Armors"
            site_dir = root / "site" / "images" / "armors"
            client_dir.mkdir(parents=True)
            site_dir.mkdir(parents=True)
            (client_dir / "Listed.png").write_bytes(b"asset")
            (site_dir / "Listed.png").write_bytes(b"asset")
            (site_dir / "Unlisted.png").write_bytes(b"asset")
            (site_dir / "manifest.json").write_text(
                json.dumps(
                    [
                        "images/armors/Listed.png",
                        "images/armors/Missing.png",
                        "images/armors/manifest.json",
                    ]
                ),
                encoding="utf-8",
            )

            report = build_asset_change_report(AssetTarget("armors", client_dir, site_dir))

        messages = "\n".join(issue.message for issue in report.issues)
        self.assertIn("manifest includes itself", messages)
        self.assertIn("manifest lists missing image Missing.png", messages)
        self.assertIn("manifest does not list image Unlisted.png", messages)
