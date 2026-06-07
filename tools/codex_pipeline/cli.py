from __future__ import annotations

import argparse
import json

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
    collect_names,
    validate_drop_references,
    validate_inline_scripts,
    validate_manifest_entries,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Project Rogue Codex data pipeline")
    parser.add_argument("command", choices=["validate", "validate-drops", "validate-site"])
    return parser


def _print_issues(issues: list[ValidationIssue]) -> int:
    for issue in issues:
        print(f"{issue.severity.upper()}: {issue.message}")
    return 1 if any(issue.severity == "error" for issue in issues) else 0


def run_validate() -> int:
    sources = load_drop_sources(DROP_SOURCES_PATH)
    issues: list[ValidationIssue] = []
    weapon_names = collect_names(WEAPONS_DATA_PATH)
    armor_names = collect_names(ARMORS_DATA_PATH)
    monster_names = collect_names(MONSTERS_DATA_PATH)
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
        entries = json.loads(manifest_path.read_text(encoding="utf-8"))
        issues.extend(validate_manifest_entries(folder, entries))
    for path in [
        REPO_ROOT / "pages" / "items" / "armors.html",
        REPO_ROOT / "pages" / "enemies" / "monsters.html",
    ]:
        issues.extend(validate_inline_scripts(str(path.relative_to(REPO_ROOT)), path.read_text(encoding="utf-8")))
    return _print_issues(issues)


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command in {"validate", "validate-drops", "validate-site"}:
        return run_validate()
    parser.error(f"Unsupported command: {args.command}")
    return 2
