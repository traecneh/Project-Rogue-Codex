from __future__ import annotations

import hashlib
import json
import shutil
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable, Sequence

from tools.codex_pipeline.config import (
    ARMOR_IMAGES_DIR,
    CLIENT_ARMOR_IMAGES_DIR,
    CLIENT_MONSTER_IMAGES_DIR,
    CLIENT_WEAPON_IMAGES_DIR,
    COLLECTABLE_IMAGES_DIR,
    GENERATED_ATLAS_ASSET_DIR,
    MONSTER_IMAGES_DIR,
    USEABLE_IMAGES_DIR,
    WEAPON_IMAGES_DIR,
)
from tools.codex_pipeline.validators.site import ValidationIssue


IMAGE_EXTENSIONS = {".gif", ".png", ".jpg", ".jpeg", ".webp", ".ico"}
PNG_BASE64_PREFIX = "iVBORw0KGgo"


@dataclass(frozen=True)
class AssetTarget:
    name: str
    client_dir: Path
    site_dir: Path
    manifest_prefix: str | None = None

    @property
    def manifest_path(self) -> Path:
        return self.site_dir / "manifest.json"

    @property
    def manifest_entry_prefix(self) -> str:
        return (self.manifest_prefix or f"images/{self.name}").strip("/")


@dataclass(frozen=True)
class AssetChangeReport:
    target_name: str
    client_dir: Path
    site_dir: Path
    client_count: int
    site_count: int
    manifest_count: int
    added: list[str]
    removed: list[str]
    changed: list[str]
    issues: list[ValidationIssue]

    @property
    def has_changes(self) -> bool:
        return bool(self.added or self.removed or self.changed)


@dataclass(frozen=True)
class AssetSyncReport:
    target_name: str
    client_dir: Path
    site_dir: Path
    dry_run: bool
    copied: list[str]
    removed: list[str]
    manifest_count: int
    issues: list[ValidationIssue]
    skipped_changed: list[str] = field(default_factory=list)

    @property
    def has_changes(self) -> bool:
        return bool(self.copied or self.removed)

    @property
    def has_errors(self) -> bool:
        return any(issue.severity == "error" for issue in self.issues)


DEFAULT_ASSET_TARGETS = [
    AssetTarget("weapons", CLIENT_WEAPON_IMAGES_DIR, WEAPON_IMAGES_DIR),
    AssetTarget("armors", CLIENT_ARMOR_IMAGES_DIR, ARMOR_IMAGES_DIR),
    AssetTarget("collectables", GENERATED_ATLAS_ASSET_DIR / "collectables", COLLECTABLE_IMAGES_DIR),
    AssetTarget("useables", GENERATED_ATLAS_ASSET_DIR / "useables", USEABLE_IMAGES_DIR),
    AssetTarget("monsters", CLIENT_MONSTER_IMAGES_DIR, MONSTER_IMAGES_DIR),
]
DEFAULT_ASSET_TARGETS_BY_NAME = {target.name: target for target in DEFAULT_ASSET_TARGETS}
ChangedImageFilter = Callable[[Path, Path, str], bool]


