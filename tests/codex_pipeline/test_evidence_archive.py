import json
import io
from contextlib import redirect_stdout
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch


def _build_completed_run(root: Path) -> tuple[Path, str, str]:
    from tools.codex_pipeline.update_run import (
        initialize_game_update_run,
        update_game_update_artifacts,
        update_game_update_stage,
    )

    digest = "sha256:" + "a" * 64
    commit_sha = "b" * 40
    artifacts = {
        "impactValidationPlan": root / "impact_validation_plan.json",
        "localValidation": root / "impact_validation_results.json",
        "liveValidation": root / "live_impact_validation_results.json",
        "deploymentValidation": root / "deployment_validation_results.json",
        "workflowSummary": root / "game_update_workflow_summary.md",
    }
    for role, path in artifacts.items():
        path.write_text(f"{role}\n", encoding="utf-8")

    run_path = root / "game_update_run.json"
    initialize_game_update_run(
        run_path,
        report_digest=digest,
        source_fingerprint="client-source",
        metadata={"syncReady": True},
        artifacts={
            "impactValidationPlan": artifacts["impactValidationPlan"],
            "workflowSummary": artifacts["workflowSummary"],
        },
    )
    update_game_update_stage(run_path, expected_digest=digest, stage="review", status="passed")
    update_game_update_stage(run_path, expected_digest=digest, stage="apply", status="passed")
    update_game_update_stage(
        run_path,
        expected_digest=digest,
        stage="localValidation",
        status="passed",
        artifacts={"localValidation": artifacts["localValidation"]},
    )
    update_game_update_stage(run_path, expected_digest=digest, stage="baseline", status="passed")
    update_game_update_stage(
        run_path,
        expected_digest=digest,
        stage="commit",
        status="passed",
        details={
            "commitSha": commit_sha,
            "sourceTreeSha256": "c" * 64,
            "githubRepository": "traecneh/Project-Rogue-Codex",
            "branch": "main",
        },
    )
    update_game_update_stage(run_path, expected_digest=digest, stage="deployment", status="passed")
    update_game_update_stage(
        run_path,
        expected_digest=digest,
        stage="liveValidation",
        status="passed",
        artifacts={"liveValidation": artifacts["liveValidation"]},
    )
    update_game_update_artifacts(
        run_path,
        expected_digest=digest,
        artifacts={"deploymentValidation": artifacts["deploymentValidation"]},
    )
    return run_path, digest, commit_sha


