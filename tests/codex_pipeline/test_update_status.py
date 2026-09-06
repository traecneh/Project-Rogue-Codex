import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


SOURCE_TREE_SHA256 = "c" * 64
SOURCE_TREE_ROOTS = ("index.html", "nav.html", "css", "data", "images", "js", "pages")


def _source_tree_payload(sha256: str = SOURCE_TREE_SHA256) -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "algorithm": "sha256-path-content-v1",
        "sha256": sha256,
        "fileCount": 7,
        "roots": list(SOURCE_TREE_ROOTS),
    }


def _build_ready_run(root: Path) -> tuple[Path, dict[str, object]]:
    from tools.codex_pipeline.update_run import (
        initialize_game_update_run,
        load_game_update_run,
        update_game_update_stage,
    )

    digest = "sha256:" + "a" * 64
    plan_path = root / "impact_validation_plan.json"
    results_path = root / "impact_validation_results.json"
    run_path = root / "game_update_run.json"
    plan_path.write_text(
        json.dumps(
            {
                "schemaVersion": 2,
                "reportDigest": digest,
                "checks": [{"id": "weapons-page", "automatedBy": ["smoke-site"]}],
                "affectedRecords": [],
            }
        ),
        encoding="utf-8",
    )
    results_path.write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "reportDigest": digest,
                "mode": "impact-plan",
                "target": "local",
                "status": "passed",
                "summary": {"groupCount": 1, "passedGroups": 1},
                "plan": {"routedCheckIds": ["weapons-page"]},
                "sourceTree": _source_tree_payload(),
                "failures": [],
            }
        ),
        encoding="utf-8",
    )
    initialize_game_update_run(
        run_path,
        report_digest=digest,
        source_fingerprint="client-source",
        metadata={"syncReady": True, "outputDir": str(root)},
        artifacts={"impactValidationPlan": plan_path},
    )
    update_game_update_stage(run_path, expected_digest=digest, stage="review", status="passed")
    update_game_update_stage(run_path, expected_digest=digest, stage="apply", status="passed")
    update_game_update_stage(
        run_path,
        expected_digest=digest,
        stage="localValidation",
        status="passed",
        artifacts={"localValidation": results_path},
    )
    update_game_update_stage(run_path, expected_digest=digest, stage="baseline", status="passed")
    return run_path, load_game_update_run(run_path)


