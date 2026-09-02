from __future__ import annotations

import argparse
import json
import os
import subprocess
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

from tools.codex_pipeline.config import (
    ARMOR_IMAGES_DIR,
    ARMORS_DATA_PATH,
    CLIENT_GRAPHICS_PACK_PATH,
    CLIENT_INVENTORY_SNAPSHOT_PATH,
    CODEX_MANIFEST_PATH,
    CLIENT_ROOT,
    CLIENT_GF_JSON_DIR,
    DROP_SOURCES_PATH,
    ITEM_RELATIONSHIP_TARGETS_PATH,
    GENERATED_ATLAS_ASSET_DIR,
    GENERATED_GRAPHICS_PACK_DIR,
    GENERATED_IMAGE_REVIEW_DIR,
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
from tools.codex_pipeline.asset_review import (
    CLASSIFICATION_ORDER,
    PRIORITY_IMAGE_CHANGE_CLASSIFICATIONS,
    asset_report_has_priority_image_changes,
    asset_report_image_classification_counts,
    classify_image_change,
    write_asset_review_artifacts,
)
from tools.codex_pipeline.atlas_assets import extract_atlas_assets_for_targets, generated_atlas_asset_targets
from tools.codex_pipeline.assets import resolve_asset_targets, sync_asset_targets
from tools.codex_pipeline.client_inventory import (
    ClientInventoryDiffReport,
    build_client_inventory_report,
    build_client_inventory_snapshot,
    diff_client_inventory_snapshots,
    load_client_inventory_snapshot,
    write_client_inventory_snapshot,
)
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
from tools.codex_pipeline.deployment_validation import (
    DeploymentValidationError,
    file_sha256,
    load_reviewed_validation_evidence,
    load_smoke_validation_results,
    read_codex_content_sha256,
    write_deployment_validation_results,
)
from tools.codex_pipeline.exports import (
    DEFAULT_EXPORT_TARGETS,
    ExportError,
    build_generated_diff_reports,
    export_client_data,
    resolve_targets,
    sync_generated_outputs,
)
from tools.codex_pipeline.evidence_archive import (
    EvidenceArchiveError,
    archive_game_update_evidence,
    discover_evidence_archives,
    evidence_archive_path,
    verify_evidence_archive,
)
from tools.codex_pipeline.game_update import build_game_update_report
from tools.codex_pipeline.gameplay_impact import (
    build_gameplay_impact_report,
    gameplay_impact_digest,
    gameplay_risk_policy,
    write_gameplay_impact_json,
    write_gameplay_impact_report,
)
from tools.codex_pipeline.freshness import build_codex_manifest, validate_codex_manifest, write_codex_manifest
from tools.codex_pipeline.item_relationships import build_item_relationship_inventory
from tools.codex_pipeline.impact_validation import (
    ImpactValidationPlan,
    build_impact_validation_plan,
    write_impact_validation_plan_json,
)
from tools.codex_pipeline.perks import load_perk_label_overrides
from tools.codex_pipeline.quests import validate_quest_data_file
from tools.codex_pipeline.provenance import (
    build_source_tree_fingerprint,
    inspect_git_remote_branch,
    inspect_git_worktree,
)
from tools.codex_pipeline.sources import inspect_export_source_package, validate_export_sources
from tools.codex_pipeline.site_smoke import run_site_smoke as run_site_smoke_command
from tools.codex_pipeline.site_coverage import SiteCoverageReport, build_site_coverage_report
from tools.codex_pipeline.static_assets import (
    STATIC_ASSET_VERSION_PATH,
    load_static_asset_version,
    update_static_asset_versions,
    validate_static_asset_version,
    write_static_asset_version,
)
from tools.codex_pipeline.unknowns import build_unknown_field_reports
from tools.codex_pipeline.update_run import (
    UPDATE_RUN_STAGES,
    UpdateRunError,
    initialize_game_update_run,
    load_game_update_run,
    require_update_run_ready_for_deployment,
    stable_payload_sha256,
    update_game_update_artifacts,
    update_game_update_stage,
)
from tools.codex_pipeline.update_status import assess_game_update_status
from tools.codex_pipeline.vpack import (
    VpackError,
    decrypt_vpack,
    extract_vpack_files,
    inspect_vpack,
    resolve_vpack_output_path,
)
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
    validate_unique_record_ids,
)


VALIDATED_HTML_PATHS = [
    REPO_ROOT / "index.html",
    REPO_ROOT / "pages" / "General" / "build-planner.html",
    REPO_ROOT / "pages" / "General" / "play-the-game.html",
    REPO_ROOT / "pages" / "General" / "quests.html",
    REPO_ROOT / "pages" / "items" / "weapons.html",
    REPO_ROOT / "pages" / "items" / "armors.html",
    REPO_ROOT / "pages" / "items" / "collectables.html",
    REPO_ROOT / "pages" / "items" / "useables.html",
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
    REPO_ROOT / "pages" / "systems" / "seasonal-events.html",
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
    REPO_ROOT / "css" / "quests.css",
    REPO_ROOT / "css" / "weapons.css",
    REPO_ROOT / "css" / "armors.css",
    REPO_ROOT / "css" / "misc-items.css",
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
    REPO_ROOT / "js" / "quests-page.js",
    REPO_ROOT / "js" / "weapons-page.js",
    REPO_ROOT / "js" / "armors-page.js",
    REPO_ROOT / "js" / "misc-items-page.js",
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
            "client-inventory",
            "vpack-info",
            "vpack-extract",
            "unknown-fields",
            "item-relationships",
            "drop-report",
            "game-update-report",
            "sync-assets",
            "extract-atlas-assets",
            "refresh-manifest",
            "bump-static-version",
            "release-check",
            "game-update-workflow",
            "game-update-history",
            "game-update-status",
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
        help=(
            "Client gf_json directory for atlas extraction and client-inventory. "
            "Atlas commands default to the current graphics VPACK when available."
        ),
    )
    parser.add_argument(
        "--asset-source",
        choices=["auto", "client", "atlas"],
        default="auto",
        help="Image source for game-update-report/sync-assets. auto uses atlas output when legacy client images are absent.",
    )
    parser.add_argument(
        "--image-sync-scope",
        choices=["all", "priority"],
        help=(
            "For sync-assets/game-update-workflow, priority sync applies added/removed images plus meaningful or unreadable changed images. "
            "Defaults to all for sync-assets and priority for game-update-workflow."
        ),
    )
    parser.add_argument(
        "--write-summary",
        action="store_true",
        help="For game-update-report/game-update-workflow, write Markdown review and gameplay-impact artifacts.",
    )
    parser.add_argument(
        "--write-image-review",
        action="store_true",
        help="For game-update-report/game-update-workflow, write contact sheets for image changes.",
    )
    parser.add_argument(
        "--image-review-dir",
        type=Path,
        default=GENERATED_IMAGE_REVIEW_DIR,
        help="Generated image review artifact directory.",
    )
    parser.add_argument(
        "--review-checklist",
        action="store_true",
        help="For game-update-report/game-update-workflow, print a short review checklist before applying changes.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="For sync-generated/export-sync/sync-assets/bump-static-version, report site file changes without copying.",
    )
    parser.add_argument(
        "--asset-version",
        help="For bump-static-version, the static CSS/JS cache-busting token to write.",
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
        "--risk-gate",
        action="store_true",
        help="For game-update-workflow --apply, enforce gameplay-impact review requirements before syncing.",
    )
    parser.add_argument(
        "--acknowledge-impact",
        metavar="DIGEST",
        help="For an enforced game-update workflow, acknowledge the exact reviewed gameplay-impact report digest.",
    )
    parser.add_argument(
        "--verify-live",
        action="store_true",
        help="For game-update-workflow/release-check, run verify-live after local checks.",
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
        "--impact-plan",
        type=Path,
        help="For smoke-site or verify-deploy, run only checks routed by an impact_validation_plan.json artifact.",
    )
    parser.add_argument(
        "--smoke-results-path",
        type=Path,
        help="Write machine-readable smoke evidence here. Defaults to OUTPUT_DIR/impact_validation_results.json.",
    )
    parser.add_argument(
        "--local-smoke-results-path",
        type=Path,
        help="For verify-deploy with --impact-plan, read the passed local smoke evidence here. Defaults beside the plan.",
    )
    parser.add_argument(
        "--deployment-results-path",
        type=Path,
        help="Write verify-deploy evidence here. Defaults beside --impact-plan, or under OUTPUT_DIR without a plan.",
    )
    parser.add_argument(
        "--update-run-path",
        type=Path,
        help="Read or write the game_update_run.json ledger here. Defaults beside --impact-plan or under OUTPUT_DIR.",
    )
    parser.add_argument(
        "--update-archive-dir",
        type=Path,
        default=GENERATED_OUTPUT_DIR / "game-update-history",
        help="Store immutable completed game-update evidence archives here.",
    )
    parser.add_argument(
        "--pack-path",
        type=Path,
        help="For vpack-info/client-inventory, inspect this VPACK file instead of the configured client pack.",
    )
    parser.add_argument(
        "--log-path",
        type=Path,
        help="For vpack-info/client-inventory, read this client log for observed packed file loads.",
    )
    parser.add_argument(
        "--client-root",
        type=Path,
        default=CLIENT_ROOT,
        help="For client-inventory, inspect this client install root.",
    )
    parser.add_argument(
        "--snapshot-path",
        type=Path,
        default=CLIENT_INVENTORY_SNAPSHOT_PATH,
        help="For client-inventory, read/write this persisted inventory snapshot.",
    )
    parser.add_argument(
        "--write-snapshot",
        action="store_true",
        help="For client-inventory, write the current inventory to --snapshot-path.",
    )
    parser.add_argument(
        "--diff-snapshot",
        action="store_true",
        help="For client-inventory, compare the current inventory with --snapshot-path.",
    )
    return parser


def _print_issues(issues: list[ValidationIssue]) -> int:
    for issue in issues:
        print(f"{issue.severity.upper()}: {issue.message}")
    return 1 if any(issue.severity == "error" for issue in issues) else 0


def _format_path_label(path: Path) -> str:
    if not path.is_absolute():
        return path.as_posix()
    try:
        return path.relative_to(REPO_ROOT).as_posix()
    except ValueError:
        return path.name


def git_status_lines() -> list[str]:
    output = subprocess.check_output(["git", "status", "--short"], cwd=REPO_ROOT, text=True)
    return [line for line in output.splitlines() if line.strip()]


def run_bump_static_version(args: argparse.Namespace) -> int:
    try:
        current_version = load_static_asset_version(STATIC_ASSET_VERSION_PATH)
        if not args.asset_version:
            print(f"STATIC ASSET VERSION CURRENT: {current_version}")
            return 0
        target_version = validate_static_asset_version(args.asset_version)
        results = update_static_asset_versions(VALIDATED_HTML_PATHS, target_version, dry_run=args.dry_run)
        if not args.dry_run:
            write_static_asset_version(target_version, STATIC_ASSET_VERSION_PATH)
    except (OSError, ValueError) as exc:
        print(f"ERROR: {exc}")
        return 1

    mode = "DRY-RUN" if args.dry_run else "UPDATED"
    print(f"STATIC ASSET VERSION {mode}: {current_version} -> {target_version}")
    changed_results = [result for result in results if result.changed]
    if not changed_results:
        print("STATIC ASSET NO CHANGES")
        return 0

    verb = "WOULD UPDATE" if args.dry_run else "UPDATED"
    for result in changed_results:
        print(f"STATIC ASSET {verb} {_format_path_label(result.path)}: {result.asset_reference_count} asset reference(s)")
    return 0


