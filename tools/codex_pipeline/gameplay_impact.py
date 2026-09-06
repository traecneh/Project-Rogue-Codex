from __future__ import annotations

import hashlib
import json
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

from tools.codex_pipeline.exports import DataDiffReport, FieldChange


@dataclass(frozen=True)
class GameplayImpactChange:
    category: str
    label: str
    risk: str
    old_value: Any
    new_value: Any
    path: str


@dataclass(frozen=True)
class GameplayImpactRecord:
    label: str
    changes: list[GameplayImpactChange]

    @property
    def highest_risk(self) -> str:
        return _highest_risk(change.risk for change in self.changes)


@dataclass(frozen=True)
class GameplayImpactTarget:
    target_name: str
    source_digest: str
    added: list[str]
    removed: list[str]
    changed: list[GameplayImpactRecord]
    source_changed_count: int
    source_field_change_count: int
    omitted_counts: dict[str, int]

    @property
    def gameplay_field_change_count(self) -> int:
        return sum(len(record.changes) for record in self.changed)

    @property
    def routine_only_record_count(self) -> int:
        return self.source_changed_count - len(self.changed)

    @property
    def omitted_field_change_count(self) -> int:
        return sum(self.omitted_counts.values())

    @property
    def risk_counts(self) -> dict[str, int]:
        counts: Counter[str] = Counter()
        counts["medium"] += len(self.added)
        counts["high"] += len(self.removed)
        for record in self.changed:
            counts.update(change.risk for change in record.changes)
        for reason, count in self.omitted_counts.items():
            counts[_OMISSION_RISKS.get(reason, "medium")] += count
        return _ordered_risk_counts(counts)

    @property
    def highest_risk(self) -> str:
        return _highest_risk(risk for risk, count in self.risk_counts.items() if count)


@dataclass(frozen=True)
class GameplayImpactReport:
    targets: list[GameplayImpactTarget]

    @property
    def added_count(self) -> int:
        return sum(len(target.added) for target in self.targets)

    @property
    def removed_count(self) -> int:
        return sum(len(target.removed) for target in self.targets)

    @property
    def changed_record_count(self) -> int:
        return sum(len(target.changed) for target in self.targets)

    @property
    def changed_field_count(self) -> int:
        return sum(target.gameplay_field_change_count for target in self.targets)

    @property
    def routine_only_record_count(self) -> int:
        return sum(target.routine_only_record_count for target in self.targets)

    @property
    def omitted_field_change_count(self) -> int:
        return sum(target.omitted_field_change_count for target in self.targets)

    @property
    def omitted_counts(self) -> dict[str, int]:
        counts: Counter[str] = Counter()
        for target in self.targets:
            counts.update(target.omitted_counts)
        return dict(counts)

    @property
    def risk_counts(self) -> dict[str, int]:
        counts: Counter[str] = Counter()
        for target in self.targets:
            counts.update(target.risk_counts)
        return _ordered_risk_counts(counts)

    @property
    def highest_risk(self) -> str:
        return _highest_risk(risk for risk, count in self.risk_counts.items() if count)

    @property
    def has_changes(self) -> bool:
        return bool(self.added_count or self.removed_count or self.changed_record_count)


@dataclass(frozen=True)
class GameplayRiskPolicy:
    status: str
    description: str
    required_flags_when_enforced: tuple[str, ...]


_CATEGORY_ORDER = {
    "Identity & Availability": 0,
    "Combat": 1,
    "Defense": 2,
    "Requirements": 3,
    "Elements & Effects": 4,
    "Perks": 5,
    "Progression": 6,
    "Tatter Drops": 7,
}

