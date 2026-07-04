from __future__ import annotations

import base64
import io
import json
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Sequence

from PIL import Image

from tools.codex_pipeline.assets import AssetTarget
from tools.codex_pipeline.exports import ExportTarget
from tools.codex_pipeline.validators.site import ValidationIssue


ATLAS_FILENAMES_BY_TARGET = {
    "weapons": "itemgraph.json",
    "armors": "itemgraph.json",
    "collectables": "itemgraph.json",
    "useables": "itemgraph.json",
    "monsters": "avatars.json",
}
INVALID_FILENAME_CHARS = re.compile(r'[<>:"/\\|?*]')
IMAGE_EXTENSIONS = {".gif", ".png", ".jpg", ".jpeg", ".webp"}
CHROMA_KEY_MIN_RED_BLUE = 250
CHROMA_KEY_MAX_GREEN = 5


@dataclass(frozen=True)
class AtlasFrame:
    x: int
    y: int
    width: int
    height: int


@dataclass(frozen=True)
class AtlasExtractionReport:
    target_name: str
    atlas_path: Path
    data_path: Path
    output_dir: Path
    written: list[str]
    skipped: list[str]
    issues: list[ValidationIssue]

    @property
    def has_errors(self) -> bool:
        return any(issue.severity == "error" for issue in self.issues)


