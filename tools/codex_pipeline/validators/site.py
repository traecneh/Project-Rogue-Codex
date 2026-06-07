from __future__ import annotations

import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

from tools.codex_pipeline.drops import DROP_KINDS, normalize_key


@dataclass(frozen=True)
class ValidationIssue:
    severity: str
    message: str


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def collect_names(path: Path) -> set[str]:
    data = read_json(path)
    if not isinstance(data, list):
        return set()
    return {
        normalize_key(row.get("name"))
        for row in data
        if isinstance(row, dict) and normalize_key(row.get("name"))
    }


def validate_manifest_entries(folder: Path, entries: Iterable[str]) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    actual = {path.name for path in folder.iterdir() if path.is_file()}
    for entry in entries:
        name = Path(str(entry).replace("\\", "/")).name
        if name == "manifest.json":
            issues.append(ValidationIssue("error", f"{folder / 'manifest.json'} manifest includes itself"))
        elif name not in actual:
            issues.append(ValidationIssue("error", f"{folder / 'manifest.json'} lists missing image {name}"))
    return issues


def validate_drop_references(
    sources: dict[str, dict[str, list[str]]],
    *,
    armor_names: set[str],
    weapon_names: set[str],
    monster_names: set[str],
) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    item_sets = {
        "armors": {normalize_key(name) for name in armor_names},
        "weapons": {normalize_key(name) for name in weapon_names},
    }
    monsters = {normalize_key(name) for name in monster_names}

    for kind in DROP_KINDS:
        for item_name, drop_monsters in sources.get(kind, {}).items():
            if normalize_key(item_name) not in item_sets[kind]:
                issues.append(ValidationIssue("error", f"{kind} drop override item not found: {item_name}"))
            for monster_name in drop_monsters:
                if normalize_key(monster_name) not in monsters:
                    issues.append(ValidationIssue("error", f"{kind} drop override monster not found: {monster_name}"))
    return issues


def validate_corrupted_perk_labels(
    item_data_by_kind: dict[str, Iterable[Any]],
    *,
    corrupted_perk_overrides: dict[int, str | None],
) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    for kind, items in item_data_by_kind.items():
        for item in items:
            if not isinstance(item, dict):
                continue
            fields = item.get("fields")
            if not isinstance(fields, dict):
                continue
            code = _int_or_none(fields.get("corrupted_perk"))
            if code is None or not code:
                continue

            name = item.get("name") or f"id {item.get('id')}"
            label = fields.get("corrupted_perk_label")
            expected = corrupted_perk_overrides.get(code)
            if not label:
                if code not in corrupted_perk_overrides:
                    issues.append(
                        ValidationIssue(
                            "error",
                            f"{kind} {name} has unmapped corrupted perk code {code}",
                        )
                    )
                elif expected is not None:
                    issues.append(
                        ValidationIssue(
                            "error",
                            f"{kind} {name} missing expected corrupted perk {code} label {expected!r}",
                        )
                    )
                continue

            if code in corrupted_perk_overrides:
                if expected is None:
                    issues.append(
                        ValidationIssue(
                            "error",
                            f"{kind} {name} corrupted perk {code} is configured as unknown but has label {label!r}",
                        )
                    )
                elif label != expected:
                    issues.append(
                        ValidationIssue(
                            "error",
                            f"{kind} {name} expected corrupted perk {code} label {expected!r}, found {label!r}",
                        )
                    )
    return issues


def _int_or_none(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        stripped = value.strip()
        if stripped and stripped.lstrip("-").isdigit():
            return int(stripped)
    return None


def validate_javascript_source(label: str, code: str) -> list[ValidationIssue]:
    try:
        completed = subprocess.run(
            ["node", "--check", "-"],
            input=code,
            text=True,
            capture_output=True,
        )
    except FileNotFoundError:
        return [ValidationIssue("error", f"{label} node executable not found")]
    if completed.returncode == 0:
        return []

    lines = (completed.stderr or completed.stdout).strip().splitlines()
    detail = lines[0] if lines else "node --check returned no output"
    return [ValidationIssue("error", f"{label} failed parse: {detail}")]


def validate_javascript_file(label: str, path: Path) -> list[ValidationIssue]:
    try:
        code = path.read_text(encoding="utf-8")
    except OSError as exc:
        return [ValidationIssue("error", f"{label} failed to read JavaScript: {exc}")]
    return validate_javascript_source(label, code)


def validate_inline_scripts(label: str, html: str) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    script_re = re.compile(r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>", re.IGNORECASE)
    for index, match in enumerate(script_re.finditer(html), start=1):
        code = match.group(1).strip()
        if not code:
            continue
        issues.extend(validate_javascript_source(f"{label} inline script #{index}", code))
    return issues