_RISK_ORDER = {"none": 0, "low": 1, "medium": 2, "high": 3}
_RISK_DEFINITIONS = {
    "high": "Direct gameplay balance, equipment eligibility, perk, drop, or public-removal change; review before publishing.",
    "medium": "Public addition, identity, progression, unknown, or otherwise unclassified change; inspect during update review.",
    "low": "Routine extraction, price, animation-coordinate, duplicate-code, or metadata-only change.",
    "none": "No update signals were detected.",
}
_HIGH_RISK_CATEGORIES = {
    "Combat",
    "Defense",
    "Requirements",
    "Elements & Effects",
    "Perks",
    "Tatter Drops",
}
_OMISSION_RISKS = {
    "animation coordinates": "low",
    "duplicate numeric codes": "low",
    "metadata enrichment": "low",
    "price fields": "low",
    "record identity internals": "high",
    "unknown/raw fields": "medium",
    "non-priority fields": "medium",
}
_RISK_POLICIES = {
    "none": GameplayRiskPolicy(
        status="no_changes",
        description="No gameplay-impact signals were detected.",
        required_flags_when_enforced=(),
    ),
    "low": GameplayRiskPolicy(
        status="automatic_apply_allowed",
        description="Only low-risk routine or secondary changes were detected.",
        required_flags_when_enforced=(),
    ),
    "medium": GameplayRiskPolicy(
        status="summary_required",
        description="Generate the review artifacts before applying medium-risk changes.",
        required_flags_when_enforced=("--write-summary",),
    ),
    "high": GameplayRiskPolicy(
        status="acknowledgement_required",
        description="Review the generated artifacts and explicitly acknowledge high-risk gameplay changes before applying.",
        required_flags_when_enforced=("--write-summary", "--acknowledge-impact <report-digest>"),
    ),
}

_SHARED_DISPLAY_LABELS = {
    "name": "Name",
    "level": "Item level",
    "level_requirement": "Item level",
    "player_level_requirement": "Player level requirement",
    "skill_requirement": "Skill requirement",
    "min_damage": "Minimum damage",
    "max_damage": "Maximum damage",
    "attack_speed": "Attack speed",
    "movement_speed": "Movement speed",
    "health": "Health",
    "armor": "Armor",
    "proc_chance": "Proc chance",
    "to_hit": "To hit",
    "strength": "Strength",
    "dexterity": "Dexterity",
    "constitution": "Constitution",
    "weight": "Weight",
    "element_label": "Element",
    "elemental_attack_label": "Elemental attack",
    "status_effect_label": "Status effect",
    "perk_label": "Innate perk",
    "corrupted_perk_label": "Corrupted perk",
    "max_rarity_label": "Maximum rarity",
    "subtype_label": "Weapon type",
    "slot_label": "Armor slot",
    "specialty_label": "Specialty",
    "specialty_amount": "Specialty amount",
    "shard_decomposition_amount": "Deconstruction shards",
    "shard_promotion_amount": "Promotion shards",
    "deconstruction": "Deconstruction shards",
    "promotion": "Promotion shards",
    "type_label": "Monster type",
    "uncommon_tatter_label": "Uncommon tatter",
    "rare_tatter_label": "Rare tatter",
    "is_boss": "Boss",
    "is_berserker": "Berserker",
    "is_ethereal": "Ethereal",
    "is_flying": "Flying",
    "is_immobile": "Immobile",
    "is_target_when_blocked": "Targets when blocked",
    "is_target_when_hit_ranged_trapped": "Targets ranged attackers when trapped",
    "has_thorns": "Thorns",
}

