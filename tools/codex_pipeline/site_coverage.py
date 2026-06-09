from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path

from tools.codex_pipeline.config import REPO_ROOT


_EXTERNAL_URL_RE = re.compile(r"^[a-z][a-z0-9+.-]*:", re.IGNORECASE)


@dataclass(frozen=True)
class CoveredPage:
    path: str
    title: str
    in_navigation: bool
    in_search: bool
    exists: bool
    validated: bool = False
    smoked: bool = False


@dataclass(frozen=True)
class SiteCoverageReport:
    pages: list[CoveredPage]
    external_links: list[str] = field(default_factory=list)
    smoke_paths: set[str] = field(default_factory=set)
    validated_paths: set[str] = field(default_factory=set)

    @property
    def linked_page_count(self) -> int:
        return len(self.pages)

    @property
    def validated_count(self) -> int:
        return sum(1 for page in self.pages if self.is_validated(page))

    @property
    def smoked_count(self) -> int:
        return sum(1 for page in self.pages if self.is_smoked(page))

    @property
    def missing_files(self) -> list[CoveredPage]:
        return [page for page in self.pages if not page.exists]

    @property
    def nav_only_pages(self) -> list[CoveredPage]:
        return [page for page in self.pages if page.in_navigation and not page.in_search]

    @property
    def search_only_pages(self) -> list[CoveredPage]:
        return [page for page in self.pages if page.in_search and not page.in_navigation]

    @property
    def unvalidated_pages(self) -> list[CoveredPage]:
        return [page for page in self.pages if not self.is_validated(page)]

    @property
    def unsmoked_pages(self) -> list[CoveredPage]:
        return [page for page in self.pages if not self.is_smoked(page)]

    @property
    def has_errors(self) -> bool:
        return bool(self.missing_files)

    def is_validated(self, page: CoveredPage) -> bool:
        return page.validated or page.path in self.validated_paths

    def is_smoked(self, page: CoveredPage) -> bool:
        return page.smoked or page.path in self.smoke_paths


class _NavLinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[tuple[str, str]] = []
        self._active_href: str | None = None
        self._active_text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a" or self._active_href is not None:
            return
        attr_map = {name.lower(): value or "" for name, value in attrs}
        class_names = set(attr_map.get("class", "").split())
        href = attr_map.get("href", "").strip()
        if "nav-link" not in class_names or not href:
            return
        self._active_href = href
        self._active_text = []

    def handle_data(self, data: str) -> None:
        if self._active_href is not None:
            self._active_text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() != "a" or self._active_href is None:
            return
        title = " ".join("".join(self._active_text).split())
        self.links.append((self._active_href, title))
        self._active_href = None
        self._active_text = []


def build_site_coverage_report(
    repo_root: Path = REPO_ROOT,
    *,
    validated_html_paths: list[Path] | None = None,
) -> SiteCoverageReport:
    repo_root = Path(repo_root)
    nav_links, nav_external_links = _read_navigation_links(repo_root / "nav.html")
    search_links, search_external_links = _read_search_links(repo_root / "js" / "site-search.js")
    smoke_paths = _read_smoke_paths(repo_root / "tools" / "codex_pipeline" / "site_smoke.mjs")
    validated_paths = {
        _normalize_filesystem_page_path(path, repo_root)
        for path in (validated_html_paths or [])
        if _normalize_filesystem_page_path(path, repo_root)
    }

    pages: list[CoveredPage] = []
    for page_path in sorted(set(nav_links) | set(search_links)):
        title = nav_links.get(page_path) or search_links.get(page_path) or page_path
        exists = (repo_root / page_path).is_file()
        pages.append(
            CoveredPage(
                path=page_path,
                title=title,
                in_navigation=page_path in nav_links,
                in_search=page_path in search_links,
                exists=exists,
                validated=page_path in validated_paths,
                smoked=page_path in smoke_paths,
            )
        )

    return SiteCoverageReport(
        pages=pages,
        external_links=sorted(set(nav_external_links) | set(search_external_links)),
        smoke_paths=smoke_paths,
        validated_paths=validated_paths,
    )


