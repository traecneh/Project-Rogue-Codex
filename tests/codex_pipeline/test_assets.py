import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


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

    def test_build_asset_change_report_skips_diff_when_client_folder_is_missing(self):
        from tools.codex_pipeline.assets import AssetTarget, build_asset_change_report

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            client_dir = root / "client" / "gf_json" / "images" / "Weapons"
            site_dir = root / "site" / "images" / "weapons"
            site_dir.mkdir(parents=True)
            (site_dir / "Rune Sword.gif").write_bytes(b"site asset")
            (site_dir / "manifest.json").write_text(
                json.dumps(["images/weapons/Rune Sword.gif"]),
                encoding="utf-8",
            )

            report = build_asset_change_report(AssetTarget("weapons", client_dir, site_dir))

        self.assertEqual(0, report.client_count)
        self.assertEqual(1, report.site_count)
        self.assertEqual(1, report.manifest_count)
        self.assertEqual([], report.added)
        self.assertEqual([], report.removed)
        self.assertEqual([], report.changed)
        self.assertFalse(report.has_changes)
        messages = "\n".join(issue.message for issue in report.issues)
        self.assertIn("client image folder not found", messages)
        self.assertIn("asset comparison skipped", messages)

    def test_build_asset_change_report_notes_embedded_gf_json_atlas_source(self):
        from tools.codex_pipeline.assets import AssetTarget, build_asset_change_report

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            gf_json_dir = root / "client" / "gf_json"
            client_dir = gf_json_dir / "images" / "Weapons"
            site_dir = root / "site" / "images" / "weapons"
            gf_json_dir.mkdir(parents=True)
            site_dir.mkdir(parents=True)
            (gf_json_dir / "itemgraph.json").write_text(
                json.dumps({"Name": "itemgraph", "Data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB"}),
                encoding="utf-8",
            )
            (site_dir / "Rune Sword.gif").write_bytes(b"site asset")
            (site_dir / "manifest.json").write_text(
                json.dumps(["images/weapons/Rune Sword.gif"]),
                encoding="utf-8",
            )

            report = build_asset_change_report(AssetTarget("weapons", client_dir, site_dir))

        self.assertEqual([], report.removed)
        messages = "\n".join(issue.message for issue in report.issues)
        self.assertIn("embedded gf_json PNG atlas source found", messages)
        self.assertIn("itemgraph.json", messages)

    def test_sync_asset_changes_dry_run_reports_without_writing(self):
        from tools.codex_pipeline.assets import AssetTarget, sync_asset_changes

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

            report = sync_asset_changes(AssetTarget("weapons", client_dir, site_dir), dry_run=True)

            manifest_entries = json.loads((site_dir / "manifest.json").read_text(encoding="utf-8"))

            self.assertTrue(report.dry_run)
            self.assertEqual(["Added.gif", "Changed.gif"], report.copied)
            self.assertEqual(["Removed.gif"], report.removed)
            self.assertEqual(3, report.manifest_count)
            self.assertEqual([], report.issues)
            self.assertFalse((site_dir / "Added.gif").exists())
            self.assertEqual(b"old", (site_dir / "Changed.gif").read_bytes())
            self.assertTrue((site_dir / "Removed.gif").exists())
            self.assertEqual(
                [
                    "images/weapons/Same.gif",
                    "images/weapons/Changed.gif",
                    "images/weapons/Removed.gif",
                ],
                manifest_entries,
            )

    def test_sync_asset_changes_copies_removes_and_regenerates_manifest(self):
        from tools.codex_pipeline.assets import AssetTarget, build_asset_change_report, sync_asset_changes

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

            report = sync_asset_changes(AssetTarget("weapons", client_dir, site_dir), dry_run=False)
            post_report = build_asset_change_report(AssetTarget("weapons", client_dir, site_dir))
            manifest_entries = json.loads((site_dir / "manifest.json").read_text(encoding="utf-8"))

            self.assertFalse(report.dry_run)
            self.assertEqual(["Added.gif", "Changed.gif"], report.copied)
            self.assertEqual(["Removed.gif"], report.removed)
            self.assertEqual(3, report.manifest_count)
            self.assertEqual([], report.issues)
            self.assertEqual(b"added", (site_dir / "Added.gif").read_bytes())
            self.assertEqual(b"new", (site_dir / "Changed.gif").read_bytes())
            self.assertFalse((site_dir / "Removed.gif").exists())
            self.assertEqual(
                [
                    "images/weapons/Added.gif",
                    "images/weapons/Changed.gif",
                    "images/weapons/Same.gif",
                ],
                manifest_entries,
            )
            self.assertFalse(post_report.has_changes)
            self.assertEqual([], post_report.issues)

    def test_sync_asset_changes_leaves_clean_manifest_unchanged(self):
        from tools.codex_pipeline.assets import AssetTarget, sync_asset_changes

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            client_dir = root / "client" / "Armors"
            site_dir = root / "site" / "images" / "armors"
            client_dir.mkdir(parents=True)
            site_dir.mkdir(parents=True)
            (client_dir / "Same.gif").write_bytes(b"same")
            (site_dir / "Same.gif").write_bytes(b"same")
            manifest_path = site_dir / "manifest.json"
            manifest_path.write_text(json.dumps(["images/armors/Same.gif"]), encoding="utf-8")
            original_manifest = manifest_path.read_bytes()

            report = sync_asset_changes(AssetTarget("armors", client_dir, site_dir), dry_run=False)

            self.assertEqual([], report.copied)
            self.assertEqual([], report.removed)
            self.assertEqual([], report.issues)
            self.assertEqual(original_manifest, manifest_path.read_bytes())

    def test_sync_asset_changes_preserves_manifest_when_only_image_bytes_change(self):
        from tools.codex_pipeline.assets import AssetTarget, sync_asset_changes

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            client_dir = root / "client" / "Weapons"
            site_dir = root / "site" / "images" / "weapons"
            client_dir.mkdir(parents=True)
            site_dir.mkdir(parents=True)
            (client_dir / "Galdruil Axe.gif").write_bytes(b"new")
            (site_dir / "Galdruil Axe.gif").write_bytes(b"old")
            (client_dir / "GM Deathbringer.png").write_bytes(b"same")
            (site_dir / "GM Deathbringer.png").write_bytes(b"same")
            manifest_path = site_dir / "manifest.json"
            manifest_path.write_text(
                json.dumps(
                    [
                        "images/weapons/Galdruil Axe.gif",
                        "images/weapons/GM Deathbringer.png",
                    ]
                ),
                encoding="utf-8",
            )
            original_manifest = manifest_path.read_bytes()

            report = sync_asset_changes(AssetTarget("weapons", client_dir, site_dir), dry_run=False)

            self.assertEqual(["Galdruil Axe.gif"], report.copied)
            self.assertEqual([], report.removed)
            self.assertEqual([], report.issues)
            self.assertEqual(b"new", (site_dir / "Galdruil Axe.gif").read_bytes())
            self.assertEqual(original_manifest, manifest_path.read_bytes())

    def test_cli_sync_assets_prints_dry_run_summary(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.assets import AssetSyncReport
        from tools.codex_pipeline.validators.site import ValidationIssue

        report = AssetSyncReport(
            target_name="weapons",
            client_dir=Path("client/Weapons"),
            site_dir=Path("images/weapons"),
            dry_run=True,
            copied=["Added.gif", "Changed.gif"],
            removed=["Removed.gif"],
            manifest_count=3,
            issues=[ValidationIssue("warning", "sample warning")],
        )
        output = io.StringIO()
        with (
            patch.object(cli, "resolve_asset_targets", return_value=["weapons"]),
            patch.object(cli, "sync_asset_targets", return_value=[report]) as sync_assets,
            patch("sys.stdout", output),
        ):
            exit_code = cli.main(["sync-assets", "--dry-run", "--target", "weapons"])

        self.assertEqual(0, exit_code)
        sync_assets.assert_called_once_with(["weapons"], dry_run=True)
        printed = output.getvalue()
        self.assertIn("ASSET SYNC DRY-RUN weapons: copied 2, removed 1, manifest entries=3, issues=1", printed)
        self.assertIn("ASSET SYNC ISSUE WARNING: sample warning", printed)

    def test_cli_sync_assets_can_use_generated_atlas_source(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.assets import AssetSyncReport, AssetTarget

        resolved_target = AssetTarget(
            "weapons",
            Path("client/Weapons"),
            Path("site/images/weapons"),
        )
        report = AssetSyncReport(
            target_name="weapons",
            client_dir=Path("atlas/weapons"),
            site_dir=Path("site/images/weapons"),
            dry_run=True,
            copied=["New Sword.png"],
            removed=[],
            manifest_count=1,
            issues=[],
        )
        output = io.StringIO()
        with (
            patch.object(cli, "resolve_asset_targets", return_value=[resolved_target]),
            patch.object(cli, "sync_asset_targets", return_value=[report]) as sync_assets,
            patch("sys.stdout", output),
        ):
            exit_code = cli.main(
                [
                    "sync-assets",
                    "--dry-run",
                    "--asset-source",
                    "atlas",
                    "--asset-output-dir",
                    "atlas",
                    "--target",
                    "weapons",
                ]
            )

        self.assertEqual(0, exit_code)
        sync_targets = list(sync_assets.call_args.args[0])
        self.assertEqual(Path("atlas/weapons"), sync_targets[0].client_dir)
        self.assertEqual(Path("site/images/weapons"), sync_targets[0].site_dir)
        self.assertIn("ASSET SYNC DRY-RUN weapons: copied 1, removed 0, manifest entries=1, issues=0", output.getvalue())