_FIELD_CATEGORIES = {
    "weapons": {
        "name": "Identity & Availability",
        "subtype": "Identity & Availability",
        "subtype_label": "Identity & Availability",
        "max_rarity": "Identity & Availability",
        "max_rarity_label": "Identity & Availability",
        "min_damage": "Combat",
        "max_damage": "Combat",
        "attack_speed": "Combat",
        "proc_chance": "Combat",
        "to_hit": "Combat",
        "strength": "Combat",
        "dexterity": "Combat",
        "constitution": "Combat",
        "weight": "Combat",
        "skill_requirement": "Requirements",
        "level_requirement": "Requirements",
        "element": "Elements & Effects",
        "element_label": "Elements & Effects",
        "specialty": "Elements & Effects",
        "specialty_label": "Elements & Effects",
        "specialty_amount": "Elements & Effects",
        "perk": "Perks",
        "perk_label": "Perks",
        "corrupted_perk": "Perks",
        "corrupted_perk_label": "Perks",
        "shard_decomposition_amount": "Progression",
        "shard_promotion_amount": "Progression",
    },
    "armors": {
        "name": "Identity & Availability",
        "slot": "Identity & Availability",
        "slot_label": "Identity & Availability",
        "max_rarity": "Identity & Availability",
        "max_rarity_label": "Identity & Availability",
        "armor": "Defense",
        "strength": "Defense",
        "dexterity": "Defense",
        "constitution": "Defense",
        "to_hit": "Defense",
        "weight": "Defense",
        "level": "Requirements",
        "player_level_requirement": "Requirements",
        "perk": "Perks",
        "perk_label": "Perks",
        "corrupted_perk": "Perks",
        "corrupted_perk_label": "Perks",
        "deconstruction": "Progression",
        "promotion": "Progression",
    },
    "monsters": {
        "name": "Identity & Availability",
        "type": "Identity & Availability",
        "type_label": "Identity & Availability",
        "level": "Combat",
        "health": "Combat",
        "min_damage": "Combat",
        "max_damage": "Combat",
        "attack_speed": "Combat",
        "movement_speed": "Combat",
        "elemental_attack": "Elements & Effects",
        "elemental_attack_label": "Elements & Effects",
        "status_effect": "Elements & Effects",
        "status_effect_label": "Elements & Effects",
        "is_boss": "Combat",
        "is_berserker": "Combat",
        "is_ethereal": "Combat",
        "is_flying": "Combat",
        "is_immobile": "Combat",
        "is_target_when_blocked": "Combat",
        "is_target_when_hit_ranged_trapped": "Combat",
        "has_thorns": "Combat",
        "uncommon_tatter": "Tatter Drops",
        "uncommon_tatter_label": "Tatter Drops",
        "rare_tatter": "Tatter Drops",
        "rare_tatter_label": "Tatter Drops",
    },
}

_CODE_TO_LABEL_FIELD = {
    "subtype": "subtype_label",
    "max_rarity": "max_rarity_label",
    "element": "element_label",
    "specialty": "specialty_label",
    "perk": "perk_label",
    "corrupted_perk": "corrupted_perk_label",
    "slot": "slot_label",
    "type": "type_label",
    "elemental_attack": "elemental_attack_label",
    "status_effect": "status_effect_label",
    "uncommon_tatter": "uncommon_tatter_label",
    "rare_tatter": "rare_tatter_label",
}

_RESISTANCE_LABELS = {
    "fire_resistance": "Fire resistance",
    "cold_resistance": "Cold resistance",
    "electric_resistance": "Electric resistance",
    "lightning_resistance": "Electric resistance",
    "acid_resistance": "Acid resistance",
    "poison_resistance": "Poison resistance",
    "disease_resistance": "Disease resistance",
    "holy_resistance": "Holy resistance",
    "dark_resistance": "Dark resistance",
}

_METADATA_FIELDS = {"emits_light", "item_class", "total_flags"}
_PRICE_FIELDS = {"value", "value_low", "value_high"}
_TARGET_DISPLAY_LABELS = {
    "monsters": {"level": "Level"},
}


def _ordered_risk_counts(counts: Counter[str] | dict[str, int]) -> dict[str, int]:
    return {risk: counts.get(risk, 0) for risk in ("high", "medium", "low")}


def _omission_risk_counts(omitted_counts: dict[str, int]) -> dict[str, int]:
    counts: Counter[str] = Counter()
    for reason, count in omitted_counts.items():
        counts[_OMISSION_RISKS.get(reason, "medium")] += count
    return _ordered_risk_counts(counts)