class EvidenceArchiveTests(unittest.TestCase):
    def test_completed_run_archives_ledger_and_all_hashed_artifacts(self):
        from tools.codex_pipeline.evidence_archive import (
            REQUIRED_ARCHIVE_ROLES,
            archive_game_update_evidence,
        )

        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            run_path, digest, commit_sha = _build_completed_run(root)
            result = archive_game_update_evidence(
                run_path,
                root / "history",
                expected_digest=digest,
                expected_commit_sha=commit_sha,
            )
            manifest = json.loads(result.manifest_path.read_text(encoding="utf-8"))
            roles = {entry["role"] for entry in manifest["files"]}

            self.assertTrue(result.created)
            self.assertTrue(REQUIRED_ARCHIVE_ROLES.issubset(roles))
            self.assertIn("workflowSummary", roles)
            self.assertEqual(commit_sha, manifest["commitSha"])
            self.assertEqual("c" * 64, manifest["sourceTreeSha256"])
            for entry in manifest["files"]:
                self.assertTrue((result.path / entry["path"]).is_file())

    def test_existing_matching_archive_is_verified_without_overwrite(self):
        from tools.codex_pipeline.evidence_archive import archive_game_update_evidence

        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            run_path, digest, commit_sha = _build_completed_run(root)
            created = archive_game_update_evidence(
                run_path,
                root / "history",
                expected_digest=digest,
                expected_commit_sha=commit_sha,
            )
            archived_at = created.manifest_path.stat().st_mtime_ns
            repeated = archive_game_update_evidence(
                run_path,
                root / "history",
                expected_digest=digest,
                expected_commit_sha=commit_sha,
            )
            repeated_mtime = repeated.manifest_path.stat().st_mtime_ns

        self.assertFalse(repeated.created)
        self.assertEqual(created.path, repeated.path)
        self.assertEqual(archived_at, repeated_mtime)

    def test_tampered_existing_archive_is_rejected(self):
        from tools.codex_pipeline.evidence_archive import (
            EvidenceArchiveError,
            archive_game_update_evidence,
        )

        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            run_path, digest, commit_sha = _build_completed_run(root)
            created = archive_game_update_evidence(
                run_path,
                root / "history",
                expected_digest=digest,
                expected_commit_sha=commit_sha,
            )
            manifest = json.loads(created.manifest_path.read_text(encoding="utf-8"))
            archived_file = created.path / manifest["files"][0]["path"]
            archived_file.write_text("tampered\n", encoding="utf-8")

            with self.assertRaisesRegex(EvidenceArchiveError, "failed verification"):
                archive_game_update_evidence(
                    run_path,
                    root / "history",
                    expected_digest=digest,
                    expected_commit_sha=commit_sha,
                )

    def test_cli_history_lists_and_verifies_archived_release(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.evidence_archive import archive_game_update_evidence

        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            history = root / "history"
            run_path, digest, commit_sha = _build_completed_run(root)
            archive_game_update_evidence(
                run_path,
                history,
                expected_digest=digest,
                expected_commit_sha=commit_sha,
            )
            output = io.StringIO()
            with redirect_stdout(output):
                exit_code = cli.main(
                    ["game-update-history", "--update-archive-dir", str(history)]
                )

        self.assertEqual(0, exit_code)
        self.assertIn("HISTORY OK", output.getvalue())
        self.assertIn("HISTORY SUMMARY: 1 valid, 0 invalid", output.getvalue())

    def test_cli_history_flags_completed_run_without_archive(self):
        from tools.codex_pipeline import cli

        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            history = root / "history"
            run_path, _, _ = _build_completed_run(root)
            output = io.StringIO()
            with redirect_stdout(output):
                exit_code = cli.main(
                    [
                        "game-update-history",
                        "--update-archive-dir",
                        str(history),
                        "--update-run-path",
                        str(run_path),
                    ]
                )

        self.assertEqual(1, exit_code)
        self.assertIn("completed active run has no valid archive", output.getvalue())
        self.assertIn("HISTORY SUMMARY: 0 valid, 1 invalid", output.getvalue())

    def test_deployment_finisher_records_archive_failure(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.evidence_archive import EvidenceArchiveError
        from tools.codex_pipeline.update_run import load_game_update_run

        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            run_path, digest, commit_sha = _build_completed_run(root)
            result_path = root / "deployment-final.json"
            payload = {
                "schemaVersion": 1,
                "commitSha": commit_sha,
                "failures": [],
                "updateRun": None,
            }
            with (
                patch.object(
                    cli,
                    "archive_game_update_evidence",
                    side_effect=EvidenceArchiveError("archive conflict"),
                ),
                patch("sys.stdout", io.StringIO()),
            ):
                exit_code = cli._finish_deployment_result(
                    result_path,
                    payload,
                    started_at_monotonic=time.monotonic(),
                    passed=True,
                    update_run_path=run_path,
                    update_run_digest=digest,
                    update_run_stage="liveValidation",
                    update_run_status="passed",
                    evidence_archive_root=root / "history",
                )
            result_payload = json.loads(result_path.read_text(encoding="utf-8"))
            run_payload = load_game_update_run(run_path)

        self.assertEqual(1, exit_code)
        self.assertEqual("failed", result_payload["status"])
        self.assertIn("archive conflict", result_payload["failures"][0])
        self.assertEqual("failed", run_payload["stages"]["deployment"]["status"])
