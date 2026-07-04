import base64
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image, ImageSequence


def _write_gf_json_png(path: Path, image: Image.Image) -> None:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    path.write_text(
        json.dumps({"Name": path.stem, "Data": base64.b64encode(buffer.getvalue()).decode("ascii")}),
        encoding="utf-8",
    )


class AtlasAssetTests(unittest.TestCase):
    def test_extract_atlas_assets_crops_item_frames_and_preserves_existing_site_names(self):
        from tools.codex_pipeline.atlas_assets import extract_atlas_assets_for_target

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            gf_json_dir = root / "client" / "gf_json"
            data_path = root / "generated" / "weapons_data05.json"
            output_dir = root / "atlas-assets" / "weapons"
            site_dir = root / "site" / "images" / "weapons"
            gf_json_dir.mkdir(parents=True)
            data_path.parent.mkdir()
            site_dir.mkdir(parents=True)

            atlas = Image.new("RGBA", (4, 2), (254, 0, 254, 255))
            for x in range(2):
                for y in range(2):
                    if x == y:
                        atlas.putpixel((x, y), (255, 0, 0, 255))
                        atlas.putpixel((x + 2, y), (0, 0, 255, 255))
            _write_gf_json_png(gf_json_dir / "itemgraph.json", atlas)
            data_path.write_text(
                json.dumps(
                    [
                        {
                            "id": 1,
                            "name": "Rune Sword",
                            "fields": {"frame_1_x": 0, "frame_1_y": 0, "frame_1_width": 2, "frame_1_height": 2},
                        },
                        {
                            "id": 2,
                            "name": "New Bow",
                            "fields": {"frame_1_x": 2, "frame_1_y": 0, "frame_1_width": 2, "frame_1_height": 2},
                        },
                    ]
                ),
                encoding="utf-8",
            )
            (site_dir / "manifest.json").write_text(
                json.dumps(["images/weapons/Rune Sword.gif"]),
                encoding="utf-8",
            )

            report = extract_atlas_assets_for_target(
                "weapons",
                data_path=data_path,
                gf_json_dir=gf_json_dir,
                output_dir=output_dir,
                site_dir=site_dir,
            )

            manifest_entries = json.loads((output_dir / "manifest.json").read_text(encoding="utf-8"))
            with Image.open(output_dir / "New Bow.png") as image:
                new_bow = image.convert("RGBA")
                new_bow.load()
            with Image.open(output_dir / "Rune Sword.gif") as image:
                rune_sword = image.convert("RGBA")
                rune_sword.load()

        self.assertEqual("itemgraph.json", report.atlas_path.name)
        self.assertEqual(["New Bow.png", "Rune Sword.gif"], sorted(report.written))
        self.assertEqual([], report.skipped)
        self.assertEqual([], report.issues)
        self.assertEqual(["images/weapons/New Bow.png", "images/weapons/Rune Sword.gif"], manifest_entries)
        self.assertEqual((2, 2), new_bow.size)
        self.assertEqual((0, 0, 255, 255), new_bow.getpixel((0, 0)))
        self.assertEqual(0, new_bow.getpixel((1, 0))[3])
        self.assertEqual(0, rune_sword.getpixel((1, 0))[3])
        self.assertEqual((255, 0, 0, 255), rune_sword.getpixel((0, 0)))

    def test_extract_atlas_assets_preserves_transparency_in_animated_gifs(self):
        from tools.codex_pipeline.atlas_assets import extract_atlas_assets_for_target

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            gf_json_dir = root / "client" / "gf_json"
            data_path = root / "generated" / "weapons_data05.json"
            output_dir = root / "atlas-assets" / "weapons"
            site_dir = root / "site" / "images" / "weapons"
            gf_json_dir.mkdir(parents=True)
            data_path.parent.mkdir()
            site_dir.mkdir(parents=True)

            atlas = Image.new("RGBA", (4, 2), (255, 0, 255, 255))
            atlas.putpixel((0, 0), (255, 0, 0, 255))
            atlas.putpixel((2, 0), (0, 0, 255, 255))
            _write_gf_json_png(gf_json_dir / "itemgraph.json", atlas)
            data_path.write_text(
                json.dumps(
                    [
                        {
                            "id": 1,
                            "name": "Trident",
                            "fields": {
                                "frame_1_x": 0,
                                "frame_1_y": 0,
                                "frame_1_width": 2,
                                "frame_1_height": 2,
                                "frame_2_x": 2,
                                "frame_2_y": 0,
                                "frame_2_width": 2,
                                "frame_2_height": 2,
                            },
                        }
                    ]
                ),
                encoding="utf-8",
            )
            (site_dir / "manifest.json").write_text(
                json.dumps(["images/weapons/Trident.gif"]),
                encoding="utf-8",
            )

            extract_atlas_assets_for_target(
                "weapons",
                data_path=data_path,
                gf_json_dir=gf_json_dir,
                output_dir=output_dir,
                site_dir=site_dir,
            )

            with Image.open(output_dir / "Trident.gif") as image:
                frames = [frame.convert("RGBA").copy() for frame in ImageSequence.Iterator(image)]

        self.assertEqual(2, len(frames))
        self.assertEqual((255, 0, 0, 255), frames[0].getpixel((0, 0)))
        self.assertEqual(0, frames[0].getpixel((1, 0))[3])
        self.assertEqual((0, 0, 255, 255), frames[1].getpixel((0, 0)))
        self.assertEqual(0, frames[1].getpixel((1, 0))[3])

    def test_extract_atlas_assets_uses_avatar_atlas_for_monsters(self):
        from tools.codex_pipeline.atlas_assets import extract_atlas_assets_for_target

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            gf_json_dir = root / "client" / "gf_json"
            data_path = root / "generated" / "monsters_data03.json"
            output_dir = root / "atlas-assets" / "monsters"
            gf_json_dir.mkdir(parents=True)
            data_path.parent.mkdir()

            atlas = Image.new("RGBA", (2, 2), (12, 34, 56, 255))
            _write_gf_json_png(gf_json_dir / "avatars.json", atlas)
            data_path.write_text(
                json.dumps(
                    [
                        {
                            "id": 10,
                            "name": "Ice Devil",
                            "fields": {"frame_1_x": 0, "frame_1_y": 0, "frame_1_width": 2, "frame_1_height": 2},
                        }
                    ]
                ),
                encoding="utf-8",
            )

            report = extract_atlas_assets_for_target(
                "monsters",
                data_path=data_path,
                gf_json_dir=gf_json_dir,
                output_dir=output_dir,
            )

            with Image.open(output_dir / "Ice Devil.png") as image:
                monster_image = image.convert("RGBA")
                monster_image.load()

        self.assertEqual("avatars.json", report.atlas_path.name)
        self.assertEqual(["Ice Devil.png"], report.written)
        self.assertEqual((12, 34, 56, 255), monster_image.getpixel((0, 0)))

    def test_extract_atlas_assets_uses_itemgraph_for_collectables_and_useables(self):
        from tools.codex_pipeline.atlas_assets import has_atlas_source

        with tempfile.TemporaryDirectory() as tmp:
            gf_json_dir = Path(tmp)
            (gf_json_dir / "itemgraph.json").write_text('{"Data": ""}', encoding="utf-8")

            self.assertTrue(has_atlas_source("collectables", gf_json_dir=gf_json_dir))
            self.assertTrue(has_atlas_source("useables", gf_json_dir=gf_json_dir))

    def test_extract_atlas_assets_writes_collectables_from_itemgraph(self):
        from tools.codex_pipeline.atlas_assets import extract_atlas_assets_for_target

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            gf_json_dir = root / "client" / "gf_json"
            data_path = root / "generated" / "collectables_data.json"
            output_dir = root / "atlas-assets" / "collectables"
            gf_json_dir.mkdir(parents=True)
            data_path.parent.mkdir()

            atlas = Image.new("RGBA", (2, 2), (255, 0, 255, 255))
            atlas.putpixel((0, 0), (255, 215, 0, 255))
            _write_gf_json_png(gf_json_dir / "itemgraph.json", atlas)
            data_path.write_text(
                json.dumps(
                    [
                        {
                            "id": 1,
                            "name": "Gold",
                            "fields": {"frame_1_x": 0, "frame_1_y": 0, "frame_1_width": 2, "frame_1_height": 2},
                        }
                    ]
                ),
                encoding="utf-8",
            )

            report = extract_atlas_assets_for_target(
                "collectables",
                data_path=data_path,
                gf_json_dir=gf_json_dir,
                output_dir=output_dir,
            )

            manifest_entries = json.loads((output_dir / "manifest.json").read_text(encoding="utf-8"))
            with Image.open(output_dir / "Gold.png") as image:
                gold = image.convert("RGBA")
                gold.load()

        self.assertEqual("itemgraph.json", report.atlas_path.name)
        self.assertEqual(["Gold.png"], report.written)
        self.assertEqual([], report.skipped)
        self.assertEqual([], report.issues)
        self.assertEqual(["images/collectables/Gold.png"], manifest_entries)
        self.assertEqual((255, 215, 0, 255), gold.getpixel((0, 0)))

    def test_cli_extract_atlas_assets_prints_summary(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.atlas_assets import AtlasExtractionReport
        from tools.codex_pipeline.validators.site import ValidationIssue

        report = AtlasExtractionReport(
            target_name="weapons",
            atlas_path=Path("client/gf_json/itemgraph.json"),
            data_path=Path("generated/weapons_data05.json"),
            output_dir=Path("generated-output/atlas-assets/weapons"),
            written=["Short Sword.png", "Long Sword.png"],
            skipped=["Broken Sword"],
            issues=[ValidationIssue("warning", "sample warning")],
        )
        output = io.StringIO()
        with (
            patch.object(cli, "resolve_targets", return_value=["weapons"]),
            patch.object(cli, "resolve_asset_targets", return_value=["asset-weapons"]),
            patch.object(cli, "extract_atlas_assets_for_targets", return_value=[report]) as extract_assets,
            patch("sys.stdout", output),
        ):
            exit_code = cli.main(["extract-atlas-assets", "--target", "weapons"])

        self.assertEqual(0, exit_code)
        extract_assets.assert_called_once()
        printed = output.getvalue()
        self.assertIn("ATLAS EXTRACT weapons: wrote 2, skipped 1, issues=1", printed)
        self.assertIn("ATLAS ISSUE WARNING: sample warning", printed)
