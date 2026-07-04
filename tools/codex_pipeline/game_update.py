from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

from tools.codex_pipeline.config import (
    CLIENT_GF_JSON_DIR,
    DROP_SOURCES_PATH,
    GENERATED_ATLAS_ASSET_DIR,
    GENERATED_OUTPUT_DIR,
    PERK_LABEL_OVERRIDES_PATH,
)
from tools.codex_pipeline.atlas_assets import (
    extract_atlas_assets_for_targets,
    generated_atlas_asset_targets,
    has_atlas_source,
)
from tools.codex_pipeline.assets import (
    AssetChangeReport,
    AssetTarget,
    DEFAULT_ASSET_TARGETS,
    build_asset_change_reports,
    validate_asset_data_parity,
)
from tools.codex_pipeline.asset_review import asset_report_has_priority_image_changes
from tools.codex_pipeline.drop_audit import DropSourceAuditReport, build_drop_source_audit_report
from tools.codex_pipeline.exports import (
    DataDiffReport,
    ExportError,
    ExportResult,
    ExportTarget,
    build_generated_diff_reports,
    export_client_data,
)
from tools.codex_pipeline.perks import load_perk_label_overrides
from tools.codex_pipeline.sources import SourceCheckResult, validate_export_sources
from tools.codex_pipeline.unknowns import UnknownFieldTargetReport, build_unknown_field_reports
from tools.codex_pipeline.validators.site import ValidationIssue, validate_corrupted_perk_labels


@dataclass(frozen=True)
class GameUpdateReport:
    output_dir: Path
    source_checks: list[SourceCheckResult]
    export_results: list[ExportResult]
    diff_reports: list[DataDiffReport]
    unknown_reports: list[UnknownFieldTargetReport]
    asset_reports: list[AssetChangeReport]
    drop_report: DropSourceAuditReport | None
    validation_issues: list[ValidationIssue]
    export_errors: list[str]
    skipped_sections: list[str]

    @property
    def has_changes(self) -> bool:
        return (
            any(report.has_changes for report in self.diff_reports)
            or any(report.has_changes for report in self.asset_reports)
        )

    @property
    def has_errors(self) -> bool:
        return (
            any(not check.ok for check in self.source_checks)
            or bool(self.export_errors)
            or any(issue.severity == "error" for issue in self.validation_issues)
            or any(
                issue.severity == "error"
                for report in self.asset_reports
                for issue in report.issues
            )
            or (
                self.drop_report is not None
                and any(issue.severity == "error" for issue in self.drop_report.validation_issues)
            )
        )

    @property
    def safe_to_sync(self) -> bool:
        return not self.has_errors and not any(
            asset_report_has_priority_image_changes(report)
            for report in self.asset_reports
        )


def _target_by_name(targets: Iterable[ExportTarget]) -> dict[str, ExportTarget]:
    return {target.name: target for target in targets}


