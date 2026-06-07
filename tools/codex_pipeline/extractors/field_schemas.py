from __future__ import annotations

from collections.abc import Mapping


FRAME_COMPONENTS = ("x", "y", "width", "height")


def _name_fields(count: int) -> dict[int, str]:
    return {index: f"name_{index}" for index in range(count)}


def _frame_fields(start_index: int, frame_count: int = 9) -> dict[int, str]:
    return {
        start_index + ((frame_number - 1) * len(FRAME_COMPONENTS)) + component_index: (
            f"frame_{frame_number}_{component}"
        )
        for frame_number in range(1, frame_count + 1)
        for component_index, component in enumerate(FRAME_COMPONENTS)
    }


MONSTER_FIELD_NAMES = {
    **_name_fields(9),
    15: "type",
    16: "min_damage",
    17: "max_damage",
    18: "health",
    23: "movement_speed",
    24: "attack_speed",
    25: "level",
    26: "total_flags",
    28: "elemental_attack",
    29: "status_effect",
    **_frame_fields(130),
    174: "uncommon_tatter",
    175: "rare_tatter",
}

WEAPON_FIELD_NAMES = {
    **_name_fields(12),
    13: "min_damage",
    14: "max_damage",
    16: "value_low",
    17: "value_high",
    18: "weight",
    19: "attack_speed",
    20: "skill_requirement",
    22: "subtype",
    23: "level_requirement",
    24: "specialty",
    25: "specialty_amount",
    26: "element",
    28: "proc_chance",
    **_frame_fields(38),
    75: "max_rarity",
    76: "shard_decomposition_amount",
    77: "shard_promotion_amount",
    80: "perk",
    82: "fire_resistance",
    83: "cold_resistance",
    84: "electric_resistance",
    85: "acid_resistance",
    86: "poison_resistance",
    87: "disease_resistance",
    90: "strength",
    91: "dexterity",
    92: "constitution",
    96: "to_hit",
    99: "corrupted_perk",
}

ARMOR_FIELD_NAMES = {
    **_name_fields(12),
    13: "armor",
    14: "value_low",
    15: "value_high",
    16: "weight",
    17: "player_level_requirement",
    19: "slot",
    20: "level",
    **_frame_fields(34),
    71: "max_rarity",
    72: "deconstruction",
    73: "promotion",
    76: "perk",
    78: "fire_resistance",
    79: "cold_resistance",
    80: "lightning_resistance",
    82: "acid_resistance",
    83: "poison_resistance",
    84: "disease_resistance",
    86: "strength",
    87: "dexterity",
    88: "constitution",
    92: "to_hit",
    95: "corrupted_perk",
}


def field_name(field_names: Mapping[int, str], index: int) -> str:
    return field_names.get(index, f"unknown_{index}")
