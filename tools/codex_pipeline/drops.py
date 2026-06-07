from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


DROP_KINDS = ("armors", "weapons")


def normalize_name(value: Any) -> str:
    return str(value or "").strip()


def normalize_key(value: Any) -> str:
    return normalize_name(value).lower()


def normalize_slug(value: Any) -> str:
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9_-]+", "-", normalize_key(value)))


def load_drop_sources(path: Path) -> dict[str, dict[str, list[str]]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if raw.get("schemaVersion") != 1:
        raise ValueError(f"Unsupported drop source schemaVersion: {raw.get('schemaVersion')!r}")

    result: dict[str, dict[str, list[str]]] = {}
    for kind in DROP_KINDS:
        if kind not in raw:
            raise ValueError(f"{kind} drop sources must be an object")
        entries = raw[kind]
        if not isinstance(entries, dict):
            raise ValueError(f"{kind} drop sources must be an object")

        normalized_entries: dict[str, list[str]] = {}
        for item_name, monster_names in entries.items():
            item = normalize_name(item_name)
            if not item:
                raise ValueError(f"{kind} drop source contains an empty item name")
            if not isinstance(monster_names, list):
                raise ValueError(f"{kind} drop source for {item!r} must be a list")
            monsters = [normalize_name(name) for name in monster_names if normalize_name(name)]
            if not monsters:
                raise ValueError(f"{kind} drop source for {item!r} must include at least one monster")
            normalized_entries[item] = monsters
        result[kind] = normalized_entries
    return result


def derive_monster_drops(sources: dict[str, dict[str, list[str]]]) -> dict[str, dict[str, list[str]]]:
    reverse: dict[str, dict[str, list[str]]] = {kind: {} for kind in DROP_KINDS}
    for kind in DROP_KINDS:
        for item_name, monster_names in sources.get(kind, {}).items():
            for monster_name in monster_names:
                monster_id = normalize_slug(monster_name)
                reverse[kind].setdefault(monster_id, [])
                if item_name not in reverse[kind][monster_id]:
                    reverse[kind][monster_id].append(item_name)
    return reverse
