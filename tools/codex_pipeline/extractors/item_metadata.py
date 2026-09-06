from __future__ import annotations

import re
from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any

try:
    from tools.codex_pipeline.extractors.monster_metadata import TATTER_LABELS
except ModuleNotFoundError:
    from monster_metadata import TATTER_LABELS


# Item perks encode the perk ID in the low byte and tier minus one in
# the high byte. Reuse tatter identities rather than maintaining separate
# and potentially conflicting labels for each ordinary perk tier.
_PERK_NAMES = {
    **{code: name for code, name in TATTER_LABELS.items() if code},
    15: "Flame Strike",
    16: "Lightning Javelin",
    17: "Iceburst",
    18: "Sulfuric",
    19: "Plague",
    20: "Toxicity",
    100: "Runic",
    101: "Vengeance",
    102: "Envenomation",
    103: "Lycan",
    104: "Flame Buffet",
    105: "Crimson Feast",
    106: "Plague Eater",
    107: "Blood Siphon",
}
PERK_LABELS = {
    code + (tier - 1) * 256: f"{name} (Tier {tier})"
    for code, name in _PERK_NAMES.items()
    for tier in (1, 2, 3)
}

WEAPON_SUBTYPE_LABELS = {
    1: "Sword",
    2: "Dagger",
    3: "Axe",
    4: "Blunt",
    5: "Polearm",
    7: "Bow",
    8: "Crossbow",
}

WEAPON_SPECIALTY_LABELS = {
    1: "Strength",
    2: "Dexterity",
    3: "Constitution",
}

WEAPON_ELEMENT_LABELS = {
    1: "Fire",
    2: "Electric",
    4: "Cold",
    6: "Acid",
    7: "Poison",
    8: "Disease",
    5: "Magic",
}

RARITY_LABELS = {
    0: "Common",
    1: "Uncommon",
    2: "Rare",
    3: "Epic",
    4: "Legendary",
    5: "Mythical",
    6: "Ascendant",
}

WEAPON_RARITY_LABELS = {
    rarity: label for rarity, label in RARITY_LABELS.items() if rarity != 0
}

ARMOR_SLOT_LABELS = {
    10: "Helmet",
    11: "Chest",
    12: "Shield",
    13: "Leggings",
    14: "Gauntlets",
    15: "Arrows",
    16: "Bolts",
    18: "Cosmetic",
}

WEAPON_CONFIRMED_ALIASES = {
    "unknown_21": "use_requirement_type",
    "unknown_34": "animated",
    "unknown_35": "animation_frame_count",
    "unknown_37": "animation_type",
    "unknown_88": "holy_resistance",
    "unknown_89": "dark_resistance",
    "unknown_93": "bonus_intelligence",
    "unknown_98": "emits_light",
}

DEV_ONLY_ITEM_NAME_REASON = "dev_only_item_name"
DEV_ONLY_ITEM_NAME_PATTERN = re.compile(r"^\s*super\s+duper\b", re.IGNORECASE)

ARMOR_CONFIRMED_ALIASES = {
    "unknown_18": "use_requirement_type",
    "unknown_30": "animated",
    "unknown_31": "animation_frame_count",
    "unknown_33": "animation_type",
    "unknown_70": "minimum_rarity",
    "unknown_81": "holy_resistance",
    "unknown_85": "dark_resistance",
    "unknown_89": "bonus_intelligence",
    "unknown_93": "avatar",
    "unknown_94": "emits_light",
}


def resolve_corrupted_perk_label(corrupted_val: int, base_val: int | None = None) -> str | None:
    return PERK_LABELS.get(corrupted_val)


def add_field_label(
    fields: MutableMapping[str, object],
    source_field: str,
    label_field: str,
    labels: dict[int, str],
) -> None:
    value = fields.get(source_field)
    if value in labels:
        fields[label_field] = labels[value]


def add_confirmed_aliases(fields: MutableMapping[str, object], aliases: Mapping[str, str]) -> None:
    for legacy_name, friendly_name in aliases.items():
        if friendly_name in fields:
            fields.setdefault(legacy_name, fields[friendly_name])
        elif legacy_name in fields:
            fields[friendly_name] = fields[legacy_name]


def add_derived_value(fields: MutableMapping[str, object]) -> None:
    if "value_low" in fields and "value_high" in fields:
        fields["value"] = fields["value_low"] + (fields["value_high"] << 16)


