import io
import json
from contextlib import redirect_stdout
from pathlib import Path
import tempfile
import unittest


class GameUpdateRunTests(unittest.TestCase):
    def test_cli_status_reports_current_stage_and_next_command(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.update_run import initialize_game_update_run

        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            initialize_game_update_run(
                root / "game_update_run.json",
                report_digest="sha256:" + "f" * 64,
                source_fingerprint="client-f",
                metadata={"syncReady": True, "outputDir": str(root)},
            )
            output = io.StringIO()
            with redirect_stdout(output):
                exit_code = cli.main(["game-update-status", "--output-dir", str(root)])

        self.assertEqual(0, exit_code)
        printed = output.getvalue()
        self.assertIn("RUN STATUS: AWAITING_REVIEW", printed)
        self.assertIn("STAGE discovery: PASSED", printed)
        self.assertIn("NEXT COMMAND:", printed)

    def test_initialize_creates_review_ledger_with_hashed_artifacts(self):
        from tools.codex_pipeline.update_run import initialize_game_update_run

        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            plan_path = root / "impact_validation_plan.json"
            plan_path.write_text('{"schemaVersion": 2}\n', encoding="utf-8")
            run_path = root / "game_update_run.json"

            payload = initialize_game_update_run(
                run_path,
                report_digest="sha256:" + "a" * 64,
                source_fingerprint="client-pack-a",
                metadata={"syncReady": True, "outputDir": str(root)},
                artifacts={"impactValidationPlan": plan_path},
            )
            stored = json.loads(run_path.read_text(encoding="utf-8"))

        self.assertEqual("awaiting_review", payload["status"])
        self.assertEqual("passed", payload["stages"]["discovery"]["status"])
        self.assertEqual("ready", payload["stages"]["review"]["status"])
        self.assertEqual(64, len(payload["runId"].removeprefix("sha256:")))
        self.assertEqual(64, len(payload["artifacts"]["impactValidationPlan"]["sha256"]))
        self.assertEqual(payload, stored)
        self.assertIn("--acknowledge-impact", payload["nextAction"]["command"])

    def test_same_source_preserves_progress_and_new_source_starts_new_run(self):
        from tools.codex_pipeline.update_run import (
            initialize_game_update_run,
            update_game_update_stage,
        )

        digest = "sha256:" + "b" * 64
        with tempfile.TemporaryDirectory() as tmp_dir:
            run_path = Path(tmp_dir) / "game_update_run.json"
            first = initialize_game_update_run(
                run_path,
                report_digest=digest,
                source_fingerprint="client-a",
                metadata={"syncReady": True},
            )
            for stage in ("review", "apply", "localValidation", "baseline"):
                update_game_update_stage(
                    run_path,
                    expected_digest=digest,
                    stage=stage,
                    status="passed",
                )
            repeated = initialize_game_update_run(
                run_path,
                report_digest=digest,
                source_fingerprint="client-a",
                metadata={"syncReady": True},
            )
            replacement = initialize_game_update_run(
                run_path,
                report_digest=digest,
                source_fingerprint="client-b",
                metadata={"syncReady": True},
            )

        self.assertEqual("ready_to_commit", repeated["status"])
        self.assertEqual("passed", repeated["stages"]["apply"]["status"])
        self.assertNotEqual(first["runId"], replacement["runId"])
        self.assertEqual("awaiting_review", replacement["status"])
        self.assertEqual("pending", replacement["stages"]["apply"]["status"])

    def test_deployment_gate_requires_completed_local_stages_and_matching_digest(self):
        from tools.codex_pipeline.update_run import (
            UpdateRunError,
            initialize_game_update_run,
            require_update_run_ready_for_deployment,
            update_game_update_stage,
        )

        digest = "sha256:" + "c" * 64
        with tempfile.TemporaryDirectory() as tmp_dir:
            run_path = Path(tmp_dir) / "game_update_run.json"
            initialize_game_update_run(
                run_path,
                report_digest=digest,
                source_fingerprint="client-c",
                metadata={"syncReady": True},
            )
            with self.assertRaisesRegex(UpdateRunError, "incomplete stages"):
                require_update_run_ready_for_deployment(run_path, expected_digest=digest)

            for stage in ("review", "apply", "localValidation", "baseline"):
                update_game_update_stage(
                    run_path,
                    expected_digest=digest,
                    stage=stage,
                    status="passed",
                )
            ready = require_update_run_ready_for_deployment(run_path, expected_digest=digest)
            with self.assertRaisesRegex(UpdateRunError, "does not match"):
                require_update_run_ready_for_deployment(
                    run_path,
                    expected_digest="sha256:" + "d" * 64,
                )

        self.assertEqual("ready_to_commit", ready["status"])

    def test_completed_deployment_clears_next_action(self):
        from tools.codex_pipeline.update_run import (
            initialize_game_update_run,
            update_game_update_stage,
        )

        digest = "sha256:" + "e" * 64
        with tempfile.TemporaryDirectory() as tmp_dir:
            run_path = Path(tmp_dir) / "game_update_run.json"
            initialize_game_update_run(
                run_path,
                report_digest=digest,
                source_fingerprint="client-e",
                metadata={"syncReady": True},
            )
            for stage in (
                "review",
                "apply",
                "localValidation",
                "baseline",
                "commit",
                "deployment",
                "liveValidation",
            ):
                payload = update_game_update_stage(
                    run_path,
                    expected_digest=digest,
                    stage=stage,
                    status="passed",
                )

        self.assertEqual("complete", payload["status"])
        self.assertIsNone(payload["nextAction"])