def _highest_risk(risks: Iterable[str]) -> str:
    return max(risks, key=lambda risk: _RISK_ORDER[risk], default="none")


def _category_risk(category: str) -> str:
    if category in _HIGH_RISK_CATEGORIES:
        return "high"
    return "medium"


def gameplay_risk_policy(report: GameplayImpactReport) -> GameplayRiskPolicy:
    return _RISK_POLICIES[report.highest_risk]


def _field_name(path: str) -> str | None:
    if path == "name":
        return path
    if not path.startswith("fields."):
        return None
    field_name = path.removeprefix("fields.")
    return field_name if "." not in field_name else None


def _category_and_label(target_name: str, field_name: str) -> tuple[str, str] | None:
    if field_name in _RESISTANCE_LABELS and target_name in {"weapons", "armors"}:
        category = "Combat" if target_name == "weapons" else "Defense"
        return category, _RESISTANCE_LABELS[field_name]
    category = _FIELD_CATEGORIES.get(target_name, {}).get(field_name)
    if category is None:
        return None
    display_label = _TARGET_DISPLAY_LABELS.get(target_name, {}).get(
        field_name,
        _SHARED_DISPLAY_LABELS.get(field_name, field_name.replace("_", " ").title()),
    )
    return category, display_label


def _omission_reason(path: str, field_name: str | None, preferred_label_fields: set[str]) -> str:
    if field_name in _CODE_TO_LABEL_FIELD and _CODE_TO_LABEL_FIELD[field_name] in preferred_label_fields:
        return "duplicate numeric codes"
    if field_name is not None and (field_name.startswith("frame_") or field_name.startswith("name_")):
        return "animation coordinates"
    if field_name in _PRICE_FIELDS:
        return "price fields"
    if field_name is not None and field_name.startswith("unknown_"):
        return "unknown/raw fields"
    if field_name in _METADATA_FIELDS:
        return "metadata enrichment"
    if path in {"id", "ID"}:
        return "record identity internals"
    return "non-priority fields"


def _impact_changes(target_name: str, changes: list[FieldChange]) -> tuple[list[GameplayImpactChange], Counter[str]]:
    fields = {_field_name(change.path) for change in changes}
    preferred_label_fields = {field for field in fields if field is not None}
    impact_changes: list[GameplayImpactChange] = []
    omitted: Counter[str] = Counter()

    for change in changes:
        field_name = _field_name(change.path)
        classification = None if field_name is None else _category_and_label(target_name, field_name)
        if (
            classification is None
            or field_name in _CODE_TO_LABEL_FIELD
            and _CODE_TO_LABEL_FIELD[field_name] in preferred_label_fields
        ):
            omitted[_omission_reason(change.path, field_name, preferred_label_fields)] += 1
            continue
        category, label = classification
        impact_changes.append(
            GameplayImpactChange(
                category=category,
                label=label,
                risk=_category_risk(category),
                old_value=change.old_value,
                new_value=change.new_value,
                path=change.path,
            )
        )

    impact_changes.sort(key=lambda change: (_CATEGORY_ORDER.get(change.category, 99), change.label, change.path))
    return impact_changes, omitted


def _file_sha256(path: Path) -> str | None:
    if not path.is_file():
        return None
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _record_changes_payload(records) -> list[dict[str, Any]]:
    return [
        {
            "key": record.key,
            "label": record.label,
            "fieldChanges": [
                {
                    "path": change.path,
                    "oldValue": change.old_value,
                    "newValue": change.new_value,
                }
                for change in record.field_changes
            ],
        }
        for record in records
    ]


