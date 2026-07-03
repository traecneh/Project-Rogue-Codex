from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont, ImageOps

from tools.codex_pipeline.assets import AssetChangeReport


THUMBNAIL_SIZE = (48, 48)
TILE_WIDTH = 220
TILE_HEIGHT = 112
TILE_PADDING = 10
SHEET_COLUMNS = 4
BACKGROUND = (250, 250, 248)
TILE_BACKGROUND = (255, 255, 255)
BORDER = (205, 210, 216)
TEXT = (35, 38, 45)
MUTED = (102, 112, 124)
STATUS_COLORS = {
    "ADDED": (22, 101, 52),
    "REMOVED": (153, 27, 27),
    "CHANGED": (30, 64, 175),
}


@dataclass(frozen=True)
class AssetImageReviewArtifact:
    markdown_path: Path
    sheet_paths: list[Path]


@dataclass(frozen=True)
class AssetImageChange:
    status: str
    file_name: str
    before_path: Path | None
    after_path: Path | None


def _change_rows(report: AssetChangeReport) -> list[AssetImageChange]:
    rows: list[AssetImageChange] = []
    rows.extend(
        AssetImageChange("ADDED", file_name, None, report.client_dir / file_name)
        for file_name in sorted(report.added)
    )
    rows.extend(
        AssetImageChange("REMOVED", file_name, report.site_dir / file_name, None)
        for file_name in sorted(report.removed)
    )
    rows.extend(
        AssetImageChange("CHANGED", file_name, report.site_dir / file_name, report.client_dir / file_name)
        for file_name in sorted(report.changed)
    )
    return rows


def _load_thumbnail(path: Path | None) -> Image.Image | None:
    if path is None or not path.is_file():
        return None
    with Image.open(path) as image:
        frame = image.convert("RGBA")
        thumb = ImageOps.contain(frame, THUMBNAIL_SIZE, method=Image.Resampling.NEAREST)
        thumb.load()
        return thumb


def _truncate(value: str, max_chars: int) -> str:
    if len(value) <= max_chars:
        return value
    return value[: max(0, max_chars - 3)] + "..."


def _draw_thumbnail(draw: ImageDraw.ImageDraw, sheet: Image.Image, path: Path | None, box: tuple[int, int, int, int], label: str) -> None:
    x1, y1, x2, y2 = box
    draw.rectangle(box, outline=BORDER, fill=(248, 249, 250))
    thumb = _load_thumbnail(path)
    if thumb is None:
        draw.text((x1 + 10, y1 + 16), "none", fill=MUTED)
    else:
        x = x1 + ((x2 - x1) - thumb.width) // 2
        y = y1 + ((y2 - y1) - thumb.height) // 2
        sheet.paste(thumb, (x, y), thumb)
    draw.text((x1, y2 + 4), label, fill=MUTED)


def _draw_change_tile(sheet: Image.Image, change: AssetImageChange, tile_x: int, tile_y: int, font: ImageFont.ImageFont) -> None:
    draw = ImageDraw.Draw(sheet)
    x1 = tile_x + TILE_PADDING
    y1 = tile_y + TILE_PADDING
    x2 = tile_x + TILE_WIDTH - TILE_PADDING
    y2 = tile_y + TILE_HEIGHT - TILE_PADDING
    draw.rounded_rectangle((x1, y1, x2, y2), radius=6, fill=TILE_BACKGROUND, outline=BORDER)
    status_color = STATUS_COLORS.get(change.status, TEXT)
    draw.text((x1 + 8, y1 + 7), change.status, fill=status_color, font=font)
    draw.text((x1 + 8, y1 + 24), _truncate(change.file_name, 28), fill=TEXT, font=font)

    before_box = (x1 + 12, y1 + 44, x1 + 68, y1 + 100)
    after_box = (x1 + 128, y1 + 44, x1 + 184, y1 + 100)
    _draw_thumbnail(draw, sheet, change.before_path, before_box, "before")
    _draw_thumbnail(draw, sheet, change.after_path, after_box, "after")
    draw.text((x1 + 93, y1 + 64), "->", fill=MUTED, font=font)


def _write_contact_sheet(report: AssetChangeReport, rows: list[AssetImageChange], output_path: Path) -> Path:
    row_count = max(1, math.ceil(len(rows) / SHEET_COLUMNS))
    width = SHEET_COLUMNS * TILE_WIDTH
    height = row_count * TILE_HEIGHT
    sheet = Image.new("RGB", (width, height), BACKGROUND)
    font = ImageFont.load_default()
    for index, change in enumerate(rows):
        column = index % SHEET_COLUMNS
        row = index // SHEET_COLUMNS
        _draw_change_tile(sheet, change, column * TILE_WIDTH, row * TILE_HEIGHT, font)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path, format="PNG")
    return output_path


def _target_title(name: str) -> str:
    return name[:1].upper() + name[1:]


def _build_markdown(reports: list[AssetChangeReport], sheet_paths_by_target: dict[str, Path], output_dir: Path) -> str:
    changed_reports = [report for report in reports if report.has_changes]
    lines = [
        "# Project Rogue Codex Image Review",
        "",
        "Generated contact sheets for reviewed site image changes.",
        "",
    ]
    if not changed_reports:
        lines.append("- No image changes.")
        return "\n".join(lines).rstrip() + "\n"

    for report in changed_reports:
        lines.extend(
            [
                f"## {_target_title(report.target_name)}",
                f"- Totals: +{len(report.added)} -{len(report.removed)} ~{len(report.changed)}",
            ]
        )
        sheet_path = sheet_paths_by_target.get(report.target_name)
        if sheet_path is not None:
            rel_path = sheet_path.relative_to(output_dir).as_posix()
            lines.append(f"![{_target_title(report.target_name)} contact sheet]({rel_path})")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def write_asset_review_artifacts(
    reports: Iterable[AssetChangeReport],
    *,
    output_dir: Path,
) -> AssetImageReviewArtifact:
    report_list = list(reports)
    output_dir.mkdir(parents=True, exist_ok=True)
    sheet_paths_by_target: dict[str, Path] = {}
    for report in report_list:
        rows = _change_rows(report)
        if not rows:
            continue
        sheet_path = output_dir / f"{report.target_name}_contact_sheet.png"
        sheet_paths_by_target[report.target_name] = _write_contact_sheet(report, rows, sheet_path)

    markdown_path = output_dir / "asset_image_review.md"
    markdown_path.write_text(
        _build_markdown(report_list, sheet_paths_by_target, output_dir),
        encoding="utf-8",
        newline="\n",
    )
    return AssetImageReviewArtifact(
        markdown_path=markdown_path,
        sheet_paths=list(sheet_paths_by_target.values()),
    )