def run_release_check(args: argparse.Namespace) -> int:
    exit_code = 0

    print("RELEASE CHECK validate")
    validate_code = run_validate()
    if validate_code == 0:
        print("RELEASE OK validate")
    else:
        print(f"RELEASE ERROR validate: exit code {validate_code}")
        exit_code = 1

    try:
        asset_version = load_static_asset_version(STATIC_ASSET_VERSION_PATH)
        asset_results = update_static_asset_versions(VALIDATED_HTML_PATHS, asset_version, dry_run=True)
    except (OSError, ValueError) as exc:
        print(f"RELEASE ERROR static-assets: {exc}")
        exit_code = 1
    else:
        stale_pages = [result for result in asset_results if result.changed]
        if stale_pages:
            print(f"RELEASE ERROR static-assets: {len(stale_pages)} page(s) would change for version {asset_version}")
            for result in stale_pages:
                print(f"RELEASE STALE {_format_path_label(result.path)}: {result.asset_reference_count} asset reference(s)")
            exit_code = 1
        else:
            print(f"RELEASE OK static-assets: version {asset_version}")

    try:
        dirty_lines = git_status_lines()
    except (OSError, subprocess.CalledProcessError) as exc:
        print(f"RELEASE ERROR git-status: {exc}")
        exit_code = 1
    else:
        if dirty_lines:
            print(f"RELEASE ERROR git-status: dirty worktree ({len(dirty_lines)} changed path(s))")
            for line in dirty_lines:
                print(f"RELEASE DIRTY {line.strip()}")
            exit_code = 1
        else:
            print("RELEASE OK git-status: clean")

    if args.verify_live:
        print("RELEASE CHECK verify-live")
        live_code = run_verify_live(args)
        if live_code == 0:
            print("RELEASE OK verify-live")
        else:
            print(f"RELEASE ERROR verify-live: exit code {live_code}")
            exit_code = 1

    status = "ready" if exit_code == 0 else "blocked"
    print(f"RELEASE CHECK COMPLETE: {status}")
    return exit_code


def _item_relationship_target_coverage_issues(report) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    for coverage in report.target_coverage:
        if coverage.status == "unclassified":
            issues.append(
                ValidationIssue(
                    "error",
                    f"unclassified item relationship target: {coverage.target}; "
                    f"add it to {ITEM_RELATIONSHIP_TARGETS_PATH.relative_to(REPO_ROOT).as_posix()}",
                )
            )
        elif coverage.status == "broken_link":
            issues.append(
                ValidationIssue(
                    "error",
                    f"broken item relationship target link: {coverage.target} -> {coverage.href}; {coverage.issue}",
                )
            )
    return issues


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
    monster_items, monster_item_issues = _collect_item_data_for_validation(MONSTERS_DATA_PATH)
    issues.extend(weapon_item_issues)
    issues.extend(armor_item_issues)
    issues.extend(monster_item_issues)

    if not (weapon_item_issues or armor_item_issues or monster_item_issues):
        issues.extend(
            validate_unique_record_ids(
                {
                    "weapons": weapon_items,
                    "armors": armor_items,
                    "monsters": monster_items,
                }
            )
        )

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
    issues.extend(validate_quest_data_file())

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
    try:
        relationship_report = build_item_relationship_inventory()
    except ExportError as exc:
        issues.append(ValidationIssue("error", f"item relationship target validation failed: {exc}"))
    else:
        issues.extend(_item_relationship_target_coverage_issues(relationship_report))
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
    if any(asset_report_has_priority_image_changes(asset) for asset in report.asset_reports):
        return "blocked - review priority image changes before applying"
    if report.has_changes:
        return "safe after reviewing data changes or low-priority image churn"
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


def _workflow_recommended_next_action(inventory_diff_report: ClientInventoryDiffReport | None, report) -> str:
    if inventory_diff_report is not None and inventory_diff_report.has_errors:
        return "Resolve client inventory diff issues before applying site updates."
    if report.has_errors:
        return "Resolve game update errors before applying site updates."
    if any(asset_report_has_priority_image_changes(asset) for asset in report.asset_reports):
        return "Review image changes; if priority image changes are accepted, rerun game-update-workflow --apply --force-apply --image-sync-scope priority."
    if any(diff.has_changes for diff in report.diff_reports):
        return "Review generated data changes, then rerun game-update-workflow --apply."
    if any(asset.has_changes for asset in report.asset_reports):
        return "Only low-priority image churn remains; no apply step is needed unless you intentionally want to sync it."
    if inventory_diff_report is not None and inventory_diff_report.has_changes:
        return "Client package changed but generated site data did not; review inventory details before refreshing the snapshot."
    return "No generated site changes detected; no apply step is needed."


def _workflow_issue_lines(inventory_diff_report: ClientInventoryDiffReport | None, report) -> list[str]:
    lines: list[str] = []
    if inventory_diff_report is not None:
        lines.extend(f"CLIENT INVENTORY: {issue}" for issue in inventory_diff_report.issues)
    lines.extend(
        f"SOURCE CHECK: {check.target} {check.check}: {check.message}"
        for check in report.source_checks
        if not check.ok
    )
    lines.extend(f"VALIDATION {issue.severity.upper()}: {issue.message}" for issue in report.validation_issues)
    lines.extend(f"EXPORT ERROR: {error}" for error in report.export_errors)
    lines.extend(f"SKIPPED: {section}" for section in report.skipped_sections)
    for asset in report.asset_reports:
        lines.extend(f"ASSET {asset.target_name} {issue.severity.upper()}: {issue.message}" for issue in asset.issues)
    if report.drop_report is not None:
        lines.extend(
            f"DROPS {issue.severity.upper()}: {issue.message}"
            for issue in report.drop_report.validation_issues
        )
    if any(asset_report_has_priority_image_changes(asset) for asset in report.asset_reports):
        lines.append("SYNC READINESS: priority image changes require human review before applying.")
    return lines


def _extend_workflow_inventory_diff(
    lines: list[str],
    inventory_diff_report: ClientInventoryDiffReport | None,
    *,
    max_records: int,
) -> None:
    lines.extend(["", "## Client Inventory Diff"])
    if inventory_diff_report is None:
        lines.append("- Not available.")
        return
    if inventory_diff_report.issues:
        for issue in inventory_diff_report.issues:
            lines.append(f"- Issue: {issue}")
    if not inventory_diff_report.entries:
        lines.append("- No client inventory changes.")
        return
    for entry in inventory_diff_report.entries[:max_records]:
        label = entry.change_type[:1].upper() + entry.change_type[1:]
        lines.append(f"- {label}: {entry.section} {entry.key}: {entry.summary}")
    if len(inventory_diff_report.entries) > max_records:
        lines.append(f"- ... {len(inventory_diff_report.entries) - max_records} more")


def _gameplay_risk_gate_failure(
    impact,
    *,
    summary_requested: bool,
    acknowledged_impact: str | None,
) -> str | None:
    policy = gameplay_risk_policy(impact)
    missing_requirements: list[str] = []
    if "--write-summary" in policy.required_flags_when_enforced and not summary_requested:
        missing_requirements.append("--write-summary")
    if "--acknowledge-impact <report-digest>" in policy.required_flags_when_enforced:
        report_digest = gameplay_impact_digest(impact)
        if acknowledged_impact is None:
            missing_requirements.append(f"--acknowledge-impact {report_digest}")
        elif acknowledged_impact != report_digest:
            return (
                f"gameplay risk {impact.highest_risk.upper()} acknowledgement {acknowledged_impact} "
                f"does not match current report digest {report_digest}"
            )
    if missing_requirements:
        return (
            f"gameplay risk {impact.highest_risk.upper()} requires "
            f"{', '.join(missing_requirements)}"
        )
    return None


def _enforce_gameplay_risk_gate(report, args: argparse.Namespace) -> bool:
    impact = build_gameplay_impact_report(report.diff_reports)
    policy = gameplay_risk_policy(impact)
    failure = _gameplay_risk_gate_failure(
        impact,
        summary_requested=args.write_summary,
        acknowledged_impact=args.acknowledge_impact,
    )
    print(f"RISK GATE: {impact.highest_risk.upper()} - {policy.status.replace('_', ' ').upper()}")
    print(f"GAMEPLAY IMPACT DIGEST: {gameplay_impact_digest(impact)}")
    if failure:
        print(f"WORKFLOW STOP apply: {failure} when --risk-gate is enabled")
        return False
    print(f"RISK GATE OK: gameplay risk {impact.highest_risk.upper()} requirements satisfied")
    return True


def _extend_workflow_gameplay_impact(
    lines: list[str],
    report,
    *,
    artifact_path: Path | None,
    json_artifact_path: Path | None,
    risk_gate_enabled: bool,
    acknowledged_impact: str | None,
    summary_path: Path | None,
) -> None:
    impact = build_gameplay_impact_report(report.diff_reports)
    policy = gameplay_risk_policy(impact)
    report_digest = gameplay_impact_digest(impact)
    lines.extend(
        [
            "",
            "## Gameplay Impact",
            f"- Review risk: {impact.highest_risk.upper()} "
            f"(high={impact.risk_counts['high']}, medium={impact.risk_counts['medium']}, low={impact.risk_counts['low']})",
            f"- Report digest: `{report_digest}`",
            f"- Review decision: {policy.status.replace('_', ' ').upper()} - {policy.description}",
            f"- Public records: +{impact.added_count} -{impact.removed_count}",
            f"- Gameplay changes: {impact.changed_record_count} record(s), {impact.changed_field_count} field(s)",
            f"- Routine-only changed records hidden: {impact.routine_only_record_count}",
            f"- Filtered field changes: {impact.omitted_field_change_count}",
        ]
    )
    if risk_gate_enabled:
        failure = _gameplay_risk_gate_failure(
            impact,
            summary_requested=True,
            acknowledged_impact=acknowledged_impact,
        )
        gate_status = "BLOCKED" if failure else "SATISFIED"
        suffix = f" ({failure})" if failure else ""
        lines.append(f"- Risk gate: {gate_status}{suffix}")
    else:
        lines.append("- Risk gate: disabled")
    if artifact_path is not None:
        lines.append(
            f"- Full report: [{artifact_path.name}]"
            f"({_workflow_markdown_link_path(artifact_path, summary_path=summary_path)})"
        )
    if json_artifact_path is not None:
        lines.append(
            f"- Machine-readable report: [{json_artifact_path.name}]"
            f"({_workflow_markdown_link_path(json_artifact_path, summary_path=summary_path)})"
        )


def _extend_workflow_impact_validation(
    lines: list[str],
    plan: ImpactValidationPlan | None,
    *,
    artifact_path: Path | None,
    results_artifact_path: Path | None,
    results_status: str | None,
    summary_path: Path | None,
) -> None:
    lines.extend(["", "## Impact-Aware Validation Plan"])
    if plan is None:
        lines.append("- Not available.")
        return
    runners = ", ".join(plan.automated_runners) or "none"
    lines.extend(
        [
            f"- Report digest: `{plan.report_digest}`",
            f"- Routed checks: {len(plan.checks)}",
            f"- Affected records: {len(plan.affected_records)}",
            f"- Automatic runners: {runners}",
            f"- Post-apply browser smoke: {'required' if plan.requires_browser_smoke else 'not required'}",
        ]
    )
    if artifact_path is not None:
        lines.append(
            f"- Machine-readable plan: [{artifact_path.name}]"
            f"({_workflow_markdown_link_path(artifact_path, summary_path=summary_path)})"
        )
    if results_artifact_path is not None:
        lines.append(
            f"- Validation evidence: [{results_artifact_path.name}]"
            f"({_workflow_markdown_link_path(results_artifact_path, summary_path=summary_path)})"
        )
        if results_status:
            lines.append(f"- Validation evidence status: {results_status.upper()}")
    if not plan.checks:
        lines.append("- No impact-routed checks are required.")
        return
    for check in plan.checks:
        lines.append(f"- `{check.check_id}`: {check.label}")
        lines.append(f"  - Surfaces: {', '.join(check.surfaces)}")
        lines.append(f"  - Automated by: {', '.join(check.automated_by)}")
        lines.append(f"  - Trigger: {'; '.join(check.triggers)}")


