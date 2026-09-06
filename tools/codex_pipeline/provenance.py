from __future__ import annotations

import hashlib
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse

from tools.codex_pipeline.config import REPO_ROOT


SOURCE_TREE_SCHEMA_VERSION = 1
SOURCE_TREE_ALGORITHM = "sha256-path-content-v1"
DEPLOYABLE_SITE_ROOTS = (
    "index.html",
    "nav.html",
    "css",
    "data",
    "images",
    "js",
    "pages",
)
IGNORED_DEPLOYABLE_FILE_NAMES = frozenset({".DS_Store", "Thumbs.db", "desktop.ini"})


@dataclass(frozen=True)
class SourceTreeFingerprint:
    sha256: str
    file_count: int
    roots: tuple[str, ...]

    def as_dict(self) -> dict[str, object]:
        return {
            "schemaVersion": SOURCE_TREE_SCHEMA_VERSION,
            "algorithm": SOURCE_TREE_ALGORITHM,
            "sha256": self.sha256,
            "fileCount": self.file_count,
            "roots": list(self.roots),
        }


@dataclass(frozen=True)
class GitWorktreeState:
    tracked_changes: tuple[str, ...]
    untracked_deployable_files: tuple[str, ...]

    @property
    def tracked_clean(self) -> bool:
        return not self.tracked_changes

    @property
    def deployable_files_tracked(self) -> bool:
        return not self.untracked_deployable_files


@dataclass(frozen=True)
class GitRemoteBranchState:
    remote_name: str
    remote_url: str
    github_repository: str | None
    branch: str
    head_sha: str | None


def _iter_deployable_files(
    repo_root: Path,
    roots: Iterable[str],
) -> list[tuple[str, Path]]:
    files: list[tuple[str, Path]] = []
    for root_name in roots:
        root_path = repo_root / root_name
        if root_path.is_file():
            if root_path.name not in IGNORED_DEPLOYABLE_FILE_NAMES:
                files.append((root_path.relative_to(repo_root).as_posix(), root_path))
            continue
        if not root_path.is_dir():
            continue
        for path in root_path.rglob("*"):
            if path.is_file() and path.name not in IGNORED_DEPLOYABLE_FILE_NAMES:
                files.append((path.relative_to(repo_root).as_posix(), path))
    return sorted(files, key=lambda entry: entry[0])


def build_source_tree_fingerprint(
    repo_root: Path = REPO_ROOT,
    *,
    roots: Iterable[str] = DEPLOYABLE_SITE_ROOTS,
) -> SourceTreeFingerprint:
    resolved_root = repo_root.expanduser().resolve()
    normalized_roots = tuple(dict.fromkeys(str(root).replace("\\", "/") for root in roots))
    hasher = hashlib.sha256()
    hasher.update(b"project-rogue-codex-source-tree-v1\0")
    files = _iter_deployable_files(resolved_root, normalized_roots)
    for relative_path, path in files:
        content = path.read_bytes()
        content_sha256 = hashlib.sha256(content).hexdigest()
        hasher.update(relative_path.encode("utf-8"))
        hasher.update(b"\0")
        hasher.update(str(len(content)).encode("ascii"))
        hasher.update(b"\0")
        hasher.update(content_sha256.encode("ascii"))
        hasher.update(b"\n")
    return SourceTreeFingerprint(
        sha256=hasher.hexdigest(),
        file_count=len(files),
        roots=normalized_roots,
    )


def _git_status_lines(
    repo_root: Path,
    *args: str,
    git_executable: str = "git",
) -> tuple[str, ...]:
    output = subprocess.check_output(
        [git_executable, "status", "--porcelain=v1", *args],
        cwd=repo_root,
        text=True,
    )
    return tuple(line for line in output.splitlines() if line)


def inspect_git_worktree(
    repo_root: Path = REPO_ROOT,
    *,
    deployable_roots: Iterable[str] = DEPLOYABLE_SITE_ROOTS,
    git_executable: str = "git",
) -> GitWorktreeState:
    resolved_root = repo_root.expanduser().resolve()
    tracked_changes = _git_status_lines(
        resolved_root,
        "--untracked-files=no",
        git_executable=git_executable,
    )
    roots = tuple(dict.fromkeys(str(root).replace("\\", "/") for root in deployable_roots))
    deployable_status = _git_status_lines(
        resolved_root,
        "--untracked-files=all",
        "--",
        *roots,
        git_executable=git_executable,
    )
    untracked_deployable_files = tuple(
        line[3:] for line in deployable_status if line.startswith("?? ")
    )
    return GitWorktreeState(
        tracked_changes=tracked_changes,
        untracked_deployable_files=untracked_deployable_files,
    )


def github_repository_from_remote_url(remote_url: str) -> str | None:
    candidate = remote_url.strip()
    if not candidate:
        return None
    if candidate.startswith("git@github.com:"):
        repository_path = candidate.removeprefix("git@github.com:")
    else:
        parsed = urlparse(candidate)
        if parsed.hostname is None or parsed.hostname.lower() != "github.com":
            return None
        repository_path = parsed.path
    repository_path = repository_path.strip("/")
    if repository_path.lower().endswith(".git"):
        repository_path = repository_path[:-4]
    parts = repository_path.split("/")
    if len(parts) != 2 or not all(parts):
        return None
    return "/".join(parts)


def inspect_git_remote_branch(
    repo_root: Path = REPO_ROOT,
    *,
    remote_name: str = "origin",
    branch: str,
    git_executable: str = "git",
) -> GitRemoteBranchState:
    resolved_root = repo_root.expanduser().resolve()
    remote_url = subprocess.check_output(
        [git_executable, "remote", "get-url", remote_name],
        cwd=resolved_root,
        text=True,
    ).strip()
    branch_ref = f"refs/heads/{branch}"
    remote_refs = subprocess.check_output(
        [git_executable, "ls-remote", "--heads", remote_name, branch_ref],
        cwd=resolved_root,
        text=True,
    )
    head_sha = None
    for line in remote_refs.splitlines():
        fields = line.split()
        if len(fields) == 2 and fields[1] == branch_ref:
            head_sha = fields[0]
            break
    return GitRemoteBranchState(
        remote_name=remote_name,
        remote_url=remote_url,
        github_repository=github_repository_from_remote_url(remote_url),
        branch=branch,
        head_sha=head_sha,
    )


def is_git_ancestor(
    ancestor_sha: str,
    descendant_sha: str,
    *,
    repo_root: Path = REPO_ROOT,
    git_executable: str = "git",
) -> bool:
    completed = subprocess.run(
        [git_executable, "merge-base", "--is-ancestor", ancestor_sha, descendant_sha],
        cwd=repo_root.expanduser().resolve(),
        capture_output=True,
        text=True,
    )
    if completed.returncode == 0:
        return True
    if completed.returncode == 1:
        return False
    raise subprocess.CalledProcessError(
        completed.returncode,
        completed.args,
        output=completed.stdout,
        stderr=completed.stderr,
    )