def _source_diff_digest(diff: DataDiffReport) -> str:
    payload = {
        "target": diff.target.name,
        "generatedFileSha256": _file_sha256(diff.generated_path),
        "siteFileSha256": _file_sha256(diff.site_path),
        "added": diff.added,
        "removed": diff.removed,
        "changed": _record_changes_payload(diff.changed),
        "hiddenAdded": diff.hidden_added,
        "hiddenRemoved": diff.hidden_removed,
        "hiddenChanged": _record_changes_payload(diff.hidden_changed),
    }
    return _payload_digest(payload)


def build_gameplay_impact_report(diff_reports: Iterable[DataDiffReport]) -> GameplayImpactReport:
    targets: list[GameplayImpactTarget] = []
    for diff in diff_reports:
        records: list[GameplayImpactRecord] = []
        omitted_counts: Counter[str] = Counter()
        source_field_change_count = 0
        for record in diff.changed:
            source_field_change_count += len(record.field_changes)
            changes, omitted = _impact_changes(diff.target.name, record.field_changes)
            omitted_counts.update(omitted)
            if changes:
                records.append(GameplayImpactRecord(label=record.label, changes=changes))
        targets.append(
            GameplayImpactTarget(
                target_name=diff.target.name,
                source_digest=_source_diff_digest(diff),
                added=list(diff.added),
                removed=list(diff.removed),
                changed=records,
                source_changed_count=len(diff.changed),
                source_field_change_count=source_field_change_count,
                omitted_counts=dict(omitted_counts),
            )
        )
    return GameplayImpactReport(targets=targets)


def _format_value(value: Any) -> str:
    if value is None:
        return "not set"
    if isinstance(value, bool):
        return "yes" if value else "no"
    if isinstance(value, str):
        text = value
    else:
        text = json.dumps(value, ensure_ascii=True, sort_keys=True)
    escaped_text = text.replace("`", "\\`")
    return f"`{escaped_text}`"


def _heading(value: str) -> str:
    return value[:1].upper() + value[1:]


def _escape_cell(value: str) -> str:
    return value.replace("|", "\\|").replace("\n", " ")


def _record_change_summary(record: GameplayImpactRecord) -> str:
    grouped: dict[str, list[str]] = defaultdict(list)
    for change in record.changes:
        grouped[change.category].append(
            f"**{change.label}:** {_format_value(change.old_value)} -> {_format_value(change.new_value)}"
        )
    return "<br>".join(
        f"**{category}** - {'; '.join(grouped[category])}"
        for category in sorted(grouped, key=lambda value: _CATEGORY_ORDER.get(value, 99))
    )


def build_gameplay_impact_markdown(report: GameplayImpactReport) -> str:
    policy = gameplay_risk_policy(report)
    report_digest = gameplay_impact_digest(report)
    omitted_summary = ", ".join(
        f"{reason}={count}" for reason, count in sorted(report.omitted_counts.items())
    ) or "none"
    lines = [
        "# Project Rogue Codex Gameplay Impact",
        "",
        "## Overview",
        f"- Review risk: {report.highest_risk.upper()} "
        f"(high={report.risk_counts['high']}, medium={report.risk_counts['medium']}, low={report.risk_counts['low']})",
        f"- Report digest: `{report_digest}`",
        f"- Review decision: {policy.status.replace('_', ' ').upper()} - {policy.description}",
        f"- Public records: +{report.added_count} -{report.removed_count}",
        f"- Gameplay changes: {report.changed_record_count} record(s), {report.changed_field_count} field(s)",
        f"- Routine-only changed records hidden: {report.routine_only_record_count}",
        f"- Filtered field changes: {report.omitted_field_change_count} ({omitted_summary})",
        "- Scope: player-facing identity, combat, defense, requirements, elements, perks, progression, monster traits, and tatter drops.",
    ]

    for target in report.targets:
        if not (target.added or target.removed or target.changed or target.source_changed_count):
            continue
        lines.extend(
            [
                "",
                f"## {_heading(target.target_name)}",
                f"- Public records: +{len(target.added)} -{len(target.removed)}",
                f"- Gameplay changes: {len(target.changed)} record(s), {target.gameplay_field_change_count} field(s)",
                f"- Routine-only changed records hidden: {target.routine_only_record_count}",
            ]
        )
        for label in target.added:
            lines.append(f"- Added: {label}")
        for label in target.removed:
            lines.append(f"- Removed: {label}")
        if target.changed:
            lines.extend(["", "| Record | Player-facing changes |", "| --- | --- |"])
            for record in target.changed:
                lines.append(
                    f"| {_escape_cell(record.label)} | {_escape_cell(_record_change_summary(record))} |"
                )

    if not report.has_changes:
        lines.extend(["", "## Result", "- No player-facing gameplay changes detected."])
    return "\n".join(lines).rstrip() + "\n"


