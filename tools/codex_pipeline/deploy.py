from __future__ import annotations

import hashlib
import json
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable
from urllib.parse import quote, urljoin

from tools.codex_pipeline.config import (
    ARMOR_IMAGES_DIR,
    ARMORS_DATA_PATH,
    MONSTER_IMAGES_DIR,
    MONSTERS_DATA_PATH,
    WEAPON_IMAGES_DIR,
    WEAPONS_DATA_PATH,
)


DEFAULT_LIVE_SITE_URL = "https://traecneh.github.io/Project-Rogue-Codex/"


@dataclass(frozen=True)
class LiveDataTarget:
    name: str
    local_path: Path
    site_relative_path: str


@dataclass(frozen=True)
class LiveAssetTarget:
    name: str
    local_dir: Path
    manifest_path: Path
    site_manifest_relative_path: str


@dataclass(frozen=True)
class LiveCheckResult:
    label: str
    url: str
    ok: bool
    message: str


DEFAULT_LIVE_DATA_TARGETS = [
    LiveDataTarget("weapons", WEAPONS_DATA_PATH, "pages/items/weapons_data05.json"),
    LiveDataTarget("armors", ARMORS_DATA_PATH, "pages/items/armors_data06.json"),
    LiveDataTarget("monsters", MONSTERS_DATA_PATH, "pages/enemies/monsters_data03.json"),
]

DEFAULT_LIVE_ASSET_TARGETS = [
    LiveAssetTarget("weapons", WEAPON_IMAGES_DIR, WEAPON_IMAGES_DIR / "manifest.json", "images/weapons/manifest.json"),
    LiveAssetTarget("armors", ARMOR_IMAGES_DIR, ARMOR_IMAGES_DIR / "manifest.json", "images/armors/manifest.json"),
    LiveAssetTarget("monsters", MONSTER_IMAGES_DIR, MONSTER_IMAGES_DIR / "manifest.json", "images/monsters/manifest.json"),
]


FetchText = Callable[[str, float], str]
FetchBytes = Callable[[str, float], bytes]


def fetch_url_text(url: str, timeout_seconds: float) -> str:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Project-Rogue-Codex-Codex-Pipeline/1.0"},
    )
    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset, errors="replace")


def fetch_url_bytes(url: str, timeout_seconds: float) -> bytes:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Project-Rogue-Codex-Codex-Pipeline/1.0"},
    )
    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
        return response.read()


def _normalize_site_url(site_url: str) -> str:
    normalized = site_url.strip()
    if not normalized:
        raise ValueError("live site URL must not be empty")
    if not normalized.endswith("/"):
        normalized += "/"
    return normalized


def _read_local_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def _read_local_manifest(target: LiveAssetTarget) -> list[str]:
    data = _read_local_json(target.manifest_path)
    if not isinstance(data, list):
        raise ValueError(f"{target.manifest_path} manifest must be a list")
    return [str(entry).replace("\\", "/") for entry in data]


def _asset_url(site_url: str, manifest_entry: str) -> str:
    return urljoin(site_url, quote(manifest_entry.replace("\\", "/"), safe="/"))


def _asset_local_path(target: LiveAssetTarget, manifest_entry: str) -> Path:
    return target.local_dir / Path(manifest_entry.replace("\\", "/")).name


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _check_index(site_url: str, fetch_text: FetchText, timeout_seconds: float) -> LiveCheckResult:
    try:
        html = fetch_text(site_url, timeout_seconds)
    except Exception as exc:
        return LiveCheckResult("site", site_url, False, f"site failed to load: {exc}")
    if "Project Rogue Codex" not in html:
        return LiveCheckResult("site", site_url, False, "site loaded but did not contain Project Rogue Codex")
    return LiveCheckResult("site", site_url, True, "site reachable")


