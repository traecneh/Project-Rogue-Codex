import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


class CodexFreshnessTests(unittest.TestCase):
    def test_build_codex_manifest_summarizes_data_and_assets(self):
        from tools.codex_pipeline.freshness import (
            ManifestAssetTarget,
            ManifestDataTarget,
            build_codex_manifest,
        )

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data_path = root / "pages" / "items" / "weapons.json"
            data_path.parent.mkdir(parents=True)
            data_path.write_text(json.dumps([{"name": "Rune Sword"}, {"name": "Axe"}]), encoding="utf-8")

            image_dir = root / "images" / "weapons"
            image_dir.mkdir(parents=True)
            (image_dir / "Rune Sword.gif").write_bytes(b"rune sword")
            manifest_path = image_dir / "manifest.json"
            manifest_path.write_text(json.dumps(["images/weapons/Rune Sword.gif"]), encoding="utf-8")

            manifest = build_codex_manifest(
                repo_root=root,
                generated_at_utc="2026-06-09T12:00:00Z",
                source_commit="abc123",
                data_targets=[
                    ManifestDataTarget("weapons", data_path, "pages/items/weapons.json"),
                ],
                asset_targets=[
                    ManifestAssetTarget("weapons", image_dir, manifest_path, "images/weapons/manifest.json"),
                ],
            )

        self.assertEqual("project-rogue-codex-manifest", manifest["schema"])
        self.assertEqual(1, manifest["version"])
        self.assertEqual("2026-06-09T12:00:00Z", manifest["generated_at_utc"])
        self.assertEqual("abc123", manifest["source_commit"])
        self.assertEqual(2, manifest["data"]["weapons"]["records"])
        self.assertEqual(64, len(manifest["data"]["weapons"]["sha256"]))
        self.assertEqual(1, manifest["assets"]["weapons"]["entries"])
        self.assertEqual(64, len(manifest["assets"]["weapons"]["manifest_sha256"]))
        self.assertEqual(64, len(manifest["assets"]["weapons"]["files_sha256"]))
        self.assertEqual(2, manifest["summary"]["data_records"])
        self.assertEqual(1, manifest["summary"]["asset_entries"])
        self.assertEqual(64, len(manifest["summary"]["content_sha256"]))

    def test_write_and_validate_codex_manifest_detects_stale_content(self):
        from tools.codex_pipeline.freshness import (
            ManifestAssetTarget,
            ManifestDataTarget,
            build_codex_manifest,
            validate_codex_manifest,
            write_codex_manifest,
        )

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data_path = root / "pages" / "items" / "armors.json"
            data_path.parent.mkdir(parents=True)
            data_path.write_text(json.dumps([{"name": "Brown Tunic"}]), encoding="utf-8")

            image_dir = root / "images" / "armors"
            image_dir.mkdir(parents=True)
            (image_dir / "Brown Tunic.gif").write_bytes(b"brown tunic")
            manifest_path = image_dir / "manifest.json"
            manifest_path.write_text(json.dumps(["images/armors/Brown Tunic.gif"]), encoding="utf-8")

            data_targets = [ManifestDataTarget("armors", data_path, "pages/items/armors.json")]
            asset_targets = [
                ManifestAssetTarget("armors", image_dir, manifest_path, "images/armors/manifest.json"),
            ]
            codex_manifest_path = root / "data" / "codex_manifest.json"
            manifest = build_codex_manifest(
                repo_root=root,
                generated_at_utc="2026-06-09T12:00:00Z",
                source_commit="abc123",
                data_targets=data_targets,
                asset_targets=asset_targets,
            )
            write_codex_manifest(manifest, codex_manifest_path)

            self.assertTrue(codex_manifest_path.read_text(encoding="utf-8").endswith("\n"))
            self.assertEqual(
                [],
                validate_codex_manifest(
                    manifest_path=codex_manifest_path,
                    repo_root=root,
                    data_targets=data_targets,
                    asset_targets=asset_targets,
                ),
            )

            data_path.write_text(
                json.dumps([{"name": "Brown Tunic"}, {"name": "Iceburst Amulet"}]),
                encoding="utf-8",
            )
            issues = validate_codex_manifest(
                manifest_path=codex_manifest_path,
                repo_root=root,
                data_targets=data_targets,
                asset_targets=asset_targets,
            )

        self.assertEqual(1, len(issues))
        self.assertIn("data/codex_manifest.json is stale", issues[0].message)
        self.assertIn("refresh-manifest", issues[0].message)

    def test_cli_refresh_manifest_writes_current_site_manifest(self):
        from tools.codex_pipeline import cli

        with tempfile.TemporaryDirectory() as tmp:
            codex_manifest_path = Path(tmp) / "codex_manifest.json"
            with patch.object(cli, "CODEX_MANIFEST_PATH", codex_manifest_path):
                exit_code = cli.main(["refresh-manifest"])

            self.assertEqual(0, exit_code)
            self.assertTrue(codex_manifest_path.is_file())
            manifest = json.loads(codex_manifest_path.read_text(encoding="utf-8"))

        self.assertIn("weapons", manifest["data"])
        self.assertIn("armors", manifest["data"])
        self.assertIn("monsters", manifest["data"])
        self.assertGreater(manifest["summary"]["data_records"], 0)
        self.assertGreater(manifest["summary"]["asset_entries"], 0)