def _extend_workflow_update_run(
    lines: list[str],
    artifact_path: Path | None,
    *,
    summary_path: Path | None,
) -> None:
    if artifact_path is None:
        return
    lines.extend(
        [
            "",
            "## Automated Update Run",
            f"- Run ledger: [{artifact_path.name}]"
            f"({_workflow_markdown_link_path(artifact_path, summary_path=summary_path)})",
            "- Status command: "
            f"`python -m tools.codex_pipeline game-update-status --update-run-path \"{artifact_path}\"`",
        ]
    )


def _extend_workflow_data_diff(lines: list[str], report, *, max_records: int, max_fields: int) -> None:
    lines.extend(["", "## Generated Data Diff"])
    data_sections = [diff for diff in report.diff_reports if diff.has_changes]
    if not data_sections:
        lines.append("- No generated data changes.")
        return
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


def _hidden_data_counts(report) -> tuple[int, int, int]:
    return (
        sum(len(getattr(diff, "hidden_added", [])) for diff in report.diff_reports),
        sum(len(getattr(diff, "hidden_removed", [])) for diff in report.diff_reports),
        sum(len(getattr(diff, "hidden_changed", [])) for diff in report.diff_reports),
    )


def _hidden_image_counts(report) -> tuple[int, int, int]:
    return (
        sum(len(getattr(asset, "hidden_added", [])) for asset in report.asset_reports),
        sum(len(getattr(asset, "hidden_removed", [])) for asset in report.asset_reports),
        sum(len(getattr(asset, "hidden_changed", [])) for asset in report.asset_reports),
    )


def _extend_workflow_hidden_exclusions(lines: list[str], report) -> None:
    hidden_data_added, hidden_data_removed, hidden_data_changed = _hidden_data_counts(report)
    hidden_image_added, hidden_image_removed, hidden_image_changed = _hidden_image_counts(report)
    if not any(
        [
            hidden_data_added,
            hidden_data_removed,
            hidden_data_changed,
            hidden_image_added,
            hidden_image_removed,
            hidden_image_changed,
        ]
    ):
        return

    lines.extend(
        [
            "",
            "## Hidden Exclusions",
            f"- Data hidden by `data/allowlists.json`: +{hidden_data_added} -{hidden_data_removed} ~{hidden_data_changed}",
            f"- Images hidden by `data/allowlists.json`: +{hidden_image_added} -{hidden_image_removed} ~{hidden_image_changed}",
        ]
    )
    for diff in report.diff_reports:
        added = len(getattr(diff, "hidden_added", []))
        removed = len(getattr(diff, "hidden_removed", []))
        changed = len(getattr(diff, "hidden_changed", []))
        if any([added, removed, changed]):
            lines.append(f"- {_target_heading(diff.target.name)} data: +{added} -{removed} ~{changed}")
    for asset in report.asset_reports:
        added = len(getattr(asset, "hidden_added", []))
        removed = len(getattr(asset, "hidden_removed", []))
        changed = len(getattr(asset, "hidden_changed", []))
        if any([added, removed, changed]):
            lines.append(f"- {_target_heading(asset.target_name)} images: +{added} -{removed} ~{changed}")


def _workflow_image_classification_counts(asset) -> dict[str, int]:
    return asset_report_image_classification_counts(asset)


def _workflow_image_review_rows(report) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for asset in report.asset_reports:
        if not asset.has_changes:
            continue
        counts = _workflow_image_classification_counts(asset)
        priority_changed = sum(counts.get(classification, 0) for classification in PRIORITY_IMAGE_CHANGE_CLASSIFICATIONS)
        low_priority_changed = counts.get("background-only", 0) + counts.get("encoding-only", 0)
        rows.append(
            {
                "asset": asset,
                "counts": counts,
                "priority_changed": priority_changed,
                "priority_total": len(asset.added) + len(asset.removed) + priority_changed,
                "low_priority_changed": low_priority_changed,
            }
        )
    return rows


def _workflow_classification_summary(counts: dict[str, int]) -> str:
    return ", ".join(f"{classification}={counts.get(classification, 0)}" for classification in CLASSIFICATION_ORDER)


def _workflow_low_priority_summary(counts: dict[str, int]) -> str:
    return f"background-only={counts.get('background-only', 0)}, encoding-only={counts.get('encoding-only', 0)}"


def _workflow_priority_image_details(report) -> list[tuple[str, str, str]]:
    details: list[tuple[str, str, str]] = []
    for asset in report.asset_reports:
        if not asset.has_changes:
            continue
        target_name = _target_heading(asset.target_name)
        details.extend((target_name, "added", image_name) for image_name in asset.added)
        details.extend((target_name, "removed", image_name) for image_name in asset.removed)
        for image_name in asset.changed:
            classification = classify_image_change(asset.site_dir / image_name, asset.client_dir / image_name)
            if classification in PRIORITY_IMAGE_CHANGE_CLASSIFICATIONS:
                details.append((target_name, f"changed {classification}", image_name))
    return details


def _extend_workflow_image_review_decision(lines: list[str], report) -> None:
    lines.extend(["", "## Image Review Decision"])
    rows = _workflow_image_review_rows(report)
    if not rows:
        lines.append("- No image changes.")
        return

    total_added = sum(len(row["asset"].added) for row in rows)
    total_removed = sum(len(row["asset"].removed) for row in rows)
    priority_changed = sum(int(row["priority_changed"]) for row in rows)
    priority_total = sum(int(row["priority_total"]) for row in rows)
    low_priority_changed = sum(int(row["low_priority_changed"]) for row in rows)
    low_priority_counts = {
        "background-only": sum(row["counts"].get("background-only", 0) for row in rows),
        "encoding-only": sum(row["counts"].get("encoding-only", 0) for row in rows),
    }

    lines.append(f"- Priority image changes: {priority_total} (+{total_added} -{total_removed} ~{priority_changed})")
    lines.append(f"- Low-priority changed images: {low_priority_changed} ({_workflow_low_priority_summary(low_priority_counts)})")
    if priority_total:
        lines.append(
            "- Recommended apply command: "
            "python -m tools.codex_pipeline game-update-workflow --apply --force-apply --image-sync-scope priority"
        )
    elif low_priority_changed:
        lines.append("- Recommended apply command: skip apply unless you intentionally want to sync low-priority changed-image churn.")
    else:
        lines.append("- Recommended apply command: no image apply step is needed.")

    for row in rows:
        asset = row["asset"]
        counts = row["counts"]
        lines.append(
            f"- {_target_heading(asset.target_name)}: "
            f"priority={row['priority_total']}, low-priority={row['low_priority_changed']}, "
            f"changed classifications: {_workflow_classification_summary(counts)}"
        )


def _extend_workflow_priority_image_details(lines: list[str], report, *, max_records: int) -> None:
    lines.extend(["", "## Priority Image Details"])
    details = _workflow_priority_image_details(report)
    if not details:
        lines.append("- No priority image changes.")
        return

    for target_name, change_type, image_name in details[:max_records]:
        lines.append(f"- {target_name} {change_type}: {image_name}")
    if len(details) > max_records:
        lines.append(f"- ... {len(details) - max_records} more priority image change(s)")


def _workflow_markdown_link_path(path: Path, *, summary_path: Path | None) -> str:
    if summary_path is None:
        return path.as_posix()
    try:
        return Path(os.path.relpath(path, start=summary_path.parent)).as_posix()
    except ValueError:
        return path.as_posix()


def _extend_workflow_image_review_artifacts(lines: list[str], artifact, *, summary_path: Path | None) -> None:
    if artifact is None:
        return

    lines.extend(["", "## Image Review Artifacts"])
    markdown_path = artifact.markdown_path
    lines.append(
        f"- Full image review: [{markdown_path.name}]"
        f"({_workflow_markdown_link_path(markdown_path, summary_path=summary_path)})"
    )
    for sheet_path in artifact.sheet_paths:
        lines.append(
            f"- Contact sheet: [{sheet_path.name}]"
            f"({_workflow_markdown_link_path(sheet_path, summary_path=summary_path)})"
        )


def _extend_workflow_image_diff(lines: list[str], report, *, max_records: int) -> None:
    lines.extend(["", "## Image Diff"])
    image_sections = [asset for asset in report.asset_reports if asset.has_changes]
    if not image_sections:
        lines.append("- No image changes.")
        return
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


def _extend_workflow_unknown_fields(lines: list[str], report, *, max_fields: int) -> None:
    lines.extend(["", "## Unknown Fields"])
    if not report.unknown_reports:
        lines.append("- No unknown-field inventory was produced.")
        return
    for unknown_report in report.unknown_reports:
        nonzero_fields = sum(1 for field in unknown_report.fields if field.nonzero_count)
        lines.append(
            f"- {unknown_report.target_name}: {len(unknown_report.fields)} unknown field(s), "
            f"{nonzero_fields} with nonzero values across {unknown_report.record_count} record(s)"
        )
        for field in unknown_report.fields[:max_fields]:
            lines.append(
                f"  - {field.name}: {field.nonzero_count}/{field.record_count} nonzero"
            )
        if len(unknown_report.fields) > max_fields:
            lines.append(f"  - ... {len(unknown_report.fields) - max_fields} more")


