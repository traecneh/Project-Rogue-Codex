import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from tools.codex_pipeline.assets import AssetChangeReport


def _write_image(path: Path, color: tuple[int, int, int, int]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGBA", (8, 8), color).save(path)


class AssetImageReviewTests(unittest.TestCase):
    def test_write_asset_review_artifacts_creates_markdown_and_contact_sheet(self):
        from tools.codex_pipeline.asset_review import write_asset_review_artifacts

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            client_dir = root / "generated" / "weapons"
            site_dir = root / "site" / "images" / "weapons"
            output_dir = root / "review"
            _write_image(client_dir / "New Sword.png", (0, 0, 255, 255))
            _write_image(client_dir / "Changed Sword.png", (255, 255, 0, 255))
            _write_image(site_dir / "Changed Sword.png", (0, 255, 0, 255))
            _write_image(site_dir / "Removed Sword.png", (255, 0, 0, 255))
            (site_dir / "manifest.json").write_text(
                json.dumps(["images/weapons/Changed Sword.png", "images/weapons/Removed Sword.png"]),
                encoding="utf-8",
            )
            report = AssetChangeReport(
                target_name="weapons",
                client_dir=client_dir,
                site_dir=site_dir,
                client_count=2,
                site_count=2,
                manifest_count=2,
                added=["New Sword.png"],
                removed=["Removed Sword.png"],
                changed=["Changed Sword.png"],
                issues=[],
            )

            artifact = write_asset_review_artifacts([report], output_dir=output_dir)
            markdown = artifact.markdown_path.read_text(encoding="utf-8")
            with Image.open(artifact.sheet_paths[0]) as image:
                sheet = image.convert("RGB")
                sheet.load()

        self.assertEqual(output_dir / "asset_image_review.md", artifact.markdown_path)
        self.assertEqual([output_dir / "weapons_contact_sheet.png"], artifact.sheet_paths)
        self.assertIn("# Project Rogue Codex Image Review", markdown)
        self.assertIn("## Weapons", markdown)
        self.assertIn("- Totals: +1 -1 ~1", markdown)
        self.assertIn("![Weapons contact sheet](weapons_contact_sheet.png)", markdown)
        self.assertGreater(sheet.size[0], 200)
        self.assertGreater(sheet.size[1], 80)
        pixels = list(sheet.getdata())
        self.assertTrue(any(red > 200 and green < 80 and blue < 80 for red, green, blue in pixels))
        self.assertTrue(any(red < 80 and green < 80 and blue > 200 for red, green, blue in pixels))

    def test_write_asset_review_artifacts_handles_no_image_changes(self):
        from tools.codex_pipeline.asset_review import write_asset_review_artifacts

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            report = AssetChangeReport(
                target_name="weapons",
                client_dir=root / "generated" / "weapons",
                site_dir=root / "site" / "images" / "weapons",
                client_count=0,
                site_count=0,
                manifest_count=0,
                added=[],
                removed=[],
                changed=[],
                issues=[],
            )

            artifact = write_asset_review_artifacts([report], output_dir=root / "review")
            markdown = artifact.markdown_path.read_text(encoding="utf-8")

        self.assertEqual([], artifact.sheet_paths)
        self.assertIn("- No image changes.", markdown)
