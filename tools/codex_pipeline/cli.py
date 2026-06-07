from __future__ import annotations

import argparse
import json
from pathlib import Path

from tools.codex_pipeline.config import (
    ARMOR_IMAGES_DIR,
    ARMORS_DATA_PATH,
    DROP_SOURCES_PATH,
    MONSTER_IMAGES_DIR,
    MONSTERS_DATA_PATH,
    REPO_ROOT,
    WEAPON_IMAGES_DIR,
    WEAPONS_DATA_PATH,
)
from tools.codex_pipeline.drops import load_drop_sources
from tools.codex_pipeline.validators.site import (
    ValidationIssue,
    read_json,
    validate_drop_references,
    validate_inline_scripts,
    validate_manifest_entries,
)


VALIDATED_HTML_PATHS = [
    REPO_ROOT / "pages" / "items" / "armors.html",
    REPO_ROOT / "pages" / "enemies" / "monsters.html",
]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Project Rogue Codex data pipeline")
    parser.add_argument("command", choices=["validate", "validate-drops", "validate-site"])
    return parser


def _print_issues(issues: list[ValidationIssue]) -> int:
    for issue in issues:
        print(f"{issue.severity.upper()}: {issue.message}")
    return 1 if any(issue.severity == "error" for issue in issues) else 0


def _read_json_issue(path: Path, label: str) -> tuple[object | None, ValidationIssue | None]:
    try:
        return read_json(path), None
    except (OSError, json.JSONDecodeError) as exc:
        return None, ValidationIssue("error", f"{path} failed to read {label}: {exc}")


def _collect_names_for_validation(path: Path) -> tuple[set[str], list[ValidationIssue]]:
    from tools.codex_pipeline.drops import normalize_key

    data, issue = _read_json_issue(path, "data JSON")
    if issue:
        return set(), [issue]
    if not isinstance(data, list):
        return set(), [ValidationIssue("error", f"{path} data JSON must be a list")]
    return {
        normalize_key(row.get("name"))
        for row in data
        if isinstance(row, dict) and normalize_key(row.get("name"))
    }, []


def _load_drop_sources_for_validation(path: Path) -> tuple[dict[str, dict[str, list[str]]] | None, ValidationIssue | None]:
    try:
        return load_drop_sources(path), None
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        return None, ValidationIssue("error", f"{path} failed to read drop sources: {exc}")


def collect_validation_issues() -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    sources, source_issue = _load_drop_sources_for_validation(DROP_SOURCES_PATH)
    if source_issue:
        issues.append(source_issue)

    weapon_names, weapon_issues = _collect_names_for_validation(WEAPONS_DATA_PATH)
    armor_names, armor_issues = _collect_names_for_validation(ARMORS_DATA_PATH)
    monster_names, monster_issues = _collect_names_for_validation(MONSTERS_DATA_PATH)
    issues.extend(weapon_issues)
    issues.extend(armor_issues)
    issues.extend(monster_issues)

    if sources is not None and not (weapon_issues or armor_issues or monster_issues):
        issues.extend(
            validate_drop_references(
                sources,
                armor_names=armor_names,
                weapon_names=weapon_names,
                monster_names=monster_names,
            )
        )

    for folder in [WEAPON_IMAGES_DIR, ARMOR_IMAGES_DIR, MONSTER_IMAGES_DIR]:
        manifest_path = folder / "manifest.json"
        entries, issue = _read_json_issue(manifest_path, "manifest")
        if issue:
            issues.append(issue)
            continue
        if not isinstance(entries, list):
            issues.append(ValidationIssue("error", f"{manifest_path} manifest must be a list"))
            continue
        issues.extend(validate_manifest_entries(folder, entries))

    for path in VALIDATED_HTML_PATHS:
        try:
            label = str(path.relative_to(REPO_ROOT))
        except ValueError:
            label = str(path)
        try:
            html = path.read_text(encoding="utf-8")
        except OSError as exc:
            issues.append(ValidationIssue("error", f"{path} failed to read HTML: {exc}"))
            continue
        issues.extend(validate_inline_scripts(label, html))
    return issues


def run_validate() -> int:
    issues = collect_validation_issues()
    return _print_issues(issues)


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command in {"validate", "validate-drops", "validate-site"}:
        return run_validate()
    parser.error(f"Unsupported command: {args.command}")
    return 2