def build_game_update_workflow_summary_markdown(
    inventory_diff_report: ClientInventoryDiffReport | None,
    report,
    *,
    apply_requested: bool,
    image_review_artifact=None,
    gameplay_impact_artifact: Path | None = None,
    gameplay_impact_json_artifact: Path | None = None,
    impact_validation_plan: ImpactValidationPlan | None = None,
    impact_validation_plan_artifact: Path | None = None,
    impact_validation_results_artifact: Path | None = None,
    impact_validation_results_status: str | None = None,
    game_update_run_artifact: Path | None = None,
    risk_gate_enabled: bool = False,
    acknowledged_impact: str | None = None,
    summary_path: Path | None = None,
    max_records: int = 12,
    max_fields: int = 8,
) -> str:
    data_added, data_removed, data_changed, image_added, image_removed, image_changed = _player_change_counts(report)
    inventory_change_count = 0 if inventory_diff_report is None else len(inventory_diff_report.entries)
    inventory_issue_count = 0 if inventory_diff_report is None else len(inventory_diff_report.issues)
    lines = [
        "# Project Rogue Codex Workflow Summary",
        "",
        "## Recommended Next Action",
        f"- {_workflow_recommended_next_action(inventory_diff_report, report)}",
        f"- Sync readiness: {'OK' if report.safe_to_sync else 'BLOCKED'}",
        f"- Apply requested: {'yes' if apply_requested else 'no'}",
        "",
        "## Review Totals",
        f"- Client inventory: {inventory_change_count} change(s), {inventory_issue_count} issue(s)",
        f"- Data: +{data_added} -{data_removed} ~{data_changed}",
        f"- Images: +{image_added} -{image_removed} ~{image_changed}",
        f"- Review notes: {_review_note_count(report) + inventory_issue_count}",
    ]
    _extend_workflow_inventory_diff(lines, inventory_diff_report, max_records=max_records)
    _extend_workflow_gameplay_impact(
        lines,
        report,
        artifact_path=gameplay_impact_artifact,
        json_artifact_path=gameplay_impact_json_artifact,
        risk_gate_enabled=risk_gate_enabled,
        acknowledged_impact=acknowledged_impact,
        summary_path=summary_path,
    )
    _extend_workflow_impact_validation(
        lines,
        impact_validation_plan,
        artifact_path=impact_validation_plan_artifact,
        results_artifact_path=impact_validation_results_artifact,
        results_status=impact_validation_results_status,
        summary_path=summary_path,
    )
    _extend_workflow_update_run(
        lines,
        game_update_run_artifact,
        summary_path=summary_path,
    )
    _extend_workflow_data_diff(lines, report, max_records=max_records, max_fields=max_fields)
    _extend_workflow_hidden_exclusions(lines, report)
    _extend_workflow_image_review_decision(lines, report)
    _extend_workflow_image_review_artifacts(lines, image_review_artifact, summary_path=summary_path)
    _extend_workflow_priority_image_details(lines, report, max_records=max_records)
    _extend_workflow_image_diff(lines, report, max_records=max_records)
    _extend_workflow_unknown_fields(lines, report, max_fields=max_fields)

    lines.extend(["", "## Blockers And Notes"])
    issue_lines = _workflow_issue_lines(inventory_diff_report, report)
    if issue_lines:
        lines.extend(f"- {line}" for line in issue_lines)
    else:
        lines.append("- No blockers or skipped review sections.")
    return "\n".join(lines).rstrip() + "\n"


def _write_game_update_workflow_summary(
    inventory_diff_report: ClientInventoryDiffReport | None,
    report,
    path: Path,
    *,
    apply_requested: bool,
    image_review_artifact=None,
    gameplay_impact_artifact: Path | None = None,
    gameplay_impact_json_artifact: Path | None = None,
    impact_validation_plan: ImpactValidationPlan | None = None,
    impact_validation_plan_artifact: Path | None = None,
    impact_validation_results_artifact: Path | None = None,
    impact_validation_results_status: str | None = None,
    game_update_run_artifact: Path | None = None,
    risk_gate_enabled: bool = False,
    acknowledged_impact: str | None = None,
) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        build_game_update_workflow_summary_markdown(
            inventory_diff_report,
            report,
            apply_requested=apply_requested,
            image_review_artifact=image_review_artifact,
            gameplay_impact_artifact=gameplay_impact_artifact,
            gameplay_impact_json_artifact=gameplay_impact_json_artifact,
            impact_validation_plan=impact_validation_plan,
            impact_validation_plan_artifact=impact_validation_plan_artifact,
            impact_validation_results_artifact=impact_validation_results_artifact,
            impact_validation_results_status=impact_validation_results_status,
            game_update_run_artifact=game_update_run_artifact,
            risk_gate_enabled=risk_gate_enabled,
            acknowledged_impact=acknowledged_impact,
            summary_path=path,
        ),
        encoding="utf-8",
        newline="\n",
    )
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
    setattr(args, "_live_check_results", results)
    for result in results:
        status = "OK" if result.ok else "ERROR"
        print(f"LIVE {status} {result.label}: {result.message} ({result.url})")
    return 0 if all(result.ok for result in results) else 1


def run_smoke_site(args: argparse.Namespace) -> int:
    impact_plan = getattr(args, "_impact_validation_plan", None)
    impact_plan_path = args.impact_plan
    temporary_directory = None
    if impact_plan is not None and impact_plan_path is None:
        temporary_directory = tempfile.TemporaryDirectory()
        impact_plan_path = write_impact_validation_plan_json(
            impact_plan,
            Path(temporary_directory.name) / "impact_validation_plan.json",
        )
    smoke_options = {"timeout_ms": args.smoke_timeout_ms}
    if impact_plan_path is not None:
        smoke_options["impact_plan_path"] = impact_plan_path
    if args.live:
        smoke_options["base_url"] = args.site_url
    results_path = args.smoke_results_path or args.output_dir / "impact_validation_results.json"
    smoke_options["results_path"] = results_path
    try:
        result = run_site_smoke_command(**smoke_options)
    finally:
        if temporary_directory is not None:
            temporary_directory.cleanup()
    if result.stdout:
        print(result.stdout.rstrip())
    if result.stderr:
        print(result.stderr.rstrip())
    if results_path.is_file():
        setattr(args, "_impact_validation_results_artifact", results_path)
    return result.returncode


def _smoke_results_status(path: Path | None) -> str | None:
    if path is None or not path.is_file():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    status = payload.get("status")
    return status if status in {"passed", "failed"} else None


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


def _configured_update_run_path(
    args: argparse.Namespace,
    *,
    impact_plan_path: Path | None = None,
) -> Path:
    if args.update_run_path is not None:
        return args.update_run_path.expanduser().resolve()
    plan_path = impact_plan_path or args.impact_plan
    base_dir = plan_path.parent if plan_path is not None else args.output_dir
    return (base_dir / "game_update_run.json").expanduser().resolve()


def run_game_update_status(args: argparse.Namespace) -> int:
    run_path = _configured_update_run_path(args)
    try:
        payload = load_game_update_run(run_path)
    except UpdateRunError as exc:
        print(f"UPDATE RUN ERROR: {exc}")
        return 1

    print(f"UPDATE RUN: {run_path}")
    print(f"RUN ID: {payload.get('runId')}")
    print(f"REPORT DIGEST: {payload.get('reportDigest')}")
    assessment = assess_game_update_status(
        payload,
        github_repository=args.github_repo,
        branch=args.branch,
    )
    print(f"RUN STATUS: {assessment.status.upper()}")
    if assessment.status != payload.get("status"):
        print(f"LEDGER STATUS: {str(payload.get('status')).upper()}")
    stages = payload.get("stages")
    for stage in UPDATE_RUN_STAGES:
        entry = stages.get(stage) if isinstance(stages, dict) else None
        status = entry.get("status") if isinstance(entry, dict) else "missing"
        print(f"STAGE {stage}: {str(status).upper()}")
    print(f"ARTIFACTS VERIFIED: {assessment.artifact_count}")
    if assessment.source_tree is not None:
        print(
            f"SOURCE TREE: {assessment.source_tree.sha256} "
            f"({assessment.source_tree.file_count} files)"
        )
    if assessment.worktree is not None:
        print(
            "WORKTREE: "
            f"tracked={'clean' if assessment.worktree.tracked_clean else 'changed'} "
            f"untracked-deployable={len(assessment.worktree.untracked_deployable_files)}"
        )
    if assessment.local_head_sha is not None:
        print(f"LOCAL HEAD: {assessment.local_head_sha}")
    if assessment.remote is not None:
        print(
            f"REMOTE: {assessment.remote.remote_name}/{assessment.remote.branch} "
            f"repository={assessment.remote.github_repository or 'unknown'} "
            f"head={assessment.remote.head_sha or 'missing'}"
        )
    for issue in assessment.issues:
        print(f"STATUS ERROR: {issue}")
    if assessment.next_action:
        print(f"NEXT ACTION: {assessment.next_action}")
        if assessment.next_command:
            print(f"NEXT COMMAND: {assessment.next_command}")
    elif assessment.status == "complete":
        print("NEXT ACTION: None; this update run is complete.")
    else:
        print("NEXT ACTION: Resolve the reported status errors before continuing.")
    return assessment.exit_code


def run_game_update_history(args: argparse.Namespace) -> int:
    archive_root = args.update_archive_dir.expanduser().resolve()
    print(f"EVIDENCE HISTORY: {archive_root}")
    try:
        candidates = discover_evidence_archives(archive_root)
    except EvidenceArchiveError as exc:
        print(f"HISTORY ERROR: {exc}")
        return 1

    records = []
    errors: list[str] = []
    for candidate in candidates:
        try:
            records.append(verify_evidence_archive(candidate))
        except (EvidenceArchiveError, OSError) as exc:
            errors.append(f"{candidate.name}: {exc}")
    records.sort(key=lambda record: (record.archived_at, record.run_id), reverse=True)
    for record in records:
        repository = record.github_repository or "unknown"
        branch = record.branch or "unknown"
        print(
            f"HISTORY OK {record.archived_at} commit={record.commit_sha[:12]} "
            f"run={record.run_id.removeprefix('sha256:')[:12]} files={record.file_count} "
            f"source={record.source_tree_sha256[:12]} repository={repository} branch={branch}"
        )
    for error in errors:
        print(f"HISTORY ERROR {error}")

    if args.update_run_path is not None:
        active_run_path = args.update_run_path.expanduser().resolve()
        try:
            active_run = load_game_update_run(active_run_path)
        except UpdateRunError as exc:
            errors.append(f"active run: {exc}")
            print(f"HISTORY ERROR active run: {exc}")
        else:
            if active_run.get("status") == "complete":
                try:
                    expected_archive = evidence_archive_path(
                        archive_root,
                        active_run.get("runId"),
                    )
                except EvidenceArchiveError as exc:
                    errors.append(f"active run: {exc}")
                    print(f"HISTORY ERROR active run: {exc}")
                else:
                    record = next(
                        (entry for entry in records if entry.path == expected_archive),
                        None,
                    )
                    if record is None:
                        message = f"completed active run has no valid archive: {expected_archive}"
                        errors.append(message)
                        print(f"HISTORY ERROR {message}")
                    else:
                        stages = active_run.get("stages")
                        commit_stage = stages.get("commit") if isinstance(stages, dict) else None
                        details = commit_stage.get("details") if isinstance(commit_stage, dict) else None
                        expected_commit = details.get("commitSha") if isinstance(details, dict) else None
                        if (
                            record.report_digest != active_run.get("reportDigest")
                            or record.commit_sha != expected_commit
                        ):
                            message = "completed active run identity differs from its evidence archive"
                            errors.append(message)
                            print(f"HISTORY ERROR {message}")
                        else:
                            print(f"ACTIVE RUN ARCHIVE: VERIFIED {record.path}")

    print(f"HISTORY SUMMARY: {len(records)} valid, {len(errors)} invalid")
    return 1 if errors else 0


def _utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _smoke_evidence_reference(path: Path, payload: dict[str, object]) -> dict[str, object]:
    return {
        "path": str(path.expanduser().resolve()),
        "sha256": file_sha256(path.expanduser().resolve()),
        "status": payload.get("status"),
        "mode": payload.get("mode"),
        "target": payload.get("target"),
        "completedAt": payload.get("completedAt"),
        "durationMs": payload.get("durationMs"),
        "summary": payload.get("summary"),
        "sourceTree": payload.get("sourceTree"),
        "failures": payload.get("failures", []),
    }


def _write_deployment_result(
    path: Path,
    payload: dict[str, object],
    *,
    started_at_monotonic: float,
    passed: bool,
) -> int:
    payload["status"] = "passed" if passed else "failed"
    payload["completedAt"] = _utc_timestamp()
    payload["durationMs"] = round((time.monotonic() - started_at_monotonic) * 1000)
    written_path = write_deployment_validation_results(path, payload)
    print(f"DEPLOYMENT RESULTS: {written_path}")
    return 0 if passed else 1


