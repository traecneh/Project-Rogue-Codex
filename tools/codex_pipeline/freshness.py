from __future__ import annotations

import hashlib
import json
import subprocess
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Iterable

from tools.codex_pipeline.config import (
    ARMOR_IMAGES_DIR,
    ARMORS_DATA_PATH,
    CODEX_MANIFEST_PATH,
    MONSTER_IMAGES_DIR,
    MONSTERS_DATA_PATH,
    REPO_ROOT,
    WEAPON_IMAGES_DIR,
    WEAPONS_DATA_PATH,
)
from tools.codex_pipeline.validators.site import ValidationIssue


MANIFEST_SCHEMA = "project-rogue-codex-manifest"
MANIFEST_VERSION = 1


@dataclass(frozen=True)
class ManifestDataTarget:
    name: str
    path: Path
    relative_path: str


@dataclass(frozen=True)
class ManifestAssetTarget:
    name: str
    site_dir: Path
    manifest_path: Path
    relative_manifest_path: str


DEFAULT_MANIFEST_DATA_TARGETS = [
    ManifestDataTarget("weapons", WEAPONS_DATA_PATH, "pages/items/weapons_data05.json"),
    ManifestDataTarget("armors", ARMORS_DATA_PATH, "pages/items/armors_data06.json"),
    ManifestDataTarget("monsters", MONSTERS_DATA_PATH, "pages/enemies/monsters_data03.json"),
]

DEFAULT_MANIFEST_ASSET_TARGETS = [
    ManifestAssetTarget(
        "weapons",
        WEAPON_IMAGES_DIR,
        WEAPON_IMAGES_DIR / "manifest.json",
        "images/weapons/manifest.json",
    ),
    ManifestAssetTarget(
        "armors",
        ARMOR_IMAGES_DIR,
        ARMOR_IMAGES_DIR / "manifest.json",
        "images/armors/manifest.json",
    ),
    ManifestAssetTarget(
        "monsters",
        MONSTER_IMAGES_DIR,
        MONSTER_IMAGES_DIR / "manifest.json",
        "images/monsters/manifest.json",
    ),
]


def _utc_now_label() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha256_file(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def _stable_hash(value: object) -> str:
    payload = json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
    return _sha256_bytes(payload.encode("utf-8"))


def _read_json_list(path: Path, label: str) -> list[object]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"{label} must be a JSON list: {path}")
    return data


def _resolve_source_commit(repo_root: Path) -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=repo_root, text=True).strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def _asset_local_path(target: ManifestAssetTarget, manifest_entry: str) -> Path:
    return target.site_dir / Path(str(manifest_entry).replace("\\", "/")).name


def _build_data_section(targets: Iterable[ManifestDataTarget]) -> dict[str, dict[str, object]]:
    section: dict[str, dict[str, object]] = {}
    for target in targets:
        records = _read_json_list(target.path, target.name)
        section[target.name] = {
            "path": target.relative_path,
            "records": len(records),
            "sha256": _sha256_file(target.path),
        }
    return section


def _build_asset_section(targets: Iterable[ManifestAssetTarget]) -> dict[str, dict[str, object]]:
    section: dict[str, dict[str, object]] = {}
    for target in targets:
        entries = [str(entry).replace("\\", "/") for entry in _read_json_list(target.manifest_path, target.name)]
        file_hashes = [
            {
                "entry": entry,
                "sha256": _sha256_file(_asset_local_path(target, entry)),
            }
            for entry in sorted(entries)
        ]
        section[target.name] = {
            "manifest_path": target.relative_manifest_path,
            "entries": len(entries),
            "manifest_sha256": _sha256_file(target.manifest_path),
            "files_sha256": _stable_hash(file_hashes),
        }
    return section


def build_codex_manifest(
    *,
    repo_root: Path = REPO_ROOT,
    generated_at_utc: str | None = None,
    source_commit: str | None = None,
    data_targets: Iterable[ManifestDataTarget] = DEFAULT_MANIFEST_DATA_TARGETS,
    asset_targets: Iterable[ManifestAssetTarget] = DEFAULT_MANIFEST_ASSET_TARGETS,
) -> dict[str, object]:
    data = _build_data_section(data_targets)
    assets = _build_asset_section(asset_targets)
    summary = {
        "data_records": sum(int(details["records"]) for details in data.values()),
        "asset_entries": sum(int(details["entries"]) for details in assets.values()),
    }
    summary["content_sha256"] = _stable_hash({"data": data, "assets": assets})
    return {
        "schema": MANIFEST_SCHEMA,
        "version": MANIFEST_VERSION,
        "generated_at_utc": generated_at_utc or _utc_now_label(),
        "source_commit": source_commit or _resolve_source_commit(repo_root),
        "data": data,
        "assets": assets,
        "summary": summary,
    }


def write_codex_manifest(manifest: dict[str, object], path: Path = CODEX_MANIFEST_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(manifest, ensure_ascii=True, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def load_codex_manifest(path: Path = CODEX_MANIFEST_PATH) -> dict[str, object]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"codex manifest must be a JSON object: {path}")
    return data


def validate_codex_manifest(
    *,
    manifest_path: Path = CODEX_MANIFEST_PATH,
    repo_root: Path = REPO_ROOT,
    data_targets: Iterable[ManifestDataTarget] = DEFAULT_MANIFEST_DATA_TARGETS,
    asset_targets: Iterable[ManifestAssetTarget] = DEFAULT_MANIFEST_ASSET_TARGETS,
) -> list[ValidationIssue]:
    try:
        current = load_codex_manifest(manifest_path)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        return [ValidationIssue("error", f"{manifest_path} failed to read codex manifest: {exc}")]

    expected = build_codex_manifest(
        repo_root=repo_root,
        generated_at_utc=str(current.get("generated_at_utc") or ""),
        source_commit=str(current.get("source_commit") or ""),
        data_targets=data_targets,
        asset_targets=asset_targets,
    )
    if current != expected:
        return [
            ValidationIssue(
                "error",
                "data/codex_manifest.json is stale; run python -m tools.codex_pipeline refresh-manifest",
            )
        ]
    return []
