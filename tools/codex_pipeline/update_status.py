from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path

from tools.codex_pipeline.config import REPO_ROOT
from tools.codex_pipeline.deploy import resolve_git_commit
from tools.codex_pipeline.deployment_validation import (
    DeploymentValidationError,
    file_sha256,
    load_reviewed_validation_evidence,
)
from tools.codex_pipeline.provenance import (
    GitRemoteBranchState,
    GitWorktreeState,
    SourceTreeFingerprint,
    build_source_tree_fingerprint,
    inspect_git_remote_branch,
    inspect_git_worktree,
    is_git_ancestor,
)


PROVENANCE_READY_LEDGER_STATES = frozenset(
    {"ready_to_commit", "deployment_required", "complete"}
)


@dataclass(frozen=True)
class UpdateStatusAssessment:
    status: str
    exit_code: int
    artifact_count: int
    source_tree: SourceTreeFingerprint | None
    worktree: GitWorktreeState | None
    local_head_sha: str | None
    remote: GitRemoteBranchState | None
    issues: tuple[str, ...]
    next_action: str | None
    next_command: str | None


def _artifact_entry(
    payload: dict[str, object],
    name: str,
) -> tuple[Path | None, str | None]:
    artifacts = payload.get("artifacts")
    entry = artifacts.get(name) if isinstance(artifacts, dict) else None
    if not isinstance(entry, dict):
        return None, None
    path = entry.get("path")
    sha256 = entry.get("sha256")
    return (Path(path).expanduser().resolve() if isinstance(path, str) and path else None), (
        str(sha256) if sha256 else None
    )


def validate_update_run_artifacts(payload: dict[str, object]) -> tuple[int, tuple[str, ...]]:
    artifacts = payload.get("artifacts")
    if not isinstance(artifacts, dict):
        return 0, ("game update run artifacts section is invalid",)
    issues: list[str] = []
    verified_count = 0
    for name in sorted(artifacts):
        path, expected_sha256 = _artifact_entry(payload, name)
        if path is None or expected_sha256 is None:
            issues.append(f"{name} artifact reference is incomplete")
            continue
        if not path.is_file():
            issues.append(f"{name} artifact is missing: {path}")
            continue
        try:
            actual_sha256 = file_sha256(path)
        except OSError as exc:
            issues.append(f"{name} artifact could not be hashed: {path}: {exc}")
            continue
        if actual_sha256 != expected_sha256:
            issues.append(f"{name} artifact hash differs from the game update run")
            continue
        verified_count += 1
    return verified_count, tuple(issues)


def _ledger_next_action(payload: dict[str, object]) -> tuple[str | None, str | None]:
    next_action = payload.get("nextAction")
    if not isinstance(next_action, dict):
        return None, None
    description = next_action.get("description")
    command = next_action.get("command")
    return (
        str(description) if description else None,
        str(command) if command else None,
    )


def _verify_deploy_command(payload: dict[str, object]) -> str:
    plan_path, _ = _artifact_entry(payload, "impactValidationPlan")
    command = "python -m tools.codex_pipeline verify-deploy"
    if plan_path is not None:
        command += f' --impact-plan "{plan_path}"'
    return command


def _assessment(
    status: str,
    *,
    exit_code: int = 0,
    artifact_count: int = 0,
    source_tree: SourceTreeFingerprint | None = None,
    worktree: GitWorktreeState | None = None,
    local_head_sha: str | None = None,
    remote: GitRemoteBranchState | None = None,
    issues: tuple[str, ...] = (),
    next_action: str | None = None,
    next_command: str | None = None,
) -> UpdateStatusAssessment:
    return UpdateStatusAssessment(
        status=status,
        exit_code=exit_code,
        artifact_count=artifact_count,
        source_tree=source_tree,
        worktree=worktree,
        local_head_sha=local_head_sha,
        remote=remote,
        issues=issues,
        next_action=next_action,
        next_command=next_command,
    )


