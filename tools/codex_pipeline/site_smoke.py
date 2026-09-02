from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path

from tools.codex_pipeline.config import REPO_ROOT
from tools.codex_pipeline.provenance import build_source_tree_fingerprint


@dataclass(frozen=True)
class SiteSmokeRun:
    returncode: int
    stdout: str
    stderr: str


def run_site_smoke(
    *,
    timeout_ms: int = 20_000,
    base_url: str | None = None,
    impact_plan_path: Path | None = None,
    results_path: Path | None = None,
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
    affected_record_count = 0
    impact_report_digest = None
    if impact_plan_path is not None:
        impact_plan_path = impact_plan_path.expanduser().resolve()
        if not impact_plan_path.is_file():
            return SiteSmokeRun(
                returncode=1,
                stdout="",
                stderr=f"impact validation plan not found: {impact_plan_path}",
            )
        command.extend(["--impact-plan", str(impact_plan_path)])
        try:
            plan = json.loads(impact_plan_path.read_text(encoding="utf-8"))
            affected_record_count = len(plan.get("affectedRecords", []))
            impact_report_digest = plan.get("reportDigest")
        except (OSError, json.JSONDecodeError, TypeError):
            affected_record_count = 0
    if results_path is not None:
        results_path = results_path.expanduser().resolve()
        try:
            results_path.unlink(missing_ok=True)
        except OSError as exc:
            return SiteSmokeRun(
                returncode=1,
                stdout="",
                stderr=f"cannot prepare site smoke results path {results_path}: {exc}",
            )
        command.extend(["--results-path", str(results_path)])
    try:
        completed = subprocess.run(
            command,
            cwd=repo_root,
            capture_output=True,
            text=True,
            timeout=max(10, (timeout_ms / 1000) * 3 + 10, 30 + affected_record_count * 5),
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

    evidence_issue = None
    if results_path is not None:
        if not results_path.is_file():
            evidence_issue = f"site smoke did not write results artifact: {results_path}"
        else:
            try:
                evidence = json.loads(results_path.read_text(encoding="utf-8"))
                if not isinstance(evidence, dict):
                    evidence_issue = "site smoke results must contain a JSON object"
                else:
                    evidence["sourceTree"] = build_source_tree_fingerprint(repo_root).as_dict()
                    results_path.write_text(f"{json.dumps(evidence, indent=2)}\n", encoding="utf-8")
                if evidence_issue:
                    pass
                elif evidence.get("schemaVersion") != 1:
                    evidence_issue = f"site smoke results use unsupported schema: {evidence.get('schemaVersion')}"
                elif impact_report_digest and evidence.get("reportDigest") != impact_report_digest:
                    evidence_issue = "site smoke results report digest does not match the impact validation plan"
                elif completed.returncode == 0 and evidence.get("status") != "passed":
                    evidence_issue = "site smoke exited successfully but its results status is not passed"
                elif completed.returncode != 0 and evidence.get("status") != "failed":
                    evidence_issue = "site smoke failed but its results status is not failed"
            except (OSError, json.JSONDecodeError, TypeError, ValueError) as exc:
                evidence_issue = f"site smoke results are not readable JSON: {exc}"

    stderr = completed.stderr
    if evidence_issue:
        stderr = "\n".join(part for part in (stderr.rstrip(), evidence_issue) if part) + "\n"
    return SiteSmokeRun(
        returncode=1 if evidence_issue else completed.returncode,
        stdout=completed.stdout,
        stderr=stderr,
    )