def _finish_deployment_result(
    path: Path,
    payload: dict[str, object],
    *,
    started_at_monotonic: float,
    passed: bool,
    update_run_path: Path | None = None,
    update_run_digest: str | None = None,
    update_run_stage: str | None = None,
    update_run_status: str | None = None,
    update_run_details: dict[str, object] | None = None,
    update_run_artifacts: dict[str, Path] | None = None,
    evidence_archive_root: Path | None = None,
) -> int:
    ledger_updated = False
    run_payload: dict[str, object] | None = None
    if (
        update_run_path is not None
        and update_run_digest is not None
        and update_run_stage is not None
        and update_run_status is not None
    ):
        try:
            run_payload = update_game_update_stage(
                update_run_path,
                expected_digest=update_run_digest,
                stage=update_run_stage,
                status=update_run_status,
                details=update_run_details,
                artifacts=update_run_artifacts,
            )
        except UpdateRunError as exc:
            payload["failures"].append(f"could not update game update run: {exc}")
            passed = False
        else:
            ledger_updated = True
            payload["updateRun"] = {
                "path": str(update_run_path),
                "runId": run_payload.get("runId"),
                "status": run_payload.get("status"),
                "nextAction": run_payload.get("nextAction"),
            }

    archive_target = None
    if passed and ledger_updated and run_payload is not None and evidence_archive_root is not None:
        try:
            archive_target = evidence_archive_path(evidence_archive_root, run_payload.get("runId"))
        except EvidenceArchiveError as exc:
            payload["failures"].append(f"could not prepare evidence archive: {exc}")
            passed = False
        else:
            payload["evidenceArchive"] = {"path": str(archive_target)}

    code = _write_deployment_result(
        path,
        payload,
        started_at_monotonic=started_at_monotonic,
        passed=passed,
    )
    if ledger_updated and update_run_path is not None and update_run_digest is not None:
        try:
            run_payload = update_game_update_artifacts(
                update_run_path,
                expected_digest=update_run_digest,
                artifacts={"deploymentValidation": path},
            )
        except UpdateRunError as exc:
            payload["failures"].append(f"could not attach deployment evidence to game update run: {exc}")
            return _write_deployment_result(
                path,
                payload,
                started_at_monotonic=started_at_monotonic,
                passed=False,
            )
    if (
        code == 0
        and archive_target is not None
        and update_run_path is not None
        and update_run_digest is not None
    ):
        try:
            archive_result = archive_game_update_evidence(
                update_run_path,
                evidence_archive_root,
                expected_digest=update_run_digest,
                expected_commit_sha=str(payload.get("commitSha")),
            )
        except (EvidenceArchiveError, OSError) as exc:
            payload["failures"].append(f"could not archive completed update evidence: {exc}")
            try:
                run_payload = update_game_update_stage(
                    update_run_path,
                    expected_digest=update_run_digest,
                    stage="deployment",
                    status="failed",
                    details={
                        "commitSha": payload.get("commitSha"),
                        "failedStep": "evidence-archive",
                        "error": str(exc),
                    },
                )
                payload["updateRun"] = {
                    "path": str(update_run_path),
                    "runId": run_payload.get("runId"),
                    "status": run_payload.get("status"),
                    "nextAction": run_payload.get("nextAction"),
                }
            except UpdateRunError as ledger_exc:
                payload["failures"].append(
                    f"could not record evidence archive failure in game update run: {ledger_exc}"
                )
            _write_deployment_result(
                path,
                payload,
                started_at_monotonic=started_at_monotonic,
                passed=False,
            )
            try:
                update_game_update_artifacts(
                    update_run_path,
                    expected_digest=update_run_digest,
                    artifacts={"deploymentValidation": path},
                )
            except UpdateRunError as ledger_exc:
                print(f"UPDATE RUN ERROR: {ledger_exc}")
            return 1
        archive_mode = "CREATED" if archive_result.created else "VERIFIED"
        print(
            f"EVIDENCE ARCHIVE {archive_mode}: {archive_result.path} "
            f"({archive_result.file_count} files)"
        )
    return code


def run_verify_deploy(args: argparse.Namespace) -> int:
    started_at_monotonic = time.monotonic()
    impact_plan_path = args.impact_plan.expanduser().resolve() if args.impact_plan else None
    deployment_results_dir = args.impact_plan.parent if args.impact_plan else args.output_dir
    deployment_results_path = (
        args.deployment_results_path
        or deployment_results_dir / "deployment_validation_results.json"
    ).expanduser().resolve()
    live_results_path = deployment_results_path.with_name("live_impact_validation_results.json")
    local_results_path = None
    if impact_plan_path is not None:
        local_results_path = (
            args.local_smoke_results_path.expanduser().resolve()
            if args.local_smoke_results_path
            else impact_plan_path.with_name("impact_validation_results.json")
        )
    failures: list[str] = []
    payload: dict[str, object] = {
        "schemaVersion": 1,
        "status": "running",
        "startedAt": _utc_timestamp(),
        "completedAt": None,
        "durationMs": None,
        "githubRepository": args.github_repo,
        "branch": args.branch,
        "commitSha": None,
        "provenance": None,
        "siteUrl": args.site_url,
        "reportDigest": None,
        "codexContentSha256": None,
        "reviewPlan": None,
        "localValidation": None,
        "workflows": [],
        "liveChecks": [],
        "liveValidation": None,
        "evidenceArchive": None,
        "updateRun": None,
        "failures": failures,
    }

    if live_results_path == deployment_results_path or local_results_path in {
        deployment_results_path,
        live_results_path,
    }:
        print("DEPLOYMENT ERROR: local, live, and deployment validation artifacts must use different paths")
        return 1
    try:
        live_results_path.unlink(missing_ok=True)
    except OSError as exc:
        failures.append(f"could not prepare live smoke results path {live_results_path}: {exc}")
        return _write_deployment_result(
            deployment_results_path,
            payload,
            started_at_monotonic=started_at_monotonic,
            passed=False,
        )

    try:
        local_head_sha = resolve_git_commit()
        commit_sha = resolve_git_commit(args.commit) if args.commit else local_head_sha
        worktree_state = inspect_git_worktree()
        source_tree = build_source_tree_fingerprint().as_dict()
    except (OSError, subprocess.CalledProcessError) as exc:
        failures.append(f"could not establish deployment provenance: {exc}")
        return _write_deployment_result(
            deployment_results_path,
            payload,
            started_at_monotonic=started_at_monotonic,
            passed=False,
        )
    payload["commitSha"] = commit_sha
    payload["provenance"] = {
        "localHeadSha": local_head_sha,
        "requestedCommitSha": commit_sha,
        "headMatchesRequestedCommit": local_head_sha == commit_sha,
        "trackedWorktreeClean": worktree_state.tracked_clean,
        "trackedChanges": list(worktree_state.tracked_changes),
        "deployableFilesTracked": worktree_state.deployable_files_tracked,
        "untrackedDeployableFiles": list(worktree_state.untracked_deployable_files),
        "sourceTree": source_tree,
        "remote": None,
        "localEvidenceSourceTreeSha256": None,
        "matchesLocalEvidence": None,
    }
    if local_head_sha != commit_sha:
        failures.append(
            f"requested deployment commit {commit_sha} does not match local HEAD {local_head_sha}"
        )
    if not worktree_state.tracked_clean:
        failures.append("tracked worktree has uncommitted changes")
    if not worktree_state.deployable_files_tracked:
        failures.append("deployable site tree contains untracked files")
    if failures:
        return _write_deployment_result(
            deployment_results_path,
            payload,
            started_at_monotonic=started_at_monotonic,
            passed=False,
        )

    try:
        payload["codexContentSha256"] = read_codex_content_sha256(CODEX_MANIFEST_PATH)
    except DeploymentValidationError as exc:
        failures.append(str(exc))
        return _write_deployment_result(
            deployment_results_path,
            payload,
            started_at_monotonic=started_at_monotonic,
            passed=False,
        )

    expected_routed_check_ids: list[str] | None = None
    update_run_path: Path | None = None
    update_run_digest: str | None = None
    if impact_plan_path is not None:
        try:
            assert local_results_path is not None
            reviewed = load_reviewed_validation_evidence(impact_plan_path, local_results_path)
        except DeploymentValidationError as exc:
            failures.append(str(exc))
            return _write_deployment_result(
                deployment_results_path,
                payload,
                started_at_monotonic=started_at_monotonic,
                passed=False,
            )
        payload["reportDigest"] = reviewed.report_digest
        expected_routed_check_ids = sorted(
            str(check.get("id"))
            for check in reviewed.plan.get("checks", [])
            if isinstance(check, dict) and check.get("id")
        )
        payload["reviewPlan"] = {
            "path": str(reviewed.plan_path),
            "sha256": reviewed.plan_sha256,
            "schemaVersion": reviewed.plan.get("schemaVersion"),
            "checkCount": len(reviewed.plan.get("checks", [])),
            "affectedRecordCount": len(reviewed.plan.get("affectedRecords", [])),
            "routedCheckIds": expected_routed_check_ids,
        }
        payload["localValidation"] = _smoke_evidence_reference(
            reviewed.results_path,
            reviewed.results,
        )
        provenance = payload["provenance"]
        assert isinstance(provenance, dict)
        provenance["localEvidenceSourceTreeSha256"] = reviewed.source_tree_sha256
        provenance["matchesLocalEvidence"] = reviewed.source_tree_sha256 == source_tree["sha256"]
        if not provenance["matchesLocalEvidence"]:
            failures.append(
                "reviewed local smoke evidence source-tree fingerprint does not match the current site tree"
            )
            return _write_deployment_result(
                deployment_results_path,
                payload,
                started_at_monotonic=started_at_monotonic,
                passed=False,
            )
        update_run_path = _configured_update_run_path(
            args,
            impact_plan_path=impact_plan_path,
        )
        try:
            update_run_payload = require_update_run_ready_for_deployment(
                update_run_path,
                expected_digest=reviewed.report_digest,
                expected_plan_sha256=reviewed.plan_sha256,
                expected_local_results_sha256=reviewed.results_sha256,
            )
        except UpdateRunError as exc:
            failures.append(str(exc))
            return _write_deployment_result(
                deployment_results_path,
                payload,
                started_at_monotonic=started_at_monotonic,
                passed=False,
            )
        update_run_digest = reviewed.report_digest
        payload["updateRun"] = {
            "path": str(update_run_path),
            "runId": update_run_payload.get("runId"),
            "status": update_run_payload.get("status"),
            "nextAction": update_run_payload.get("nextAction"),
        }

    try:
        remote_state = inspect_git_remote_branch(branch=args.branch)
    except (OSError, subprocess.CalledProcessError, ValueError) as exc:
        failures.append(f"could not establish remote deployment provenance: {exc}")
        return _write_deployment_result(
            deployment_results_path,
            payload,
            started_at_monotonic=started_at_monotonic,
            passed=False,
        )
    provenance = payload["provenance"]
    assert isinstance(provenance, dict)
    repository_matches = (
        remote_state.github_repository is not None
        and remote_state.github_repository.casefold() == args.github_repo.casefold()
    )
    branch_matches = remote_state.head_sha == commit_sha
    provenance["remote"] = {
        "name": remote_state.remote_name,
        "url": remote_state.remote_url,
        "githubRepository": remote_state.github_repository,
        "repositoryMatchesConfigured": repository_matches,
        "branch": remote_state.branch,
        "headSha": remote_state.head_sha,
        "branchMatchesLocalHead": branch_matches,
    }
    if not repository_matches:
        failures.append(
            f"Git remote {remote_state.remote_name} does not match configured repository "
            f"{args.github_repo}"
        )
    if remote_state.head_sha is None:
        failures.append(
            f"Git remote {remote_state.remote_name} has no branch named {args.branch}"
        )
    elif not branch_matches:
        failures.append(
            f"Git remote {remote_state.remote_name}/{args.branch} at {remote_state.head_sha} "
            f"does not match local HEAD {commit_sha}"
        )
    if failures:
        return _write_deployment_result(
            deployment_results_path,
            payload,
            started_at_monotonic=started_at_monotonic,
            passed=False,
        )

    if update_run_path is not None and update_run_digest is not None:
        try:
            update_game_update_stage(
                update_run_path,
                expected_digest=update_run_digest,
                stage="commit",
                status="passed",
                details={
                    "commitSha": commit_sha,
                    "branch": args.branch,
                    "githubRepository": args.github_repo,
                    "sourceTreeSha256": source_tree["sha256"],
                    "remoteName": remote_state.remote_name,
                    "remoteUrl": remote_state.remote_url,
                    "remoteBranchHeadSha": remote_state.head_sha,
                },
            )
            update_run_payload = update_game_update_stage(
                update_run_path,
                expected_digest=update_run_digest,
                stage="deployment",
                status="running",
                details={"commitSha": commit_sha},
            )
        except UpdateRunError as exc:
            failures.append(str(exc))
            return _write_deployment_result(
                deployment_results_path,
                payload,
                started_at_monotonic=started_at_monotonic,
                passed=False,
            )
        payload["updateRun"] = {
            "path": str(update_run_path),
            "runId": update_run_payload.get("runId"),
            "status": update_run_payload.get("status"),
            "nextAction": update_run_payload.get("nextAction"),
        }

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
    payload["workflows"] = [
        {
            "name": result.name,
            "status": result.status,
            "conclusion": result.conclusion,
            "url": result.url,
            "passed": result.ok,
        }
        for result in workflow_results
    ]
    if not all(result.ok for result in workflow_results):
        failures.append("one or more required deployment workflows did not complete successfully")
        return _finish_deployment_result(
            deployment_results_path,
            payload,
            started_at_monotonic=started_at_monotonic,
            passed=False,
            update_run_path=update_run_path,
            update_run_digest=update_run_digest,
            update_run_stage="deployment" if update_run_path else None,
            update_run_status="failed" if update_run_path else None,
            update_run_details={"commitSha": commit_sha, "failedStep": "github-workflows"},
        )

    if update_run_path is not None and update_run_digest is not None:
        try:
            update_game_update_stage(
                update_run_path,
                expected_digest=update_run_digest,
                stage="deployment",
                status="passed",
                details={"commitSha": commit_sha, "workflowCount": len(workflow_results)},
            )
        except UpdateRunError as exc:
            failures.append(f"could not update deployment stage: {exc}")
            return _write_deployment_result(
                deployment_results_path,
                payload,
                started_at_monotonic=started_at_monotonic,
                passed=False,
            )

    verify_code = _run_workflow_step("verify-live", run_verify_live, args)
    live_check_results = getattr(args, "_live_check_results", [])
    payload["liveChecks"] = [
        {
            "label": result.label,
            "url": result.url,
            "status": "passed" if result.ok else "failed",
            "message": result.message,
        }
        for result in live_check_results
    ]
    if verify_code != 0:
        failures.append("live data, asset, or manifest verification failed")
        return _finish_deployment_result(
            deployment_results_path,
            payload,
            started_at_monotonic=started_at_monotonic,
            passed=False,
            update_run_path=update_run_path,
            update_run_digest=update_run_digest,
            update_run_stage="liveValidation" if update_run_path else None,
            update_run_status="failed" if update_run_path else None,
            update_run_details={"failedStep": "verify-live"},
        )

    smoke_args = _args_with(
        args,
        live=True,
        impact_plan=impact_plan_path,
        smoke_results_path=live_results_path,
    )
    smoke_code = _run_workflow_step("smoke-site --live", run_smoke_site, smoke_args)
    if live_results_path.is_file():
        try:
            raw_live_results = json.loads(live_results_path.read_text(encoding="utf-8"))
            if isinstance(raw_live_results, dict):
                payload["liveValidation"] = _smoke_evidence_reference(
                    live_results_path,
                    raw_live_results,
                )
        except (OSError, json.JSONDecodeError):
            pass
    if smoke_code != 0:
        failures.append("live browser validation failed")
        live_artifacts = {"liveValidation": live_results_path} if live_results_path.is_file() else None
        return _finish_deployment_result(
            deployment_results_path,
            payload,
            started_at_monotonic=started_at_monotonic,
            passed=False,
            update_run_path=update_run_path,
            update_run_digest=update_run_digest,
            update_run_stage="liveValidation" if update_run_path else None,
            update_run_status="failed" if update_run_path else None,
            update_run_details={"failedStep": "smoke-site --live"},
            update_run_artifacts=live_artifacts,
        )

    try:
        validated_live_results = load_smoke_validation_results(
            live_results_path,
            expected_digest=payload["reportDigest"] if impact_plan_path else None,
            expected_target="live",
            expected_mode="impact-plan" if impact_plan_path else "full",
            expected_check_ids=expected_routed_check_ids,
            expected_source_tree_sha256=str(source_tree["sha256"]),
        )
    except DeploymentValidationError as exc:
        failures.append(str(exc))
        return _finish_deployment_result(
            deployment_results_path,
            payload,
            started_at_monotonic=started_at_monotonic,
            passed=False,
            update_run_path=update_run_path,
            update_run_digest=update_run_digest,
            update_run_stage="liveValidation" if update_run_path else None,
            update_run_status="failed" if update_run_path else None,
            update_run_details={"failedStep": "live-evidence-validation", "error": str(exc)},
            update_run_artifacts={"liveValidation": live_results_path}
            if live_results_path.is_file()
            else None,
        )
    payload["liveValidation"] = _smoke_evidence_reference(
        live_results_path,
        validated_live_results,
    )
    return _finish_deployment_result(
        deployment_results_path,
        payload,
        started_at_monotonic=started_at_monotonic,
        passed=True,
        update_run_path=update_run_path,
        update_run_digest=update_run_digest,
        update_run_stage="liveValidation" if update_run_path else None,
        update_run_status="passed" if update_run_path else None,
        update_run_details={
            "siteUrl": args.site_url,
            "reportDigest": payload["reportDigest"],
        },
        update_run_artifacts={"liveValidation": live_results_path}
        if update_run_path
        else None,
        evidence_archive_root=args.update_archive_dir,
    )


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