def _int_or_none(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        stripped = value.strip()
        if stripped and stripped.lstrip("-").isdigit():
            return int(stripped)
    return None


def _read_json_list(path: Path, target_name: str, issues: list[ValidationIssue]) -> list[Any] | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        issues.append(ValidationIssue("error", f"{target_name} generated data failed to read: {path}: {exc}"))
        return None
    if not isinstance(data, list):
        issues.append(ValidationIssue("error", f"{target_name} generated data must be a JSON list: {path}"))
        return None
    return data


def _load_atlas_image(path: Path, target_name: str, issues: list[ValidationIssue]) -> Image.Image | None:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        issues.append(ValidationIssue("error", f"{target_name} atlas failed to read: {path}: {exc}"))
        return None
    data = raw.get("Data") if isinstance(raw, dict) else None
    if not isinstance(data, str) or not data.strip():
        issues.append(ValidationIssue("error", f"{target_name} atlas does not contain embedded PNG Data: {path}"))
        return None
    try:
        image_bytes = base64.b64decode(data, validate=True)
        image = Image.open(io.BytesIO(image_bytes))
        image.load()
    except (ValueError, OSError) as exc:
        issues.append(ValidationIssue("error", f"{target_name} atlas PNG failed to decode: {path}: {exc}"))
        return None
    return image.convert("RGBA")


def _record_name(record: Any, fallback_index: int) -> str:
    if isinstance(record, dict):
        name = str(record.get("name") or "").strip()
        if name:
            return name
        record_id = record.get("id")
        if record_id is not None and str(record_id).strip():
            return f"asset-{record_id}"
    return f"asset-{fallback_index + 1}"


def _sanitize_filename_stem(value: str) -> str:
    sanitized = INVALID_FILENAME_CHARS.sub("_", value).strip().rstrip(".")
    return sanitized or "asset"


def _manifest_site_name_map(site_dir: Path | None) -> dict[str, str]:
    if site_dir is None:
        return {}

    names: dict[str, str] = {}
    manifest_path = site_dir / "manifest.json"
    if manifest_path.is_file():
        try:
            entries = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            entries = []
        if isinstance(entries, list):
            for entry in entries:
                file_name = Path(str(entry).replace("\\", "/")).name
                if file_name and file_name != "manifest.json":
                    names.setdefault(Path(file_name).stem.casefold(), file_name)

    if site_dir.is_dir():
        for path in sorted(site_dir.iterdir()):
            if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS and path.name != "manifest.json":
                names.setdefault(path.stem.casefold(), path.name)
    return names


def _record_id_suffix(record: Any, fallback_index: int) -> str:
    if isinstance(record, dict):
        record_id = record.get("id")
        if record_id is not None and str(record_id).strip():
            return _sanitize_filename_stem(str(record_id))
    return str(fallback_index + 1)


def _output_file_name(record_name: str, site_names: dict[str, str], *, duplicate_suffix: str | None = None) -> str:
    stem = _sanitize_filename_stem(record_name)
    if duplicate_suffix:
        duplicate_stem = f"{stem}-{duplicate_suffix}"
        return site_names.get(duplicate_stem.casefold()) or f"{duplicate_stem}.png"
    return site_names.get(stem.casefold()) or f"{stem}.png"


def _record_frames(record: Any) -> list[AtlasFrame]:
    if not isinstance(record, dict):
        return []
    fields = record.get("fields")
    if not isinstance(fields, dict):
        return []

    frames: list[AtlasFrame] = []
    for frame_number in range(1, 10):
        prefix = f"frame_{frame_number}"
        x = _int_or_none(fields.get(f"{prefix}_x"))
        y = _int_or_none(fields.get(f"{prefix}_y"))
        width = _int_or_none(fields.get(f"{prefix}_width"))
        height = _int_or_none(fields.get(f"{prefix}_height"))
        if x is None or y is None or width is None or height is None:
            continue
        if width <= 0 or height <= 0:
            continue
        frames.append(AtlasFrame(x=x, y=y, width=width, height=height))
    return frames


def _crop_frames(atlas: Image.Image, frames: Sequence[AtlasFrame], record_name: str, issues: list[ValidationIssue]) -> list[Image.Image]:
    crops: list[Image.Image] = []
    atlas_width, atlas_height = atlas.size
    for frame in frames:
        if frame.x < 0 or frame.y < 0 or frame.x + frame.width > atlas_width or frame.y + frame.height > atlas_height:
            issues.append(
                ValidationIssue(
                    "warning",
                    f"{record_name} frame outside atlas bounds: x={frame.x} y={frame.y} w={frame.width} h={frame.height}",
                )
            )
            continue
        crops.append(
            _apply_chroma_key_transparency(
                atlas.crop((frame.x, frame.y, frame.x + frame.width, frame.y + frame.height))
            )
        )
    return crops


def _apply_chroma_key_transparency(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = []
    changed = False
    for red, green, blue, alpha in rgba.getdata():
        if _is_transparent_chroma_key(red, green, blue) and alpha:
            pixels.append((red, green, blue, 0))
            changed = True
        else:
            pixels.append((red, green, blue, alpha))
    if changed:
        rgba.putdata(pixels)
    return rgba


def _is_transparent_chroma_key(red: int, green: int, blue: int) -> bool:
    return red >= CHROMA_KEY_MIN_RED_BLUE and blue >= CHROMA_KEY_MIN_RED_BLUE and green <= CHROMA_KEY_MAX_GREEN


def _save_frames(frames: Sequence[Image.Image], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    suffix = path.suffix.lower()
    if suffix == ".gif":
        gif_frames = [frame.convert("RGBA") for frame in frames]
        first, rest = gif_frames[0], gif_frames[1:]
        first.save(path, format="GIF", save_all=bool(rest), append_images=rest, duration=120, loop=0, disposal=2)
        return
    frames[0].save(path, format="PNG")


def _write_manifest(output_dir: Path, target_name: str, file_names: Iterable[str]) -> None:
    entries = [f"images/{target_name}/{file_name}" for file_name in sorted(file_names)]
    (output_dir / "manifest.json").write_text(json.dumps(entries, indent=2) + "\n", encoding="utf-8", newline="\n")


def _clear_generated_output_images(output_dir: Path) -> None:
    if not output_dir.is_dir():
        return
    for path in output_dir.rglob("*"):
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS:
            path.unlink()


def extract_atlas_assets_for_target(
    target_name: str,
    *,
    data_path: Path,
    gf_json_dir: Path,
    output_dir: Path,
    site_dir: Path | None = None,
) -> AtlasExtractionReport:
    atlas_filename = ATLAS_FILENAMES_BY_TARGET.get(target_name)
    atlas_path = gf_json_dir / (atlas_filename or "")
    issues: list[ValidationIssue] = []
    written: list[str] = []
    skipped: list[str] = []

    if atlas_filename is None:
        issues.append(ValidationIssue("error", f"{target_name} has no configured atlas source"))
        return AtlasExtractionReport(target_name, atlas_path, data_path, output_dir, written, skipped, issues)

    records = _read_json_list(data_path, target_name, issues)
    atlas = _load_atlas_image(atlas_path, target_name, issues) if atlas_path.is_file() else None
    if not atlas_path.is_file():
        issues.append(ValidationIssue("error", f"{target_name} atlas not found: {atlas_path}"))
    if records is None or atlas is None:
        return AtlasExtractionReport(target_name, atlas_path, data_path, output_dir, written, skipped, issues)

    site_names = _manifest_site_name_map(site_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    _clear_generated_output_images(output_dir)
    record_names = [_record_name(record, index) for index, record in enumerate(records)]
    name_counts = Counter(_sanitize_filename_stem(name).casefold() for name in record_names)
    for index, record in enumerate(records):
        name = record_names[index]
        frames = _record_frames(record)
        if not frames:
            skipped.append(name)
            continue
        crops = _crop_frames(atlas, frames, name, issues)
        if not crops:
            skipped.append(name)
            continue
        duplicate_suffix = (
            _record_id_suffix(record, index)
            if name_counts[_sanitize_filename_stem(name).casefold()] > 1
            else None
        )
        file_name = _output_file_name(name, site_names, duplicate_suffix=duplicate_suffix)
        try:
            _save_frames(crops, output_dir / file_name)
        except OSError as exc:
            issues.append(ValidationIssue("error", f"{target_name} failed to write atlas asset {file_name}: {exc}"))
            continue
        written.append(file_name)

    _write_manifest(output_dir, target_name, written)
    return AtlasExtractionReport(
        target_name=target_name,
        atlas_path=atlas_path,
        data_path=data_path,
        output_dir=output_dir,
        written=sorted(written),
        skipped=skipped,
        issues=issues,
    )


def extract_atlas_assets_for_targets(
    export_targets: Iterable[ExportTarget],
    asset_targets: Iterable[AssetTarget],
    *,
    output_dir: Path,
    gf_json_dir: Path,
    asset_output_dir: Path,
) -> list[AtlasExtractionReport]:
    asset_targets_by_name = {target.name: target for target in asset_targets}
    reports: list[AtlasExtractionReport] = []
    for target in export_targets:
        asset_target = asset_targets_by_name.get(target.name)
        reports.append(
            extract_atlas_assets_for_target(
                target.name,
                data_path=target.generated_path(output_dir),
                gf_json_dir=gf_json_dir,
                output_dir=asset_output_dir / target.name,
                site_dir=asset_target.site_dir if asset_target is not None else None,
            )
        )
    return reports


def generated_atlas_asset_targets(
    asset_targets: Iterable[AssetTarget],
    *,
    asset_output_dir: Path,
) -> list[AssetTarget]:
    return [
        AssetTarget(
            target.name,
            asset_output_dir / target.name,
            target.site_dir,
            target.manifest_prefix,
        )
        for target in asset_targets
    ]


def has_atlas_source(target_name: str, *, gf_json_dir: Path) -> bool:
    atlas_filename = ATLAS_FILENAMES_BY_TARGET.get(target_name)
    return bool(atlas_filename) and (gf_json_dir / atlas_filename).is_file()