def _is_image_file(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS


def _file_hash(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def _collect_image_files(folder: Path) -> dict[str, Path]:
    if not folder.is_dir():
        return {}
    files: dict[str, Path] = {}
    for path in folder.rglob("*"):
        if not _is_image_file(path):
            continue
        rel = path.relative_to(folder).as_posix()
        files[rel] = path
    return files


def _manifest_image_names(target: AssetTarget, issues: list[ValidationIssue]) -> set[str]:
    manifest_path = target.manifest_path
    if not manifest_path.is_file():
        issues.append(ValidationIssue("error", f"{target.name} manifest not found: {manifest_path}"))
        return set()
    try:
        raw_entries = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        issues.append(ValidationIssue("error", f"{target.name} manifest failed to read: {manifest_path}: {exc}"))
        return set()
    if not isinstance(raw_entries, list):
        issues.append(ValidationIssue("error", f"{target.name} manifest must be a list: {manifest_path}"))
        return set()

    entries: set[str] = set()
    for raw_entry in raw_entries:
        entry = Path(str(raw_entry).replace("\\", "/")).name
        if entry == "manifest.json":
            issues.append(ValidationIssue("error", f"{manifest_path} manifest includes itself"))
            continue
        if entry:
            entries.add(entry)
    return entries


def _validate_asset_target_paths(target: AssetTarget) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    if not target.site_dir.is_dir():
        issues.append(ValidationIssue("error", f"{target.name} site image folder not found: {target.site_dir}"))
    return issues


def _find_gf_json_dir(path: Path) -> Path | None:
    for candidate in (path, *path.parents):
        if candidate.name.casefold() == "gf_json" and candidate.is_dir():
            return candidate
        child = candidate / "gf_json"
        if child.is_dir():
            return child
    return None


def _embedded_gf_json_png_sources(path: Path) -> list[Path]:
    gf_json_dir = _find_gf_json_dir(path)
    if gf_json_dir is None:
        return []

    sources: list[Path] = []
    for json_path in sorted(gf_json_dir.glob("*.json")):
        try:
            raw = json.loads(json_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        data = raw.get("Data") if isinstance(raw, dict) else None
        if isinstance(data, str) and data.lstrip().startswith(PNG_BASE64_PREFIX):
            sources.append(json_path)
    return sources


def _format_missing_client_asset_source_message(target: AssetTarget) -> str:
    message = f"{target.name} asset comparison skipped because client image folder not found: {target.client_dir}"
    embedded_sources = _embedded_gf_json_png_sources(target.client_dir)
    if not embedded_sources:
        return message

    names = [source.name for source in embedded_sources[:5]]
    if len(embedded_sources) > len(names):
        names.append(f"... {len(embedded_sources) - len(names)} more")
    gf_json_dir = embedded_sources[0].parent
    return (
        f"{message}; embedded gf_json PNG atlas source found: {gf_json_dir} "
        f"({len(embedded_sources)} file(s): {', '.join(names)}); run extract-atlas-assets to generate review images"
    )


def _manifest_entries_for(target: AssetTarget, image_names: Iterable[str]) -> list[str]:
    return [
        f"{target.manifest_entry_prefix}/{image_name}"
        for image_name in sorted(image_names)
    ]


def _read_manifest_entries(target: AssetTarget) -> list[str] | None:
    if not target.manifest_path.is_file():
        return None
    try:
        entries = json.loads(target.manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(entries, list):
        return None
    return [str(entry).replace("\\", "/") for entry in entries]


def _write_manifest_entries(target: AssetTarget, entries: Iterable[str]) -> None:
    target.manifest_path.write_text(
        json.dumps(list(entries), indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def _manifest_entries_match(current_entries: list[str] | None, desired_entries: list[str]) -> bool:
    return current_entries is not None and set(current_entries) == set(desired_entries)


def _read_json_list_for_asset_parity(path: Path, label: str, issues: list[ValidationIssue]) -> list[Any] | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        issues.append(ValidationIssue("error", f"{label} failed to read for asset/data parity: {path}: {exc}"))
        return None
    if not isinstance(data, list):
        issues.append(ValidationIssue("error", f"{label} must be a JSON list for asset/data parity: {path}"))
        return None
    return data


def _image_stem_key(value: object) -> tuple[str, str]:
    text = str(value).replace("\\", "/").strip()
    if not text:
        return "", ""
    file_name = Path(text).name
    stem = Path(file_name).stem.strip()
    return stem.casefold(), file_name


def _expected_image_names_from_data(records: list[Any]) -> dict[str, str]:
    names: dict[str, str] = {}
    for record in records:
        if not isinstance(record, dict):
            continue
        display_name = str(record.get("name") or "").strip()
        direct_image = record.get("image") or record.get("icon") or record.get("thumbnail")
        if direct_image:
            key, direct_display = _image_stem_key(direct_image)
            display_name = display_name or direct_display
        else:
            key = display_name.casefold()
        if key:
            names.setdefault(key, display_name)
    return names


def _image_names_from_manifest(entries: list[Any]) -> dict[str, str]:
    names: dict[str, str] = {}
    for entry in entries:
        key, file_name = _image_stem_key(entry)
        if not key or file_name == "manifest.json":
            continue
        names.setdefault(key, file_name)
    return names


def validate_asset_data_parity(target_name: str, data_path: Path, manifest_path: Path) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    records = _read_json_list_for_asset_parity(data_path, f"{target_name} data", issues)
    manifest_entries = _read_json_list_for_asset_parity(manifest_path, f"{target_name} manifest", issues)
    if records is None or manifest_entries is None:
        return issues

    data_names = _expected_image_names_from_data(records)
    image_names = _image_names_from_manifest(manifest_entries)

    for key in sorted(set(data_names) - set(image_names), key=lambda item: data_names[item].casefold()):
        issues.append(
            ValidationIssue(
                "warning",
                f"{target_name} asset/data parity: data record has no matching image: {data_names[key]}",
            )
        )
    for key in sorted(set(image_names) - set(data_names), key=lambda item: image_names[item].casefold()):
        issues.append(
            ValidationIssue(
                "warning",
                f"{target_name} asset/data parity: image has no matching data record: {image_names[key]}",
            )
        )
    return issues


def build_asset_change_report(target: AssetTarget) -> AssetChangeReport:
    issues = _validate_asset_target_paths(target)
    client_source_available = target.client_dir.is_dir()
    client_files = _collect_image_files(target.client_dir)
    site_files = _collect_image_files(target.site_dir)
    manifest_entries = _manifest_image_names(target, issues)

    if not client_source_available:
        issues.append(
            ValidationIssue(
                "error",
                _format_missing_client_asset_source_message(target),
            )
        )
        return AssetChangeReport(
            target_name=target.name,
            client_dir=target.client_dir,
            site_dir=target.site_dir,
            client_count=0,
            site_count=len(site_files),
            manifest_count=len(manifest_entries),
            added=[],
            removed=[],
            changed=[],
            issues=issues,
        )

    added = sorted(set(client_files) - set(site_files))
    removed = sorted(set(site_files) - set(client_files))
    changed = [
        name
        for name in sorted(set(client_files) & set(site_files))
        if _file_hash(client_files[name]) != _file_hash(site_files[name])
    ]

    for entry in sorted(manifest_entries - set(site_files)):
        issues.append(ValidationIssue("error", f"{target.name} manifest lists missing image {entry}"))
    for image_name in sorted(set(site_files) - manifest_entries):
        issues.append(ValidationIssue("error", f"{target.name} manifest does not list image {image_name}"))

    return AssetChangeReport(
        target_name=target.name,
        client_dir=target.client_dir,
        site_dir=target.site_dir,
        client_count=len(client_files),
        site_count=len(site_files),
        manifest_count=len(manifest_entries),
        added=added,
        removed=removed,
        changed=changed,
        issues=issues,
    )


def build_asset_change_reports(targets: Iterable[AssetTarget] = DEFAULT_ASSET_TARGETS) -> list[AssetChangeReport]:
    return [build_asset_change_report(target) for target in targets]


def resolve_asset_targets(names: Sequence[str] | None = None) -> list[AssetTarget]:
    if not names:
        return list(DEFAULT_ASSET_TARGETS)

    unknown = [name for name in names if name not in DEFAULT_ASSET_TARGETS_BY_NAME]
    if unknown:
        valid = ", ".join(sorted(DEFAULT_ASSET_TARGETS_BY_NAME))
        raise ValueError(f"Unknown asset target(s): {', '.join(unknown)}. Valid targets: {valid}")
    return [DEFAULT_ASSET_TARGETS_BY_NAME[name] for name in names]


def _asset_sync_path_issues(target: AssetTarget) -> list[ValidationIssue]:
    if target.client_dir.is_dir():
        return []
    return [ValidationIssue("error", f"{target.name} client image folder not found: {target.client_dir}")]


def sync_asset_changes(
    target: AssetTarget,
    *,
    dry_run: bool = False,
    changed_filter: ChangedImageFilter | None = None,
) -> AssetSyncReport:
    issues = _asset_sync_path_issues(target)
    if issues:
        return AssetSyncReport(
            target_name=target.name,
            client_dir=target.client_dir,
            site_dir=target.site_dir,
            dry_run=dry_run,
            copied=[],
            removed=[],
            manifest_count=0,
            issues=issues,
        )

    client_files = _collect_image_files(target.client_dir)
    site_files = _collect_image_files(target.site_dir)
    added = sorted(set(client_files) - set(site_files))
    changed = sorted(
        name
        for name in set(client_files) & set(site_files)
        if _file_hash(client_files[name]) != _file_hash(site_files[name])
    )
    selected_changed: list[str] = []
    skipped_changed: list[str] = []
    for image_name in changed:
        if changed_filter is None or changed_filter(site_files[image_name], client_files[image_name], image_name):
            selected_changed.append(image_name)
        else:
            skipped_changed.append(image_name)
    copied = sorted(set(added) | set(selected_changed))
    removed = sorted(set(site_files) - set(client_files))
    manifest_entries = _manifest_entries_for(target, client_files)

    if not dry_run:
        target.site_dir.mkdir(parents=True, exist_ok=True)
        for image_name in copied:
            destination = target.site_dir / Path(image_name)
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(client_files[image_name], destination)
        for image_name in removed:
            site_files[image_name].unlink()
        if added or removed or not _manifest_entries_match(_read_manifest_entries(target), manifest_entries):
            _write_manifest_entries(target, manifest_entries)
        issues.extend(build_asset_change_report(target).issues)
    elif target.site_dir.is_dir() and target.manifest_path.is_file():
        issues.extend(build_asset_change_report(target).issues)

    return AssetSyncReport(
        target_name=target.name,
        client_dir=target.client_dir,
        site_dir=target.site_dir,
        dry_run=dry_run,
        copied=copied,
        removed=removed,
        manifest_count=len(manifest_entries),
        issues=issues,
        skipped_changed=skipped_changed,
    )


def sync_asset_targets(
    targets: Iterable[AssetTarget] = DEFAULT_ASSET_TARGETS,
    *,
    dry_run: bool = False,
    changed_filter: ChangedImageFilter | None = None,
) -> list[AssetSyncReport]:
    return [sync_asset_changes(target, dry_run=dry_run, changed_filter=changed_filter) for target in targets]