def _format_optional(value) -> str:
    return "unknown" if value is None else str(value)


def _format_field_list(fields: list[str], *, max_fields: int = 24) -> str:
    if not fields:
        return "none"
    visible = fields[:max_fields]
    suffix = f", ... +{len(fields) - max_fields}" if len(fields) > max_fields else ""
    return ", ".join(visible) + suffix


def _format_inventory_path(path: Path) -> str:
    return path.as_posix()


def _configured_gf_json_dir(args: argparse.Namespace, *, client_root: Path | None = None) -> Path:
    if args.gf_json_dir:
        return args.gf_json_dir
    graphics_pack_path = (
        CLIENT_GRAPHICS_PACK_PATH
        if client_root is None
        else client_root / "Data" / "GraphicsPack" / "rogue_graphics.vpack"
    )
    fallback_dir = CLIENT_GF_JSON_DIR if client_root is None else client_root / "gf_json"
    if not graphics_pack_path.is_file():
        return fallback_dir
    log_path = CLIENT_LOG_PATH if client_root is None else client_root / "ProjectRogue.log"
    try:
        extract_vpack_files(
            graphics_pack_path,
            GENERATED_GRAPHICS_PACK_DIR,
            log_path=log_path,
        )
    except (OSError, VpackError) as exc:
        raise ExportError(f"failed to extract graphics VPACK: {exc}") from exc
    print(f"GRAPHICS SOURCE: {graphics_pack_path} -> {GENERATED_GRAPHICS_PACK_DIR}")
    return GENERATED_GRAPHICS_PACK_DIR


def _print_client_inventory_diff(report) -> None:
    for issue in report.issues:
        print(f"CLIENT INVENTORY DIFF ISSUE ERROR: {issue}")
    for entry in report.entries:
        print(
            f"DIFF {entry.change_type.upper()} {entry.section} {entry.key}: "
            f"{entry.summary}"
        )
    status = "changes detected" if report.has_changes else "no changes"
    if report.has_errors:
        status = f"blocked - {len(report.issues)} issue(s)"
    print(f"CLIENT INVENTORY DIFF STATUS: {status}")


def run_client_inventory(args: argparse.Namespace) -> int:
    client_root = args.client_root or CLIENT_ROOT
    pack_path = args.pack_path or (client_root / "Data" / "ClientPack" / "rogue_data.vpack")
    log_path = args.log_path or (client_root / "ProjectRogue.log")
    try:
        gf_json_dir = _configured_gf_json_dir(args, client_root=client_root)
        report = build_client_inventory_report(
            client_root,
            pack_path=pack_path,
            log_path=log_path,
            gf_json_dir=gf_json_dir,
        )
    except ExportError as exc:
        print(f"ERROR: {exc}")
        return 1
    setattr(args, "_client_inventory_report", report)

    print(f"CLIENT INVENTORY: {report.client_root}")
    print(
        "ROOT FILES: "
        f"{report.root_file_count} file(s), diagnostics={report.diagnostic_file_count}, "
        f"runtime={report.runtime_file_count}, zeroed-binary={report.zeroed_binary_count}"
    )
    for file in report.root_files:
        zeroed = " zeroed=yes" if file.zeroed_binary else ""
        print(f"ROOT FILE {file.path}: kind={file.kind} size={file.size_bytes}{zeroed}")

    if report.vpack_exists:
        print(
            "VPACK: "
            f"{_format_inventory_path(report.vpack_path)} size={_format_optional(report.vpack_size_bytes)} "
            f"sha256={_format_optional(report.vpack_sha256)} "
            f"schema={_format_optional(report.vpack_schema_version)} "
            f"build={_format_optional(report.vpack_build_version)} "
            f"files={len(report.vpack_files)}"
        )
        if report.vpack_compression:
            print(f"VPACK COMPRESSION: {report.vpack_compression}")
        if report.vpack_log_build_version is not None or report.vpack_log_file_count is not None:
            print(
                "VPACK LOG: "
                f"build={_format_optional(report.vpack_log_build_version)} "
                f"files={_format_optional(report.vpack_log_file_count)} "
                f"observed={len(report.vpack_log_loaded_files)}"
            )
        for file in report.vpack_files:
            sha_status = "ok" if file.sha256_ok else "error"
            print(
                f"VPACK FILE {file.path}: "
                f"original={file.original_size} compressed={file.compressed_size} sha256={sha_status}"
            )
    else:
        print(f"VPACK: missing ({_format_inventory_path(report.vpack_path)})")

    for summary in report.json_files:
        print(
            f"PACKED JSON {summary.path}: "
            f"collection={summary.primary_collection or 'none'} "
            f"groups={summary.group_count} records={summary.record_count} "
            f"fields={_format_field_list(summary.fields)}"
        )
        for issue in summary.issues:
            print(f"PACKED JSON ISSUE {summary.path}: {issue}")

    print(f"ATLASES: {len(report.atlases)} file(s)")
    for atlas in report.atlases:
        size = f"{atlas.width}x{atlas.height}" if atlas.width is not None and atlas.height is not None else "unknown"
        print(
            f"ATLAS {atlas.path}: "
            f"name={atlas.name or 'unknown'} size={size} "
            f"bytes={atlas.size_bytes} sha256={atlas.sha256 or 'unknown'}"
        )
        if atlas.issue:
            print(f"ATLAS ISSUE {atlas.path}: {atlas.issue}")

    for diagnostic in report.diagnostics:
        print(
            f"DIAGNOSTIC {diagnostic.path}: "
            f"keys={_format_field_list(diagnostic.keys)} ({diagnostic.note})"
        )

    for issue in report.issues:
        print(f"CLIENT INVENTORY ISSUE ERROR: {issue}")

    exit_code = 0 if report.ready else 1
    current_snapshot = build_client_inventory_snapshot(report)
    if args.diff_snapshot:
        print(f"CLIENT INVENTORY DIFF: {args.snapshot_path}")
        try:
            previous_snapshot = load_client_inventory_snapshot(args.snapshot_path)
            diff_report = diff_client_inventory_snapshots(previous_snapshot, current_snapshot)
        except (OSError, json.JSONDecodeError, ValueError) as exc:
            setattr(args, "_client_inventory_diff_report", ClientInventoryDiffReport([], [str(exc)]))
            print(f"CLIENT INVENTORY DIFF ISSUE ERROR: {exc}")
            print("CLIENT INVENTORY DIFF STATUS: blocked - 1 issue(s)")
            exit_code = 1
        else:
            setattr(args, "_client_inventory_diff_report", diff_report)
            _print_client_inventory_diff(diff_report)
            if diff_report.has_errors:
                exit_code = 1

    if args.write_snapshot:
        try:
            written_path = write_client_inventory_snapshot(report, args.snapshot_path)
        except OSError as exc:
            print(f"CLIENT INVENTORY SNAPSHOT ISSUE ERROR: {exc}")
            exit_code = 1
        else:
            print(f"WROTE CLIENT INVENTORY SNAPSHOT: {written_path}")

    print(f"CLIENT INVENTORY READINESS: {'READY' if report.ready else 'BLOCKED'}")
    return exit_code


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
        decrypted = extract_vpack_files(pack_path, output_dir, log_path=args.log_path or CLIENT_LOG_PATH)
        for file in decrypted.files:
            output_path = resolve_vpack_output_path(output_dir, file.path)
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


