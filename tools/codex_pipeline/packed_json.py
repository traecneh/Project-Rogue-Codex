from __future__ import annotations

import json
from collections import defaultdict
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from tools.codex_pipeline.extractors.item_metadata import (
    apply_item_visibility_metadata,
    enrich_armor_fields,
    enrich_weapon_fields,
)
from tools.codex_pipeline.extractors.monster_metadata import enrich_monster_fields
from tools.codex_pipeline.vpack import VpackError, decrypt_vpack


PACKED_JSON_FILENAMES_BY_TARGET = {
    "weapons": "weapons.json",
    "armors": "armors.json",
    "monsters": "monsters.json",
    "collectables": "collectables.json",
    "useables": "useables.json",
}

VPACK_MAGIC = b"VPACK"
VPACK_FILENAME = "rogue_data.vpack"
SITE_DERIVED_FIELD_NAMES = {
    "value",
    "subtype_label",
    "specialty_label",
    "element_label",
    "max_rarity_label",
    "slot_label",
    "perk_label",
    "corrupted_perk_label",
    "type_label",
    "elemental_attack_label",
    "status_effect_label",
    "uncommon_tatter_label",
    "rare_tatter_label",
    "is_target_when_hit_ranged_trapped",
    "is_flying",
    "is_ethereal",
    "is_boss",
    "is_berserker",
    "is_target_when_blocked",
    "is_immobile",
    "has_thorns",
    "unknown_18",
    "unknown_21",
    "unknown_27",
    "unknown_30",
    "unknown_31",
    "unknown_33",
    "unknown_34",
    "unknown_35",
    "unknown_37",
    "unknown_70",
    "unknown_81",
    "unknown_85",
    "unknown_88",
    "unknown_89",
    "unknown_93",
    "unknown_94",
    "unknown_98",
    "unknown_166",
    "unknown_168",
}


def is_packed_json_target_supported(target_name: str) -> bool:
    return target_name in PACKED_JSON_FILENAMES_BY_TARGET


def vpack_candidates_for_source(source_data: Path) -> list[Path]:
    data_dir = source_data.parent
    client_root = data_dir.parent
    candidates = [
        data_dir / "ClientPack" / VPACK_FILENAME,
        client_root / "Data" / "ClientPack" / VPACK_FILENAME,
    ]
    return list(dict.fromkeys(candidates))


def is_vpack_file(path: Path) -> bool:
    if not path.is_file():
        return False
    try:
        return path.read_bytes()[: len(VPACK_MAGIC)] == VPACK_MAGIC
    except OSError:
        return False


def find_packed_vpack_source(source_data: Path) -> Path | None:
    for candidate in vpack_candidates_for_source(source_data):
        if is_vpack_file(candidate):
            return candidate
    return None


