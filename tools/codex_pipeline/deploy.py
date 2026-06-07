from __future__ import annotations

import json
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable
from urllib.parse import urljoin

from tools.codex_pipeline.config import ARMORS_DATA_PATH, MONSTERS_DATA_PATH, WEAPONS_DATA_PATH


DEFAULT_LIVE_SITE_URL = "https://traecneh.github.io/Project-Rogue-Codex/"


@dataclass(frozen=True)
class LiveDataTarget:
    name: str
    local_path: Path
    site_relative_path: str


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


FetchText = Callable[[str, float], str]


def fetch_url_text(url: str, timeout_seconds: float) -> str:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Project-Rogue-Codex-Codex-Pipeline/1.0"},
    )
    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset, errors="replace")


def _normalize_site_url(site_url: str) -> str:
    normalized = site_url.strip()
    if not normalized:
        raise ValueError("live site URL must not be empty")
    if not normalized.endswith("/"):
        normalized += "/"
    return normalized


def _read_local_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


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


def verify_live_site(
    site_url: str = DEFAULT_LIVE_SITE_URL,
    *,
    targets: Iterable[LiveDataTarget] = DEFAULT_LIVE_DATA_TARGETS,
    fetch_text: FetchText = fetch_url_text,
    timeout_seconds: float = 20,
) -> list[LiveCheckResult]:
    normalized_site_url = _normalize_site_url(site_url)
    results = [_check_index(normalized_site_url, fetch_text, timeout_seconds)]
    results.extend(
        _check_data_target(normalized_site_url, target, fetch_text, timeout_seconds)
        for target in targets
    )
    return results
