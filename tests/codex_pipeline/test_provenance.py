import tempfile
import unittest
from pathlib import Path
from subprocess import CompletedProcess
from unittest.mock import patch


class ProvenanceTests(unittest.TestCase):
    def test_github_repository_from_remote_url_supports_https_and_ssh(self):
        from tools.codex_pipeline.provenance import github_repository_from_remote_url

        self.assertEqual(
            "traecneh/Project-Rogue-Codex",
            github_repository_from_remote_url(
                "https://github.com/traecneh/Project-Rogue-Codex.git"
            ),
        )
        self.assertEqual(
            "traecneh/Project-Rogue-Codex",
            github_repository_from_remote_url(
                "git@github.com:traecneh/Project-Rogue-Codex.git"
            ),
        )
        self.assertEqual(
            "traecneh/Project-Rogue-Codex",
            github_repository_from_remote_url(
                "ssh://git@github.com/traecneh/Project-Rogue-Codex.git"
            ),
        )
        self.assertIsNone(github_repository_from_remote_url("https://example.test/owner/repo.git"))

    def test_source_tree_fingerprint_is_stable_for_root_order(self):
        from tools.codex_pipeline.provenance import build_source_tree_fingerprint

        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            (root / "index.html").write_text("<title>Codex</title>", encoding="utf-8")
            (root / "js").mkdir()
            (root / "js" / "app.js").write_text("console.log('ready');", encoding="utf-8")

            forward = build_source_tree_fingerprint(root, roots=("index.html", "js"))
            reverse = build_source_tree_fingerprint(root, roots=("js", "index.html"))

        self.assertEqual(forward.sha256, reverse.sha256)
        self.assertEqual(2, forward.file_count)

    def test_source_tree_fingerprint_changes_with_deployable_content(self):
        from tools.codex_pipeline.provenance import build_source_tree_fingerprint

        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            (root / "index.html").write_text("before", encoding="utf-8")
            before = build_source_tree_fingerprint(root, roots=("index.html",))
            (root / "index.html").write_text("after", encoding="utf-8")
            after = build_source_tree_fingerprint(root, roots=("index.html",))

        self.assertNotEqual(before.sha256, after.sha256)

    def test_source_tree_fingerprint_excludes_pipeline_outputs(self):
        from tools.codex_pipeline.provenance import build_source_tree_fingerprint

        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            (root / "index.html").write_text("site", encoding="utf-8")
            before = build_source_tree_fingerprint(root)
            (root / "generated-output").mkdir()
            (root / "generated-output" / "report.json").write_text("changed", encoding="utf-8")
            (root / "tools").mkdir()
            (root / "tools" / "pipeline.py").write_text("changed", encoding="utf-8")
            after = build_source_tree_fingerprint(root)

        self.assertEqual(before.sha256, after.sha256)
        self.assertEqual(1, after.file_count)

    def test_git_worktree_state_separates_tracked_and_untracked_deployable_changes(self):
        from tools.codex_pipeline.provenance import inspect_git_worktree

        with patch(
            "tools.codex_pipeline.provenance.subprocess.check_output",
            side_effect=[
                " M README.md\nM  js/utils.js\n",
                " M js/utils.js\n?? images/weapons/New Sword.gif\n",
            ],
        ):
            state = inspect_git_worktree(Path("."), deployable_roots=("js", "images"))

        self.assertEqual((" M README.md", "M  js/utils.js"), state.tracked_changes)
        self.assertEqual(("images/weapons/New Sword.gif",), state.untracked_deployable_files)
        self.assertFalse(state.tracked_clean)
        self.assertFalse(state.deployable_files_tracked)

    def test_git_remote_branch_state_reads_origin_url_and_exact_branch_ref(self):
        from tools.codex_pipeline.provenance import inspect_git_remote_branch

        with patch(
            "tools.codex_pipeline.provenance.subprocess.check_output",
            side_effect=[
                "git@github.com:traecneh/Project-Rogue-Codex.git\n",
                "abc123\trefs/heads/main\n",
            ],
        ) as check_output:
            state = inspect_git_remote_branch(Path("."), branch="main")

        self.assertEqual("origin", state.remote_name)
        self.assertEqual("traecneh/Project-Rogue-Codex", state.github_repository)
        self.assertEqual("main", state.branch)
        self.assertEqual("abc123", state.head_sha)
        self.assertEqual(
            ["git", "ls-remote", "--heads", "origin", "refs/heads/main"],
            check_output.call_args_list[1].args[0],
        )

    def test_git_ancestor_uses_merge_base_exit_status(self):
        from tools.codex_pipeline.provenance import is_git_ancestor

        with patch(
            "tools.codex_pipeline.provenance.subprocess.run",
            return_value=CompletedProcess(args=["git"], returncode=0),
        ) as run:
            self.assertTrue(is_git_ancestor("remote", "local", repo_root=Path(".")))
        self.assertEqual(
            ["git", "merge-base", "--is-ancestor", "remote", "local"],
            run.call_args.args[0],
        )

        with patch(
            "tools.codex_pipeline.provenance.subprocess.run",
            return_value=CompletedProcess(args=["git"], returncode=1),
        ):
            self.assertFalse(is_git_ancestor("remote", "local", repo_root=Path(".")))
