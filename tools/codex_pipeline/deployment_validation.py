from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

from tools.codex_pipeline.provenance import (
    DEPLOYABLE_SITE_ROOTS,
    SOURCE_TREE_ALGORITHM,
    SOURCE_TREE_SCHEMA_VERSION,
)


class DeploymentValidationError(ValueError):
    pass


@dataclass(frozen=True)
class ReviewedValidationEvidence:
    report_digest: str
    plan_path: Path
    plan_sha256: str
    plan: dict[str, object]
    results_path: Path
    results_sha256: str
    results: dict[str, object]
    source_tree: dict[str, object]
    source_tree_sha256: str


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _is_sha256_digest(value: object, *, prefix: bool) -> bool:
    if not isinstance(value, str):
        return False
    candidate = value.removeprefix("sha256:") if prefix else value
    if prefix and not value.startswith("sha256:"):
        return False
    return len(candidate) == 64 and all(character in "0123456789abcdef" for character in candidate.lower())


def _read_json_object(path: Path, label: str) -> dict[str, object]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise DeploymentValidationError(f"{label} could not be read: {path}: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise DeploymentValidationError(f"{label} is not valid JSON: {path}: {exc}") from exc
    if not isinstance(payload, dict):
        raise DeploymentValidationError(f"{label} must contain a JSON object: {path}")
    return payload


def validate_source_tree_evidence(
    payload: dict[str, object],
    *,
    label: str,
    expected_sha256: str | None = None,
) -> dict[str, object]:
    source_tree = payload.get("sourceTree")
    if not isinstance(source_tree, dict):
        raise DeploymentValidationError(f"{label} is missing its source-tree fingerprint")
    if source_tree.get("schemaVersion") != SOURCE_TREE_SCHEMA_VERSION:
        raise DeploymentValidationError(
            f"{label} source-tree fingerprint uses unsupported schema: "
            f"{source_tree.get('schemaVersion')}"
        )
    if source_tree.get("algorithm") != SOURCE_TREE_ALGORITHM:
        raise DeploymentValidationError(
            f"{label} source-tree fingerprint uses unsupported algorithm: "
            f"{source_tree.get('algorithm')!r}"
        )
    source_sha256 = source_tree.get("sha256")
    if not _is_sha256_digest(source_sha256, prefix=False):
        raise DeploymentValidationError(f"{label} source-tree fingerprint is missing its SHA-256")
    file_count = source_tree.get("fileCount")
    if isinstance(file_count, bool) or not isinstance(file_count, int) or file_count < 1:
        raise DeploymentValidationError(f"{label} source-tree fingerprint has an invalid file count")
    if source_tree.get("roots") != list(DEPLOYABLE_SITE_ROOTS):
        raise DeploymentValidationError(f"{label} source-tree fingerprint uses unexpected roots")
    if expected_sha256 is not None and source_sha256 != expected_sha256:
        raise DeploymentValidationError(
            f"{label} source-tree fingerprint does not match the reviewed local site tree"
        )
    return source_tree


def load_reviewed_validation_evidence(
    plan_path: Path,
    results_path: Path,
) -> ReviewedValidationEvidence:
    resolved_plan_path = plan_path.expanduser().resolve()
    resolved_results_path = results_path.expanduser().resolve()
    plan = _read_json_object(resolved_plan_path, "impact validation plan")
    if plan.get("schemaVersion") != 2:
        raise DeploymentValidationError(
            f"impact validation plan uses unsupported schema: {plan.get('schemaVersion')}"
        )
    report_digest = plan.get("reportDigest")
    if not _is_sha256_digest(report_digest, prefix=True):
        raise DeploymentValidationError("impact validation plan is missing its report digest")
    checks = plan.get("checks")
    affected_records = plan.get("affectedRecords")
    if not isinstance(checks, list) or not isinstance(affected_records, list):
        raise DeploymentValidationError("impact validation plan is missing checks or affectedRecords")

    expected_check_ids = sorted(
        str(check.get("id"))
        for check in checks
        if isinstance(check, dict) and check.get("id")
    )
    results = load_smoke_validation_results(
        resolved_results_path,
        expected_digest=report_digest,
        expected_target="local",
        expected_mode="impact-plan",
        expected_check_ids=expected_check_ids,
    )
    source_tree = validate_source_tree_evidence(
        results,
        label="local smoke validation results",
    )

    return ReviewedValidationEvidence(
        report_digest=report_digest,
        plan_path=resolved_plan_path,
        plan_sha256=file_sha256(resolved_plan_path),
        plan=plan,
        results_path=resolved_results_path,
        results_sha256=file_sha256(resolved_results_path),
        results=results,
        source_tree=source_tree,
        source_tree_sha256=str(source_tree["sha256"]),
    )


def load_smoke_validation_results(
    results_path: Path,
    *,
    expected_digest: object = None,
    expected_target: str,
    expected_mode: str,
    expected_check_ids: list[str] | None = None,
    expected_source_tree_sha256: str | None = None,
) -> dict[str, object]:
    resolved_results_path = results_path.expanduser().resolve()
    results = _read_json_object(resolved_results_path, "smoke validation results")
    if results.get("schemaVersion") != 1:
        raise DeploymentValidationError(
            f"smoke validation results use unsupported schema: {results.get('schemaVersion')}"
        )
    if results.get("status") != "passed":
        raise DeploymentValidationError(
            f"smoke validation results are not passed: {results.get('status')}"
        )
    if results.get("target") != expected_target:
        raise DeploymentValidationError(
            f"smoke validation results target is {results.get('target')!r}, expected {expected_target!r}"
        )
    if results.get("mode") != expected_mode:
        raise DeploymentValidationError(
            f"smoke validation results mode is {results.get('mode')!r}, expected {expected_mode!r}"
        )
    if expected_digest is not None and results.get("reportDigest") != expected_digest:
        raise DeploymentValidationError(
            "smoke validation results report digest does not match the impact validation plan"
        )
    if expected_check_ids is not None:
        result_plan = results.get("plan")
        routed_check_ids = result_plan.get("routedCheckIds") if isinstance(result_plan, dict) else None
        if routed_check_ids != expected_check_ids:
            raise DeploymentValidationError(
                "smoke validation results routed checks do not match the impact validation plan"
            )
    failures = results.get("failures")
    if failures not in (None, []):
        raise DeploymentValidationError("passed smoke validation results still contain failures")
    summary = results.get("summary")
    if not isinstance(summary, dict):
        raise DeploymentValidationError("smoke validation results are missing their summary")
    if summary.get("failedGroups") not in (None, 0) or summary.get("failedRecords") not in (None, 0):
        raise DeploymentValidationError("passed smoke validation results contain failed checks")
    if (
        summary.get("groupCount") is not None
        and summary.get("passedGroups") is not None
        and summary.get("groupCount") != summary.get("passedGroups")
    ):
        raise DeploymentValidationError("smoke validation group totals are inconsistent")
    if (
        summary.get("recordCount") is not None
        and summary.get("passedRecords") is not None
        and summary.get("recordCount") != summary.get("passedRecords")
    ):
        raise DeploymentValidationError("smoke validation record totals are inconsistent")
    validate_source_tree_evidence(
        results,
        label=f"{expected_target} smoke validation results",
        expected_sha256=expected_source_tree_sha256,
    )
    return results


def read_codex_content_sha256(manifest_path: Path) -> str:
    manifest = _read_json_object(manifest_path.expanduser().resolve(), "Codex manifest")
    summary = manifest.get("summary")
    digest = summary.get("content_sha256") if isinstance(summary, dict) else None
    if not _is_sha256_digest(digest, prefix=False):
        raise DeploymentValidationError("Codex manifest is missing summary.content_sha256")
    return digest


def write_deployment_validation_results(path: Path, payload: dict[str, object]) -> Path:
    resolved_path = path.expanduser().resolve()
    resolved_path.parent.mkdir(parents=True, exist_ok=True)
    resolved_path.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")
    return resolved_path