def _print_item_relationship_report(report) -> None:
    print(
        f"RELATIONSHIP SUMMARY: {report.total_items} items, "
        f"{report.confirmed_count} confirmed, {report.candidate_count} candidates, {report.gap_count} gaps"
    )
    name_counts = {}
    for record in report.records:
        key = (record.item_kind, record.item_name)
        name_counts[key] = name_counts.get(key, 0) + 1

    def item_label(record) -> str:
        duplicate_suffix = f" #{record.item_id}" if name_counts.get((record.item_kind, record.item_name), 0) > 1 else ""
        return f"{record.item_kind} {record.item_name}{duplicate_suffix}"

    for record in report.records:
        if record.status == "confirmed":
            for relationship in record.confirmed:
                print(
                    f"CONFIRMED {item_label(record)}: "
                    f"{relationship.relationship_type} -> {relationship.target} ({relationship.evidence})"
                )
            continue
        if record.status == "candidate":
            for relationship in record.candidates:
                print(
                    f"CANDIDATE {item_label(record)}: "
                    f"{relationship.relationship_type} -> {relationship.target} ({relationship.evidence})"
                )
            continue
        print(f"GAP {item_label(record)}: no relationship evidence")

    for group in report.unknown_use_types:
        print(
            f"UNKNOWN {group.item_kind} {group.field_name} {group.value}: "
            f"{len(group.item_names)} item(s): {', '.join(group.item_names)}"
        )

    if report.target_coverage:
        print(
            f"TARGET COVERAGE: {len(report.target_coverage)} targets, "
            f"{report.linked_target_count} linked, {report.text_only_target_count} text-only, "
            f"{report.target_issue_count} issue(s)"
        )
    for coverage in report.target_coverage:
        if coverage.status == "linked":
            print(f"TARGET LINKED {coverage.target}: {coverage.href} ({coverage.relationship_count} relationship(s))")
        elif coverage.status == "text_only":
            print(f"TARGET TEXT-ONLY {coverage.target}: {coverage.reason} ({coverage.relationship_count} relationship(s))")
        elif coverage.status == "broken_link":
            print(
                f"TARGET BROKEN-LINK {coverage.target}: {coverage.href} "
                f"({coverage.issue}; {coverage.relationship_count} relationship(s))"
            )
        else:
            print(f"TARGET UNCLASSIFIED {coverage.target}: {coverage.issue} ({coverage.relationship_count} relationship(s))")

    if report.target_reviews:
        print(
            f"TARGET REVIEW: {report.target_review_count} text-only target(s), "
            f"{report.target_review_relationship_count} relationship(s) need source confirmation"
        )
    for review in report.target_reviews:
        print(
            f"TARGET REVIEW {review.target}: {review.next_step} "
            f"({review.relationship_count} relationship(s): {', '.join(review.item_labels)})"
        )
        if review.evidence:
            print(f"TARGET REVIEW EVIDENCE {review.target}: {review.evidence}")


def run_item_relationships() -> int:
    try:
        report = build_item_relationship_inventory()
    except ExportError as exc:
        print(f"ERROR: {exc}")
        return 1
    _print_item_relationship_report(report)
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
        skipped_changed = getattr(report, "skipped_changed", [])
        skipped_text = f", skipped changed={len(skipped_changed)}" if skipped_changed else ""
        print(
            f"ASSET SYNC {mode} {report.target_name}: "
            f"copied {len(report.copied)}, removed {len(report.removed)}, "
            f"manifest entries={report.manifest_count}, issues={len(report.issues)}{skipped_text} "
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
            gf_json_dir=_configured_gf_json_dir(args),
            asset_output_dir=args.asset_output_dir,
        )
    except ExportError as exc:
        print(f"ERROR: {exc}")
        return 1
    _print_game_update_report(report)
    setattr(args, "_game_update_report", report)
    setattr(args, "_game_update_report_safe_to_sync", report.safe_to_sync)
    gameplay_impact = build_gameplay_impact_report(report.diff_reports)
    impact_plan = build_impact_validation_plan(
        gameplay_impact,
        report_digest=gameplay_impact_digest(gameplay_impact),
    )
    setattr(args, "_impact_validation_plan", impact_plan)
    print(
        f"IMPACT VALIDATION PLAN: {len(impact_plan.checks)} check(s); "
        f"runners={','.join(impact_plan.automated_runners) or 'none'}"
    )
    for check in impact_plan.checks:
        print(f"  CHECK {check.check_id}: {check.label}")
    if args.review_checklist:
        _print_game_update_review_checklist(report)
    if args.write_summary:
        summary_path = report.output_dir / "game_update_summary.md"
        written_path = _write_game_update_summary(report, summary_path)
        print(f"WROTE SUMMARY: {written_path}")
        gameplay_impact_path = write_gameplay_impact_report(
            gameplay_impact,
            report.output_dir / "gameplay_impact_report.md",
        )
        setattr(args, "_gameplay_impact_artifact", gameplay_impact_path)
        print(f"WROTE GAMEPLAY IMPACT: {gameplay_impact_path}")
        gameplay_impact_json_path = write_gameplay_impact_json(
            gameplay_impact,
            report.output_dir / "gameplay_impact_report.json",
        )
        setattr(args, "_gameplay_impact_json_artifact", gameplay_impact_json_path)
        print(f"WROTE GAMEPLAY IMPACT JSON: {gameplay_impact_json_path}")
        print(f"GAMEPLAY IMPACT DIGEST: {gameplay_impact_digest(gameplay_impact)}")
        impact_plan_path = write_impact_validation_plan_json(
            impact_plan,
            report.output_dir / "impact_validation_plan.json",
        )
        setattr(args, "_impact_validation_plan_artifact", impact_plan_path)
        print(f"WROTE IMPACT VALIDATION PLAN: {impact_plan_path}")
    if args.write_image_review:
        artifact = write_asset_review_artifacts(report.asset_reports, output_dir=args.image_review_dir)
        setattr(args, "_asset_image_review_artifact", artifact)
        print(f"WROTE IMAGE REVIEW: {artifact.markdown_path}")
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


def _priority_image_change_filter(before_path: Path, after_path: Path, _image_name: str) -> bool:
    return classify_image_change(before_path, after_path) in PRIORITY_IMAGE_CHANGE_CLASSIFICATIONS


def _image_sync_changed_filter(args: argparse.Namespace):
    if (getattr(args, "image_sync_scope", None) or "all") == "priority":
        return _priority_image_change_filter
    return None


def run_sync_assets(args: argparse.Namespace) -> int:
    try:
        targets = _resolve_sync_asset_targets(args)
    except ValueError as exc:
        print(f"ERROR: {exc}")
        return 1
    changed_filter = _image_sync_changed_filter(args)
    sync_kwargs = {"dry_run": args.dry_run}
    if changed_filter is not None:
        sync_kwargs["changed_filter"] = changed_filter
    reports = sync_asset_targets(targets, **sync_kwargs)
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
        gf_json_dir=_configured_gf_json_dir(args),
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


def _workflow_asset_sync_args(args: argparse.Namespace) -> argparse.Namespace:
    asset_args = _workflow_asset_args(args)
    if getattr(asset_args, "image_sync_scope", None) is None:
        return _args_with(asset_args, image_sync_scope="priority")
    return asset_args


def _workflow_asset_steps(label_prefix: str, args: argparse.Namespace, *, dry_run: bool) -> list[tuple[str, object, argparse.Namespace]]:
    asset_args = _workflow_asset_sync_args(args)
    if asset_args.asset_source == "client":
        return [(f"{label_prefix}sync-assets" if label_prefix else "sync-assets", run_sync_assets, _args_with(asset_args, dry_run=dry_run))]
    return [
        (f"{label_prefix}extract-atlas-assets" if label_prefix else "extract-atlas-assets", run_extract_atlas_assets, asset_args),
        (f"{label_prefix}sync-assets" if label_prefix else "sync-assets", run_sync_assets, _args_with(asset_args, dry_run=dry_run)),
    ]


def _mark_workflow_update_stage(
    args: argparse.Namespace,
    *,
    stage: str,
    status: str,
    details: dict[str, object] | None = None,
    artifacts: dict[str, Path] | None = None,
) -> bool:
    run_path = getattr(args, "_game_update_run_path", None)
    report_digest = getattr(args, "_game_update_run_digest", None)
    if run_path is None or report_digest is None:
        return True
    try:
        update_game_update_stage(
            run_path,
            expected_digest=report_digest,
            stage=stage,
            status=status,
            details=details,
            artifacts=artifacts,
        )
    except UpdateRunError as exc:
        print(f"UPDATE RUN ERROR: {exc}")
        return False
    print(f"UPDATE RUN STAGE {stage}: {status.upper()}")
    return True


