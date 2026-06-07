import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


class LiveDeploymentTests(unittest.TestCase):
    def test_verify_live_site_compares_public_data_files(self):
        from tools.codex_pipeline.deploy import LiveDataTarget, verify_live_site

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            weapons = root / "weapons.json"
            weapons.write_text(json.dumps([{"name": "Grips of Winter"}]), encoding="utf-8")
            target = LiveDataTarget("weapons", weapons, "pages/items/weapons_data05.json")
            seen_urls = []

            def fetch_text(url, timeout_seconds):
                seen_urls.append((url, timeout_seconds))
                if url == "https://example.test/codex/":
                    return "<title>Project Rogue Codex</title>"
                if url == "https://example.test/codex/pages/items/weapons_data05.json":
                    return json.dumps([{"name": "Grips of Winter"}])
                raise OSError(f"unexpected URL: {url}")

            results = verify_live_site(
                "https://example.test/codex",
                targets=[target],
                asset_targets=[],
                fetch_text=fetch_text,
                timeout_seconds=3,
            )

        self.assertTrue(all(result.ok for result in results), results)
        self.assertEqual(
            [
                ("https://example.test/codex/", 3),
                ("https://example.test/codex/pages/items/weapons_data05.json", 3),
            ],
            seen_urls,
        )

    def test_verify_live_site_reports_mismatched_public_data(self):
        from tools.codex_pipeline.deploy import LiveDataTarget, verify_live_site

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            armors = root / "armors.json"
            armors.write_text(json.dumps([{"name": "Armor of Great Health"}]), encoding="utf-8")
            target = LiveDataTarget("armors", armors, "pages/items/armors_data06.json")

            def fetch_text(url, timeout_seconds):
                if url.endswith("/"):
                    return "<title>Project Rogue Codex</title>"
                return json.dumps([{"name": "Old Armor Data"}])

            results = verify_live_site(
                "https://example.test/codex/",
                targets=[target],
                asset_targets=[],
                fetch_text=fetch_text,
            )

        messages = "\n".join(result.message for result in results if not result.ok)
        self.assertIn("armors live JSON differs from pages/items/armors_data06.json", messages)

    def test_verify_live_site_compares_public_image_manifest_and_hashes(self):
        from tools.codex_pipeline.deploy import LiveAssetTarget, verify_live_site

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            image_dir = root / "images" / "weapons"
            image_dir.mkdir(parents=True)
            (image_dir / "Rune Sword.gif").write_bytes(b"rune sword image")
            (image_dir / "Axe.png").write_bytes(b"axe image")
            manifest_path = image_dir / "manifest.json"
            manifest_path.write_text(
                json.dumps(
                    [
                        "images/weapons/Rune Sword.gif",
                        "images/weapons/Axe.png",
                    ]
                ),
                encoding="utf-8",
            )
            target = LiveAssetTarget(
                "weapons",
                image_dir,
                manifest_path,
                "images/weapons/manifest.json",
            )
            seen_binary_urls = []

            def fetch_text(url, timeout_seconds):
                if url == "https://example.test/codex/":
                    return "<title>Project Rogue Codex</title>"
                if url == "https://example.test/codex/images/weapons/manifest.json":
                    return manifest_path.read_text(encoding="utf-8")
                raise OSError(f"unexpected text URL: {url}")

            def fetch_bytes(url, timeout_seconds):
                seen_binary_urls.append((url, timeout_seconds))
                if url == "https://example.test/codex/images/weapons/Rune%20Sword.gif":
                    return b"rune sword image"
                if url == "https://example.test/codex/images/weapons/Axe.png":
                    return b"axe image"
                raise OSError(f"unexpected binary URL: {url}")

            results = verify_live_site(
                "https://example.test/codex",
                targets=[],
                asset_targets=[target],
                fetch_text=fetch_text,
                fetch_bytes=fetch_bytes,
                timeout_seconds=5,
            )

        self.assertTrue(all(result.ok for result in results), results)
        self.assertEqual(
            [
                ("https://example.test/codex/images/weapons/Axe.png", 5),
                ("https://example.test/codex/images/weapons/Rune%20Sword.gif", 5),
            ],
            seen_binary_urls,
        )
        self.assertIn("weapons images match manifest and local hashes (2 checked)", results[-1].message)

    def test_verify_live_site_reports_mismatched_public_image(self):
        from tools.codex_pipeline.deploy import LiveAssetTarget, verify_live_site

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            image_dir = root / "images" / "armors"
            image_dir.mkdir(parents=True)
            (image_dir / "Iceburst Amulet.gif").write_bytes(b"local image")
            manifest_path = image_dir / "manifest.json"
            manifest_path.write_text(
                json.dumps(["images/armors/Iceburst Amulet.gif"]),
                encoding="utf-8",
            )
            target = LiveAssetTarget(
                "armors",
                image_dir,
                manifest_path,
                "images/armors/manifest.json",
            )

            def fetch_text(url, timeout_seconds):
                if url.endswith("/"):
                    return "<title>Project Rogue Codex</title>"
                return manifest_path.read_text(encoding="utf-8")

            def fetch_bytes(url, timeout_seconds):
                return b"deployed image"

            results = verify_live_site(
                "https://example.test/codex/",
                targets=[],
                asset_targets=[target],
                fetch_text=fetch_text,
                fetch_bytes=fetch_bytes,
            )

        messages = "\n".join(result.message for result in results if not result.ok)
        self.assertIn("armors live image differs from images/armors/Iceburst Amulet.gif", messages)

    def test_cli_verify_live_prints_results_and_returns_failure_for_errors(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.deploy import LiveCheckResult

        output = io.StringIO()
        with (
            patch.object(
                cli,
                "verify_live_site",
                return_value=[
                    LiveCheckResult("site", "https://example.test/codex/", True, "site reachable"),
                    LiveCheckResult(
                        "armors",
                        "https://example.test/codex/pages/items/armors_data06.json",
                        False,
                        "armors live JSON differs from pages/items/armors_data06.json",
                    ),
                ],
            ),
            patch("sys.stdout", output),
        ):
            exit_code = cli.main(["verify-live", "--site-url", "https://example.test/codex/"])

        self.assertEqual(1, exit_code)
        printed = output.getvalue()
        self.assertIn("LIVE OK site: site reachable", printed)
        self.assertIn("LIVE ERROR armors: armors live JSON differs", printed)