def _read_navigation_links(path: Path) -> tuple[dict[str, str], list[str]]:
    if not path.is_file():
        return {}, []
    parser = _NavLinkParser()
    parser.feed(path.read_text(encoding="utf-8"))
    links: dict[str, str] = {}
    external: list[str] = []
    for href, title in parser.links:
        normalized = _normalize_internal_page_url(href)
        if normalized:
            links.setdefault(normalized, title or normalized)
        elif _is_external_url(href):
            external.append(href)
    return links, external


def _read_search_links(path: Path) -> tuple[dict[str, str], list[str]]:
    if not path.is_file():
        return {}, []
    source = path.read_text(encoding="utf-8")
    index_match = re.search(r"const\s+SITE_SEARCH_INDEX\s*=\s*\[(?P<body>[\s\S]*?)\]\s*;", source)
    if not index_match:
        return {}, []

    links: dict[str, str] = {}
    external: list[str] = []
    for object_match in re.finditer(r"\{(?P<body>[\s\S]*?)\}\s*,?", index_match.group("body")):
        body = object_match.group("body")
        title = _read_js_string_property(body, "title")
        url = _read_js_string_property(body, "url")
        if not url:
            continue
        normalized = _normalize_internal_page_url(url)
        if normalized:
            links.setdefault(normalized, title or normalized)
        elif _is_external_url(url):
            external.append(url)
    return links, external


def _read_smoke_paths(path: Path) -> set[str]:
    if not path.is_file():
        return set()
    source = path.read_text(encoding="utf-8")
    constant_paths = {
        name: value
        for name, value in re.findall(
            r"\bconst\s+([A-Z][A-Z0-9_]*)\s*=\s*\"([^\"]*\.html(?:\?[^\"]*)?)\"\s*;",
            source,
        )
    }

    smoke_urls: set[str] = set()
    smoke_urls.update(re.findall(r"\blistPath\s*:\s*\"([^\"]*\.html(?:\?[^\"]*)?)\"", source))
    smoke_urls.update(
        re.findall(r"page\.goto\(\s*joinUrl\(\s*baseUrl\s*,\s*\"([^\"]*\.html(?:\?[^\"]*)?)\"", source)
    )

    for constant_name in re.findall(r"page\.goto\(\s*joinUrl\(\s*baseUrl\s*,\s*([A-Z][A-Z0-9_]*)", source):
        if constant_name in constant_paths:
            smoke_urls.add(constant_paths[constant_name])

    return {
        normalized
        for normalized in (_normalize_internal_page_url(url) for url in smoke_urls)
        if normalized
    }


def _read_js_string_property(source: str, property_name: str) -> str | None:
    double_match = re.search(rf"\b{re.escape(property_name)}\s*:\s*\"((?:\\.|[^\"\\])*)\"", source)
    if double_match:
        return _decode_js_string(double_match.group(1), '"')
    single_match = re.search(rf"\b{re.escape(property_name)}\s*:\s*'((?:\\.|[^'\\])*)'", source)
    if single_match:
        return _decode_js_string(single_match.group(1), "'")
    return None


def _decode_js_string(value: str, quote: str) -> str:
    try:
        return json.loads(f"{quote}{value}{quote}")
    except json.JSONDecodeError:
        return value


def _normalize_internal_page_url(url: str) -> str | None:
    url = url.strip()
    if not url or _is_external_url(url):
        return None
    page_path = re.split(r"[?#]", url, maxsplit=1)[0].replace("\\", "/")
    while page_path.startswith("./"):
        page_path = page_path[2:]
    page_path = page_path.lstrip("/")
    if not page_path.endswith(".html"):
        return None
    return page_path


def _normalize_filesystem_page_path(path: Path, repo_root: Path) -> str | None:
    try:
        relative = Path(path).resolve().relative_to(repo_root.resolve())
    except ValueError:
        relative = Path(path)
    return _normalize_internal_page_url(relative.as_posix())


def _is_external_url(url: str) -> bool:
    return bool(_EXTERNAL_URL_RE.match(url.strip()))