def read_packed_json_files(pack_path: Path, *, log_path: Path | None = None) -> dict[str, Any]:
    decrypted = decrypt_vpack(pack_path, log_path=log_path)
    packed_files: dict[str, Any] = {}
    for file in decrypted.files:
        if not file.path.lower().endswith(".json"):
            continue
        try:
            packed_files[file.path.casefold()] = json.loads(file.data.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise VpackError(f"{file.path} failed to parse as packed JSON: {exc}") from exc
    return packed_files


def map_packed_json_target(
    target_name: str,
    packed_files: Mapping[str, Any],
    *,
    site_records: Sequence[Mapping[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    filename = PACKED_JSON_FILENAMES_BY_TARGET.get(target_name)
    if filename is None:
        raise VpackError(f"{target_name} does not support packed JSON mapping")
    data = packed_files.get(filename.casefold()) or packed_files.get(filename)
    if data is None:
        raise VpackError(f"packed JSON file not found for {target_name}: {filename}")

    site_index = _build_site_index(site_records or [])
    if target_name == "weapons":
        records = _map_weapons(data, site_index)
    elif target_name == "armors":
        records = _map_armors(data, site_index)
    elif target_name == "monsters":
        records = _map_monsters(data, site_index)
    elif target_name in {"collectables", "useables"}:
        records = _map_simple_items(data, target_name)
    else:
        raise VpackError(f"{target_name} does not support packed JSON mapping")
    return sorted(records, key=lambda record: _sort_record_id(record["id"]))


def _sort_record_id(record_id: Any) -> tuple[int, str]:
    if isinstance(record_id, int):
        return 0, f"{record_id:012d}"
    return 1, str(record_id)


def _build_site_index(site_records: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    by_id: dict[int, Mapping[str, Any]] = {}
    by_name: dict[str, list[Mapping[str, Any]]] = defaultdict(list)
    by_name_level_type: dict[tuple[str, int | None, int | None], list[Mapping[str, Any]]] = defaultdict(list)
    for record in site_records:
        if not isinstance(record, Mapping):
            continue
        record_id = _int_or_none(record.get("id"))
        name = _normalize_name(record.get("name"))
        fields = record.get("fields")
        fields = fields if isinstance(fields, Mapping) else {}
        level = _int_or_none(fields.get("level"))
        monster_type = _int_or_none(fields.get("type"))
        if record_id is not None:
            by_id[record_id] = record
        if name:
            by_name[name].append(record)
            by_name_level_type[(name, level, monster_type)].append(record)
    return {
        "by_id": by_id,
        "by_name": by_name,
        "by_name_level_type": by_name_level_type,
    }


def _normalize_name(value: Any) -> str:
    return str(value or "").strip().casefold()


def _display_name(value: Any) -> str:
    return str(value or "").strip()


def _is_named_record(item: Mapping[str, Any]) -> bool:
    name = _display_name(item.get("name"))
    return bool(name) and name.casefold() != "unused"


def _int_or_none(value: Any) -> int | None:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        stripped = value.strip()
        if stripped and stripped.lstrip("-").isdigit():
            return int(stripped)
    return None


def _int_value(item: Mapping[str, Any], key: str, default: int = 0) -> int:
    value = _int_or_none(item.get(key))
    return default if value is None else value


def _split_value(value: int) -> tuple[int, int]:
    return value & 0xFFFF, (value >> 16) & 0xFFFF


def _site_record_by_id_or_name(site_index: Mapping[str, Any], record_id: int, name: str) -> Mapping[str, Any] | None:
    by_id = site_index["by_id"]
    if record_id in by_id:
        return by_id[record_id]
    return _unique_site_record(site_index["by_name"].get(_normalize_name(name), []))


def _monster_site_record(
    site_index: Mapping[str, Any],
    name: str,
    level: int,
    monster_type: int,
) -> Mapping[str, Any] | None:
    name_key = _normalize_name(name)
    by_name_level_type = site_index["by_name_level_type"]
    exact = _unique_site_record(by_name_level_type.get((name_key, level, monster_type), []))
    if exact is not None:
        return exact
    return _unique_site_record(site_index["by_name"].get(name_key, []))


def _unique_site_record(records: Sequence[Mapping[str, Any]]) -> Mapping[str, Any] | None:
    return records[0] if len(records) == 1 else None


def _site_record_id(record: Mapping[str, Any] | None, fallback: int) -> int:
    if record is None:
        return fallback
    record_id = _int_or_none(record.get("id"))
    return fallback if record_id is None else record_id


def _site_fields(record: Mapping[str, Any] | None) -> Mapping[str, Any]:
    if record is None:
        return {}
    fields = record.get("fields")
    return fields if isinstance(fields, Mapping) else {}


def _merge_site_only_fields(fields: dict[str, Any], site_record: Mapping[str, Any] | None) -> None:
    for key, value in _site_fields(site_record).items():
        if key in SITE_DERIVED_FIELD_NAMES:
            continue
        fields.setdefault(key, value)


def _add_value_fields(fields: dict[str, Any], packed_value: int) -> None:
    value_low, value_high = _split_value(packed_value)
    fields["value_low"] = value_low
    fields["value_high"] = value_high


def _add_frames(fields: dict[str, Any], frames: Any, frame_count: int = 9) -> None:
    frame_list = frames if isinstance(frames, list) else []
    for index in range(frame_count):
        frame = frame_list[index] if index < len(frame_list) and isinstance(frame_list[index], Mapping) else {}
        prefix = f"frame_{index + 1}"
        fields[f"{prefix}_x"] = _int_value(frame, "x")
        fields[f"{prefix}_y"] = _int_value(frame, "y")
        fields[f"{prefix}_width"] = _int_value(frame, "w", _int_value(frame, "width"))
        fields[f"{prefix}_height"] = _int_value(frame, "h", _int_value(frame, "height"))


def _group_items(data: Mapping[str, Any], key: str) -> list[tuple[int, Mapping[str, Any]]]:
    groups = data.get(key)
    if not isinstance(groups, list):
        raise VpackError(f"packed {key} JSON does not contain a {key} array")
    grouped_items: list[tuple[int, Mapping[str, Any]]] = []
    for group in groups:
        if not isinstance(group, Mapping):
            continue
        group_type = _int_or_none(group.get("type"))
        items = group.get("items")
        if group_type is None or not isinstance(items, list):
            continue
        for item in items:
            if isinstance(item, Mapping) and _is_named_record(item):
                grouped_items.append((group_type, item))
    return grouped_items


def _simple_item_records(data: Mapping[str, Any], key: str) -> list[Mapping[str, Any]]:
    items = data.get(key)
    if not isinstance(items, list):
        raise VpackError(f"packed {key} JSON does not contain a {key} array")
    return [item for item in items if isinstance(item, Mapping) and _is_named_record(item)]


def _map_simple_items(data: Mapping[str, Any], key: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for item in _simple_item_records(data, key):
        fields = {
            "value": _int_value(item, "value"),
            "use_type": _int_value(item, "use_type"),
            "crafting_material_type": _int_value(item, "crafting_material_type"),
            "crafting_material_amount": _int_value(item, "crafting_material_amount"),
            "crafting_difficulty": _int_value(item, "crafting_difficulty"),
            "crafting_requirement": _int_value(item, "crafting_requirement"),
            "emits_light": _int_value(item, "emits_light"),
            "animated": _int_value(item, "animated"),
            "animation_frame_count": _int_value(item, "animation_frame_count"),
            "animation_type": _int_value(item, "animation_type"),
        }
        _add_frames(fields, item.get("frames"))
        records.append({"id": _int_value(item, "id"), "name": _display_name(item.get("name")), "fields": fields})
    return records


def _map_weapons(data: Mapping[str, Any], site_index: Mapping[str, Any]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for group_type, item in _group_items(data, "weapons"):
        packed_id = group_type * 200 + _int_value(item, "id")
        name = _display_name(item.get("name"))
        site_record = _site_record_by_id_or_name(site_index, packed_id, name)
        fields = {
            "min_damage": _int_value(item, "dam_min"),
            "max_damage": _int_value(item, "dam_max"),
            "attack_speed": _int_value(item, "speed"),
            "minimum_rarity": _int_value(item, "minimum_rarity"),
            "sale_value": _int_value(item, "sale_value"),
            "skill_requirement": _int_value(item, "use_req_amnt"),
            "use_requirement_type": _int_value(item, "use_req_type"),
            "crafting_requirement": _int_value(item, "crafting_requirement"),
            "crafting_material_type": _int_value(item, "crafting_material_type"),
            "crafting_material_amount": _int_value(item, "crafting_material_amount"),
            "crafting_difficulty": _int_value(item, "crafting_difficulty"),
            "subtype": _int_value(item, "subtype"),
            "level_requirement": _int_value(item, "level"),
            "element": _int_value(item, "elemental_damage_type"),
            "proc_chance": _int_value(item, "elemental_damage_max"),
            "animated": _int_value(item, "animated"),
            "animation_frame_count": _int_value(item, "animation_frame_count"),
            "animation_type": _int_value(item, "animation_type"),
            "max_rarity": _int_value(item, "maximum_rarity"),
            "shard_decomposition_amount": _int_value(item, "shards_deconstruction"),
            "shard_promotion_amount": _int_value(item, "shards_promotion"),
            "perk": _int_value(item, "innate_special_effect"),
            "fire_resistance": _int_value(item, "resistance_fire"),
            "cold_resistance": _int_value(item, "resistance_cold"),
            "electric_resistance": _int_value(item, "resistance_electric"),
            "acid_resistance": _int_value(item, "resistance_acid"),
            "poison_resistance": _int_value(item, "resistance_poison"),
            "disease_resistance": _int_value(item, "resistance_disease"),
            "holy_resistance": _int_value(item, "resistance_holy"),
            "dark_resistance": _int_value(item, "resistance_dark"),
            "strength": _int_value(item, "bonus_strength"),
            "dexterity": _int_value(item, "bonus_dexterity"),
            "constitution": _int_value(item, "bonus_constitution"),
            "bonus_intelligence": _int_value(item, "bonus_intelligence"),
            "to_hit": _int_value(item, "to_hit"),
            "emits_light": _int_value(item, "emits_light"),
        }
        _add_value_fields(fields, _int_value(item, "value"))
        _add_frames(fields, item.get("frames"))
        _merge_site_only_fields(fields, site_record)
        enrich_weapon_fields(fields)
        record = {"id": packed_id, "name": name, "fields": fields}
        apply_item_visibility_metadata(record)
        records.append(record)
    return records


def _map_armors(data: Mapping[str, Any], site_index: Mapping[str, Any]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for group_type, item in _group_items(data, "armors"):
        packed_id = group_type * 200 + _int_value(item, "id")
        name = _display_name(item.get("name"))
        site_record = _site_record_by_id_or_name(site_index, packed_id, name)
        fields = {
            "armor": _int_value(item, "ac"),
            "minimum_rarity": _int_value(item, "minimum_rarity"),
            "sale_value": _int_value(item, "sale_value"),
            "player_level_requirement": _int_value(item, "use_req_amnt"),
            "use_requirement_type": _int_value(item, "use_req_type"),
            "crafting_requirement": _int_value(item, "crafting_requirement"),
            "crafting_material_type": _int_value(item, "crafting_material_type"),
            "crafting_material_amount": _int_value(item, "crafting_material_amount"),
            "crafting_difficulty": _int_value(item, "crafting_difficulty"),
            "slot": _int_value(item, "subtype"),
            "level": _int_value(item, "level"),
            "animated": _int_value(item, "animated"),
            "animation_frame_count": _int_value(item, "animation_frame_count"),
            "animation_type": _int_value(item, "animation_type"),
            "max_rarity": _int_value(item, "maximum_rarity"),
            "deconstruction": _int_value(item, "shards_deconstruction"),
            "promotion": _int_value(item, "shards_promotion"),
            "perk": _int_value(item, "innate_special_effect"),
            "fire_resistance": _int_value(item, "resistance_fire"),
            "cold_resistance": _int_value(item, "resistance_cold"),
            "lightning_resistance": _int_value(item, "resistance_electric"),
            "acid_resistance": _int_value(item, "resistance_acid"),
            "poison_resistance": _int_value(item, "resistance_poison"),
            "disease_resistance": _int_value(item, "resistance_disease"),
            "holy_resistance": _int_value(item, "resistance_holy"),
            "dark_resistance": _int_value(item, "resistance_dark"),
            "strength": _int_value(item, "bonus_strength"),
            "dexterity": _int_value(item, "bonus_dexterity"),
            "constitution": _int_value(item, "bonus_constitution"),
            "bonus_intelligence": _int_value(item, "bonus_intelligence"),
            "to_hit": _int_value(item, "to_hit"),
            "avatar": _int_value(item, "avatar"),
            "emits_light": _int_value(item, "emits_light"),
        }
        _add_value_fields(fields, _int_value(item, "value"))
        _add_frames(fields, item.get("frames"))
        _merge_site_only_fields(fields, site_record)
        enrich_armor_fields(fields)
        record = {"id": packed_id, "name": name, "fields": fields}
        apply_item_visibility_metadata(record)
        records.append(record)
    return records


def _map_monsters(data: Mapping[str, Any], site_index: Mapping[str, Any]) -> list[dict[str, Any]]:
    monsters = data.get("monsters")
    if not isinstance(monsters, list):
        raise VpackError("packed monsters JSON does not contain a monsters array")

    records: list[dict[str, Any]] = []
    for item in monsters:
        if not isinstance(item, Mapping) or not _is_named_record(item):
            continue
        if item.get("used") is False:
            continue
        name = _display_name(item.get("name"))
        packed_id = _int_value(item, "id")
        level = _int_value(item, "monster_level")
        monster_type = _int_value(item, "mon_type")
        site_record = _monster_site_record(site_index, name, level, monster_type)
        flags = _int_value(item, "flags")
        animation_frame_count = _int_value(item, "animation_frame_count")
        animation_type = _int_value(item, "animation_type")
        fields = {
            "type": monster_type,
            "min_damage": _int_value(item, "dam_min"),
            "max_damage": _int_value(item, "dam_max"),
            "health": _int_value(item, "hp_max"),
            "movement_speed": _int_value(item, "moving_speed"),
            "attack_speed": _int_value(item, "attack_speed"),
            "level": level,
            "total_flags": flags & 0xFFFF,
            "extra_flags": flags >> 16,
            "elemental_attack": _int_value(item, "element"),
            "animated": _int_value(item, "animated"),
            "animation_frame_count": animation_frame_count,
            "animation_type": animation_type,
            "animation_metadata": animation_frame_count + (animation_type << 8),
        }
        _add_frames(fields, item.get("frames"))
        _merge_site_only_fields(fields, site_record)
        enrich_monster_fields(fields, name)
        records.append({"id": _site_record_id(site_record, packed_id), "name": name, "fields": fields})
    return records
