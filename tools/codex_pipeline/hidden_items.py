from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

from tools.codex_pipeline.config import ALLOWLISTS_PATH


VARIANT_SUFFIX_RE = re.compile(r"\s*-\d+$")
VARIANT_ID_RE = re.compile(r"-(\d+)$")


def _normalize_name(value: object) -> str:
    return " ".join(str(value or "").strip().casefold().split())


def _image_display_name(image_name: object) -> str:
    name = Path(str(image_name).replace("\\", "/")).name
    stem = Path(name).stem
    return VARIANT_SUFFIX_RE.sub("", stem).strip()


def _image_record_id(image_name: object) -> str:
    name = Path(str(image_name).replace("\\", "/")).name
    match = VARIANT_ID_RE.search(Path(name).stem)
    return match.group(1) if match else ""


@dataclass(frozen=True)
class HiddenItemRules:
    blocked_by_target: dict[str, tuple[str, ...]]
    blocked_ids_by_target: dict[str, tuple[str, ...]] = field(default_factory=dict)

    @classmethod
    def from_allowlists(cls, allowlists: dict[str, Any]) -> "HiddenItemRules":
        blocked_by_target: dict[str, tuple[str, ...]] = {}
        blocked_ids_by_target: dict[str, tuple[str, ...]] = {}
        for target_name, target_rules in allowlists.items():
            if not isinstance(target_rules, dict):
                continue
            blocked = target_rules.get("block", [])
            if not isinstance(blocked, list):
                continue
            normalized = tuple(
                sorted(
                    {
                        normalized_name
                        for value in blocked
                        if (normalized_name := _normalize_name(value))
                    }
                )
            )
            if normalized:
                blocked_by_target[_normalize_name(target_name)] = normalized
            blocked_ids = target_rules.get("block_ids", [])
            if isinstance(blocked_ids, list):
                normalized_ids = tuple(
                    sorted(
                        {
                            str(value).strip()
                            for value in blocked_ids
                            if value is not None and str(value).strip()
                        }
                    )
                )
                if normalized_ids:
                    blocked_ids_by_target[_normalize_name(target_name)] = normalized_ids
        return cls(blocked_by_target, blocked_ids_by_target)

    def is_hidden_name(self, target_name: str, name: object) -> bool:
        normalized = _normalize_name(name)
        if not normalized:
            return False
        blocked_names = self.blocked_by_target.get(_normalize_name(target_name), ())
        return any(
            normalized == blocked_name or normalized.startswith(f"{blocked_name} ")
            for blocked_name in blocked_names
        )

    def is_hidden_record(self, target_name: str, record: object) -> bool:
        if not isinstance(record, dict):
            return False
        blocked_ids = self.blocked_ids_by_target.get(_normalize_name(target_name), ())
        record_id = record.get("id") if "id" in record else record.get("Id")
        if record_id is not None and str(record_id).strip() in blocked_ids:
            return True
        return self.is_hidden_name(target_name, record.get("name") or record.get("Name"))

    def is_hidden_image(self, target_name: str, image_name: object) -> bool:
        blocked_ids = self.blocked_ids_by_target.get(_normalize_name(target_name), ())
        if _image_record_id(image_name) in blocked_ids:
            return True
        return self.is_hidden_name(target_name, _image_display_name(image_name))


@lru_cache(maxsize=4)
def load_hidden_item_rules(path: Path = ALLOWLISTS_PATH) -> HiddenItemRules:
    try:
        allowlists = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return HiddenItemRules({})
    if not isinstance(allowlists, dict):
        return HiddenItemRules({})
    return HiddenItemRules.from_allowlists(allowlists)
