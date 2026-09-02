from __future__ import annotations

import json
import re
import shutil
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from tools.codex_pipeline.deployment_validation import file_sha256
from tools.codex_pipeline.update_run import load_game_update_run


EVIDENCE_ARCHIVE_SCHEMA_VERSION = 1
RUN_ID_PATTERN = re.compile(r"^sha256:([0-9a-f]{64})$")
REQUIRED_ARCHIVE_ROLES = frozenset(
    {
        "updateRun",
        "impactValidationPlan",
        "localValidation",
        "liveValidation",
        "deploymentValidation",
    }
)


class EvidenceArchiveError(ValueError):
    pass


@dataclass(frozen=True)
class EvidenceArchiveResult:
    path: Path
    manifest_path: Path
    created: bool
    file_count: int


@dataclass(frozen=True)
class EvidenceArchiveRecord:
    path: Path
    manifest_path: Path
    run_id: str
    archived_at: str
    report_digest: str
    commit_sha: str
    source_tree_sha256: str
    github_repository: str | None
    branch: str | None
    file_count: int


def _utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def evidence_archive_path(archive_root: Path, run_id: object) -> Path:
    match = RUN_ID_PATTERN.fullmatch(str(run_id))
    if match is None:
        raise EvidenceArchiveError(f"game update run has an invalid run ID: {run_id!r}")
    return archive_root.expanduser().resolve() / match.group(1)


def _stage_details(payload: dict[str, object], stage: str) -> dict[str, object]:
    stages = payload.get("stages")
    entry = stages.get(stage) if isinstance(stages, dict) else None
    if not isinstance(entry, dict) or entry.get("status") != "passed":
        raise EvidenceArchiveError(f"game update run stage is not passed: {stage}")
    details = entry.get("details")
    return details if isinstance(details, dict) else {}


def _safe_role_filename(role: str, source_path: Path) -> str:
    role_name = re.sub(r"[^A-Za-z0-9._-]+", "-", role).strip("-.") or "artifact"
    suffix = "".join(source_path.suffixes) or ".artifact"
    return f"artifacts/{role_name}{suffix}"


def _artifact_sources(payload: dict[str, object], run_path: Path) -> list[dict[str, object]]:
    sources: list[dict[str, object]] = [
        {
            "role": "updateRun",
            "source": run_path,
            "archivePath": "game_update_run.json",
            "expectedSha256": file_sha256(run_path),
        }
    ]
    artifacts = payload.get("artifacts")
    if not isinstance(artifacts, dict):
        raise EvidenceArchiveError("game update run artifacts section is invalid")
    for role in sorted(artifacts):
        entry = artifacts.get(role)
        source_value = entry.get("path") if isinstance(entry, dict) else None
        expected_sha256 = entry.get("sha256") if isinstance(entry, dict) else None
        if not isinstance(source_value, str) or not source_value or not isinstance(expected_sha256, str):
            raise EvidenceArchiveError(f"game update run artifact reference is incomplete: {role}")
        source_path = Path(source_value).expanduser().resolve()
        if not source_path.is_file():
            raise EvidenceArchiveError(f"game update run artifact is missing: {role}: {source_path}")
        actual_sha256 = file_sha256(source_path)
        if actual_sha256 != expected_sha256:
            raise EvidenceArchiveError(f"game update run artifact hash differs: {role}")
        sources.append(
            {
                "role": str(role),
                "source": source_path,
                "archivePath": _safe_role_filename(str(role), source_path),
                "expectedSha256": expected_sha256,
            }
        )
    source_roles = {str(source["role"]) for source in sources}
    missing_roles = sorted(REQUIRED_ARCHIVE_ROLES - source_roles)
    if missing_roles:
        raise EvidenceArchiveError(
            "game update run is missing required archive artifacts: " + ", ".join(missing_roles)
        )
    return sources


def _safe_archived_file(archive_path: Path, relative_path: str) -> Path:
    candidate = (archive_path / relative_path).resolve()
    try:
        candidate.relative_to(archive_path.resolve())
    except ValueError as exc:
        raise EvidenceArchiveError(
            f"evidence archive manifest contains an unsafe file path: {relative_path}"
        ) from exc
    return candidate


