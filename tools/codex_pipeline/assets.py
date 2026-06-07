from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from tools.codex_pipeline.config import (
    ARMOR_IMAGES_DIR,
    CLIENT_ARMOR_IMAGES_DIR,
    CLIENT_MONSTER_IMAGES_DIR,
    CLIENT_WEAPON_IMAGES_DIR,
    MONSTER_IMAGES_DIR,
    WEAPON_IMAGES_DIR,
)
from tools.codex_pipeline.validators.site import ValidationIssue


IMAGE_EXTENSIONS = {".gif", ".png", ".jpg", ".jpeg", ".webp", ".ico"}


@dataclass(frozen=True)
class AssetTarget:
    name: str
    client_dir: Path
    site_dir: Path

    @property
    def manifest_path(self) -> Path:
        return self.site_dir / "manifest.json"


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


DEFAULT_ASSET_TARGETS = [
    AssetTarget("weapons", CLIENT_WEAPON_IMAGES_DIR, WEAPON_IMAGES_DIR),
    AssetTarget("armors", CLIENT_ARMOR_IMAGES_DIR, ARMOR_IMAGES_DIR),
    AssetTarget("monsters", CLIENT_MONSTER_IMAGES_DIR, MONSTER_IMAGES_DIR),
]


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
    if not target.client_dir.is_dir():
        issues.append(ValidationIssue("error", f"{target.name} client image folder not found: {target.client_dir}"))
    if not target.site_dir.is_dir():
        issues.append(ValidationIssue("error", f"{target.name} site image folder not found: {target.site_dir}"))
    return issues


def build_asset_change_report(target: AssetTarget) -> AssetChangeReport:
    issues = _validate_asset_target_paths(target)
    client_files = _collect_image_files(target.client_dir)
    site_files = _collect_image_files(target.site_dir)
    manifest_entries = _manifest_image_names(target, issues)

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