def write_gameplay_impact_report(report: GameplayImpactReport, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(build_gameplay_impact_markdown(report), encoding="utf-8", newline="\n")
    return path


def _gameplay_impact_payload(report: GameplayImpactReport) -> dict[str, Any]:
    policy = gameplay_risk_policy(report)
    targets: list[dict[str, Any]] = []
    for target in report.targets:
        targets.append(
            {
                "target": target.target_name,
                "sourceDigest": target.source_digest,
                "highestRisk": target.highest_risk,
                "summary": {
                    "publicRecords": {"added": len(target.added), "removed": len(target.removed)},
                    "gameplayChanges": {
                        "records": len(target.changed),
                        "fields": target.gameplay_field_change_count,
                    },
                    "filteredChanges": {
                        "routineOnlyRecords": target.routine_only_record_count,
                        "fields": target.omitted_field_change_count,
                    },
                    "riskCounts": target.risk_counts,
                },
                "added": [{"label": label, "risk": "medium"} for label in target.added],
                "removed": [{"label": label, "risk": "high"} for label in target.removed],
                "changed": [
                    {
                        "label": record.label,
                        "highestRisk": record.highest_risk,
                        "changes": [
                            {
                                "path": change.path,
                                "category": change.category,
                                "label": change.label,
                                "risk": change.risk,
                                "oldValue": change.old_value,
                                "newValue": change.new_value,
                            }
                            for change in record.changes
                        ],
                    }
                    for record in target.changed
                ],
                "filtered": {
                    "countsByReason": dict(sorted(target.omitted_counts.items())),
                    "riskCounts": _omission_risk_counts(target.omitted_counts),
                },
            }
        )

    return {
        "schemaVersion": 1,
        "summary": {
            "highestRisk": report.highest_risk,
            "riskCounts": report.risk_counts,
            "reviewDecision": {
                "status": policy.status,
                "description": policy.description,
                "requiredFlagsWhenEnforced": list(policy.required_flags_when_enforced),
            },
            "publicRecords": {"added": report.added_count, "removed": report.removed_count},
            "gameplayChanges": {
                "records": report.changed_record_count,
                "fields": report.changed_field_count,
            },
            "filteredChanges": {
                "routineOnlyRecords": report.routine_only_record_count,
                "fields": report.omitted_field_change_count,
            },
        },
        "riskDefinitions": _RISK_DEFINITIONS,
        "targets": targets,
    }


def _payload_digest(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
    return f"sha256:{hashlib.sha256(canonical.encode('utf-8')).hexdigest()}"


def gameplay_impact_digest(report: GameplayImpactReport) -> str:
    return _payload_digest(_gameplay_impact_payload(report))


def gameplay_impact_to_dict(report: GameplayImpactReport) -> dict[str, Any]:
    payload = _gameplay_impact_payload(report)
    payload["reportDigest"] = _payload_digest(payload)
    return payload


def build_gameplay_impact_json(report: GameplayImpactReport) -> str:
    return json.dumps(gameplay_impact_to_dict(report), ensure_ascii=True, indent=2) + "\n"


def write_gameplay_impact_json(report: GameplayImpactReport, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(build_gameplay_impact_json(report), encoding="utf-8", newline="\n")
    return path