def _verify_existing_archive(
    archive_path: Path,
    *,
    run_id: str,
    report_digest: str,
    commit_sha: str,
    source_tree_sha256: str,
) -> EvidenceArchiveResult:
    manifest_path = archive_path / "archive_manifest.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise EvidenceArchiveError(f"existing evidence archive manifest could not be read: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise EvidenceArchiveError(f"existing evidence archive manifest is invalid JSON: {exc}") from exc
    if not isinstance(manifest, dict) or manifest.get("schemaVersion") != EVIDENCE_ARCHIVE_SCHEMA_VERSION:
        raise EvidenceArchiveError("existing evidence archive uses an unsupported schema")
    expected_identity = {
        "runId": run_id,
        "reportDigest": report_digest,
        "commitSha": commit_sha,
        "sourceTreeSha256": source_tree_sha256,
    }
    for field, expected in expected_identity.items():
        if manifest.get(field) != expected:
            raise EvidenceArchiveError(
                f"existing evidence archive {field} does not match this deployment"
            )
    files = manifest.get("files")
    if not isinstance(files, list):
        raise EvidenceArchiveError("existing evidence archive manifest is missing its file list")
    roles: set[str] = set()
    for entry in files:
        if not isinstance(entry, dict):
            raise EvidenceArchiveError("existing evidence archive contains an invalid file entry")
        role = entry.get("role")
        relative_path = entry.get("path")
        expected_sha256 = entry.get("sha256")
        if not all(isinstance(value, str) and value for value in (role, relative_path, expected_sha256)):
            raise EvidenceArchiveError("existing evidence archive contains an incomplete file entry")
        archived_file = _safe_archived_file(archive_path, relative_path)
        expected_size = entry.get("sizeBytes")
        if isinstance(expected_size, bool) or not isinstance(expected_size, int) or expected_size < 0:
            raise EvidenceArchiveError(
                f"existing evidence archive has an invalid file size: {role}"
            )
        if (
            not archived_file.is_file()
            or archived_file.stat().st_size != expected_size
            or file_sha256(archived_file) != expected_sha256
        ):
            raise EvidenceArchiveError(f"existing evidence archive file failed verification: {role}")
        roles.add(role)
    missing_roles = sorted(REQUIRED_ARCHIVE_ROLES - roles)
    if missing_roles:
        raise EvidenceArchiveError(
            "existing evidence archive is missing required files: " + ", ".join(missing_roles)
        )
    return EvidenceArchiveResult(
        path=archive_path,
        manifest_path=manifest_path,
        created=False,
        file_count=len(files),
    )


def discover_evidence_archives(archive_root: Path) -> tuple[Path, ...]:
    resolved_root = archive_root.expanduser().resolve()
    if not resolved_root.exists():
        return ()
    if not resolved_root.is_dir():
        raise EvidenceArchiveError(f"evidence archive root is not a directory: {resolved_root}")
    try:
        return tuple(sorted((path for path in resolved_root.iterdir() if not path.name.startswith("."))))
    except OSError as exc:
        raise EvidenceArchiveError(f"evidence archive root could not be read: {resolved_root}: {exc}") from exc


def verify_evidence_archive(archive_path: Path) -> EvidenceArchiveRecord:
    resolved_path = archive_path.expanduser().resolve()
    if not resolved_path.is_dir():
        raise EvidenceArchiveError(f"evidence archive path is not a directory: {resolved_path}")
    manifest_path = resolved_path / "archive_manifest.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise EvidenceArchiveError(f"evidence archive manifest could not be read: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise EvidenceArchiveError(f"evidence archive manifest is invalid JSON: {exc}") from exc
    if not isinstance(manifest, dict) or manifest.get("schemaVersion") != EVIDENCE_ARCHIVE_SCHEMA_VERSION:
        raise EvidenceArchiveError("evidence archive uses an unsupported schema")

    run_id = manifest.get("runId")
    run_match = RUN_ID_PATTERN.fullmatch(str(run_id))
    if run_match is None:
        raise EvidenceArchiveError("evidence archive manifest has an invalid run ID")
    if resolved_path.name != run_match.group(1):
        raise EvidenceArchiveError("evidence archive directory does not match its run ID")
    report_digest = manifest.get("reportDigest")
    if RUN_ID_PATTERN.fullmatch(str(report_digest)) is None:
        raise EvidenceArchiveError("evidence archive manifest has an invalid report digest")
    commit_sha = manifest.get("commitSha")
    if not isinstance(commit_sha, str) or not commit_sha:
        raise EvidenceArchiveError("evidence archive manifest is missing its commit")
    source_tree_sha256 = manifest.get("sourceTreeSha256")
    if not isinstance(source_tree_sha256, str) or re.fullmatch(r"[0-9a-f]{64}", source_tree_sha256) is None:
        raise EvidenceArchiveError("evidence archive manifest has an invalid source-tree fingerprint")
    archived_at = manifest.get("archivedAt")
    if not isinstance(archived_at, str) or not archived_at:
        raise EvidenceArchiveError("evidence archive manifest is missing its archive timestamp")

    verified = _verify_existing_archive(
        resolved_path,
        run_id=str(run_id),
        report_digest=str(report_digest),
        commit_sha=commit_sha,
        source_tree_sha256=source_tree_sha256,
    )
    github_repository = manifest.get("githubRepository")
    branch = manifest.get("branch")
    return EvidenceArchiveRecord(
        path=resolved_path,
        manifest_path=manifest_path,
        run_id=str(run_id),
        archived_at=archived_at,
        report_digest=str(report_digest),
        commit_sha=commit_sha,
        source_tree_sha256=source_tree_sha256,
        github_repository=str(github_repository) if github_repository else None,
        branch=str(branch) if branch else None,
        file_count=verified.file_count,
    )