def assess_game_update_status(
    payload: dict[str, object],
    *,
    github_repository: str,
    branch: str,
    repo_root: Path = REPO_ROOT,
) -> UpdateStatusAssessment:
    artifact_count, artifact_issues = validate_update_run_artifacts(payload)
    if artifact_issues:
        return _assessment(
            "stale_evidence",
            exit_code=1,
            artifact_count=artifact_count,
            issues=artifact_issues,
            next_action="Rebuild or restore the changed review artifacts before continuing.",
        )

    ledger_status = str(payload.get("status") or "unknown")
    if ledger_status not in PROVENANCE_READY_LEDGER_STATES:
        next_action, next_command = _ledger_next_action(payload)
        return _assessment(
            ledger_status,
            artifact_count=artifact_count,
            next_action=next_action,
            next_command=next_command,
        )

    plan_path, _ = _artifact_entry(payload, "impactValidationPlan")
    local_results_path, _ = _artifact_entry(payload, "localValidation")
    if plan_path is None or local_results_path is None:
        return _assessment(
            "stale_evidence",
            exit_code=1,
            artifact_count=artifact_count,
            issues=("validated update run is missing its plan or local smoke evidence",),
            next_action="Rebuild the reviewed validation artifacts before continuing.",
        )
    try:
        reviewed = load_reviewed_validation_evidence(plan_path, local_results_path)
    except DeploymentValidationError as exc:
        return _assessment(
            "stale_evidence",
            exit_code=1,
            artifact_count=artifact_count,
            issues=(str(exc),),
            next_action="Regenerate the local validation evidence before continuing.",
        )
    if reviewed.report_digest != payload.get("reportDigest"):
        return _assessment(
            "stale_evidence",
            exit_code=1,
            artifact_count=artifact_count,
            issues=("reviewed evidence report digest differs from the game update run",),
            next_action="Rebuild the update review so all artifacts share one digest.",
        )

    try:
        source_tree = build_source_tree_fingerprint(repo_root)
    except (OSError, ValueError) as exc:
        return _assessment(
            "status_unavailable",
            exit_code=1,
            artifact_count=artifact_count,
            issues=(f"could not fingerprint the current source tree: {exc}",),
        )
    if source_tree.sha256 != reviewed.source_tree_sha256:
        return _assessment(
            "stale_evidence",
            exit_code=1,
            artifact_count=artifact_count,
            source_tree=source_tree,
            issues=("current source-tree fingerprint differs from local smoke evidence",),
            next_action="Rerun the routed local smoke checks for the current site tree.",
            next_command=f'python -m tools.codex_pipeline smoke-site --impact-plan "{plan_path}"',
        )

    try:
        worktree = inspect_git_worktree(repo_root)
    except (OSError, subprocess.CalledProcessError) as exc:
        return _assessment(
            "status_unavailable",
            exit_code=1,
            artifact_count=artifact_count,
            source_tree=source_tree,
            issues=(f"could not inspect the Git worktree: {exc}",),
        )
    if not worktree.tracked_clean or not worktree.deployable_files_tracked:
        if ledger_status == "ready_to_commit":
            return _assessment(
                "ready_to_commit",
                artifact_count=artifact_count,
                source_tree=source_tree,
                worktree=worktree,
                next_action="Commit the validated update, then rerun this status check.",
            )
        return _assessment(
            "uncommitted_changes",
            exit_code=1,
            artifact_count=artifact_count,
            source_tree=source_tree,
            worktree=worktree,
            issues=("worktree changed after the deployment commit was recorded",),
            next_action="Commit or remove the additional changes before deployment verification.",
        )

    try:
        local_head_sha = resolve_git_commit(repo_root=repo_root)
    except (OSError, subprocess.CalledProcessError) as exc:
        return _assessment(
            "status_unavailable",
            exit_code=1,
            artifact_count=artifact_count,
            source_tree=source_tree,
            worktree=worktree,
            issues=(f"could not resolve local HEAD: {exc}",),
        )

    if ledger_status in {"deployment_required", "complete"}:
        stages = payload.get("stages")
        commit_stage = stages.get("commit") if isinstance(stages, dict) else None
        details = commit_stage.get("details") if isinstance(commit_stage, dict) else None
        recorded_commit = details.get("commitSha") if isinstance(details, dict) else None
        if recorded_commit != local_head_sha:
            return _assessment(
                "stale_commit",
                exit_code=1,
                artifact_count=artifact_count,
                source_tree=source_tree,
                worktree=worktree,
                local_head_sha=local_head_sha,
                issues=("local HEAD differs from the commit recorded by the update run",),
                next_action="Return to the recorded commit or start a new reviewed update run.",
            )

    try:
        remote = inspect_git_remote_branch(repo_root, branch=branch)
    except (OSError, subprocess.CalledProcessError, ValueError) as exc:
        return _assessment(
            "remote_unavailable",
            exit_code=1,
            artifact_count=artifact_count,
            source_tree=source_tree,
            worktree=worktree,
            local_head_sha=local_head_sha,
            issues=(f"could not query origin/{branch}: {exc}",),
            next_action="Restore remote access and rerun this status check.",
        )
    if (
        remote.github_repository is None
        or remote.github_repository.casefold() != github_repository.casefold()
    ):
        return _assessment(
            "remote_mismatch",
            exit_code=1,
            artifact_count=artifact_count,
            source_tree=source_tree,
            worktree=worktree,
            local_head_sha=local_head_sha,
            remote=remote,
            issues=(f"origin does not identify configured repository {github_repository}",),
            next_action="Correct the Git remote or configured repository before continuing.",
        )
    if remote.head_sha != local_head_sha:
        if remote.head_sha is not None:
            try:
                remote_is_ancestor = is_git_ancestor(
                    remote.head_sha,
                    local_head_sha,
                    repo_root=repo_root,
                )
            except (OSError, subprocess.CalledProcessError) as exc:
                return _assessment(
                    "remote_diverged",
                    exit_code=1,
                    artifact_count=artifact_count,
                    source_tree=source_tree,
                    worktree=worktree,
                    local_head_sha=local_head_sha,
                    remote=remote,
                    issues=(f"could not prove origin/{branch} is an ancestor of local HEAD: {exc}",),
                    next_action="Fetch and reconcile the remote branch before continuing.",
                )
            if not remote_is_ancestor:
                return _assessment(
                    "remote_diverged",
                    exit_code=1,
                    artifact_count=artifact_count,
                    source_tree=source_tree,
                    worktree=worktree,
                    local_head_sha=local_head_sha,
                    remote=remote,
                    issues=(f"origin/{branch} is not an ancestor of local HEAD",),
                    next_action="Fetch and reconcile the remote branch before continuing.",
                )
        return _assessment(
            "ready_to_push",
            artifact_count=artifact_count,
            source_tree=source_tree,
            worktree=worktree,
            local_head_sha=local_head_sha,
            remote=remote,
            next_action=f"Push local HEAD to origin/{branch}, then rerun this status check.",
            next_command=f"git push origin HEAD:{branch}",
        )
    if ledger_status == "complete":
        return _assessment(
            "complete",
            artifact_count=artifact_count,
            source_tree=source_tree,
            worktree=worktree,
            local_head_sha=local_head_sha,
            remote=remote,
        )
    return _assessment(
        "ready_to_deploy",
        artifact_count=artifact_count,
        source_tree=source_tree,
        worktree=worktree,
        local_head_sha=local_head_sha,
        remote=remote,
        next_action="Run deployment verification for this exact pushed commit.",
        next_command=_verify_deploy_command(payload),
    )
