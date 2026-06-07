from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from tools.codex_pipeline.config import (
    ARMORS_DATA_PATH,
    DROP_SOURCES_PATH,
    MONSTERS_DATA_PATH,
    WEAPONS_DATA_PATH,
)
from tools.codex_pipeline.drops import DROP_KINDS, load_drop_sources, normalize_key, normalize_slug
from tools.codex_pipeline.exports import ExportError
from tools.codex_pipeline.validators.site import ValidationIssue, validate_drop_references


@dataclass(frozen=True)
class DropSourceItemReport:
    kind: str
    item_name: str
    monster_names: list[str]


@dataclass(frozen=True)
class DropSourceMonsterReport:
    monster_name: str
    monster_slug: str
    armors: list[str]
    weapons: list[str]


@dataclass(frozen=True)
class DropSourceAuditReport:
    drop_sources_path: Path
    item_overrides: list[DropSourceItemReport]
    monster_loot: list[DropSourceMonsterReport]
    validation_issues: list[ValidationIssue]

    @property
    def item_override_count(self) -> int:
        return len(self.item_overrides)

    @property
    def monster_count(self) -> int:
        return len(self.monster_loot)


def _read_json_list(path: Path, label: str) -> list[Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ExportError(f"{label} failed to read data JSON at {path}: {exc}") from exc
    if not isinstance(data, list):
        raise ExportError(f"{label} data JSON must be a list: {path}")
    return data


def _collect_names(path: Path, label: str) -> set[str]:
    return {
        normalize_key(row.get("name"))
        for row in _read_json_list(path, label)
        if isinstance(row, dict) and normalize_key(row.get("name"))
    }


def _build_item_reports(sources: dict[str, dict[str, list[str]]]) -> list[DropSourceItemReport]:
    reports: list[DropSourceItemReport] = []
    for kind in DROP_KINDS:
        for item_name, monster_names in sorted(
            sources.get(kind, {}).items(),
            key=lambda item: normalize_key(item[0]),
        ):
            reports.append(DropSourceItemReport(kind, item_name, list(monster_names)))
    return reports


def _build_monster_reports(sources: dict[str, dict[str, list[str]]]) -> list[DropSourceMonsterReport]:
    by_slug: dict[str, dict[str, Any]] = {}
    for kind in DROP_KINDS:
        for item_name, monster_names in sources.get(kind, {}).items():
            for monster_name in monster_names:
                slug = normalize_slug(monster_name)
                entry = by_slug.setdefault(
                    slug,
                    {
                        "monster_name": monster_name,
                        "armors": [],
                        "weapons": [],
                    },
                )
                if item_name not in entry[kind]:
                    entry[kind].append(item_name)

    reports = []
    for slug, entry in sorted(by_slug.items(), key=lambda item: normalize_key(item[1]["monster_name"])):
        reports.append(
            DropSourceMonsterReport(
                monster_name=entry["monster_name"],
                monster_slug=slug,
                armors=sorted(entry["armors"], key=normalize_key),
                weapons=sorted(entry["weapons"], key=normalize_key),
            )
        )
    return reports


def build_drop_source_audit_report(
    *,
    drop_sources_path: Path = DROP_SOURCES_PATH,
    armor_data_path: Path = ARMORS_DATA_PATH,
    weapon_data_path: Path = WEAPONS_DATA_PATH,
    monster_data_path: Path = MONSTERS_DATA_PATH,
) -> DropSourceAuditReport:
    try:
        sources = load_drop_sources(drop_sources_path)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        raise ExportError(f"{drop_sources_path} failed to read drop sources: {exc}") from exc

    armor_names = _collect_names(armor_data_path, "armors")
    weapon_names = _collect_names(weapon_data_path, "weapons")
    monster_names = _collect_names(monster_data_path, "monsters")
    validation_issues = validate_drop_references(
        sources,
        armor_names=armor_names,
        weapon_names=weapon_names,
        monster_names=monster_names,
    )
    return DropSourceAuditReport(
        drop_sources_path=drop_sources_path,
        item_overrides=_build_item_reports(sources),
        monster_loot=_build_monster_reports(sources),
        validation_issues=validation_issues,
    )