def _read_json_list(path: Path, label: str) -> list[Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ExportError(f"{label} generated data failed to read at {path}: {exc}") from exc
    if not isinstance(data, list):
        raise ExportError(f"{label} generated data must be a JSON list: {path}")
    return data


def _build_generated_drop_report(
    targets: list[ExportTarget],
    *,
    output_dir: Path,
    drop_sources_path: Path,
    skipped_sections: list[str],
) -> DropSourceAuditReport | None:
    targets_by_name = _target_by_name(targets)
    required = {"weapons", "armors", "monsters"}
    if not required.issubset(targets_by_name):
        skipped_sections.append("drop report requires generated weapons, armors, and monsters")
        return None

    return build_drop_source_audit_report(
        drop_sources_path=drop_sources_path,
        armor_data_path=targets_by_name["armors"].generated_path(output_dir),
        weapon_data_path=targets_by_name["weapons"].generated_path(output_dir),
        monster_data_path=targets_by_name["monsters"].generated_path(output_dir),
    )


def _validate_generated_corrupted_perks(
    targets: list[ExportTarget],
    *,
    output_dir: Path,
    perk_label_overrides_path: Path,
    skipped_sections: list[str],
) -> list[ValidationIssue]:
    targets_by_name = _target_by_name(targets)
    item_targets = {name: target for name, target in targets_by_name.items() if name in {"weapons", "armors"}}
    if not item_targets:
        skipped_sections.append("corrupted perk validation requires generated weapons or armors")
        return []

    try:
        overrides = load_perk_label_overrides(perk_label_overrides_path)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        return [ValidationIssue("error", f"{perk_label_overrides_path} failed to read perk label overrides: {exc}")]

    item_data = {
        name: _read_json_list(target.generated_path(output_dir), name)
        for name, target in item_targets.items()
    }
    return validate_corrupted_perk_labels(item_data, corrupted_perk_overrides=overrides)


def _validate_generated_asset_data_parity(
    targets: list[ExportTarget],
    *,
    output_dir: Path,
    asset_targets: Iterable[AssetTarget],
    skipped_sections: list[str],
) -> list[ValidationIssue]:
    targets_by_name = _target_by_name(targets)
    issues: list[ValidationIssue] = []
    for asset_target in asset_targets:
        target = targets_by_name.get(asset_target.name)
        if target is None:
            skipped_sections.append(f"{asset_target.name} asset/data parity requires generated {asset_target.name}")
            continue
        issues.extend(
            validate_asset_data_parity(
                asset_target.name,
                target.generated_path(output_dir),
                _asset_manifest_path_for_parity(asset_target),
            )
        )
    return issues


def _asset_manifest_path_for_parity(asset_target: AssetTarget) -> Path:
    source_manifest = asset_target.client_dir / "manifest.json"
    return source_manifest if source_manifest.is_file() else asset_target.manifest_path


def _filter_asset_targets_for_exports(
    targets: list[ExportTarget],
    asset_targets: Iterable[AssetTarget],
) -> list[AssetTarget]:
    target_names = {target.name for target in targets}
    return [asset_target for asset_target in asset_targets if asset_target.name in target_names]


def _should_use_atlas_asset_source(
    asset_source: str,
    targets: list[ExportTarget],
    asset_targets: list[AssetTarget],
    *,
    gf_json_dir: Path,
) -> bool:
    if asset_source == "atlas":
        return True
    if asset_source == "client":
        return False
    if asset_source != "auto":
        raise ExportError(f"Unknown asset source: {asset_source}")
    return (
        any(not asset_target.client_dir.is_dir() for asset_target in asset_targets)
        and any(has_atlas_source(target.name, gf_json_dir=gf_json_dir) for target in targets)
    )


def _resolve_game_update_asset_targets(
    targets: list[ExportTarget],
    asset_targets: list[AssetTarget],
    *,
    output_dir: Path,
    asset_source: str,
    gf_json_dir: Path,
    asset_output_dir: Path,
) -> tuple[list[AssetTarget], list[ValidationIssue]]:
    if not _should_use_atlas_asset_source(asset_source, targets, asset_targets, gf_json_dir=gf_json_dir):
        return asset_targets, []

    scoped_asset_targets = _filter_asset_targets_for_exports(targets, asset_targets)
    scoped_asset_names = {target.name for target in scoped_asset_targets}
    scoped_export_targets = [target for target in targets if target.name in scoped_asset_names]
    atlas_reports = extract_atlas_assets_for_targets(
        scoped_export_targets,
        scoped_asset_targets,
        output_dir=output_dir,
        gf_json_dir=gf_json_dir,
        asset_output_dir=asset_output_dir,
    )
    issues = [
        ValidationIssue(issue.severity, f"{report.target_name} atlas extraction: {issue.message}")
        for report in atlas_reports
        for issue in report.issues
    ]
    return generated_atlas_asset_targets(scoped_asset_targets, asset_output_dir=asset_output_dir), issues


def build_game_update_report(
    targets: Iterable[ExportTarget],
    *,
    output_dir: Path = GENERATED_OUTPUT_DIR,
    python_executable: str = sys.executable,
    drop_sources_path: Path = DROP_SOURCES_PATH,
    perk_label_overrides_path: Path = PERK_LABEL_OVERRIDES_PATH,
    asset_targets: Iterable[AssetTarget] = DEFAULT_ASSET_TARGETS,
    asset_source: str = "auto",
    gf_json_dir: Path = CLIENT_GF_JSON_DIR,
    asset_output_dir: Path = GENERATED_ATLAS_ASSET_DIR,
) -> GameUpdateReport:
    target_list = list(targets)
    asset_target_list = list(asset_targets)
    output_dir = output_dir.expanduser().resolve()
    source_checks = validate_export_sources(target_list)
    skipped_sections: list[str] = []
    if any(not check.ok for check in source_checks):
        return GameUpdateReport(
            output_dir=output_dir,
            source_checks=source_checks,
            export_results=[],
            diff_reports=[],
            unknown_reports=[],
            asset_reports=[],
            drop_report=None,
            validation_issues=[],
            export_errors=[],
            skipped_sections=skipped_sections,
        )

    try:
        export_results = export_client_data(
            target_list,
            output_dir=output_dir,
            python_executable=python_executable,
        )
        diff_reports = build_generated_diff_reports(target_list, output_dir=output_dir)
        unknown_reports = build_unknown_field_reports(target_list, source="generated", output_dir=output_dir)
        report_asset_targets, atlas_issues = _resolve_game_update_asset_targets(
            target_list,
            asset_target_list,
            output_dir=output_dir,
            asset_source=asset_source,
            gf_json_dir=gf_json_dir,
            asset_output_dir=asset_output_dir,
        )
        asset_reports = build_asset_change_reports(report_asset_targets)
        drop_report = _build_generated_drop_report(
            target_list,
            output_dir=output_dir,
            drop_sources_path=drop_sources_path,
            skipped_sections=skipped_sections,
        )
        validation_issues = _validate_generated_corrupted_perks(
            target_list,
            output_dir=output_dir,
            perk_label_overrides_path=perk_label_overrides_path,
            skipped_sections=skipped_sections,
        )
        validation_issues.extend(atlas_issues)
        validation_issues.extend(
            _validate_generated_asset_data_parity(
                target_list,
                output_dir=output_dir,
                asset_targets=report_asset_targets,
                skipped_sections=skipped_sections,
            )
        )
        export_errors: list[str] = []
    except ExportError as exc:
        return GameUpdateReport(
            output_dir=output_dir,
            source_checks=source_checks,
            export_results=[],
            diff_reports=[],
            unknown_reports=[],
            asset_reports=[],
            drop_report=None,
            validation_issues=[],
            export_errors=[str(exc)],
            skipped_sections=skipped_sections,
        )

    return GameUpdateReport(
        output_dir=output_dir,
        source_checks=source_checks,
        export_results=export_results,
        diff_reports=diff_reports,
        unknown_reports=unknown_reports,
        asset_reports=asset_reports,
        drop_report=drop_report,
        validation_issues=validation_issues,
        export_errors=export_errors,
        skipped_sections=skipped_sections,
    )
