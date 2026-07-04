from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from tools.codex_pipeline.config import ALLOWLISTS_PATH


VARIANT_SUFFIX_RE = re.compile(r"\s*-\d+$")


def _normalize_name(value: object) -> str:
    return " ".join(str(value or "").strip().casefold().split())


def _image_display_name(image_name: object) -> str:
    name = Path(str(image_name).replace("\\", "/")).name
    stem = Path(name).stem
    return VARIANT_SUFFIX_RE.sub("", stem).strip()


@dataclass(frozen=True)
class HiddenItemRules:
    blocked_by_target: dict[str, tuple[str, ...]]

    @classmethod
    def from_allowlists(cls, allowlists: dict[str, Any]) -> "HiddenItemRules":
        blocked_by_target: dict[str, tuple[str, ...]] = {}
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
        return cls(blocked_by_target)

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
        return self.is_hidden_name(target_name, record.get("name") or record.get("Name"))

    def is_hidden_image(self, target_name: str, image_name: object) -> bool:
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
