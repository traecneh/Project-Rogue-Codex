from __future__ import annotations

import re
from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any


PERK_LABELS = {
    1: "Lifesteal (Tier 2)",
    6: "Vitality (Tier 1)",
    10: "Juggernaut (Tier 1)",
    22: "Frozen Heart (Tier 1)",
    30: "Garrote (Tier 1)",
    44: "Consecration (Tier 1)",
    52: "Lethal Toxins (Tier 2)",
    100: "Runic (Tier 1)",
    104: "Flame Buffet (Tier 1)",
    107: "Blood Siphon (Tier 1)",
    257: "Lifesteal (Tier 2)",
    258: "Vampirism (Tier 1)",
    266: "Juggernaut (Tier 2)",
    270: "Moneybags (Tier 2)",
    285: "Vampirism (Tier 2)",
    286: "Garrote (Tier 2)",
    291: "Epidemic (Tier 2)",
    293: "Destruction (Tier 2)",
    295: "Hawkeye (Tier 2)",
    296: "Overpower (Tier 2)",
    297: "Demonsbane (Tier 2)",
    302: "Ice Shatter (Tier 2)",
    307: "Critical Aegis (Tier 2)",
    308: "Toxic Shell (Tier 2)",
    102: "Envenomation (Tier 1)",
    105: "Crimson Feast (Tier 1)",
    259: "Rejuvenation (Tier 2)",
    260: "Antitoxin (Tier 2)",
    261: "Immunization (Tier 2)",
    262: "Vitality (Tier 2)",
    263: "Bolstered Strength (Tier 2)",
    265: "Magic Shield (Tier 2)",
    267: "Parry (Tier 2)",
    268: "Alchemist (Tier 2)",
    269: "Knowledge (Tier 2)",
    277: "Demon Blood (Tier 2)",
    278: "Frozen Heart (Tier 2)",
    21: "Demon Blood",
    279: "Lightning Field (Tier 2)",
    280: "Tourniquet (Tier 2)",
    281: "Hazmat (Tier 2)",
    282: "Antacid (Tier 2)",
    287: "Brutality (Tier 2)",
    288: "Tenacity (Tier 2)",
    289: "Swiftness (Tier 2)",
    292: "Lethal Toxins (Tier 2)",
    300: "Consecration (Tier 2)",
    301: "Venomshock (Tier 2)",
    303: "Desperation (Tier 2)",
    304: "Bloodlust (Tier 2)",
    305: "Slayer (Tier 2)",
    362: "Plague Eater (Tier 2)",
    513: "Lifesteal (Tier 3)",
    514: "Bloodthirster (Tier 3)",
    515: "Rejuvenation (Tier 3)",
    516: "Antitoxin (Tier 3)",
    522: "Juggernaut (Tier 3)",
    524: "Alchemist (Tier 3)",
    525: "Knowledge (Tier 3)",
    533: "Demon Blood (Tier 3)",
    542: "Garrote (Tier 3)",
    549: "Destruction (Tier 3)",
    556: "Consecration (Tier 3)",
    559: "Desperation (Tier 3)",
    564: "Toxic Shell (Tier 3)",
    614: "Envenomation (Tier 3)",
    615: "Lycan (Tier 3)",
    619: "Blood Siphon (Tier 3)",
    3: "Rejuvenation (Tier 1)",
    4: "Antitoxin (Tier 1)",
    5: "Immunization (Tier 1)",
    9: "Magic Shield (Tier 1)",
    11: "Parry (Tier 1)",
    12: "Alchemist (Tier 1)",
    15: "Flame Strike (Tier 1)",
    16: "Lightning Javelin (Tier 1)",
    17: "Iceburst (Tier 1)",
    18: "Sulfuric (Tier 1)",
    19: "Plague (Tier 1)",
    20: "Toxicity (Tier 1)",
    36: "Lethal Toxins (Tier 1)",
    37: "Destruction (Tier 1)",
    101: "Vengeance (Tier 1)",
    518: "Vitality (Tier 3)",
    523: "Parry (Tier 3)",
    547: "Epidemic (Tier 3)",
    548: "Lethal Toxins (Tier 3)",
    560: "Bloodlust (Tier 3)",
    563: "Critical Aegis (Tier 3)",
    612: "Runic (Tier 3)",
    613: "Vengeance (Tier 3)",
    616: "Flame Buffet (Tier 3)",
    617: "Crimson Feast (Tier 3)",
}

WEAPON_SUBTYPE_LABELS = {
    1: "Sword",
    2: "Dagger",
    3: "Axe",
    4: "Blunt",
    5: "Polearm",
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
    18: "Cosmetic",
}

_TIER_PATTERN = re.compile(r"\(Tier\s*(\d+)\)", re.IGNORECASE)


def _bump_tier_label(label: str) -> str:
    def repl(match: re.Match[str]) -> str:
        tier_num = int(match.group(1))
        return f"(Tier {tier_num + 1})"

    return _TIER_PATTERN.sub(repl, label, count=1)


def resolve_corrupted_perk_label(corrupted_val: int, base_val: int | None = None) -> str | None:
    if corrupted_val in PERK_LABELS:
        return PERK_LABELS[corrupted_val]

    if base_val is not None and base_val in PERK_LABELS:
        base_label = PERK_LABELS[base_val]
        if corrupted_val - base_val == 256:
            return _bump_tier_label(base_label)
        return base_label

    offset_base = corrupted_val - 256
    if offset_base in PERK_LABELS:
        return _bump_tier_label(PERK_LABELS[offset_base])

    return None


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
    if perk_val in PERK_LABELS:
        fields["perk_label"] = PERK_LABELS[perk_val]

    corrupted_val = fields.get("corrupted_perk")
    if corrupted_val:
        resolved = resolve_corrupted_perk_label(corrupted_val, perk_val)
        if resolved:
            fields["corrupted_perk_label"] = resolved


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
