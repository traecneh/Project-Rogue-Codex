from __future__ import annotations

from collections.abc import MutableMapping


FLAG_TARGET_HIT_RANGE_TRAP = 0x8000
FLAG_FLYING = 0x0200
FLAG_ETHEREAL = 0x0100
FLAG_BOSS = 0x0040
FLAG_BERSERKER = 0x0004
FLAG_BLOCK = 0x0001
FLAG_IMMOBILE = 0x0002
FLAG_THORNS = 0x4000
KNOWN_FLAG_MASK = (
    FLAG_TARGET_HIT_RANGE_TRAP
    | FLAG_FLYING
    | FLAG_ETHEREAL
    | FLAG_BOSS
    | FLAG_BERSERKER
    | FLAG_BLOCK
    | FLAG_IMMOBILE
    | FLAG_THORNS
)

TYPE_LABELS = {
    0: "None",
    1: "Fire Beast",
    2: "Electrical Beast",
    3: "Demon",
    4: "Animal",
    5: "Beast",
    6: "Human",
    7: "Giant",
    8: "Undead",
    9: "Ice Beast",
    10: "Poison Beast",
    11: "Disease Beast",
}

ELEMENTAL_LABELS = {
    0: "None",
    1: "Fire",
    2: "Electric",
    4: "Cold",
    6: "Acid",
    7: "Poison",
    8: "Disease",
}

STATUS_EFFECT_LABELS = {
    1286: "Bleed",
    2564: "Shock",
    3841: "Poison",
    3842: "Disease",
    3856: "Freeze",
    5121: "Poison",
    5122: "Disease",
    5126: "Bleed",
}

TATTER_LABELS = {
    0: "None",
    1: "Lifesteal",
    2: "Bloodthirster",
    3: "Rejuvenation",
    4: "Antitoxin",
    5: "Immunization",
    6: "Vitality",
    7: "Bolstered Strength",
    9: "Magic Shield",
    10: "Juggernaut",
    11: "Parry",
    12: "Alchemist",
    13: "Knowledge",
    14: "Moneybags",
    21: "Demon Blood",
    22: "Frozen Heart",
    23: "Lightning Field",
    24: "Tourniquet",
    25: "Hazmat",
    26: "Antacid",
    29: "Vampirism",
    30: "Garrote",
    31: "Brutality",
    32: "Tenacity",
    33: "Swiftness",
    35: "Epidemic",
    36: "Lethal Toxins",
    37: "Destruction",
    38: "Impenetrable",
    39: "Hawkeye",
    40: "Overpower",
    41: "Demonsbane",
    42: "Beastslayer",
    43: "Executioner",
    44: "Consecration",
    45: "Venomshock",
    46: "Iceshatter",
    47: "Desperation",
    48: "Bloodlust",
    49: "Slayer",
    51: "Critical Aegis",
    52: "Toxic Shell",
}


def _add_field_label(
    fields: MutableMapping[str, object],
    source_field: str,
    label_field: str,
    labels: dict[int, str],
) -> None:
    value = fields.get(source_field)
    if value in labels:
        fields[label_field] = labels[value]


def _int_or_none(value: object) -> int | None:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        stripped = value.strip()
        if stripped and stripped.lstrip("-").isdigit():
            return int(stripped)
    return None


def _add_confirmed_animation_aliases(fields: MutableMapping[str, object]) -> None:
    if "extra_flags" in fields:
        fields.setdefault("unknown_27", fields["extra_flags"])
    elif "unknown_27" in fields:
        fields["extra_flags"] = fields["unknown_27"]

    if "animated" in fields:
        fields.setdefault("unknown_166", fields["animated"])
    elif "unknown_166" in fields:
        fields["animated"] = fields["unknown_166"]

    frame_count = _int_or_none(fields.get("animation_frame_count"))
    animation_type = _int_or_none(fields.get("animation_type"))
    metadata = _int_or_none(fields.get("animation_metadata"))
    legacy_metadata = _int_or_none(fields.get("unknown_168"))

    if metadata is not None and legacy_metadata is None:
        fields.setdefault("unknown_168", metadata)
        legacy_metadata = metadata
    elif legacy_metadata is not None:
        fields.setdefault("animation_metadata", legacy_metadata)

    if frame_count is None and legacy_metadata is not None:
        fields["animation_frame_count"] = legacy_metadata & 0xFF
        frame_count = _int_or_none(fields.get("animation_frame_count"))
    if animation_type is None and legacy_metadata is not None:
        fields["animation_type"] = legacy_metadata >> 8
        animation_type = _int_or_none(fields.get("animation_type"))

    if frame_count is not None and animation_type is not None:
        packed = frame_count + (animation_type << 8)
        fields.setdefault("animation_metadata", packed)
        fields.setdefault("unknown_168", packed)


def enrich_monster_fields(
    fields: MutableMapping[str, object],
    monster_name: str,
) -> list[str]:
    warnings = []
    _add_confirmed_animation_aliases(fields)

    _add_field_label(fields, "type", "type_label", TYPE_LABELS)
    _add_field_label(fields, "elemental_attack", "elemental_attack_label", ELEMENTAL_LABELS)

    status_effect = fields.get("status_effect")
    if status_effect:
        if status_effect in STATUS_EFFECT_LABELS:
            fields["status_effect_label"] = STATUS_EFFECT_LABELS[status_effect]
        else:
            warnings.append(
                f"{monster_name}: unknown status_effect label for value {status_effect}"
            )

    unknown_tatters = []
    for field_name in ("uncommon_tatter", "rare_tatter"):
        value = fields.get(field_name)
        if value is None:
            continue
        if value in TATTER_LABELS:
            fields[f"{field_name}_label"] = TATTER_LABELS[value]
        else:
            unknown_tatters.append(f"{field_name}={value}")

    flag_val = fields.get("total_flags", 0)
    fields["is_target_when_hit_ranged_trapped"] = bool(
        flag_val & FLAG_TARGET_HIT_RANGE_TRAP
    )
    fields["is_flying"] = bool(flag_val & FLAG_FLYING)
    fields["is_ethereal"] = bool(flag_val & FLAG_ETHEREAL)
    fields["is_boss"] = bool(flag_val & FLAG_BOSS)
    fields["is_berserker"] = bool(flag_val & FLAG_BERSERKER)
    fields["is_target_when_blocked"] = bool(flag_val & FLAG_BLOCK)
    fields["is_immobile"] = bool(flag_val & FLAG_IMMOBILE)
    fields["has_thorns"] = bool(flag_val & FLAG_THORNS)

    unknown_bits = flag_val & ~KNOWN_FLAG_MASK
    if unknown_bits:
        warnings.append(
            f"{monster_name}: unknown flag bits set in total_flags = 0x{flag_val:04X} "
            f"(extra 0x{unknown_bits:04X})"
        )

    if unknown_tatters:
        warnings.append(
            f"{monster_name}: unknown tatter label(s): {', '.join(unknown_tatters)}"
        )

    return warnings
