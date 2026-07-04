from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from tools.codex_pipeline.config import (
    COLLECTABLES_DATA_PATH,
    ITEM_RELATIONSHIP_OVERRIDES_PATH,
    ITEM_RELATIONSHIP_TARGETS_PATH,
    REPO_ROOT,
    USEABLES_DATA_PATH,
)
from tools.codex_pipeline.exports import ExportError


@dataclass(frozen=True)
class ItemRelationship:
    relationship_type: str
    target: str
    evidence: str


@dataclass(frozen=True)
class ItemRelationshipRecord:
    item_kind: str
    item_id: str
    item_name: str
    status: str
    confirmed: list[ItemRelationship] = field(default_factory=list)
    candidates: list[ItemRelationship] = field(default_factory=list)


@dataclass(frozen=True)
class UnknownUseTypeGroup:
    item_kind: str
    field_name: str
    value: int
    item_names: list[str]


@dataclass(frozen=True)
class ItemRelationshipTargetCoverage:
    target: str
    status: str
    relationship_count: int
    href: str = ""
    reason: str = ""
    item_labels: list[str] = field(default_factory=list)
    issue: str = ""


@dataclass(frozen=True)
class ItemRelationshipReport:
    records: list[ItemRelationshipRecord]
    unknown_use_types: list[UnknownUseTypeGroup] = field(default_factory=list)
    target_coverage: list[ItemRelationshipTargetCoverage] = field(default_factory=list)

    @property
    def total_items(self) -> int:
        return len(self.records)

    @property
    def confirmed_count(self) -> int:
        return sum(1 for record in self.records if record.status == "confirmed")

    @property
    def candidate_count(self) -> int:
        return sum(1 for record in self.records if record.status == "candidate")

    @property
    def gap_count(self) -> int:
        return sum(1 for record in self.records if record.status == "gap")

    @property
    def linked_target_count(self) -> int:
        return sum(1 for coverage in self.target_coverage if coverage.status == "linked")

    @property
    def text_only_target_count(self) -> int:
        return sum(1 for coverage in self.target_coverage if coverage.status == "text_only")

    @property
    def target_issue_count(self) -> int:
        return sum(1 for coverage in self.target_coverage if coverage.issue)


@dataclass(frozen=True)
class _ItemRow:
    item_kind: str
    item_id: str
    name: str
    fields: dict[str, Any]


@dataclass(frozen=True)
class _SystemPage:
    title: str
    relative_path: str
    text: str


@dataclass(frozen=True)
class _ManualRelationshipOverride:
    item_kind: str
    item_name: str
    item_id: str | None
    relationships: list[ItemRelationship]


@dataclass(frozen=True)
class _RelationshipTargetPolicy:
    target: str
    href: str
    text_only: bool
    reason: str


class _SystemPageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.text_parts: list[str] = []
        self.title_parts: list[str] = []
        self.h1_parts: list[str] = []
        self._active_tag: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        lowered = tag.lower()
        if lowered in {"script", "style"}:
            self._active_tag = lowered
        elif lowered in {"title", "h1"}:
            self._active_tag = lowered

    def handle_endtag(self, tag: str) -> None:
        lowered = tag.lower()
        if lowered == self._active_tag:
            self._active_tag = None

    def handle_data(self, data: str) -> None:
        if self._active_tag in {"script", "style"}:
            return
        text = " ".join(data.split())
        if not text:
            return
        self.text_parts.append(text)
        if self._active_tag == "title":
            self.title_parts.append(text)
        elif self._active_tag == "h1":
            self.h1_parts.append(text)

    @property
    def title(self) -> str:
        h1 = " ".join(self.h1_parts).strip()
        if h1:
            return h1
        title = " ".join(self.title_parts).strip()
        return re.split(r"\s+[|—-]\s+", title, maxsplit=1)[0].strip() or "System Page"

    @property
    def text(self) -> str:
        return " ".join(self.text_parts)


class _HtmlIdParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if name.lower() == "id" and value:
                self.ids.add(value)


