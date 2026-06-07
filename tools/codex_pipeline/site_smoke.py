from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path

from tools.codex_pipeline.config import REPO_ROOT


@dataclass(frozen=True)
class SiteSmokeRun:
    returncode: int
    stdout: str
    stderr: str


def run_site_smoke(
    *,
    timeout_ms: int = 20_000,
    base_url: str | None = None,
    node_executable: str = "node",
    repo_root: Path = REPO_ROOT,
) -> SiteSmokeRun:
    script_path = repo_root / "tools" / "codex_pipeline" / "site_smoke.mjs"
    if not script_path.is_file():
        return SiteSmokeRun(
            returncode=1,
            stdout="",
            stderr=f"site smoke runner not found: {script_path}",
        )

    command = [
        node_executable,
        str(script_path),
        "--root",
        str(repo_root),
        "--timeout-ms",
        str(timeout_ms),
    ]
    if base_url:
        command.extend(["--base-url", base_url])
    try:
        completed = subprocess.run(
            command,
            cwd=repo_root,
            capture_output=True,
            text=True,
            timeout=max(10, (timeout_ms / 1000) * 3 + 10),
        )
    except FileNotFoundError:
        return SiteSmokeRun(
            returncode=1,
            stdout="",
            stderr="node executable not found; install Node.js before running smoke-site",
        )
    except subprocess.TimeoutExpired as exc:
        return SiteSmokeRun(
            returncode=1,
            stdout=exc.stdout or "",
            stderr=f"site smoke timed out after {timeout_ms} ms",
        )

    return SiteSmokeRun(
        returncode=completed.returncode,
        stdout=completed.stdout,
        stderr=completed.stderr,
    )