def run_game_update_workflow(args: argparse.Namespace) -> int:
    asset_args = _workflow_asset_args(args)
    inventory_args = _args_with(args, diff_snapshot=True, write_snapshot=False)
    review_steps = [
        ("client-inventory --diff-snapshot", run_client_inventory, inventory_args),
        ("doctor", run_doctor, args),
        ("game-update-report", run_game_update_report, asset_args),
        ("sync-generated --dry-run", run_sync_generated, _args_with(args, dry_run=True)),
    ]
    review_steps.extend(_workflow_asset_steps("", args, dry_run=True))
    for label, runner, step_args in review_steps:
        code = _run_workflow_step(label, runner, step_args)
        if code != 0:
            return code

    if args.write_summary:
        game_update_report = getattr(asset_args, "_game_update_report", getattr(args, "_game_update_report", None))
        if game_update_report is None:
            print("WORKFLOW SUMMARY ISSUE ERROR: game update report was not captured")
            return 1
        inventory_diff_report = getattr(inventory_args, "_client_inventory_diff_report", None)
        image_review_artifact = getattr(asset_args, "_asset_image_review_artifact", getattr(args, "_asset_image_review_artifact", None))
        gameplay_impact_artifact = getattr(
            asset_args,
            "_gameplay_impact_artifact",
            getattr(args, "_gameplay_impact_artifact", None),
        )
        gameplay_impact_json_artifact = getattr(
            asset_args,
            "_gameplay_impact_json_artifact",
            getattr(args, "_gameplay_impact_json_artifact", None),
        )
        impact_validation_plan = getattr(
            asset_args,
            "_impact_validation_plan",
            getattr(args, "_impact_validation_plan", None),
        )
        impact = build_gameplay_impact_report(game_update_report.diff_reports)
        if impact_validation_plan is None:
            impact_validation_plan = build_impact_validation_plan(
                impact,
                report_digest=gameplay_impact_digest(impact),
            )
        impact_validation_plan_artifact = getattr(
            asset_args,
            "_impact_validation_plan_artifact",
            getattr(args, "_impact_validation_plan_artifact", None),
        )
        if impact_validation_plan_artifact is None:
            impact_validation_plan_artifact = write_impact_validation_plan_json(
                impact_validation_plan,
                args.output_dir / "impact_validation_plan.json",
            )
        setattr(asset_args, "_impact_validation_plan", impact_validation_plan)
        setattr(asset_args, "_impact_validation_plan_artifact", impact_validation_plan_artifact)
        summary_path = args.output_dir / "game_update_workflow_summary.md"
        game_update_run_path = _configured_update_run_path(args)
        written_path = _write_game_update_workflow_summary(
            inventory_diff_report,
            game_update_report,
            summary_path,
            apply_requested=args.apply,
            image_review_artifact=image_review_artifact,
            gameplay_impact_artifact=gameplay_impact_artifact,
            gameplay_impact_json_artifact=gameplay_impact_json_artifact,
            impact_validation_plan=impact_validation_plan,
            impact_validation_plan_artifact=impact_validation_plan_artifact,
            game_update_run_artifact=game_update_run_path,
            risk_gate_enabled=args.risk_gate,
            acknowledged_impact=args.acknowledge_impact,
        )
        print(f"WROTE WORKFLOW SUMMARY: {written_path}")
        inventory_report = getattr(inventory_args, "_client_inventory_report", None)
        if inventory_report is not None:
            source_fingerprint = stable_payload_sha256(
                build_client_inventory_snapshot(inventory_report)
            )
        else:
            source_fingerprint = stable_payload_sha256(
                {
                    "reportDigest": impact_validation_plan.report_digest,
                    "inventoryChanges": [
                        {
                            "section": entry.section,
                            "key": entry.key,
                            "changeType": entry.change_type,
                            "summary": entry.summary,
                        }
                        for entry in (inventory_diff_report.entries if inventory_diff_report else [])
                    ],
                    "inventoryIssues": inventory_diff_report.issues if inventory_diff_report else [],
                }
            )
        run_artifacts = {
            "workflowSummary": written_path,
            "gameplayImpactReport": gameplay_impact_artifact,
            "gameplayImpactJson": gameplay_impact_json_artifact,
            "impactValidationPlan": impact_validation_plan_artifact,
        }
        filtered_run_artifacts = {
            name: artifact_path
            for name, artifact_path in run_artifacts.items()
            if artifact_path is not None and artifact_path.is_file()
        }
        if image_review_artifact is not None and image_review_artifact.markdown_path.is_file():
            filtered_run_artifacts["imageReview"] = image_review_artifact.markdown_path
        try:
            run_payload = initialize_game_update_run(
                game_update_run_path,
                report_digest=impact_validation_plan.report_digest,
                source_fingerprint=source_fingerprint,
                metadata={
                    "outputDir": str(args.output_dir.expanduser().resolve()),
                    "clientRoot": str(inventory_report.client_root) if inventory_report else None,
                    "clientVpackSha256": inventory_report.vpack_sha256 if inventory_report else None,
                    "syncReady": game_update_report.safe_to_sync,
                    "highestRisk": impact.highest_risk,
                    "browserSmokeRequired": impact_validation_plan.requires_browser_smoke,
                },
                artifacts=filtered_run_artifacts,
            )
        except UpdateRunError as exc:
            print(f"UPDATE RUN ERROR: {exc}")
            return 1
        for namespace in (args, asset_args):
            setattr(namespace, "_game_update_run_path", game_update_run_path)
            setattr(namespace, "_game_update_run_digest", impact_validation_plan.report_digest)
        print(
            f"UPDATE RUN: {game_update_run_path} "
            f"status={run_payload['status']} id={run_payload['runId']}"
        )

    if args.apply:
        if args.risk_gate:
            game_update_report = getattr(
                asset_args,
                "_game_update_report",
                getattr(args, "_game_update_report", None),
            )
            if game_update_report is None:
                print("WORKFLOW STOP apply: gameplay risk report was not captured")
                return 1
            if not _enforce_gameplay_risk_gate(game_update_report, args):
                return 1
        sync_ready = getattr(asset_args, "_game_update_report_safe_to_sync", getattr(args, "_game_update_report_safe_to_sync", None))
        if sync_ready is False and not args.force_apply:
            print("WORKFLOW STOP apply: sync readiness BLOCKED; rerun with --force-apply to override")
            return 1
        if sync_ready is False:
            print("WORKFLOW OVERRIDE apply: sync readiness BLOCKED; continuing because --force-apply was provided")
        if not _mark_workflow_update_stage(
            args,
            stage="review",
            status="passed",
            details={
                "riskGateEnabled": args.risk_gate,
                "acknowledgedImpact": args.acknowledge_impact,
                "forceApply": args.force_apply,
            },
        ):
            return 1
        if not _mark_workflow_update_stage(args, stage="apply", status="running"):
            return 1
        apply_steps = [
            ("sync-generated", run_sync_generated, _args_with(args, dry_run=False)),
            ("refresh-manifest", run_refresh_manifest, None),
        ]
        apply_steps[1:1] = _workflow_asset_steps("", args, dry_run=False)
        for label, runner, step_args in apply_steps:
            code = _run_workflow_step(label, runner, step_args) if step_args is not None else _run_workflow_step(label, runner)
            if code != 0:
                _mark_workflow_update_stage(
                    args,
                    stage="apply",
                    status="failed",
                    details={"failedStep": label, "exitCode": code},
                )
                return code

        if not _mark_workflow_update_stage(args, stage="apply", status="passed"):
            return 1
        if not _mark_workflow_update_stage(args, stage="localValidation", status="running"):
            return 1
        validate_code = _run_workflow_step("validate", run_validate)
        if validate_code != 0:
            _mark_workflow_update_stage(
                args,
                stage="localValidation",
                status="failed",
                details={"failedStep": "validate", "exitCode": validate_code},
            )
            return validate_code
        impact_validation_plan = getattr(
            asset_args,
            "_impact_validation_plan",
            getattr(args, "_impact_validation_plan", None),
        )
        impact_validation_results_artifact = None
        if impact_validation_plan is not None and impact_validation_plan.requires_browser_smoke:
            smoke_args = _args_with(args, live=False, _impact_validation_plan=impact_validation_plan)
            smoke_code = _run_workflow_step(
                f"impact smoke-site ({len(impact_validation_plan.checks)} routed checks)",
                run_smoke_site,
                smoke_args,
            )
            impact_validation_results_artifact = getattr(
                smoke_args,
                "_impact_validation_results_artifact",
                None,
            )
            if args.write_summary and impact_validation_results_artifact is not None:
                written_path = _write_game_update_workflow_summary(
                    inventory_diff_report,
                    game_update_report,
                    summary_path,
                    apply_requested=args.apply,
                    image_review_artifact=image_review_artifact,
                    gameplay_impact_artifact=gameplay_impact_artifact,
                    gameplay_impact_json_artifact=gameplay_impact_json_artifact,
                    impact_validation_plan=impact_validation_plan,
                    impact_validation_plan_artifact=impact_validation_plan_artifact,
                    impact_validation_results_artifact=impact_validation_results_artifact,
                    impact_validation_results_status=_smoke_results_status(impact_validation_results_artifact),
                    game_update_run_artifact=getattr(args, "_game_update_run_path", None),
                    risk_gate_enabled=args.risk_gate,
                    acknowledged_impact=args.acknowledge_impact,
                )
                print(f"UPDATED WORKFLOW SUMMARY: {written_path}")
            if smoke_code != 0:
                smoke_artifacts = (
                    {"localValidation": impact_validation_results_artifact}
                    if impact_validation_results_artifact is not None
                    else None
                )
                if smoke_artifacts is not None and args.write_summary:
                    smoke_artifacts["workflowSummary"] = summary_path
                _mark_workflow_update_stage(
                    args,
                    stage="localValidation",
                    status="failed",
                    details={"failedStep": "impact smoke-site", "exitCode": smoke_code},
                    artifacts=smoke_artifacts,
                )
                return smoke_code
        local_validation_artifacts = None
        local_validation_details: dict[str, object] = {
            "browserSmokeRequired": bool(
                impact_validation_plan is not None
                and impact_validation_plan.requires_browser_smoke
            )
        }
        if impact_validation_results_artifact is not None:
            local_validation_artifacts = {"localValidation": impact_validation_results_artifact}
            if args.write_summary:
                local_validation_artifacts["workflowSummary"] = summary_path
            local_validation_details["browserSmokeStatus"] = _smoke_results_status(
                impact_validation_results_artifact
            )
        if not _mark_workflow_update_stage(
            args,
            stage="localValidation",
            status="passed",
            details=local_validation_details,
            artifacts=local_validation_artifacts,
        ):
            return 1
        if not _mark_workflow_update_stage(args, stage="baseline", status="running"):
            return 1
        snapshot_code = _run_workflow_step(
            "client-inventory --write-snapshot",
            run_client_inventory,
            _args_with(args, diff_snapshot=False, write_snapshot=True),
        )
        if snapshot_code != 0:
            _mark_workflow_update_stage(
                args,
                stage="baseline",
                status="failed",
                details={"exitCode": snapshot_code},
            )
            return snapshot_code
        if not _mark_workflow_update_stage(
            args,
            stage="baseline",
            status="passed",
            details={"snapshotPath": str(args.snapshot_path.expanduser().resolve())},
        ):
            return 1

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
    if args.command == "client-inventory":
        return run_client_inventory(args)
    if args.command == "vpack-info":
        return run_vpack_info(args)
    if args.command == "vpack-extract":
        return run_vpack_extract(args)
    if args.command == "unknown-fields":
        return run_unknown_fields(args)
    if args.command == "item-relationships":
        return run_item_relationships()
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
    if args.command == "bump-static-version":
        return run_bump_static_version(args)
    if args.command == "release-check":
        return run_release_check(args)
    if args.command == "game-update-workflow":
        return run_game_update_workflow(args)
    if args.command == "game-update-history":
        return run_game_update_history(args)
    if args.command == "game-update-status":
        return run_game_update_status(args)
    parser.error(f"Unsupported command: {args.command}")
    return 2
