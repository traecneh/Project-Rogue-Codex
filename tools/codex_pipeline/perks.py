from __future__ import annotations

import json
from pathlib import Path
from typing import Any


CorruptedPerkOverrides = dict[int, str | None]


def load_perk_label_overrides(path: Path) -> CorruptedPerkOverrides:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("Perk label override root must be an object")
    if raw.get("schemaVersion") != 1:
        raise ValueError(f"Unsupported perk label schemaVersion: {raw.get('schemaVersion')!r}")

    entries = raw.get("corruptedPerkLabels")
    if not isinstance(entries, dict):
        raise ValueError("corruptedPerkLabels must be an object")

    overrides: CorruptedPerkOverrides = {}
    for raw_code, raw_label in entries.items():
        code = _parse_positive_int_key(raw_code)
        if raw_label is None:
            overrides[code] = None
        elif isinstance(raw_label, str) and raw_label.strip():
            overrides[code] = raw_label.strip()
        else:
            raise ValueError(f"corruptedPerkLabels[{raw_code!r}] must be a non-empty string or null")
    return overrides


def _parse_positive_int_key(value: Any) -> int:
    text = str(value).strip()
    if not text.isdigit():
        raise ValueError(f"Corrupted perk override key must be a positive integer string: {value!r}")
    code = int(text)
    if code <= 0:
        raise ValueError(f"Corrupted perk override key must be positive: {value!r}")
    return code
