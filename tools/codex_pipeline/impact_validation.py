from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class ImpactValidationCheck:
    check_id: str
    label: str
    description: str
    surfaces: tuple[str, ...]
    automated_by: tuple[str, ...]
    triggers: tuple[str, ...]


@dataclass(frozen=True)
class ImpactValidationRecord:
    target_name: str
    change_type: str
    label: str
    name: str
    query_value: str
    query_source: str


@dataclass(frozen=True)
class ImpactValidationPlan:
    report_digest: str
    checks: list[ImpactValidationCheck]
    affected_records: list[ImpactValidationRecord]
    changed_record_probe_limit: int = 5

    @property
    def requires_browser_smoke(self) -> bool:
        return any("smoke-site" in check.automated_by for check in self.checks)

    @property
    def automated_runners(self) -> tuple[str, ...]:
        order = ("game-update-report", "validate", "smoke-site")
        selected = {runner for check in self.checks for runner in check.automated_by}
        return tuple(runner for runner in order if runner in selected)


_CHECKS = {
    "data-integrity": {
        "label": "Generated data integrity",
        "description": "Validate IDs, labels, perks, drops, manifests, scripts, and relationship targets after sync.",
        "surfaces": ("generated data", "site data", "manifests"),
        "automated_by": ("validate",),
    },
    "weapons-page": {
        "label": "Weapon list and item cards",
        "description": "Check weapon filtering, details, images, links, and reload-safe routes.",
        "surfaces": ("pages/items/weapons.html",),
        "automated_by": ("smoke-site",),
    },
    "armors-page": {
        "label": "Armor list and item cards",
        "description": "Check armor filtering, details, resistance filters, images, links, and reload-safe routes.",
        "surfaces": ("pages/items/armors.html",),
        "automated_by": ("smoke-site",),
    },
    "monsters-page": {
        "label": "Monster list and details",
        "description": "Check monster filtering, details, drops, images, links, and reload-safe routes.",
        "surfaces": ("pages/enemies/monsters.html",),
        "automated_by": ("smoke-site",),
    },
    "collectables-page": {
        "label": "Collectable list and item cards",
        "description": "Check collectable details, images, relationships, duplicate IDs, and reload-safe routes.",
        "surfaces": ("pages/items/collectables.html",),
        "automated_by": ("smoke-site",),
    },
    "useables-page": {
        "label": "Useable list and item cards",
        "description": "Check useable details, images, relationships, duplicate IDs, and reload-safe routes.",
        "surfaces": ("pages/items/useables.html",),
        "automated_by": ("smoke-site",),
    },
    "resistance-matchups": {
        "label": "Resistance and element matchups",
        "description": "Check Holy, Dark, and other element ordering, multipliers, filters, and damage previews.",
        "surfaces": ("pages/stats/resistances.html", "pages/items/armors.html"),
        "automated_by": ("smoke-site",),
    },
    "monster-recommendations": {
        "label": "Monster equipment recommendations",
        "description": "Check weapon and armor rankings against elements, resistances, perks, levels, and monster types.",
        "surfaces": ("pages/enemies/monsters.html",),
        "automated_by": ("smoke-site",),
    },
    "perk-sources": {
        "label": "Perk sources and stacking",
        "description": "Check perk deep links, Found On and Dropped By sources, filters, and stacking tooltips.",
        "surfaces": ("pages/systems/perks.html",),
        "automated_by": ("smoke-site",),
    },
    "build-planner": {
        "label": "Build planner calculations",
        "description": "Check item selection, perk-aware totals, requirements, sharing, and summary calculations.",
        "surfaces": ("pages/General/build-planner.html",),
        "automated_by": ("smoke-site",),
    },
    "site-search": {
        "label": "Site search indexing",
        "description": "Check that public additions are searchable and removed records no longer resolve as current content.",
        "surfaces": ("js/site-search.js", "site navigation search"),
        "automated_by": ("smoke-site",),
    },
    "deep-links": {
        "label": "Detail deep links",
        "description": "Check direct routes, reloads, row navigation, and close behavior for changed public records.",
        "surfaces": ("item detail routes", "monster detail routes", "perk detail routes"),
        "automated_by": ("smoke-site",),
    },
    "asset-coverage": {
        "label": "Image and manifest coverage",
        "description": "Check added, removed, and animation-changed records against extracted assets and manifests.",
        "surfaces": ("images", "image manifests", "item and monster cards"),
        "automated_by": ("game-update-report", "validate", "smoke-site"),
    },
    "item-relationships": {
        "label": "Item relationship coverage",
        "description": "Check Used In, Found From, related-system targets, and destination links.",
        "surfaces": ("item relationship inventory", "item detail cards"),
        "automated_by": ("validate", "smoke-site"),
    },
}

_TARGET_PAGE_CHECKS = {
    "weapons": "weapons-page",
    "armors": "armors-page",
    "monsters": "monsters-page",
    "collectables": "collectables-page",
    "useables": "useables-page",
}

_RECORD_LABEL_PATTERN = re.compile(r"^(?P<name>.+?) \((?P<id>-?\d+)\)$")
_CHANGE_TYPE_ORDER = {"added": 0, "removed": 1, "changed": 2}


def _add_trigger(triggers_by_check: dict[str, set[str]], check_ids: tuple[str, ...], trigger: str) -> None:
    for check_id in check_ids:
        triggers_by_check.setdefault(check_id, set()).add(trigger)


def _target_categories(target) -> set[str]:
    return {change.category for record in target.changed for change in record.changes}


