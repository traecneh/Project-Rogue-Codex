import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from tools.codex_pipeline.assets import AssetChangeReport


def _write_image(path: Path, color: tuple[int, int, int, int]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGBA", (8, 8), color).save(path)


def _sprite_image(background: tuple[int, int, int, int], sprite: tuple[int, int, int, int]) -> Image.Image:
    image = Image.new("RGBA", (8, 8), background)
    for x in range(2, 6):
        for y in range(2, 6):
            image.putpixel((x, y), sprite)
    return image


class AssetImageReviewTests(unittest.TestCase):
    def test_classify_image_change_separates_encoding_background_and_sprite_changes(self):
        from tools.codex_pipeline.asset_review import classify_image_change

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            transparent_sprite = root / "transparent_sprite.png"
            magenta_sprite = root / "magenta_sprite.png"
            changed_sprite = root / "changed_sprite.png"
            same_visible_gif = root / "same_visible.gif"
            _sprite_image((0, 0, 0, 0), (30, 60, 90, 255)).save(transparent_sprite)
            _sprite_image((255, 0, 255, 255), (30, 60, 90, 255)).save(magenta_sprite)
            _sprite_image((255, 0, 255, 255), (200, 60, 90, 255)).save(changed_sprite)
            _sprite_image((0, 0, 0, 0), (30, 60, 90, 255)).save(same_visible_gif, save_all=False)

            self.assertEqual("encoding-only", classify_image_change(transparent_sprite, same_visible_gif))
            self.assertEqual("background-only", classify_image_change(transparent_sprite, magenta_sprite))
            self.assertEqual("meaningful", classify_image_change(transparent_sprite, changed_sprite))

    def test_write_asset_review_artifacts_creates_markdown_and_contact_sheet(self):
        from tools.codex_pipeline.asset_review import write_asset_review_artifacts

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            client_dir = root / "generated" / "weapons"
            site_dir = root / "site" / "images" / "weapons"
            output_dir = root / "review"
            site_dir.mkdir(parents=True)
            _write_image(client_dir / "New Sword.png", (0, 0, 255, 255))
            _sprite_image((255, 0, 255, 255), (20, 30, 40, 255)).save(client_dir / "Background Sword.png")
            _sprite_image((0, 0, 0, 0), (20, 30, 40, 255)).save(site_dir / "Background Sword.png")
            _sprite_image((255, 0, 255, 255), (220, 30, 40, 255)).save(client_dir / "Changed Sword.png")
            _sprite_image((0, 0, 0, 0), (20, 30, 40, 255)).save(site_dir / "Changed Sword.png")
            _write_image(site_dir / "Removed Sword.png", (255, 0, 0, 255))
            (site_dir / "manifest.json").write_text(
                json.dumps(
                    [
                        "images/weapons/Background Sword.png",
                        "images/weapons/Changed Sword.png",
                        "images/weapons/Removed Sword.png",
                    ]
                ),
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
                changed=["Background Sword.png", "Changed Sword.png"],
                issues=[],
            )

            artifact = write_asset_review_artifacts([report], output_dir=output_dir)
            markdown = artifact.markdown_path.read_text(encoding="utf-8")
            with Image.open(artifact.sheet_paths[0]) as image:
                sheet = image.convert("RGB")
                sheet.load()

        self.assertEqual(output_dir / "asset_image_review.md", artifact.markdown_path)
        self.assertEqual(
            [
                output_dir / "weapons_contact_sheet.png",
                output_dir / "weapons_priority_contact_sheet.png",
                output_dir / "weapons_background_contact_sheet.png",
            ],
            artifact.sheet_paths,
        )
        self.assertIn("# Project Rogue Codex Image Review", markdown)
        self.assertIn("## Weapons", markdown)
        self.assertIn("- Totals: +1 -1 ~2", markdown)
        self.assertIn("- Changed classifications: meaningful=1, background-only=1, encoding-only=0, unreadable=0", markdown)
        self.assertIn("## Priority Review", markdown)
        self.assertIn("- Weapons: 3 priority image(s)", markdown)
        self.assertIn("![Weapons priority contact sheet](weapons_priority_contact_sheet.png)", markdown)
        self.assertIn("## Low Priority Background-Only Changes", markdown)
        self.assertIn("- Weapons: 1 background-only image(s)", markdown)
        self.assertIn("![Weapons background contact sheet](weapons_background_contact_sheet.png)", markdown)
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
