from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Mapping

from tools.codex_pipeline.deployment_validation import file_sha256


UPDATE_RUN_SCHEMA_VERSION = 1
UPDATE_RUN_STAGES = (
    "discovery",
    "review",
    "apply",
    "localValidation",
    "baseline",
    "commit",
    "deployment",
    "liveValidation",
)


class UpdateRunError(ValueError):
    pass


def _utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def artifact_reference(path: Path, *, require_exists: bool = True) -> dict[str, object]:
    resolved_path = path.expanduser().resolve()
    if not resolved_path.is_file():
        if require_exists:
            raise UpdateRunError(f"update-run artifact does not exist: {resolved_path}")
        return {"path": str(resolved_path), "sha256": None}
    try:
        sha256 = file_sha256(resolved_path)
    except OSError as exc:
        raise UpdateRunError(f"update-run artifact could not be hashed: {resolved_path}: {exc}") from exc
    return {"path": str(resolved_path), "sha256": sha256}


def _new_stage(status: str = "pending") -> dict[str, object]:
    return {"status": status, "updatedAt": _utc_timestamp(), "details": {}}


def stable_payload_sha256(payload: object) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def game_update_run_id(report_digest: str, source_fingerprint: str) -> str:
    return "sha256:" + stable_payload_sha256(
        {"reportDigest": report_digest, "sourceFingerprint": source_fingerprint}
    )


def _new_update_run(report_digest: str, run_id: str) -> dict[str, object]:
    now = _utc_timestamp()
    return {
        "schemaVersion": UPDATE_RUN_SCHEMA_VERSION,
        "runId": run_id,
        "reportDigest": report_digest,
        "createdAt": now,
        "updatedAt": now,
        "status": "awaiting_review",
        "nextAction": None,
        "metadata": {},
        "artifacts": {},
        "stages": {stage: _new_stage() for stage in UPDATE_RUN_STAGES},
    }