def _target_paths(target) -> set[str]:
    return {change.path for record in target.changed for change in record.changes}


def _affected_record(target_name: str, change_type: str, label: str) -> ImpactValidationRecord:
    match = _RECORD_LABEL_PATTERN.fullmatch(label.strip())
    if match:
        name = match.group("name").strip()
        query_value = match.group("id")
        query_source = "id"
    else:
        name = label.strip()
        query_value = name
        query_source = "name"
    return ImpactValidationRecord(
        target_name=target_name,
        change_type=change_type,
        label=label,
        name=name,
        query_value=query_value,
        query_source=query_source,
    )


def build_impact_validation_plan(report, *, report_digest: str) -> ImpactValidationPlan:
    triggers_by_check: dict[str, set[str]] = {}
    affected_records: list[ImpactValidationRecord] = []

    for target in report.targets:
        public_count = len(target.added) + len(target.removed)
        source_change_count = target.source_changed_count
        if not (public_count or source_change_count):
            continue

        if target.target_name in _TARGET_PAGE_CHECKS:
            affected_records.extend(
                _affected_record(target.target_name, "added", label) for label in target.added
            )
            affected_records.extend(
                _affected_record(target.target_name, "removed", label) for label in target.removed
            )
            affected_records.extend(
                _affected_record(target.target_name, "changed", record.label) for record in target.changed
            )

        target_label = target.target_name
        target_page_check = _TARGET_PAGE_CHECKS.get(target.target_name)
        base_checks = ("data-integrity",) + ((target_page_check,) if target_page_check else ())
        _add_trigger(
            triggers_by_check,
            base_checks,
            f"{target_label}: {public_count} public add/remove and {source_change_count} changed record(s)",
        )

        categories = _target_categories(target)
        paths = _target_paths(target)
        has_element_change = "Elements & Effects" in categories or any(
            path.endswith("_resistance") for path in paths
        )
        has_perk_change = bool(categories & {"Perks", "Tatter Drops"})
        affects_equipment_math = bool(
            categories & {"Combat", "Defense", "Requirements", "Elements & Effects", "Perks", "Tatter Drops"}
        )

        if has_element_change:
            _add_trigger(
                triggers_by_check,
                ("resistance-matchups", "monster-recommendations"),
                f"{target_label}: element or resistance fields changed",
            )
        if has_perk_change:
            _add_trigger(
                triggers_by_check,
                ("perk-sources", "monster-recommendations"),
                f"{target_label}: perk or tatter-source fields changed",
            )
        if affects_equipment_math and target.target_name in {"weapons", "armors", "monsters"}:
            _add_trigger(
                triggers_by_check,
                ("build-planner", "monster-recommendations"),
                f"{target_label}: equipment or encounter calculations changed",
            )
        if public_count:
            _add_trigger(
                triggers_by_check,
                ("site-search", "deep-links", "asset-coverage", "item-relationships"),
                f"{target_label}: public records +{len(target.added)} -{len(target.removed)}",
            )
        if target.omitted_counts.get("animation coordinates"):
            _add_trigger(
                triggers_by_check,
                ("asset-coverage",),
                f"{target_label}: {target.omitted_counts['animation coordinates']} animation-coordinate change(s)",
            )

    checks = [
        ImpactValidationCheck(
            check_id=check_id,
            label=_CHECKS[check_id]["label"],
            description=_CHECKS[check_id]["description"],
            surfaces=_CHECKS[check_id]["surfaces"],
            automated_by=_CHECKS[check_id]["automated_by"],
            triggers=tuple(sorted(triggers)),
        )
        for check_id, triggers in sorted(triggers_by_check.items())
    ]
    affected_records.sort(
        key=lambda record: (
            record.target_name,
            _CHANGE_TYPE_ORDER[record.change_type],
            record.name.casefold(),
            record.query_value,
        )
    )
    return ImpactValidationPlan(
        report_digest=report_digest,
        checks=checks,
        affected_records=affected_records,
    )


def impact_validation_plan_to_dict(plan: ImpactValidationPlan) -> dict[str, Any]:
    return {
        "schemaVersion": 2,
        "reportDigest": plan.report_digest,
        "summary": {
            "checkCount": len(plan.checks),
            "affectedRecordCount": len(plan.affected_records),
            "browserSmokeRequired": plan.requires_browser_smoke,
            "automatedRunners": list(plan.automated_runners),
        },
        "browserProbePolicy": {
            "addedRecords": "all",
            "removedRecords": "all",
            "changedRecordsPerTarget": plan.changed_record_probe_limit,
        },
        "checks": [
            {
                "id": check.check_id,
                "label": check.label,
                "description": check.description,
                "surfaces": list(check.surfaces),
                "automatedBy": list(check.automated_by),
                "triggers": list(check.triggers),
            }
            for check in plan.checks
        ],
        "affectedRecords": [
            {
                "target": record.target_name,
                "changeType": record.change_type,
                "label": record.label,
                "name": record.name,
                "queryValue": record.query_value,
                "querySource": record.query_source,
            }
            for record in plan.affected_records
        ],
    }


def build_impact_validation_plan_json(plan: ImpactValidationPlan) -> str:
    return json.dumps(impact_validation_plan_to_dict(plan), ensure_ascii=True, indent=2) + "\n"


def write_impact_validation_plan_json(plan: ImpactValidationPlan, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(build_impact_validation_plan_json(plan), encoding="utf-8", newline="\n")
    return path
