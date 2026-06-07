from __future__ import annotations

import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

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


def validate_inline_scripts(label: str, html: str) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    script_re = re.compile(r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>", re.IGNORECASE)
    for index, match in enumerate(script_re.finditer(html), start=1):
        code = match.group(1).strip()
        if not code:
            continue
        try:
            completed = subprocess.run(
                ["node", "--check", "-"],
                input=code,
                text=True,
                capture_output=True,
            )
        except FileNotFoundError:
            issues.append(ValidationIssue("error", f"{label} inline script #{index} node executable not found"))
            continue
        if completed.returncode != 0:
            lines = (completed.stderr or completed.stdout).strip().splitlines()
            detail = lines[0] if lines else "node --check returned no output"
            issues.append(ValidationIssue("error", f"{label} inline script #{index} failed parse: {detail}"))
    return issues