def archive_game_update_evidence(
    run_path: Path,
    archive_root: Path,
    *,
    expected_digest: str,
    expected_commit_sha: str,
) -> EvidenceArchiveResult:
    resolved_run_path = run_path.expanduser().resolve()
    payload = load_game_update_run(resolved_run_path, expected_digest=expected_digest)
    if payload.get("status") != "complete":
        raise EvidenceArchiveError("game update run is not complete")
    commit_details = _stage_details(payload, "commit")
    _stage_details(payload, "deployment")
    _stage_details(payload, "liveValidation")
    commit_sha = commit_details.get("commitSha")
    if commit_sha != expected_commit_sha:
        raise EvidenceArchiveError("game update run commit does not match the deployed commit")
    source_tree_sha256 = commit_details.get("sourceTreeSha256")
    if not isinstance(source_tree_sha256, str) or len(source_tree_sha256) != 64:
        raise EvidenceArchiveError("game update run commit is missing its source-tree fingerprint")
    run_id = str(payload.get("runId"))
    report_digest = str(payload.get("reportDigest"))
    archive_path = evidence_archive_path(archive_root, run_id)
    if archive_path.exists():
        if not archive_path.is_dir():
            raise EvidenceArchiveError(f"evidence archive path is not a directory: {archive_path}")
        return _verify_existing_archive(
            archive_path,
            run_id=run_id,
            report_digest=report_digest,
            commit_sha=expected_commit_sha,
            source_tree_sha256=source_tree_sha256,
        )

    sources = _artifact_sources(payload, resolved_run_path)
    archive_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=f".{archive_path.name}.", dir=archive_path.parent) as tmp_dir:
        temporary_path = Path(tmp_dir)
        file_entries: list[dict[str, object]] = []
        for source in sources:
            source_path = source["source"]
            relative_path = str(source["archivePath"])
            assert isinstance(source_path, Path)
            destination = temporary_path / relative_path
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source_path, destination)
            file_entries.append(
                {
                    "role": source["role"],
                    "path": relative_path,
                    "sha256": file_sha256(destination),
                    "sizeBytes": destination.stat().st_size,
                }
            )
        manifest = {
            "schemaVersion": EVIDENCE_ARCHIVE_SCHEMA_VERSION,
            "archivedAt": _utc_timestamp(),
            "runId": run_id,
            "reportDigest": report_digest,
            "commitSha": expected_commit_sha,
            "sourceTreeSha256": source_tree_sha256,
            "githubRepository": commit_details.get("githubRepository"),
            "branch": commit_details.get("branch"),
            "files": file_entries,
        }
        (temporary_path / "archive_manifest.json").write_text(
            f"{json.dumps(manifest, indent=2)}\n",
            encoding="utf-8",
        )
        try:
            temporary_path.rename(archive_path)
        except OSError as exc:
            if archive_path.is_dir():
                return _verify_existing_archive(
                    archive_path,
                    run_id=run_id,
                    report_digest=report_digest,
                    commit_sha=expected_commit_sha,
                    source_tree_sha256=source_tree_sha256,
                )
            raise EvidenceArchiveError(f"could not finalize evidence archive: {exc}") from exc

    return EvidenceArchiveResult(
        path=archive_path,
        manifest_path=archive_path / "archive_manifest.json",
        created=True,
        file_count=len(sources),
    )
