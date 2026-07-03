from __future__ import annotations

import argparse
import json
from pathlib import Path

from tools.codex_pipeline.config import (
    ARMOR_IMAGES_DIR,
    ARMORS_DATA_PATH,
    CODEX_MANIFEST_PATH,
    CLIENT_GF_JSON_DIR,
    DROP_SOURCES_PATH,
    GENERATED_ATLAS_ASSET_DIR,
    GENERATED_OUTPUT_DIR,
    CLIENT_LOG_PATH,
    CLIENT_PACK_PATH,
    MONSTER_IMAGES_DIR,
    MONSTERS_DATA_PATH,
    PERK_LABEL_OVERRIDES_PATH,
    REPO_ROOT,
    WEAPON_IMAGES_DIR,
    WEAPONS_DATA_PATH,
)
from tools.codex_pipeline.atlas_assets import extract_atlas_assets_for_targets, generated_atlas_asset_targets
from tools.codex_pipeline.assets import resolve_asset_targets, sync_asset_targets
from tools.codex_pipeline.drop_audit import build_drop_source_audit_report
from tools.codex_pipeline.drops import load_drop_sources
from tools.codex_pipeline.deploy import (
    DEFAULT_DEPLOY_BRANCH,
    DEFAULT_GITHUB_REPO,
    DEFAULT_LIVE_SITE_URL,
    resolve_git_commit,
    verify_live_site,
    wait_for_github_workflows,
)
from tools.codex_pipeline.exports import (
    DEFAULT_EXPORT_TARGETS,
    ExportError,
    build_generated_diff_reports,
    export_client_data,
    resolve_targets,
    sync_generated_outputs,
)
from tools.codex_pipeline.game_update import build_game_update_report
from tools.codex_pipeline.freshness import build_codex_manifest, validate_codex_manifest, write_codex_manifest
from tools.codex_pipeline.perks import load_perk_label_overrides
from tools.codex_pipeline.sources import inspect_export_source_package, validate_export_sources
from tools.codex_pipeline.site_smoke import run_site_smoke as run_site_smoke_command
from tools.codex_pipeline.site_coverage import SiteCoverageReport, build_site_coverage_report
from tools.codex_pipeline.unknowns import build_unknown_field_reports
from tools.codex_pipeline.vpack import VpackError, decrypt_vpack, inspect_vpack, resolve_vpack_output_path
from tools.codex_pipeline.validators.site import (
    ValidationIssue,
    read_json,
    validate_corrupted_perk_labels,
    validate_css_file,
    validate_drop_references,
    validate_inline_styles,
    validate_inline_scripts,
    validate_javascript_file,
    validate_manifest_entries,
    validate_style_attributes,
)


VALIDATED_HTML_PATHS = [
    REPO_ROOT / "index.html",
    REPO_ROOT / "pages" / "General" / "build-planner.html",
    REPO_ROOT / "pages" / "General" / "play-the-game.html",
    REPO_ROOT / "pages" / "items" / "weapons.html",
    REPO_ROOT / "pages" / "items" / "armors.html",
    REPO_ROOT / "pages" / "enemies" / "monsters.html",
    REPO_ROOT / "pages" / "systems" / "perks.html",
    REPO_ROOT / "pages" / "systems" / "rarity.html",
    REPO_ROOT / "pages" / "systems" / "re-roll.html",
    REPO_ROOT / "pages" / "systems" / "deconstruct.html",
    REPO_ROOT / "pages" / "systems" / "ascend.html",
    REPO_ROOT / "pages" / "systems" / "purge.html",
    REPO_ROOT / "pages" / "systems" / "encounter.html",
    REPO_ROOT / "pages" / "systems" / "pvp-system.html",
    REPO_ROOT / "pages" / "systems" / "anti-zerg.html",
    REPO_ROOT / "pages" / "systems" / "monster-damage-reduction.html",
    REPO_ROOT / "pages" / "systems" / "experience.html",
    REPO_ROOT / "pages" / "stats" / "level.html",
    REPO_ROOT / "pages" / "stats" / "skills.html",
    REPO_ROOT / "pages" / "stats" / "races.html",
    REPO_ROOT / "pages" / "stats" / "strength.html",
    REPO_ROOT / "pages" / "stats" / "constitution.html",
    REPO_ROOT / "pages" / "stats" / "dexterity.html",
    REPO_ROOT / "pages" / "stats" / "resistances.html",
    REPO_ROOT / "pages" / "systems" / "guild.html",
    REPO_ROOT / "pages" / "systems" / "chat.html",
    REPO_ROOT / "pages" / "systems" / "floor-cleanup.html",
    REPO_ROOT / "pages" / "systems" / "corruption.html",
    REPO_ROOT / "pages" / "systems" / "craft.html",
    REPO_ROOT / "pages" / "systems" / "imbuements.html",
    REPO_ROOT / "pages" / "systems" / "crafting.html",
]

VALIDATED_STYLE_PATHS = [
    REPO_ROOT / "css" / "styles.css",
    REPO_ROOT / "css" / "home.css",
    REPO_ROOT / "css" / "build-planner.css",
    REPO_ROOT / "css" / "play-the-game.css",
    REPO_ROOT / "css" / "weapons.css",
    REPO_ROOT / "css" / "armors.css",
    REPO_ROOT / "css" / "monsters.css",
    REPO_ROOT / "css" / "perks.css",
    REPO_ROOT / "css" / "rarity.css",
    REPO_ROOT / "css" / "reroll.css",
    REPO_ROOT / "css" / "deconstruct.css",
    REPO_ROOT / "css" / "ascend.css",
    REPO_ROOT / "css" / "purge.css",
    REPO_ROOT / "css" / "encounter.css",
    REPO_ROOT / "css" / "pvp.css",
    REPO_ROOT / "css" / "anti-zerg.css",
    REPO_ROOT / "css" / "monster-damage-reduction.css",
    REPO_ROOT / "css" / "experience.css",
    REPO_ROOT / "css" / "level.css",
    REPO_ROOT / "css" / "skills.css",
    REPO_ROOT / "css" / "races.css",
    REPO_ROOT / "css" / "strength.css",
    REPO_ROOT / "css" / "constitution.css",
    REPO_ROOT / "css" / "dexterity.css",
    REPO_ROOT / "css" / "resistances.css",
    REPO_ROOT / "css" / "guild.css",
    REPO_ROOT / "css" / "chat.css",
    REPO_ROOT / "css" / "floor-cleanup.css",
    REPO_ROOT / "css" / "corruption.css",
    REPO_ROOT / "css" / "craft.css",
    REPO_ROOT / "css" / "imbuements.css",
    REPO_ROOT / "css" / "crafting.css",
]