def add_perk_labels(fields: MutableMapping[str, object]) -> None:
    perk_val = fields.get("perk")
    if perk_val in PERK_LABELS:
        fields["perk_label"] = PERK_LABELS[perk_val]

    corrupted_val = fields.get("corrupted_perk")
    if corrupted_val:
        resolved = resolve_corrupted_perk_label(corrupted_val, perk_val)
        if resolved:
            fields["corrupted_perk_label"] = resolved


def enrich_weapon_fields(fields: MutableMapping[str, object]) -> None:
    add_confirmed_aliases(fields, WEAPON_CONFIRMED_ALIASES)
    add_derived_value(fields)
    add_field_label(fields, "subtype", "subtype_label", WEAPON_SUBTYPE_LABELS)
    add_field_label(fields, "specialty", "specialty_label", WEAPON_SPECIALTY_LABELS)
    add_field_label(fields, "element", "element_label", WEAPON_ELEMENT_LABELS)
    add_field_label(fields, "max_rarity", "max_rarity_label", WEAPON_RARITY_LABELS)
    add_perk_labels(fields)


def enrich_armor_fields(fields: MutableMapping[str, object]) -> None:
    add_confirmed_aliases(fields, ARMOR_CONFIRMED_ALIASES)
    add_derived_value(fields)
    add_field_label(fields, "slot", "slot_label", ARMOR_SLOT_LABELS)
    add_field_label(fields, "max_rarity", "max_rarity_label", RARITY_LABELS)
    add_perk_labels(fields)


def classify_item_visibility(name: object) -> str | None:
    if DEV_ONLY_ITEM_NAME_PATTERN.search(str(name or "")):
        return DEV_ONLY_ITEM_NAME_REASON
    return None


def apply_item_visibility_metadata(record: MutableMapping[str, object]) -> None:
    reason = classify_item_visibility(record.get("name"))
    if reason:
        record["codex_hidden"] = True
        record["codex_hidden_reason"] = reason


def _record_fields(record: Mapping[str, Any]) -> Mapping[str, Any]:
    fields = record.get("fields", {})
    if isinstance(fields, Mapping):
        return fields
    return {}


def _record_name(record: Mapping[str, Any]) -> str:
    name = record.get("name", "<unknown>")
    return str(name) if name else "<unknown>"


def report_item_perk_values(
    records: Sequence[Mapping[str, Any]],
    *,
    include_zero_perks: bool,
) -> None:
    perk_groups = {}
    corrupted_groups = {}
    for record in records:
        fields = _record_fields(record)
        name = _record_name(record)
        val = fields.get("perk")
        if val is not None and (include_zero_perks or val != 0):
            perk_groups.setdefault(val, []).append(name)
        cval = fields.get("corrupted_perk")
        if cval not in (None, 0):
            corrupted_groups.setdefault(cval, []).append(name)

    if perk_groups:
        labeled = {v: names for v, names in perk_groups.items() if v in PERK_LABELS}
        unlabeled = {v: names for v, names in perk_groups.items() if v not in PERK_LABELS}
        if labeled:
            print("Perk values (labeled):")
            for val in sorted(labeled):
                label = PERK_LABELS.get(val, "")
                names = ", ".join(labeled[val])
                print(f"  {val} ({label}): {names}")
        if unlabeled:
            print("Perk values (unlabeled):")
            for val in sorted(unlabeled):
                names = ", ".join(unlabeled[val])
                print(f"  {val}: {names}")

    if corrupted_groups:
        labeled_c = {
            v: names
            for v, names in corrupted_groups.items()
            if resolve_corrupted_perk_label(v) is not None
        }
        unlabeled_c = {
            v: names
            for v, names in corrupted_groups.items()
            if resolve_corrupted_perk_label(v) is None
        }
        if labeled_c:
            print("Corrupted perk values (labeled):")
            for val in sorted(labeled_c):
                label = resolve_corrupted_perk_label(val) or ""
                names = ", ".join(labeled_c[val])
                print(f"  {val} ({label}): {names}")
        if unlabeled_c:
            print("Corrupted perk values (unlabeled):")
            for val in sorted(unlabeled_c):
                names = ", ".join(unlabeled_c[val])
                print(f"  {val}: {names}")