def _check_data_target(
    site_url: str,
    target: LiveDataTarget,
    fetch_text: FetchText,
    timeout_seconds: float,
) -> LiveCheckResult:
    url = urljoin(site_url, target.site_relative_path)
    try:
        local_json = _read_local_json(target.local_path)
    except (OSError, json.JSONDecodeError) as exc:
        return LiveCheckResult(target.name, url, False, f"{target.name} local JSON failed to read: {exc}")
    try:
        live_json = json.loads(fetch_text(url, timeout_seconds))
    except json.JSONDecodeError as exc:
        return LiveCheckResult(target.name, url, False, f"{target.name} live JSON failed to parse: {exc}")
    except Exception as exc:
        return LiveCheckResult(target.name, url, False, f"{target.name} live JSON failed to load: {exc}")
    if live_json != local_json:
        return LiveCheckResult(
            target.name,
            url,
            False,
            f"{target.name} live JSON differs from {target.site_relative_path}",
        )
    return LiveCheckResult(target.name, url, True, f"{target.name} matches {target.site_relative_path}")


def _check_asset_target(
    site_url: str,
    target: LiveAssetTarget,
    fetch_text: FetchText,
    fetch_bytes: FetchBytes,
    timeout_seconds: float,
) -> LiveCheckResult:
    label = f"{target.name} images"
    manifest_url = urljoin(site_url, target.site_manifest_relative_path)
    try:
        local_manifest = _read_local_manifest(target)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        return LiveCheckResult(label, manifest_url, False, f"{target.name} local manifest failed to read: {exc}")
    try:
        live_manifest = json.loads(fetch_text(manifest_url, timeout_seconds))
    except json.JSONDecodeError as exc:
        return LiveCheckResult(label, manifest_url, False, f"{target.name} live manifest failed to parse: {exc}")
    except Exception as exc:
        return LiveCheckResult(label, manifest_url, False, f"{target.name} live manifest failed to load: {exc}")
    if live_manifest != local_manifest:
        return LiveCheckResult(
            label,
            manifest_url,
            False,
            f"{target.name} live manifest differs from {target.site_manifest_relative_path}",
        )

    for manifest_entry in sorted(local_manifest):
        local_path = _asset_local_path(target, manifest_entry)
        image_url = _asset_url(site_url, manifest_entry)
        try:
            local_bytes = local_path.read_bytes()
        except OSError as exc:
            return LiveCheckResult(label, image_url, False, f"{target.name} local image failed to read: {local_path}: {exc}")
        try:
            live_bytes = fetch_bytes(image_url, timeout_seconds)
        except Exception as exc:
            return LiveCheckResult(label, image_url, False, f"{target.name} live image failed to load: {manifest_entry}: {exc}")
        if _sha256(live_bytes) != _sha256(local_bytes):
            return LiveCheckResult(
                label,
                image_url,
                False,
                f"{target.name} live image differs from {manifest_entry}",
            )

    return LiveCheckResult(
        label,
        manifest_url,
        True,
        f"{target.name} images match manifest and local hashes ({len(local_manifest)} checked)",
    )


def verify_live_site(
    site_url: str = DEFAULT_LIVE_SITE_URL,
    *,
    targets: Iterable[LiveDataTarget] = DEFAULT_LIVE_DATA_TARGETS,
    asset_targets: Iterable[LiveAssetTarget] = DEFAULT_LIVE_ASSET_TARGETS,
    fetch_text: FetchText = fetch_url_text,
    fetch_bytes: FetchBytes = fetch_url_bytes,
    timeout_seconds: float = 20,
) -> list[LiveCheckResult]:
    normalized_site_url = _normalize_site_url(site_url)
    results = [_check_index(normalized_site_url, fetch_text, timeout_seconds)]
    results.extend(
        _check_data_target(normalized_site_url, target, fetch_text, timeout_seconds)
        for target in targets
    )
    results.extend(
        _check_asset_target(normalized_site_url, target, fetch_text, fetch_bytes, timeout_seconds)
        for target in asset_targets
    )
    return results