VALIDATED_SCRIPT_PATHS = [
    REPO_ROOT / "js" / "utils.js",
    REPO_ROOT / "js" / "home.js",
    REPO_ROOT / "js" / "items-page-utils.js",
    REPO_ROOT / "js" / "build-planner.js",
    REPO_ROOT / "js" / "play-the-game.js",
    REPO_ROOT / "js" / "weapons-page.js",
    REPO_ROOT / "js" / "armors-page.js",
    REPO_ROOT / "js" / "monsters-page.js",
    REPO_ROOT / "js" / "perk-calculations.js",
    REPO_ROOT / "js" / "perks-page.js",
    REPO_ROOT / "js" / "rarity-roller.js",
    REPO_ROOT / "js" / "anti-zerg.js",
    REPO_ROOT / "js" / "monster-damage-reduction.js",
    REPO_ROOT / "js" / "experience.js",
    REPO_ROOT / "js" / "level.js",
    REPO_ROOT / "js" / "skills.js",
    REPO_ROOT / "js" / "races.js",
    REPO_ROOT / "js" / "strength.js",
    REPO_ROOT / "js" / "constitution.js",
    REPO_ROOT / "js" / "dexterity.js",
    REPO_ROOT / "js" / "resistances.js",
    REPO_ROOT / "js" / "guild.js",
    REPO_ROOT / "js" / "chat.js",
    REPO_ROOT / "js" / "floor-cleanup.js",
    REPO_ROOT / "js" / "crafting-page.js",
]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Project Rogue Codex data pipeline")
    parser.add_argument(
        "command",
        choices=[
            "validate",
            "validate-drops",
            "validate-site",
            "export-client-data",
            "sync-generated",
            "diff-generated",
            "export-sync",
            "verify-deploy",
            "verify-live",
            "doctor",
            "validate-sources",
            "source-inventory",
            "vpack-info",
            "vpack-extract",
            "unknown-fields",
            "drop-report",
            "game-update-report",
            "sync-assets",
            "extract-atlas-assets",
            "refresh-manifest",
            "game-update-workflow",
            "smoke-site",
            "site-coverage",
        ],
    )
    parser.add_argument(
        "--target",
        action="append",
        choices=sorted(DEFAULT_EXPORT_TARGETS),
        dest="targets",
        help="Limit export/sync to one target. Can be passed multiple times.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=GENERATED_OUTPUT_DIR,
        help="Intermediate generated-output directory.",
    )
    parser.add_argument(
        "--asset-output-dir",
        type=Path,
        default=GENERATED_ATLAS_ASSET_DIR,
        help="Generated atlas image output directory for extract-atlas-assets.",
    )
    parser.add_argument(
        "--gf-json-dir",
        type=Path,
        default=CLIENT_GF_JSON_DIR,
        help="Client gf_json directory for extract-atlas-assets.",
    )
    parser.add_argument(
        "--asset-source",
        choices=["auto", "client", "atlas"],
        default="auto",
        help="Image source for game-update-report/sync-assets. auto uses atlas output when legacy client images are absent.",
    )
    parser.add_argument(
        "--write-summary",
        action="store_true",
        help="For game-update-report, write a Markdown review summary artifact.",
    )
    parser.add_argument(
        "--review-checklist",
        action="store_true",
        help="For game-update-report/game-update-workflow, print a short review checklist before applying changes.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="For sync-generated/export-sync/sync-assets, report site file changes without copying.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="For game-update-workflow, apply reviewed generated data and asset syncs after dry-run previews.",
    )
    parser.add_argument(
        "--force-apply",
        action="store_true",
        help="For game-update-workflow, continue applying even when the game update report marks sync readiness as blocked.",
    )
    parser.add_argument(
        "--verify-live",
        action="store_true",
        help="For game-update-workflow, run verify-live after review/apply steps.",
    )
    parser.add_argument(
        "--github-repo",
        default=DEFAULT_GITHUB_REPO,
        help="GitHub owner/repo for verify-deploy.",
    )
    parser.add_argument(
        "--branch",
        default=DEFAULT_DEPLOY_BRANCH,
        help="GitHub branch for verify-deploy.",
    )
    parser.add_argument(
        "--commit",
        help="Commit SHA for verify-deploy. Defaults to the current local HEAD.",
    )
    parser.add_argument(
        "--deploy-timeout-seconds",
        type=float,
        default=480,
        help="Maximum time to wait for GitHub Actions and Pages in verify-deploy.",
    )
    parser.add_argument(
        "--poll-seconds",
        type=float,
        default=10,
        help="Polling interval for GitHub Actions and Pages in verify-deploy.",
    )
    parser.add_argument(
        "--site-url",
        default=DEFAULT_LIVE_SITE_URL,
        help="Public site URL for verify-live, smoke-site --live, and verify-deploy.",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=float,
        default=20,
        help="HTTP timeout for verify-live requests.",
    )
    parser.add_argument(
        "--source",
        choices=["site", "generated"],
        default="site",
        help="Data source for unknown-fields.",
    )
    parser.add_argument(
        "--max-samples",
        type=int,
        default=3,
        help="Maximum nonzero record samples per unknown field.",
    )
    parser.add_argument(
        "--smoke-timeout-ms",
        type=int,
        default=20_000,
        help="Timeout in milliseconds for each local site smoke-test action.",
    )
    parser.add_argument(
        "--live",
        action="store_true",
        help="For smoke-site, run page behavior checks against --site-url instead of a local server.",
    )
    parser.add_argument(
        "--pack-path",
        type=Path,
        help="For vpack-info, inspect this VPACK file instead of the configured client pack.",
    )
    parser.add_argument(
        "--log-path",
        type=Path,
        help="For vpack-info, read this client log for observed packed file loads.",
    )
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