def _read_update_run(path: Path) -> dict[str, object]:
    resolved_path = path.expanduser().resolve()
    try:
        payload = json.loads(resolved_path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise UpdateRunError(f"game update run could not be read: {resolved_path}: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise UpdateRunError(f"game update run is not valid JSON: {resolved_path}: {exc}") from exc
    if not isinstance(payload, dict):
        raise UpdateRunError(f"game update run must contain a JSON object: {resolved_path}")
    if payload.get("schemaVersion") != UPDATE_RUN_SCHEMA_VERSION:
        raise UpdateRunError(f"game update run uses unsupported schema: {payload.get('schemaVersion')}")
    stages = payload.get("stages")
    if not isinstance(stages, dict) or any(stage not in stages for stage in UPDATE_RUN_STAGES):
        raise UpdateRunError("game update run is missing required stages")
    return payload


def load_game_update_run(path: Path, *, expected_digest: str | None = None) -> dict[str, object]:
    payload = _read_update_run(path)
    if expected_digest is not None and payload.get("reportDigest") != expected_digest:
        raise UpdateRunError(
            "game update run report digest does not match the reviewed impact validation plan"
        )
    return payload


def _stage_status(payload: dict[str, object], stage: str) -> str:
    stages = payload.get("stages")
    entry = stages.get(stage) if isinstance(stages, dict) else None
    return str(entry.get("status")) if isinstance(entry, dict) else "missing"


def _impact_plan_path(payload: dict[str, object]) -> str | None:
    artifacts = payload.get("artifacts")
    entry = artifacts.get("impactValidationPlan") if isinstance(artifacts, dict) else None
    path = entry.get("path") if isinstance(entry, dict) else None
    return str(path) if path else None


def _output_dir_argument(payload: dict[str, object]) -> str:
    metadata = payload.get("metadata")
    output_dir = metadata.get("outputDir") if isinstance(metadata, dict) else None
    return f' --output-dir "{output_dir}"' if output_dir else ""


def _guarded_apply_command(payload: dict[str, object]) -> str:
    digest = payload.get("reportDigest")
    return (
        "python -m tools.codex_pipeline game-update-workflow --apply --risk-gate "
        f"--write-summary --acknowledge-impact {digest}{_output_dir_argument(payload)}"
    )


def _derive_run_state(payload: dict[str, object]) -> tuple[str, dict[str, object] | None]:
    metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
    sync_ready = metadata.get("syncReady")
    stages = {stage: _stage_status(payload, stage) for stage in UPDATE_RUN_STAGES}

    if stages["discovery"] != "passed":
        return "discovery_required", {
            "stage": "discovery",
            "description": "Rerun the game update workflow to rebuild the client and generated-data review.",
            "command": (
                "python -m tools.codex_pipeline game-update-workflow --write-summary"
                + _output_dir_argument(payload)
            ),
        }
    if sync_ready is False and stages["apply"] != "passed":
        return "review_blocked", {
            "stage": "review",
            "description": "Resolve the workflow blockers before applying this update.",
            "command": (
                "python -m tools.codex_pipeline game-update-workflow --write-summary"
                + _output_dir_argument(payload)
            ),
        }
    if stages["review"] != "passed":
        return "awaiting_review", {
            "stage": "review",
            "description": "Review the generated update artifacts, then run the guarded apply command.",
            "command": _guarded_apply_command(payload),
        }
    for stage, description in (
        ("apply", "Rerun the guarded apply workflow."),
        ("localValidation", "Fix the local validation failure and rerun the guarded apply workflow."),
        ("baseline", "Rerun the guarded apply workflow so the accepted client baseline can be recorded."),
    ):
        if stages[stage] != "passed":
            return f"{stage}_required", {
                "stage": stage,
                "description": description,
                "command": _guarded_apply_command(payload),
            }
    if stages["commit"] != "passed":
        return "ready_to_commit", {
            "stage": "commit",
            "description": "Commit and push the validated update.",
            "command": None,
        }
    if stages["deployment"] != "passed" or stages["liveValidation"] != "passed":
        plan_path = _impact_plan_path(payload)
        command = "python -m tools.codex_pipeline verify-deploy"
        if plan_path:
            command += f' --impact-plan "{plan_path}"'
        return "deployment_required", {
            "stage": "deployment",
            "description": "Wait for the pushed commit and verify the same routed checks on the live site.",
            "command": command,
        }
    return "complete", None


def _refresh_run_state(payload: dict[str, object]) -> None:
    status, next_action = _derive_run_state(payload)
    payload["status"] = status
    payload["nextAction"] = next_action
    payload["updatedAt"] = _utc_timestamp()


def write_game_update_run(path: Path, payload: dict[str, object]) -> Path:
    resolved_path = path.expanduser().resolve()
    try:
        resolved_path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = resolved_path.with_name(f".{resolved_path.name}.tmp")
        temporary_path.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")
        temporary_path.replace(resolved_path)
    except OSError as exc:
        raise UpdateRunError(f"game update run could not be written: {resolved_path}: {exc}") from exc
    return resolved_path


def initialize_game_update_run(
    path: Path,
    *,
    report_digest: str,
    source_fingerprint: str,
    metadata: Mapping[str, object] | None = None,
    artifacts: Mapping[str, Path] | None = None,
) -> dict[str, object]:
    resolved_path = path.expanduser().resolve()
    run_id = game_update_run_id(report_digest, source_fingerprint)
    if resolved_path.is_file():
        existing = load_game_update_run(resolved_path)
        payload = existing if existing.get("runId") == run_id else _new_update_run(report_digest, run_id)
    else:
        payload = _new_update_run(report_digest, run_id)

    stored_metadata = payload.setdefault("metadata", {})
    if isinstance(stored_metadata, dict) and metadata:
        stored_metadata.update(metadata)
    if isinstance(stored_metadata, dict):
        stored_metadata["sourceFingerprint"] = source_fingerprint
    stored_artifacts = payload.setdefault("artifacts", {})
    if isinstance(stored_artifacts, dict) and artifacts:
        stored_artifacts.update(
            {name: artifact_reference(artifact_path) for name, artifact_path in artifacts.items()}
        )

    stages = payload["stages"]
    discovery = stages["discovery"]
    discovery.update(
        {
            "status": "passed",
            "updatedAt": _utc_timestamp(),
            "details": {"reportDigest": report_digest},
        }
    )
    if stages["review"].get("status") == "pending":
        stages["review"].update(
            {
                "status": "ready",
                "updatedAt": _utc_timestamp(),
                "details": {},
            }
        )
    _refresh_run_state(payload)
    write_game_update_run(resolved_path, payload)
    return payload


def update_game_update_stage(
    path: Path,
    *,
    expected_digest: str,
    stage: str,
    status: str,
    details: Mapping[str, object] | None = None,
    artifacts: Mapping[str, Path] | None = None,
) -> dict[str, object]:
    if stage not in UPDATE_RUN_STAGES:
        raise UpdateRunError(f"unknown game update stage: {stage}")
    payload = load_game_update_run(path, expected_digest=expected_digest)
    stages = payload["stages"]
    stages[stage] = {
        "status": status,
        "updatedAt": _utc_timestamp(),
        "details": dict(details or {}),
    }
    stored_artifacts = payload.setdefault("artifacts", {})
    if isinstance(stored_artifacts, dict) and artifacts:
        stored_artifacts.update(
            {name: artifact_reference(artifact_path) for name, artifact_path in artifacts.items()}
        )
    _refresh_run_state(payload)
    write_game_update_run(path, payload)
    return payload


def update_game_update_artifacts(
    path: Path,
    *,
    expected_digest: str,
    artifacts: Mapping[str, Path],
) -> dict[str, object]:
    payload = load_game_update_run(path, expected_digest=expected_digest)
    stored_artifacts = payload.setdefault("artifacts", {})
    if not isinstance(stored_artifacts, dict):
        raise UpdateRunError("game update run artifacts section is invalid")
    stored_artifacts.update(
        {name: artifact_reference(artifact_path) for name, artifact_path in artifacts.items()}
    )
    _refresh_run_state(payload)
    write_game_update_run(path, payload)
    return payload


def require_update_run_ready_for_deployment(
    path: Path,
    *,
    expected_digest: str,
    expected_plan_sha256: str | None = None,
    expected_local_results_sha256: str | None = None,
) -> dict[str, object]:
    payload = load_game_update_run(path, expected_digest=expected_digest)
    incomplete = [
        stage
        for stage in ("review", "apply", "localValidation", "baseline")
        if _stage_status(payload, stage) != "passed"
    ]
    if incomplete:
        raise UpdateRunError(
            "game update run is not ready for deployment; incomplete stages: "
            + ", ".join(incomplete)
        )
    artifacts = payload.get("artifacts")
    artifact_expectations = {
        "impactValidationPlan": expected_plan_sha256,
        "localValidation": expected_local_results_sha256,
    }
    for name, expected_sha256 in artifact_expectations.items():
        if expected_sha256 is None:
            continue
        entry = artifacts.get(name) if isinstance(artifacts, dict) else None
        actual_sha256 = entry.get("sha256") if isinstance(entry, dict) else None
        if actual_sha256 != expected_sha256:
            raise UpdateRunError(
                f"game update run {name} hash does not match the reviewed artifact"
            )
    return payload