class GameUpdateStatusAssessmentTests(unittest.TestCase):
    def test_validated_dirty_tree_is_ready_to_commit(self):
        from tools.codex_pipeline.provenance import GitWorktreeState, SourceTreeFingerprint
        from tools.codex_pipeline.update_status import assess_game_update_status

        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            _, payload = _build_ready_run(root)
            with (
                patch(
                    "tools.codex_pipeline.update_status.build_source_tree_fingerprint",
                    return_value=SourceTreeFingerprint(SOURCE_TREE_SHA256, 7, SOURCE_TREE_ROOTS),
                ),
                patch(
                    "tools.codex_pipeline.update_status.inspect_git_worktree",
                    return_value=GitWorktreeState((" M pages/items/weapons.html",), ()),
                ),
            ):
                assessment = assess_game_update_status(
                    payload,
                    github_repository="traecneh/Project-Rogue-Codex",
                    branch="main",
                    repo_root=root,
                )

        self.assertEqual("ready_to_commit", assessment.status)
        self.assertEqual(0, assessment.exit_code)
        self.assertEqual(2, assessment.artifact_count)

    def test_changed_artifact_is_stale_evidence(self):
        from tools.codex_pipeline.update_status import assess_game_update_status

        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            _, payload = _build_ready_run(root)
            (root / "impact_validation_plan.json").write_text("{}", encoding="utf-8")
            assessment = assess_game_update_status(
                payload,
                github_repository="traecneh/Project-Rogue-Codex",
                branch="main",
                repo_root=root,
            )

        self.assertEqual("stale_evidence", assessment.status)
        self.assertEqual(1, assessment.exit_code)
        self.assertIn("artifact hash differs", assessment.issues[0])

    def test_changed_source_tree_is_stale_evidence(self):
        from tools.codex_pipeline.provenance import SourceTreeFingerprint
        from tools.codex_pipeline.update_status import assess_game_update_status

        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            _, payload = _build_ready_run(root)
            with patch(
                "tools.codex_pipeline.update_status.build_source_tree_fingerprint",
                return_value=SourceTreeFingerprint("d" * 64, 7, SOURCE_TREE_ROOTS),
            ):
                assessment = assess_game_update_status(
                    payload,
                    github_repository="traecneh/Project-Rogue-Codex",
                    branch="main",
                    repo_root=root,
                )

        self.assertEqual("stale_evidence", assessment.status)
        self.assertIn("source-tree fingerprint differs", assessment.issues[0])
        self.assertIn("smoke-site --impact-plan", assessment.next_command)

    def test_clean_unpushed_commit_is_ready_to_push(self):
        from tools.codex_pipeline.provenance import (
            GitRemoteBranchState,
            GitWorktreeState,
            SourceTreeFingerprint,
        )
        from tools.codex_pipeline.update_status import assess_game_update_status

        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            _, payload = _build_ready_run(root)
            with (
                patch(
                    "tools.codex_pipeline.update_status.build_source_tree_fingerprint",
                    return_value=SourceTreeFingerprint(SOURCE_TREE_SHA256, 7, SOURCE_TREE_ROOTS),
                ),
                patch(
                    "tools.codex_pipeline.update_status.inspect_git_worktree",
                    return_value=GitWorktreeState((), ()),
                ),
                patch(
                    "tools.codex_pipeline.update_status.resolve_git_commit",
                    return_value="local-head",
                ),
                patch(
                    "tools.codex_pipeline.update_status.inspect_git_remote_branch",
                    return_value=GitRemoteBranchState(
                        "origin",
                        "https://github.com/traecneh/Project-Rogue-Codex.git",
                        "traecneh/Project-Rogue-Codex",
                        "main",
                        "old-head",
                    ),
                ),
                patch(
                    "tools.codex_pipeline.update_status.is_git_ancestor",
                    return_value=True,
                ),
            ):
                assessment = assess_game_update_status(
                    payload,
                    github_repository="traecneh/Project-Rogue-Codex",
                    branch="main",
                    repo_root=root,
                )

        self.assertEqual("ready_to_push", assessment.status)
        self.assertEqual("git push origin HEAD:main", assessment.next_command)

    def test_remote_ahead_or_diverged_is_not_reported_ready_to_push(self):
        from tools.codex_pipeline.provenance import (
            GitRemoteBranchState,
            GitWorktreeState,
            SourceTreeFingerprint,
        )
        from tools.codex_pipeline.update_status import assess_game_update_status

        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            _, payload = _build_ready_run(root)
            with (
                patch(
                    "tools.codex_pipeline.update_status.build_source_tree_fingerprint",
                    return_value=SourceTreeFingerprint(SOURCE_TREE_SHA256, 7, SOURCE_TREE_ROOTS),
                ),
                patch(
                    "tools.codex_pipeline.update_status.inspect_git_worktree",
                    return_value=GitWorktreeState((), ()),
                ),
                patch(
                    "tools.codex_pipeline.update_status.resolve_git_commit",
                    return_value="local-head",
                ),
                patch(
                    "tools.codex_pipeline.update_status.inspect_git_remote_branch",
                    return_value=GitRemoteBranchState(
                        "origin",
                        "https://github.com/traecneh/Project-Rogue-Codex.git",
                        "traecneh/Project-Rogue-Codex",
                        "main",
                        "other-head",
                    ),
                ),
                patch(
                    "tools.codex_pipeline.update_status.is_git_ancestor",
                    return_value=False,
                ),
            ):
                assessment = assess_game_update_status(
                    payload,
                    github_repository="traecneh/Project-Rogue-Codex",
                    branch="main",
                    repo_root=root,
                )

        self.assertEqual("remote_diverged", assessment.status)
        self.assertEqual(1, assessment.exit_code)
        self.assertIsNone(assessment.next_command)

    def test_exact_pushed_commit_is_ready_to_deploy(self):
        from tools.codex_pipeline.provenance import (
            GitRemoteBranchState,
            GitWorktreeState,
            SourceTreeFingerprint,
        )
        from tools.codex_pipeline.update_status import assess_game_update_status

        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            _, payload = _build_ready_run(root)
            with (
                patch(
                    "tools.codex_pipeline.update_status.build_source_tree_fingerprint",
                    return_value=SourceTreeFingerprint(SOURCE_TREE_SHA256, 7, SOURCE_TREE_ROOTS),
                ),
                patch(
                    "tools.codex_pipeline.update_status.inspect_git_worktree",
                    return_value=GitWorktreeState((), ()),
                ),
                patch(
                    "tools.codex_pipeline.update_status.resolve_git_commit",
                    return_value="same-head",
                ),
                patch(
                    "tools.codex_pipeline.update_status.inspect_git_remote_branch",
                    return_value=GitRemoteBranchState(
                        "origin",
                        "git@github.com:traecneh/Project-Rogue-Codex.git",
                        "traecneh/Project-Rogue-Codex",
                        "main",
                        "same-head",
                    ),
                ),
            ):
                assessment = assess_game_update_status(
                    payload,
                    github_repository="traecneh/Project-Rogue-Codex",
                    branch="main",
                    repo_root=root,
                )

        self.assertEqual("ready_to_deploy", assessment.status)
        self.assertIn("verify-deploy --impact-plan", assessment.next_command)