def _collect_item_data_for_validation(path: Path) -> tuple[list[object], list[ValidationIssue]]:
    data, issue = _read_json_issue(path, "data JSON")
    if issue:
        return [], [issue]
    if not isinstance(data, list):
        return [], [ValidationIssue("error", f"{path} data JSON must be a list")]
    return data, []


def _load_drop_sources_for_validation(path: Path) -> tuple[dict[str, dict[str, list[str]]] | None, ValidationIssue | None]:
    try:
        return load_drop_sources(path), None
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        return None, ValidationIssue("error", f"{path} failed to read drop sources: {exc}")


def _load_perk_label_overrides_for_validation(path: Path) -> tuple[dict[int, str | None] | None, ValidationIssue | None]:
    try:
        return load_perk_label_overrides(path), None
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        return None, ValidationIssue("error", f"{path} failed to read perk label overrides: {exc}")


def collect_validation_issues() -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    sources, source_issue = _load_drop_sources_for_validation(DROP_SOURCES_PATH)
    if source_issue:
        issues.append(source_issue)
    perk_overrides, perk_override_issue = _load_perk_label_overrides_for_validation(PERK_LABEL_OVERRIDES_PATH)
    if perk_override_issue:
        issues.append(perk_override_issue)

    weapon_names, weapon_issues = _collect_names_for_validation(WEAPONS_DATA_PATH)
    armor_names, armor_issues = _collect_names_for_validation(ARMORS_DATA_PATH)
    monster_names, monster_issues = _collect_names_for_validation(MONSTERS_DATA_PATH)
    issues.extend(weapon_issues)
    issues.extend(armor_issues)
    issues.extend(monster_issues)

    weapon_items, weapon_item_issues = _collect_item_data_for_validation(WEAPONS_DATA_PATH)
    armor_items, armor_item_issues = _collect_item_data_for_validation(ARMORS_DATA_PATH)
    issues.extend(weapon_item_issues)
    issues.extend(armor_item_issues)

    if sources is not None and not (weapon_issues or armor_issues or monster_issues):
        issues.extend(
            validate_drop_references(
                sources,
                armor_names=armor_names,
                weapon_names=weapon_names,
                monster_names=monster_names,
            )
        )
    if perk_overrides is not None and not (weapon_item_issues or armor_item_issues):
        issues.extend(
            validate_corrupted_perk_labels(
                {"weapons": weapon_items, "armors": armor_items},
                corrupted_perk_overrides=perk_overrides,
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
        issues.extend(validate_inline_styles(label, html))
        issues.extend(validate_style_attributes(label, html))
        issues.extend(validate_inline_scripts(label, html))

    for path in VALIDATED_STYLE_PATHS:
        try:
            label = str(path.relative_to(REPO_ROOT))
        except ValueError:
            label = str(path)
        issues.extend(validate_css_file(label, path))

    for path in VALIDATED_SCRIPT_PATHS:
        try:
            label = str(path.relative_to(REPO_ROOT))
        except ValueError:
            label = str(path)
        issues.extend(validate_javascript_file(label, path))
    issues.extend(validate_codex_manifest(manifest_path=CODEX_MANIFEST_PATH))
    return issues


def run_validate() -> int:
    issues = collect_validation_issues()
    return _print_issues(issues)


def _print_export_results(results) -> None:
    for result in results:
        print(f"EXPORTED {result.target.name}: {result.generated_path}")


def _print_sync_results(results) -> None:
    for result in results:
        status = "WOULD SYNC" if result.dry_run and result.changed else "SYNCED" if result.changed else "UNCHANGED"
        print(f"{status} {result.target.name}: {result.generated_path} -> {result.site_path}")


def _format_value(value) -> str:
    return json.dumps(value, ensure_ascii=True, sort_keys=True)


def _print_diff_reports(reports, *, max_records: int = 12, max_fields: int = 8) -> None:
    for report in reports:
        print(
            f"DIFF {report.target.name}: "
            f"+{len(report.added)} -{len(report.removed)} ~{len(report.changed)} "
            f"({report.generated_path} -> {report.site_path})"
        )
        if not report.has_changes:
            continue

        for label in report.added[:max_records]:
            print(f"  + {label}")
        if len(report.added) > max_records:
            print(f"  + ... {len(report.added) - max_records} more")

        for label in report.removed[:max_records]:
            print(f"  - {label}")
        if len(report.removed) > max_records:
            print(f"  - ... {len(report.removed) - max_records} more")

        for record in report.changed[:max_records]:
            print(f"  ~ {record.label}: {len(record.field_changes)} field change(s)")
            for change in record.field_changes[:max_fields]:
                print(f"    {change.path}: {_format_value(change.old_value)} -> {_format_value(change.new_value)}")
            if len(record.field_changes) > max_fields:
                print(f"    ... {len(record.field_changes) - max_fields} more field change(s)")
        if len(report.changed) > max_records:
            print(f"  ~ ... {len(report.changed) - max_records} more changed record(s)")


def _print_player_summary_values(label: str, values: list[str], *, max_records: int) -> None:
    for value in values[:max_records]:
        print(f"  {label}: {value}")
    if len(values) > max_records:
        print(f"  {label}: ... {len(values) - max_records} more")


def _format_player_field_paths(record, *, max_fields: int) -> str:
    paths = [change.path for change in record.field_changes]
    if not paths:
        return "record changed"
    visible = paths[:max_fields]
    suffix = f", ... {len(paths) - max_fields} more" if len(paths) > max_fields else ""
    return f"{', '.join(visible)}{suffix}"


def _player_change_counts(report) -> tuple[int, int, int, int, int, int]:
    return (
        sum(len(diff.added) for diff in report.diff_reports),
        sum(len(diff.removed) for diff in report.diff_reports),
        sum(len(diff.changed) for diff in report.diff_reports),
        sum(len(asset.added) for asset in report.asset_reports),
        sum(len(asset.removed) for asset in report.asset_reports),
        sum(len(asset.changed) for asset in report.asset_reports),
    )


def _print_player_change_summary(report, *, max_records: int = 5, max_fields: int = 5) -> None:
    data_added, data_removed, data_changed, image_added, image_removed, image_changed = _player_change_counts(report)

    if not any([data_added, data_removed, data_changed, image_added, image_removed, image_changed]):
        print("PLAYER CHANGE SUMMARY: no player-facing data or image changes")
        return

    print(
        "PLAYER CHANGE SUMMARY: "
        f"data +{data_added} -{data_removed} ~{data_changed}, "
        f"images +{image_added} -{image_removed} ~{image_changed}"
    )

    for diff in report.diff_reports:
        if not diff.has_changes:
            continue
        print(f"PLAYER DATA {diff.target.name}: +{len(diff.added)} -{len(diff.removed)} ~{len(diff.changed)}")
        _print_player_summary_values("added", diff.added, max_records=max_records)
        _print_player_summary_values("removed", diff.removed, max_records=max_records)
        for record in diff.changed[:max_records]:
            fields = _format_player_field_paths(record, max_fields=max_fields)
            print(f"  changed: {record.label}: {fields}")
        if len(diff.changed) > max_records:
            print(f"  changed: ... {len(diff.changed) - max_records} more")

    for asset in report.asset_reports:
        if not asset.has_changes:
            continue
        print(f"PLAYER IMAGES {asset.target_name}: +{len(asset.added)} -{len(asset.removed)} ~{len(asset.changed)}")
        _print_player_summary_values("added", asset.added, max_records=max_records)
        _print_player_summary_values("removed", asset.removed, max_records=max_records)
        _print_player_summary_values("changed", asset.changed, max_records=max_records)


def _review_note_count(report) -> int:
    count = len(report.validation_issues) + len(report.export_errors) + len(report.skipped_sections)
    count += sum(1 for check in report.source_checks if not check.ok)
    count += sum(len(asset.issues) for asset in report.asset_reports)
    if report.drop_report is not None:
        count += len(report.drop_report.validation_issues)
    return count


def _format_apply_decision(report) -> str:
    if report.has_errors:
        return "blocked - resolve errors before applying"
    if any(asset.has_changes for asset in report.asset_reports):
        return "blocked - review image changes before applying"
    if report.has_changes:
        return "safe after reviewing data changes"
    return "safe - no player-facing changes detected"


def _print_game_update_review_checklist(report) -> None:
    data_added, data_removed, data_changed, image_added, image_removed, image_changed = _player_change_counts(report)
    status = "READY" if report.safe_to_sync else "BLOCKED"
    print(f"GAME UPDATE CHECKLIST: {status}")
    print(f"CHECK DATA: +{data_added} -{data_removed} ~{data_changed}")
    print(f"CHECK IMAGES: +{image_added} -{image_removed} ~{image_changed}")
    print(f"CHECK REVIEW NOTES: {_review_note_count(report)}")
    print("[ ] Review player data changes")
    print("[ ] Review image changes")
    print("[ ] Review warnings or skipped sections")
    print(f"[ ] Confirm --apply decision: {_format_apply_decision(report)}")


def _extend_markdown_values(lines: list[str], label: str, values: list[str], *, max_records: int) -> None:
    for value in values[:max_records]:
        lines.append(f"- {label}: {value}")
    if len(values) > max_records:
        lines.append(f"- {label}: ... {len(values) - max_records} more")


def _target_heading(name: str) -> str:
    return name[:1].upper() + name[1:]


def build_game_update_summary_markdown(report, *, max_records: int = 12, max_fields: int = 8) -> str:
    data_added, data_removed, data_changed, image_added, image_removed, image_changed = _player_change_counts(report)
    lines = [
        "# Project Rogue Codex Game Update Summary",
        "",
        "## Overview",
        f"- Data: +{data_added} -{data_removed} ~{data_changed}",
        f"- Images: +{image_added} -{image_removed} ~{image_changed}",
        f"- Review status: {'changes detected' if report.has_changes else 'no generated data changes'}",
        f"- Sync readiness: {'OK' if report.safe_to_sync else 'BLOCKED'}",
        "",
        "## Data Changes",
    ]

    data_sections = [diff for diff in report.diff_reports if diff.has_changes]
    if not data_sections:
        lines.append("- No player-facing data changes.")
    for diff in data_sections:
        lines.extend(
            [
                "",
                f"### {_target_heading(diff.target.name)}",
                f"- Totals: +{len(diff.added)} -{len(diff.removed)} ~{len(diff.changed)}",
            ]
        )
        _extend_markdown_values(lines, "Added", diff.added, max_records=max_records)
        _extend_markdown_values(lines, "Removed", diff.removed, max_records=max_records)
        for record in diff.changed[:max_records]:
            fields = _format_player_field_paths(record, max_fields=max_fields)
            lines.append(f"- Changed: {record.label}: {fields}")
        if len(diff.changed) > max_records:
            lines.append(f"- Changed: ... {len(diff.changed) - max_records} more")

    lines.extend(["", "## Image Changes"])
    image_sections = [asset for asset in report.asset_reports if asset.has_changes]
    if not image_sections:
        lines.append("- No image changes.")
    for asset in image_sections:
        lines.extend(
            [
                "",
                f"### {_target_heading(asset.target_name)}",
                f"- Totals: +{len(asset.added)} -{len(asset.removed)} ~{len(asset.changed)}",
            ]
        )
        _extend_markdown_values(lines, "Added", asset.added, max_records=max_records)
        _extend_markdown_values(lines, "Removed", asset.removed, max_records=max_records)
        _extend_markdown_values(lines, "Changed", asset.changed, max_records=max_records)

    review_notes = [
        f"{issue.severity.upper()}: {issue.message}"
        for issue in report.validation_issues
    ]
    review_notes.extend(f"EXPORT ERROR: {error}" for error in report.export_errors)
    review_notes.extend(f"SKIPPED: {section}" for section in report.skipped_sections)

    lines.extend(["", "## Review Notes"])
    if review_notes:
        lines.extend(f"- {note}" for note in review_notes)
    else:
        lines.append("- No warnings or skipped review sections.")

    return "\n".join(lines).rstrip() + "\n"


def _write_game_update_summary(report, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(build_game_update_summary_markdown(report), encoding="utf-8", newline="\n")
    return path


def run_export_client_data(args: argparse.Namespace) -> int:
    try:
        targets = resolve_targets(args.targets)
        results = export_client_data(targets, output_dir=args.output_dir)
    except ExportError as exc:
        print(f"ERROR: {exc}")
        return 1
    _print_export_results(results)
    return 0


def run_sync_generated(args: argparse.Namespace) -> int:
    try:
        targets = resolve_targets(args.targets)
        results = sync_generated_outputs(targets, output_dir=args.output_dir, dry_run=args.dry_run)
        diff_reports = build_generated_diff_reports(targets, output_dir=args.output_dir) if args.dry_run else []
    except ExportError as exc:
        print(f"ERROR: {exc}")
        return 1
    _print_sync_results(results)
    if args.dry_run:
        _print_diff_reports(diff_reports)
        return 0
    refresh_code = run_refresh_manifest()
    if refresh_code != 0:
        return refresh_code
    return run_validate()


def run_diff_generated(args: argparse.Namespace) -> int:
    try:
        targets = resolve_targets(args.targets)
        reports = build_generated_diff_reports(targets, output_dir=args.output_dir)
    except ExportError as exc:
        print(f"ERROR: {exc}")
        return 1
    _print_diff_reports(reports)
    return 0


def run_export_sync(args: argparse.Namespace) -> int:
    export_code = run_export_client_data(args)
    if export_code != 0:
        return export_code
    return run_sync_generated(args)


def run_verify_live(args: argparse.Namespace) -> int:
    results = verify_live_site(args.site_url, timeout_seconds=args.timeout_seconds)
    for result in results:
        status = "OK" if result.ok else "ERROR"
        print(f"LIVE {status} {result.label}: {result.message} ({result.url})")
    return 0 if all(result.ok for result in results) else 1


def run_smoke_site(args: argparse.Namespace) -> int:
    if args.live:
        result = run_site_smoke_command(timeout_ms=args.smoke_timeout_ms, base_url=args.site_url)
    else:
        result = run_site_smoke_command(timeout_ms=args.smoke_timeout_ms)
    if result.stdout:
        print(result.stdout.rstrip())
    if result.stderr:
        print(result.stderr.rstrip())
    return result.returncode


def _print_page_group(label: str, pages) -> None:
    for page in pages:
        print(f"{label} {page.path}: {page.title}")


def _print_site_coverage_report(report: SiteCoverageReport) -> None:
    print(
        f"SITE COVERAGE: {report.linked_page_count} linked page(s), "
        f"{report.validated_count} validated, {report.smoked_count} smoked, "
        f"{len(report.missing_files)} missing file(s), "
        f"{len(report.nav_only_pages)} nav-only, {len(report.search_only_pages)} search-only"
    )
    _print_page_group("MISSING", report.missing_files)
    _print_page_group("NAV ONLY", report.nav_only_pages)
    _print_page_group("SEARCH ONLY", report.search_only_pages)
    _print_page_group("UNVALIDATED", report.unvalidated_pages)
    _print_page_group("UNSMOKED", report.unsmoked_pages)


def run_site_coverage() -> int:
    report = build_site_coverage_report(REPO_ROOT, validated_html_paths=VALIDATED_HTML_PATHS)
    _print_site_coverage_report(report)
    return 1 if report.has_errors else 0


def run_verify_deploy(args: argparse.Namespace) -> int:
    commit_sha = args.commit or resolve_git_commit()
    print(f"DEPLOY WAIT {args.github_repo}@{commit_sha[:7]} on {args.branch}")
    workflow_results = wait_for_github_workflows(
        args.github_repo,
        args.branch,
        commit_sha,
        timeout_seconds=args.deploy_timeout_seconds,
        poll_seconds=args.poll_seconds,
    )
    for result in workflow_results:
        status = "OK" if result.ok else "ERROR"
        conclusion = f" {result.conclusion}" if result.conclusion else ""
        print(f"DEPLOY {status} {result.name}: {result.status}{conclusion} ({result.url})")
    if not all(result.ok for result in workflow_results):
        return 1

    verify_code = _run_workflow_step("verify-live", run_verify_live, args)
    if verify_code != 0:
        return verify_code
    return _run_workflow_step("smoke-site --live", run_smoke_site, _args_with(args, live=True))


def run_refresh_manifest(args: argparse.Namespace | None = None) -> int:
    try:
        manifest = build_codex_manifest()
        write_codex_manifest(manifest, CODEX_MANIFEST_PATH)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"ERROR: failed to refresh codex manifest: {exc}")
        return 1
    summary = manifest["summary"]
    print(
        "MANIFEST OK data/codex_manifest.json: "
        f"records={summary['data_records']} assets={summary['asset_entries']} "
        f"content={str(summary['content_sha256'])[:12]}"
    )
    return 0


def run_doctor(args: argparse.Namespace) -> int:
    try:
        targets = resolve_targets(args.targets)
    except ExportError as exc:
        print(f"ERROR: {exc}")
        return 1
    results = validate_export_sources(targets)
    for result in results:
        status = "OK" if result.ok else "ERROR"
        print(f"DOCTOR {status} {result.target} {result.check}: {result.message}")
    return 0 if all(result.ok for result in results) else 1


def run_source_inventory(args: argparse.Namespace) -> int:
    try:
        targets = resolve_targets(args.targets)
    except ExportError as exc:
        print(f"ERROR: {exc}")
        return 1

    report = inspect_export_source_package(targets)
    print(
        "SOURCE INVENTORY: "
        f"{report.legacy_source_count} legacy .dat source(s), "
        f"{report.packed_source_count} packed VPACK source(s), "
        f"{report.missing_source_count} missing source(s)"
    )
    for check in report.source_checks:
        status = "OK" if check.ok else "ERROR"
        print(f"SOURCE {status} {check.target}: {check.message}")

    for source in report.vpack_sources:
        if not source.exists:
            print(f"VPACK NOT FOUND: {source.path}")
            continue
        status = "VPACK FOUND" if source.is_vpack else "VPACK UNKNOWN"
        details = f"{status}: {source.path} size={source.size_bytes} sha256={source.sha256} header={source.header_hex}"
        if source.error:
            details = f"{details} error={source.error}"
        print(details)

    if report.export_ready:
        print("EXPORT READINESS: READY")
        return 0

    if any(source.exists and source.is_vpack for source in report.vpack_sources):
        print("EXPORT READINESS: BLOCKED - one or more targets cannot use packed VPACK JSON yet")
    else:
        print("EXPORT READINESS: BLOCKED - source data is missing")
    return 1


def run_vpack_info(args: argparse.Namespace) -> int:
    pack_path = args.pack_path or CLIENT_PACK_PATH
    log_path = args.log_path or CLIENT_LOG_PATH
    report = inspect_vpack(pack_path, log_path=log_path)

    print(f"VPACK INFO: {report.path}")
    if not report.exists:
        for issue in report.issues:
            print(f"VPACK ISSUE ERROR: {issue}")
        return 1

    print(
        "HEADER: "
        f"magic={report.magic} schema={report.schema_version} build={report.build_version} "
        f"crypto={report.crypto_id} compression={report.compression_id} "
        f"size={report.size_bytes} header={report.header_size}"
    )
    print(
        "CIPHERTEXT: "
        f"offset={report.ciphertext_offset} length={report.ciphertext_length} "
        f"trailing={report.trailing_bytes} fits={'yes' if report.ciphertext_fits else 'no'}"
    )
    print(f"AUTH TAG CANDIDATE: {report.auth_tag_candidate_hex}")
    print(f"NONCE CANDIDATE: {report.nonce_candidate_hex}")

    if report.log_path:
        if report.log_build_version is None and report.log_file_count is None and not report.log_loaded_files:
            print(f"CLIENT LOG: no pack observations found ({report.log_path})")
        else:
            print(
                "CLIENT LOG: "
                f"build={report.log_build_version} files={report.log_file_count} "
                f"observed={len(report.log_loaded_files)} ({report.log_path})"
            )
            for file_name in report.log_loaded_files:
                print(f"LOG FILE {file_name}")

    for issue in report.issues:
        print(f"VPACK ISSUE ERROR: {issue}")

    if not report.header_valid:
        print("DECRYPTION: skipped because the VPACK header is invalid")
        return 1

    try:
        decrypted = decrypt_vpack(pack_path, log_path=log_path)
    except VpackError as exc:
        print(f"DECRYPTION: failed - {exc}")
        return 1

    manifest = decrypted.manifest
    print(
        "MANIFEST: "
        f"schema={manifest['schema_version']} build={manifest['build_version']} "
        f"compression={manifest['compression']} files={len(decrypted.files)}"
    )
    for file in decrypted.files:
        print(
            f"MANIFEST FILE {file.path}: "
            f"original={file.original_size} compressed={file.compressed_size} sha256={'ok' if file.sha256_ok else 'error'}"
        )
    print("DECRYPTION: supported by Codex pipeline")
    return 0


def run_vpack_extract(args: argparse.Namespace) -> int:
    pack_path = args.pack_path or CLIENT_PACK_PATH
    output_dir = args.output_dir
    try:
        decrypted = decrypt_vpack(pack_path, log_path=args.log_path or CLIENT_LOG_PATH)
        for file in decrypted.files:
            output_path = resolve_vpack_output_path(output_dir, file.path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_bytes(file.data)
            print(
                f"VPACK EXTRACTED {file.path}: {output_path} "
                f"original={file.original_size} compressed={file.compressed_size} sha256=ok"
            )
    except (OSError, VpackError) as exc:
        print(f"ERROR: failed to extract VPACK: {exc}")
        return 1
    print(f"VPACK EXTRACT SUMMARY: {len(decrypted.files)} file(s) -> {output_dir}")
    return 0


def _format_report_values(values) -> str:
    return ", ".join(_format_value(value) for value in values)


def _print_unknown_field_reports(reports) -> None:
    for report in reports:
        nonzero_field_count = sum(1 for field in report.fields if field.nonzero_count)
        print(
            f"UNKNOWN FIELDS {report.target_name}: "
            f"{len(report.fields)} field(s), {nonzero_field_count} with nonzero values "
            f"({report.data_path})"
        )
        for field in report.fields:
            sample_text = "; ".join(field.samples) if field.samples else ""
            print(
                f"  {field.name}: records={field.record_count} "
                f"nonzero={field.nonzero_count} values=[{_format_report_values(field.values)}] "
                f"samples={sample_text}"
            )


def _print_unknown_field_summaries(reports) -> None:
    for report in reports:
        nonzero_field_count = sum(1 for field in report.fields if field.nonzero_count)
        print(
            f"UNKNOWN SUMMARY {report.target_name}: "
            f"{len(report.fields)} field(s), {nonzero_field_count} with nonzero values "
            f"({report.data_path})"
        )


def run_unknown_fields(args: argparse.Namespace) -> int:
    if args.max_samples < 0:
        print("ERROR: --max-samples must be 0 or greater")
        return 1
    try:
        targets = resolve_targets(args.targets)
        reports = build_unknown_field_reports(
            targets,
            source=args.source,
            output_dir=args.output_dir,
            max_samples=args.max_samples,
        )
    except ExportError as exc:
        print(f"ERROR: {exc}")
        return 1
    _print_unknown_field_reports(reports)
    return 0


def _print_drop_report(report) -> None:
    print(
        f"DROP SOURCES: {report.item_override_count} item override(s), "
        f"{report.monster_count} monster loot view(s) ({report.drop_sources_path})"
    )
    print(f"DROP VALIDATION: {len(report.validation_issues)} issue(s)")
    for issue in report.validation_issues:
        print(f"DROP ISSUE {issue.severity.upper()}: {issue.message}")

    for item in report.item_overrides:
        print(f"ITEM {item.kind} {item.item_name}: {', '.join(item.monster_names)}")

    for monster in report.monster_loot:
        parts = []
        if monster.armors:
            parts.append(f"armors={', '.join(monster.armors)}")
        if monster.weapons:
            parts.append(f"weapons={', '.join(monster.weapons)}")
        print(f"MONSTER {monster.monster_name} [{monster.monster_slug}]: {'; '.join(parts)}")


def run_drop_report() -> int:
    try:
        report = build_drop_source_audit_report()
    except ExportError as exc:
        print(f"ERROR: {exc}")
        return 1
    _print_drop_report(report)
    return 0 if not any(issue.severity == "error" for issue in report.validation_issues) else 1


def _print_drop_report_summary(report) -> None:
    print(
        f"DROP SUMMARY: {report.item_override_count} item override(s), "
        f"{report.monster_count} monster loot view(s), "
        f"{len(report.validation_issues)} issue(s) ({report.drop_sources_path})"
    )
    for issue in report.validation_issues:
        print(f"DROP ISSUE {issue.severity.upper()}: {issue.message}")


def _print_asset_report_summaries(reports) -> None:
    for report in reports:
        print(
            f"ASSET SUMMARY {report.target_name}: "
            f"+{len(report.added)} -{len(report.removed)} ~{len(report.changed)}, "
            f"manifest entries={report.manifest_count}, issues={len(report.issues)} "
            f"({report.client_dir} -> {report.site_dir})"
        )
        for issue in report.issues:
            print(f"ASSET ISSUE {issue.severity.upper()}: {issue.message}")


def _print_asset_sync_reports(reports) -> None:
    for report in reports:
        mode = "DRY-RUN" if report.dry_run else "APPLIED"
        print(
            f"ASSET SYNC {mode} {report.target_name}: "
            f"copied {len(report.copied)}, removed {len(report.removed)}, "
            f"manifest entries={report.manifest_count}, issues={len(report.issues)} "
            f"({report.client_dir} -> {report.site_dir})"
        )
        for issue in report.issues:
            print(f"ASSET SYNC ISSUE {issue.severity.upper()}: {issue.message}")


def _print_atlas_extraction_reports(reports) -> None:
    for report in reports:
        print(
            f"ATLAS EXTRACT {report.target_name}: "
            f"wrote {len(report.written)}, skipped {len(report.skipped)}, issues={len(report.issues)} "
            f"({report.atlas_path} -> {report.output_dir})"
        )
        for issue in report.issues:
            print(f"ATLAS ISSUE {issue.severity.upper()}: {issue.message}")


def _print_game_update_report(report) -> None:
    print(f"GAME UPDATE REPORT: {report.output_dir}")
    for check in report.source_checks:
        status = "OK" if check.ok else "ERROR"
        print(f"SOURCE {status} {check.target} {check.check}: {check.message}")

    for error in report.export_errors:
        print(f"EXPORT ERROR: {error}")

    if report.export_results:
        _print_export_results(report.export_results)
    _print_player_change_summary(report)
    if report.diff_reports:
        _print_diff_reports(report.diff_reports)
    if report.unknown_reports:
        _print_unknown_field_summaries(report.unknown_reports)
    if report.asset_reports:
        _print_asset_report_summaries(report.asset_reports)
    if report.drop_report is not None:
        _print_drop_report_summary(report.drop_report)

    for issue in report.validation_issues:
        print(f"UPDATE ISSUE {issue.severity.upper()}: {issue.message}")
    for section in report.skipped_sections:
        print(f"SKIPPED: {section}")

    review_status = "changes detected" if report.has_changes else "no generated data changes"
    print(f"REVIEW STATUS: {review_status}")
    sync_status = "OK" if report.safe_to_sync else "BLOCKED"
    print(f"SYNC READINESS: {sync_status}")


def run_game_update_report(args: argparse.Namespace) -> int:
    try:
        targets = resolve_targets(args.targets)
        report = build_game_update_report(
            targets,
            output_dir=args.output_dir,
            asset_source=args.asset_source,
            gf_json_dir=args.gf_json_dir,
            asset_output_dir=args.asset_output_dir,
        )
    except ExportError as exc:
        print(f"ERROR: {exc}")
        return 1
    _print_game_update_report(report)
    setattr(args, "_game_update_report_safe_to_sync", report.safe_to_sync)
    if args.review_checklist:
        _print_game_update_review_checklist(report)
    if args.write_summary:
        summary_path = report.output_dir / "game_update_summary.md"
        written_path = _write_game_update_summary(report, summary_path)
        print(f"WROTE SUMMARY: {written_path}")
    return 0 if not report.has_errors else 1


def _resolve_sync_asset_targets(args: argparse.Namespace):
    targets = resolve_asset_targets(args.targets)
    if not all(hasattr(target, "client_dir") and hasattr(target, "name") for target in targets):
        return targets
    if args.asset_source == "atlas":
        return generated_atlas_asset_targets(targets, asset_output_dir=args.asset_output_dir)
    if args.asset_source == "auto":
        client_ready = all(target.client_dir.is_dir() for target in targets)
        atlas_ready = all((args.asset_output_dir / target.name).is_dir() for target in targets)
        if not client_ready and atlas_ready:
            return generated_atlas_asset_targets(targets, asset_output_dir=args.asset_output_dir)
    return targets


def run_sync_assets(args: argparse.Namespace) -> int:
    try:
        targets = _resolve_sync_asset_targets(args)
    except ValueError as exc:
        print(f"ERROR: {exc}")
        return 1
    reports = sync_asset_targets(targets, dry_run=args.dry_run)
    _print_asset_sync_reports(reports)
    if any(report.has_errors for report in reports):
        return 1
    if not args.dry_run:
        return run_refresh_manifest()
    return 0


def run_extract_atlas_assets(args: argparse.Namespace) -> int:
    try:
        export_targets = resolve_targets(args.targets)
        asset_targets = resolve_asset_targets(args.targets)
    except (ExportError, ValueError) as exc:
        print(f"ERROR: {exc}")
        return 1
    reports = extract_atlas_assets_for_targets(
        export_targets,
        asset_targets,
        output_dir=args.output_dir,
        gf_json_dir=args.gf_json_dir,
        asset_output_dir=args.asset_output_dir,
    )
    _print_atlas_extraction_reports(reports)
    return 1 if any(report.has_errors for report in reports) else 0


def _args_with(args: argparse.Namespace, **overrides) -> argparse.Namespace:
    values = vars(args).copy()
    values.update(overrides)
    return argparse.Namespace(**values)


def _run_workflow_step(label: str, runner, args: argparse.Namespace | None = None) -> int:
    print(f"WORKFLOW STEP {label}")
    code = runner(args) if args is not None else runner()
    if code != 0:
        print(f"WORKFLOW STOP {label}: exit code {code}")
    return code


def _workflow_asset_args(args: argparse.Namespace) -> argparse.Namespace:
    if args.asset_source == "client":
        return args
    return _args_with(args, asset_source="atlas")


def _workflow_asset_steps(label_prefix: str, args: argparse.Namespace, *, dry_run: bool) -> list[tuple[str, object, argparse.Namespace]]:
    asset_args = _workflow_asset_args(args)
    if asset_args.asset_source == "client":
        return [(f"{label_prefix}sync-assets" if label_prefix else "sync-assets", run_sync_assets, _args_with(asset_args, dry_run=dry_run))]
    return [
        (f"{label_prefix}extract-atlas-assets" if label_prefix else "extract-atlas-assets", run_extract_atlas_assets, asset_args),
        (f"{label_prefix}sync-assets" if label_prefix else "sync-assets", run_sync_assets, _args_with(asset_args, dry_run=dry_run)),
    ]


def run_game_update_workflow(args: argparse.Namespace) -> int:
    asset_args = _workflow_asset_args(args)
    review_steps = [
        ("doctor", run_doctor, args),
        ("game-update-report", run_game_update_report, asset_args),
        ("sync-generated --dry-run", run_sync_generated, _args_with(args, dry_run=True)),
    ]
    review_steps.extend(_workflow_asset_steps("", args, dry_run=True))
    for label, runner, step_args in review_steps:
        code = _run_workflow_step(label, runner, step_args)
        if code != 0:
            return code

    if args.apply:
        sync_ready = getattr(asset_args, "_game_update_report_safe_to_sync", getattr(args, "_game_update_report_safe_to_sync", None))
        if sync_ready is False and not args.force_apply:
            print("WORKFLOW STOP apply: sync readiness BLOCKED; rerun with --force-apply to override")
            return 1
        if sync_ready is False:
            print("WORKFLOW OVERRIDE apply: sync readiness BLOCKED; continuing because --force-apply was provided")
        apply_steps = [
            ("sync-generated", run_sync_generated, _args_with(args, dry_run=False)),
            ("refresh-manifest", run_refresh_manifest, None),
        ]
        apply_steps[1:1] = _workflow_asset_steps("", args, dry_run=False)
        for label, runner, step_args in apply_steps:
            code = _run_workflow_step(label, runner, step_args) if step_args is not None else _run_workflow_step(label, runner)
            if code != 0:
                return code

        validate_code = _run_workflow_step("validate", run_validate)
        if validate_code != 0:
            return validate_code

    if args.verify_live:
        return _run_workflow_step("verify-live", run_verify_live, args)

    return 0


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command in {"validate", "validate-drops", "validate-site"}:
        return run_validate()
    if args.command == "export-client-data":
        return run_export_client_data(args)
    if args.command == "sync-generated":
        return run_sync_generated(args)
    if args.command == "diff-generated":
        return run_diff_generated(args)
    if args.command == "export-sync":
        return run_export_sync(args)
    if args.command == "verify-deploy":
        return run_verify_deploy(args)
    if args.command == "verify-live":
        return run_verify_live(args)
    if args.command == "smoke-site":
        return run_smoke_site(args)
    if args.command == "site-coverage":
        return run_site_coverage()
    if args.command in {"doctor", "validate-sources"}:
        return run_doctor(args)
    if args.command == "source-inventory":
        return run_source_inventory(args)
    if args.command == "vpack-info":
        return run_vpack_info(args)
    if args.command == "vpack-extract":
        return run_vpack_extract(args)
    if args.command == "unknown-fields":
        return run_unknown_fields(args)
    if args.command == "drop-report":
        return run_drop_report()
    if args.command == "game-update-report":
        return run_game_update_report(args)
    if args.command == "sync-assets":
        return run_sync_assets(args)
    if args.command == "extract-atlas-assets":
        return run_extract_atlas_assets(args)
    if args.command == "refresh-manifest":
        return run_refresh_manifest(args)
    if args.command == "game-update-workflow":
        return run_game_update_workflow(args)
    parser.error(f"Unsupported command: {args.command}")
    return 2