COLLECTABLE_USE_TYPE_LABELS = {
    11: "ore/refining material",
    12: "crafting material",
    14: "wood material",
    17: "raw cooking material",
    50: "healing potion",
    51: "cure potion",
    52: "cure potion",
    53: "berserk potion",
}

USEABLE_USE_TYPE_LABELS = {
    10: "mining tool",
    12: "blacksmithing tool",
    13: "woodcutting tool",
    14: "milling tool",
    15: "carpentry tool",
    16: "fishing tool",
}

USE_TYPE_LABELS_BY_KIND = {
    "collectable": COLLECTABLE_USE_TYPE_LABELS,
    "useable": USEABLE_USE_TYPE_LABELS,
}


def _read_json_list(path: Path, label: str) -> list[Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ExportError(f"{label} relationship source is not readable JSON at {path}: {exc}") from exc
    if not isinstance(data, list):
        raise ExportError(f"{label} relationship source must be a JSON list: {path}")
    return data


def _read_json_object(path: Path, label: str) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ExportError(f"{label} relationship source is not readable JSON at {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise ExportError(f"{label} relationship source must be a JSON object: {path}")
    return data


def _normalize_spaces(value: str) -> str:
    return " ".join(value.split())


def _normalize_key(value: Any) -> str:
    return _normalize_spaces(str(value or "")).lower()


def _field_int(fields: dict[str, Any], name: str) -> int | None:
    try:
        return int(fields.get(name))
    except (TypeError, ValueError):
        return None


def _load_items(path: Path, item_kind: str) -> list[_ItemRow]:
    rows: list[_ItemRow] = []
    for index, raw in enumerate(_read_json_list(path, item_kind)):
        if not isinstance(raw, dict):
            continue
        name = _normalize_spaces(str(raw.get("name") or ""))
        if not name:
            continue
        fields = raw.get("fields")
        rows.append(
            _ItemRow(
                item_kind=item_kind,
                item_id=str(raw.get("id", index)),
                name=name,
                fields=fields if isinstance(fields, dict) else {},
            )
        )
    return rows


def _load_manual_overrides(path: Path) -> list[_ManualRelationshipOverride]:
    if not path.is_file():
        return []
    raw = _read_json_object(path, "item relationship overrides")
    if raw.get("schemaVersion") != 1:
        raise ExportError(f"Unsupported item relationship override schemaVersion: {raw.get('schemaVersion')!r}")
    relationships = raw.get("relationships")
    if not isinstance(relationships, list):
        raise ExportError("item relationship overrides must include a relationships list")

    overrides: list[_ManualRelationshipOverride] = []
    for index, raw_override in enumerate(relationships):
        if not isinstance(raw_override, dict):
            raise ExportError(f"item relationship override #{index + 1} must be an object")
        item_kind = _normalize_key(raw_override.get("kind"))
        if item_kind not in {"collectable", "useable"}:
            raise ExportError(f"item relationship override #{index + 1} has unsupported kind: {raw_override.get('kind')!r}")
        item_name = _normalize_spaces(str(raw_override.get("name") or ""))
        if not item_name:
            raise ExportError(f"item relationship override #{index + 1} must include a name")
        item_id = raw_override.get("id")
        normalized_id = str(item_id) if item_id is not None else None
        raw_relationships = raw_override.get("relationships")
        if not isinstance(raw_relationships, list) or not raw_relationships:
            raise ExportError(f"item relationship override #{index + 1} must include at least one relationship")

        parsed_relationships: list[ItemRelationship] = []
        for relationship_index, raw_relationship in enumerate(raw_relationships):
            if not isinstance(raw_relationship, dict):
                raise ExportError(
                    f"item relationship override #{index + 1} relationship #{relationship_index + 1} must be an object"
                )
            relationship_type = _normalize_spaces(str(raw_relationship.get("type") or ""))
            target = _normalize_spaces(str(raw_relationship.get("target") or ""))
            evidence = _normalize_spaces(str(raw_relationship.get("evidence") or "manual review"))
            if not relationship_type or not target:
                raise ExportError(
                    f"item relationship override #{index + 1} relationship #{relationship_index + 1} "
                    "must include type and target"
                )
            parsed_relationships.append(
                ItemRelationship(
                    relationship_type=relationship_type,
                    target=target,
                    evidence=f"manual override: {evidence}",
                )
            )

        overrides.append(
            _ManualRelationshipOverride(
                item_kind=item_kind,
                item_name=item_name,
                item_id=normalized_id,
                relationships=parsed_relationships,
            )
        )
    return overrides


def _load_target_policies(path: Path) -> dict[str, _RelationshipTargetPolicy]:
    if not path.is_file():
        return {}
    raw = _read_json_object(path, "item relationship targets")
    if raw.get("schemaVersion") != 1:
        raise ExportError(f"Unsupported item relationship target schemaVersion: {raw.get('schemaVersion')!r}")
    raw_targets = raw.get("targets")
    if not isinstance(raw_targets, list):
        raise ExportError("item relationship targets must include a targets list")

    policies: dict[str, _RelationshipTargetPolicy] = {}
    for index, raw_target in enumerate(raw_targets):
        if not isinstance(raw_target, dict):
            raise ExportError(f"item relationship target #{index + 1} must be an object")
        target = _normalize_spaces(str(raw_target.get("target") or ""))
        href = str(raw_target.get("href") or "").strip()
        text_only = bool(raw_target.get("textOnly", False))
        reason = _normalize_spaces(str(raw_target.get("reason") or ""))
        if not target:
            raise ExportError(f"item relationship target #{index + 1} must include a target")
        if _normalize_key(target) in policies:
            raise ExportError(f"duplicate item relationship target policy: {target}")
        if bool(href) == text_only:
            raise ExportError(f"item relationship target {target} must include either href or textOnly")
        if text_only and not reason:
            raise ExportError(f"item relationship target {target} textOnly policy must include a reason")
        policies[_normalize_key(target)] = _RelationshipTargetPolicy(
            target=target,
            href=href,
            text_only=text_only,
            reason=reason,
        )
    return policies


def _load_system_pages(repo_root: Path) -> list[_SystemPage]:
    systems_dir = repo_root / "pages" / "systems"
    if not systems_dir.is_dir():
        return []
    pages: list[_SystemPage] = []
    for path in sorted(systems_dir.glob("*.html")):
        parser = _SystemPageParser()
        try:
            parser.feed(path.read_text(encoding="utf-8"))
        except OSError:
            continue
        pages.append(
            _SystemPage(
                title=parser.title,
                relative_path=path.relative_to(repo_root).as_posix(),
                text=parser.text,
            )
        )
    return pages


def _text_mentions_name(text: str, item_name: str) -> bool:
    normalized_text = _normalize_spaces(text).lower()
    normalized_name = _normalize_key(item_name)
    if not normalized_name:
        return False
    pattern = rf"(?<![a-z0-9]){re.escape(normalized_name)}(?![a-z0-9])"
    return re.search(pattern, normalized_text) is not None


def _system_page_relationships(item: _ItemRow, pages: list[_SystemPage]) -> list[ItemRelationship]:
    relationships: list[ItemRelationship] = []
    for page in pages:
        if _text_mentions_name(page.text, item.name):
            relationships.append(
                ItemRelationship(
                    relationship_type="related_system",
                    target=page.title,
                    evidence=f"mentioned in {page.relative_path}",
                )
            )
    return relationships


def _manual_relationships(item: _ItemRow, overrides: list[_ManualRelationshipOverride]) -> list[ItemRelationship]:
    relationships: list[ItemRelationship] = []
    for override in overrides:
        if override.item_kind != item.item_kind or _normalize_key(override.item_name) != _normalize_key(item.name):
            continue
        if override.item_id is not None and override.item_id != item.item_id:
            continue
        relationships.extend(override.relationships)
    return relationships


def _validate_manual_overrides(items: list[_ItemRow], overrides: list[_ManualRelationshipOverride]) -> None:
    for override in overrides:
        matches = [
            item
            for item in items
            if item.item_kind == override.item_kind
            and _normalize_key(item.name) == _normalize_key(override.item_name)
            and (override.item_id is None or override.item_id == item.item_id)
        ]
        if not matches:
            suffix = f" #{override.item_id}" if override.item_id is not None else ""
            raise ExportError(
                f"item relationship override {override.item_kind} {override.item_name}{suffix} "
                "does not match any item"
            )


def _name_chain_candidates(item: _ItemRow, item_names: set[str]) -> list[ItemRelationship]:
    name_key = _normalize_key(item.name)
    candidates: list[ItemRelationship] = []
    if name_key.endswith(" ore"):
        ingot_name = f"{item.name[:-4]} Ingot"
        if _normalize_key(ingot_name) in item_names:
            candidates.append(
                ItemRelationship(
                    relationship_type="candidate_chain",
                    target=ingot_name,
                    evidence="name-pattern ore -> ingot",
                )
            )
    if name_key == "log" and "plank" in item_names:
        candidates.append(
            ItemRelationship(
                relationship_type="candidate_chain",
                target="Plank",
                evidence="name-pattern log -> plank",
            )
        )
    if not name_key.startswith("cooked "):
        cooked_name = f"Cooked {item.name}"
        if _normalize_key(cooked_name) in item_names:
            candidates.append(
                ItemRelationship(
                    relationship_type="candidate_chain",
                    target=cooked_name,
                    evidence="name-pattern raw -> cooked",
                )
            )
    return candidates


def _use_type_candidate(item: _ItemRow) -> ItemRelationship | None:
    use_type = _field_int(item.fields, "use_type")
    if use_type in (None, 0):
        return None
    label = USE_TYPE_LABELS_BY_KIND.get(item.item_kind, {}).get(use_type)
    if not label:
        return None
    return ItemRelationship(
        relationship_type="candidate_use_type",
        target=label,
        evidence=f"use_type {use_type}",
    )


def _build_unknown_use_types(items: list[_ItemRow]) -> list[UnknownUseTypeGroup]:
    grouped: dict[tuple[str, int], list[str]] = {}
    for item in items:
        use_type = _field_int(item.fields, "use_type")
        if use_type in (None, 0):
            continue
        if use_type in USE_TYPE_LABELS_BY_KIND.get(item.item_kind, {}):
            continue
        grouped.setdefault((item.item_kind, use_type), []).append(item.name)
    return [
        UnknownUseTypeGroup(
            item_kind=item_kind,
            field_name="use_type",
            value=value,
            item_names=sorted(names, key=_normalize_key),
        )
        for (item_kind, value), names in sorted(grouped.items(), key=lambda entry: (entry[0][0], entry[0][1]))
    ]


def _record_item_label(record: ItemRelationshipRecord) -> str:
    return f"{record.item_kind} {record.item_name}"


def _relationship_href_issue(repo_root: Path, href: str) -> str:
    href_parts = urlsplit(href)
    href_path = href_parts.path
    if not href_path:
        return f"target link does not exist: {href}"
    target_path = repo_root / href_path
    if not target_path.is_file():
        return f"target link does not exist: {href}"
    if not href_parts.fragment:
        return ""

    parser = _HtmlIdParser()
    try:
        parser.feed(target_path.read_text(encoding="utf-8"))
    except OSError as exc:
        return f"target link is not readable: {href} ({exc})"
    if href_parts.fragment not in parser.ids:
        return f"missing target anchor: #{href_parts.fragment}"
    return ""


def _build_target_coverage(
    records: list[ItemRelationshipRecord],
    policies: dict[str, _RelationshipTargetPolicy],
    repo_root: Path,
) -> list[ItemRelationshipTargetCoverage]:
    grouped: dict[str, dict[str, Any]] = {}
    for record in records:
        for relationship in record.confirmed:
            target = _normalize_spaces(relationship.target)
            if not target:
                continue
            entry = grouped.setdefault(
                _normalize_key(target),
                {
                    "target": target,
                    "relationship_count": 0,
                    "item_labels": set(),
                },
            )
            entry["relationship_count"] += 1
            entry["item_labels"].add(_record_item_label(record))

    coverage: list[ItemRelationshipTargetCoverage] = []
    for target_key, entry in sorted(grouped.items(), key=lambda item: _normalize_key(item[1]["target"])):
        target = entry["target"]
        relationship_count = int(entry["relationship_count"])
        item_labels = sorted(entry["item_labels"], key=_normalize_key)
        policy = policies.get(target_key)
        if policy is None:
            coverage.append(
                ItemRelationshipTargetCoverage(
                    target=target,
                    status="unclassified",
                    relationship_count=relationship_count,
                    item_labels=item_labels,
                    issue="not listed in item_relationship_targets.json",
                )
            )
            continue
        if policy.text_only:
            coverage.append(
                ItemRelationshipTargetCoverage(
                    target=target,
                    status="text_only",
                    relationship_count=relationship_count,
                    reason=policy.reason,
                    item_labels=item_labels,
                )
            )
            continue
        link_issue = _relationship_href_issue(repo_root, policy.href)
        if link_issue:
            coverage.append(
                ItemRelationshipTargetCoverage(
                    target=target,
                    status="broken_link",
                    relationship_count=relationship_count,
                    href=policy.href,
                    item_labels=item_labels,
                    issue=link_issue,
                )
            )
            continue
        coverage.append(
            ItemRelationshipTargetCoverage(
                target=target,
                status="linked",
                relationship_count=relationship_count,
                href=policy.href,
                item_labels=item_labels,
            )
        )
    return coverage


def build_item_relationship_inventory(
    *,
    repo_root: Path = REPO_ROOT,
    collectables_data_path: Path | None = None,
    useables_data_path: Path | None = None,
    overrides_path: Path | None = None,
    target_policies_path: Path | None = None,
) -> ItemRelationshipReport:
    repo_root = Path(repo_root)
    collectables_path = collectables_data_path or repo_root / COLLECTABLES_DATA_PATH.relative_to(REPO_ROOT)
    useables_path = useables_data_path or repo_root / USEABLES_DATA_PATH.relative_to(REPO_ROOT)
    manual_overrides_path = overrides_path or repo_root / ITEM_RELATIONSHIP_OVERRIDES_PATH.relative_to(REPO_ROOT)
    target_policy_path = target_policies_path or repo_root / ITEM_RELATIONSHIP_TARGETS_PATH.relative_to(REPO_ROOT)

    items = [
        *_load_items(collectables_path, "collectable"),
        *_load_items(useables_path, "useable"),
    ]
    item_names = {_normalize_key(item.name) for item in items}
    system_pages = _load_system_pages(repo_root)
    manual_overrides = _load_manual_overrides(manual_overrides_path)
    target_policies = _load_target_policies(target_policy_path)
    _validate_manual_overrides(items, manual_overrides)

    records: list[ItemRelationshipRecord] = []
    for item in sorted(items, key=lambda row: (row.item_kind, _normalize_key(row.name), row.item_id)):
        confirmed = [
            *_system_page_relationships(item, system_pages),
            *_manual_relationships(item, manual_overrides),
        ]
        candidates = _name_chain_candidates(item, item_names)
        use_type_candidate = _use_type_candidate(item)
        if use_type_candidate:
            candidates.append(use_type_candidate)
        status = "confirmed" if confirmed else "candidate" if candidates else "gap"
        records.append(
            ItemRelationshipRecord(
                item_kind=item.item_kind,
                item_id=item.item_id,
                item_name=item.name,
                status=status,
                confirmed=confirmed,
                candidates=candidates,
            )
        )

    return ItemRelationshipReport(
        records=records,
        unknown_use_types=_build_unknown_use_types(items),
        target_coverage=_build_target_coverage(records, target_policies, repo_root),
    )
