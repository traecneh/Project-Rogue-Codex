from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re

from tools.codex_pipeline.config import REPO_ROOT


STATIC_ASSET_VERSION_PATH = REPO_ROOT / "data" / "codex-overrides" / "static_asset_version.txt"
HTML_NO_CACHE_TAGS = (
    '<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />',
    '<meta http-equiv="Pragma" content="no-cache" />',
    '<meta http-equiv="Expires" content="0" />',
)
VERSION_TOKEN_RE = re.compile(r"^[A-Za-z0-9._-]+$")
LOCAL_STATIC_ASSET_RE = re.compile(
    r'(?P<prefix>(?:href|src)=")'
    r'(?P<asset>(?:css|js)/[^"?]+)'
    r'(?:\?v=[^"]*)?'
    r'(?P<suffix>")',
    flags=re.IGNORECASE,
)
VIEWPORT_META_RE = re.compile(
    r'(?P<tag>\s*<meta name="viewport" content="width=device-width, initial-scale=1" />)',
    flags=re.IGNORECASE,
)
HEAD_OPEN_RE = re.compile(r"(<head[^>]*>)", flags=re.IGNORECASE)


@dataclass(frozen=True)
class StaticAssetVersionResult:
    path: Path
    changed: bool
    asset_reference_count: int
    cache_meta_added: bool


def validate_static_asset_version(version: str) -> str:
    token = version.strip()
    if not token:
        raise ValueError("static asset version cannot be empty")
    if not VERSION_TOKEN_RE.match(token):
        raise ValueError("static asset version can only contain letters, numbers, dots, underscores, and dashes")
    return token


def load_static_asset_version(path: Path = STATIC_ASSET_VERSION_PATH) -> str:
    return validate_static_asset_version(path.read_text(encoding="utf-8"))


def write_static_asset_version(version: str, path: Path = STATIC_ASSET_VERSION_PATH) -> None:
    token = validate_static_asset_version(version)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"{token}\n", encoding="utf-8")


def version_local_static_assets_in_html(html: str, version: str) -> tuple[str, int]:
    token = validate_static_asset_version(version)
    replacement_count = 0

    def replace(match: re.Match[str]) -> str:
        nonlocal replacement_count
        replacement_count += 1
        return f'{match.group("prefix")}{match.group("asset")}?v={token}{match.group("suffix")}'

    return LOCAL_STATIC_ASSET_RE.sub(replace, html), replacement_count


def ensure_html_no_cache_meta(html: str) -> tuple[str, bool]:
    missing_tags = [tag for tag in HTML_NO_CACHE_TAGS if tag not in html]
    if not missing_tags:
        return html, False

    insertion = "\n".join(f"    {tag}" for tag in missing_tags)
    viewport_match = VIEWPORT_META_RE.search(html)
    if viewport_match:
        insert_at = viewport_match.end("tag")
        return f"{html[:insert_at]}\n{insertion}{html[insert_at:]}", True

    head_match = HEAD_OPEN_RE.search(html)
    if head_match:
        insert_at = head_match.end(1)
        return f"{html[:insert_at]}\n{insertion}{html[insert_at:]}", True

    return f"{insertion}\n{html}", True


def update_static_asset_versions(
    paths: list[Path],
    version: str,
    *,
    dry_run: bool = False,
) -> list[StaticAssetVersionResult]:
    token = validate_static_asset_version(version)
    results: list[StaticAssetVersionResult] = []
    for path in paths:
        original = path.read_text(encoding="utf-8")
        updated, asset_reference_count = version_local_static_assets_in_html(original, token)
        updated, cache_meta_added = ensure_html_no_cache_meta(updated)
        changed = updated != original
        if changed and not dry_run:
            path.write_text(updated, encoding="utf-8")
        results.append(
            StaticAssetVersionResult(
                path=path,
                changed=changed,
                asset_reference_count=asset_reference_count,
                cache_meta_added=cache_meta_added,
            )
        )
    return results
