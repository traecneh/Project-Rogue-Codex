from __future__ import annotations

from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any

from tools.codex_pipeline.perk_catalog import PERK_LABELS
from tools.codex_pipeline.perks import UNKNOWN_PERK_LABEL

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
    3: "Holy",
    4: "Cold",
    5: "Dark",
    6: "Acid",
    7: "Poison",
    8: "Disease",
}

RARITY_LABELS = {
    0: "Common",
    1: "Rare",
    2: "Epic",
    3: "Mythical",
    4: "Ascendant",
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


def add_derived_value(fields: MutableMapping[str, object]) -> None:
    if "value_low" in fields and "value_high" in fields:
        fields["value"] = fields["value_low"] + (fields["value_high"] << 16)


def add_perk_labels(fields: MutableMapping[str, object]) -> None:
    perk_val = fields.get("perk")
    if perk_val:
        fields["perk_label"] = PERK_LABELS.get(perk_val, UNKNOWN_PERK_LABEL)

    corrupted_val = fields.get("corrupted_perk")
    if corrupted_val:
        resolved = resolve_corrupted_perk_label(corrupted_val, perk_val)
        fields["corrupted_perk_label"] = resolved or UNKNOWN_PERK_LABEL


def enrich_weapon_fields(fields: MutableMapping[str, object]) -> None:
    add_derived_value(fields)
    add_field_label(fields, "subtype", "subtype_label", WEAPON_SUBTYPE_LABELS)
    add_field_label(fields, "specialty", "specialty_label", WEAPON_SPECIALTY_LABELS)
    add_field_label(fields, "element", "element_label", WEAPON_ELEMENT_LABELS)
    add_field_label(fields, "max_rarity", "max_rarity_label", WEAPON_RARITY_LABELS)
    add_perk_labels(fields)


def enrich_armor_fields(fields: MutableMapping[str, object]) -> None:
    add_derived_value(fields)
    add_field_label(fields, "slot", "slot_label", ARMOR_SLOT_LABELS)
    add_field_label(fields, "max_rarity", "max_rarity_label", RARITY_LABELS)
    add_perk_labels(fields)


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
