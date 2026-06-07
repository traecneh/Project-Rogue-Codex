import json
import os
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

from tools.codex_pipeline.exports import (
    ExportTarget,
    build_generated_diff_report,
    export_client_data,
    resolve_targets,
    sync_generated_outputs,
)


class ExportCommandTests(unittest.TestCase):
    def test_resolve_targets_defaults_to_site_data_exports(self):
        targets = resolve_targets()
        self.assertEqual([target.name for target in targets], ["monsters", "weapons", "armors"])

    def test_export_client_data_writes_generated_output_not_site_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            script = root / "extract_fake.py"
            source = root / "source.dat"
            site_path = root / "site" / "fake.json"
            output_dir = root / "generated"
            source.write_bytes(b"fake source")
            script.write_text(
                textwrap.dedent(
                    """
                    import json
                    import sys
                    from pathlib import Path

                    source = Path(sys.argv[1])
                    output = Path(sys.argv[2])
                    output.write_text(json.dumps([{"name": source.name}]), encoding="utf-8")
                    """
                ).strip()
                + "\n",
                encoding="utf-8",
            )
            target = ExportTarget(
                name="fake",
                extractor_script=script,
                source_data=source,
                output_filename="fake.json",
                site_path=site_path,
            )

            results = export_client_data([target], output_dir=output_dir, python_executable=sys.executable)

            self.assertEqual(output_dir / "fake.json", results[0].generated_path)
            self.assertTrue((output_dir / "fake.json").is_file())
            self.assertFalse(site_path.exists())
            data = json.loads((output_dir / "fake.json").read_text(encoding="utf-8"))
            self.assertEqual([{"name": "source.dat"}], data)

    def test_export_client_data_resolves_relative_output_dir_before_subprocess(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            script_dir = root / "scripts"
            data_dir = root / "data"
            script_dir.mkdir()
            data_dir.mkdir()
            script = script_dir / "extract_fake.py"
            source = data_dir / "source.dat"
            site_path = root / "site" / "fake.json"
            source.write_bytes(b"fake source")
            script.write_text(
                textwrap.dedent(
                    """
                    import json
                    import sys
                    from pathlib import Path

                    source = Path(sys.argv[1])
                    output = Path(sys.argv[2])
                    output.write_text(json.dumps([{"name": source.name}]), encoding="utf-8")
                    """
                ).strip()
                + "\n",
                encoding="utf-8",
            )
            target = ExportTarget(
                name="fake",
                extractor_script=script,
                source_data=source,
                output_filename="fake.json",
                site_path=site_path,
            )

            previous_cwd = Path.cwd()
            try:
                os.chdir(root)
                results = export_client_data([target], output_dir=Path("generated"), python_executable=sys.executable)
            finally:
                os.chdir(previous_cwd)

            self.assertEqual(root / "generated" / "fake.json", results[0].generated_path)
            self.assertTrue((root / "generated" / "fake.json").is_file())
            self.assertFalse((script_dir / "generated" / "fake.json").exists())

    def test_sync_generated_outputs_copies_generated_json_to_site_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            output_dir = root / "generated"
            generated = output_dir / "fake.json"
            site_path = root / "site" / "fake.json"
            output_dir.mkdir()
            generated.write_text('[{"name": "Generated"}]', encoding="utf-8")
            target = ExportTarget(
                name="fake",
                extractor_script=root / "unused.py",
                source_data=root / "unused.dat",
                output_filename="fake.json",
                site_path=site_path,
            )

            results = sync_generated_outputs([target], output_dir=output_dir)

            self.assertTrue(results[0].changed)
            self.assertEqual(generated.read_text(encoding="utf-8"), site_path.read_text(encoding="utf-8"))

    def test_sync_generated_outputs_dry_run_does_not_copy(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            output_dir = root / "generated"
            generated = output_dir / "fake.json"
            site_path = root / "site" / "fake.json"
            output_dir.mkdir()
            generated.write_text('[{"name": "Generated"}]', encoding="utf-8")
            target = ExportTarget(
                name="fake",
                extractor_script=root / "unused.py",
                source_data=root / "unused.dat",
                output_filename="fake.json",
                site_path=site_path,
            )

            results = sync_generated_outputs([target], output_dir=output_dir, dry_run=True)

            self.assertTrue(results[0].changed)
            self.assertFalse(site_path.exists())

    def test_build_generated_diff_report_summarizes_added_removed_and_changed_records(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            output_dir = root / "generated"
            generated = output_dir / "fake.json"
            site_path = root / "site" / "fake.json"
            output_dir.mkdir()
            site_path.parent.mkdir()
            site_path.write_text(
                json.dumps(
                    [
                        {"id": 1, "name": "Same", "fields": {"level": 10, "damage": 3}},
                        {"id": 2, "name": "Removed", "fields": {"level": 20}},
                    ]
                ),
                encoding="utf-8",
            )
            generated.write_text(
                json.dumps(
                    [
                        {"id": 1, "name": "Same", "fields": {"level": 11, "damage": 3}},
                        {"id": 3, "name": "Added", "fields": {"level": 30}},
                    ]
                ),
                encoding="utf-8",
            )
            target = ExportTarget(
                name="fake",
                extractor_script=root / "unused.py",
                source_data=root / "unused.dat",
                output_filename="fake.json",
                site_path=site_path,
            )

            report = build_generated_diff_report(target, output_dir=output_dir)

            self.assertEqual(["Added (3)"], report.added)
            self.assertEqual(["Removed (2)"], report.removed)
            self.assertEqual(1, len(report.changed))
            self.assertEqual("Same (1)", report.changed[0].label)
            self.assertEqual("fields.level", report.changed[0].field_changes[0].path)
            self.assertEqual(10, report.changed[0].field_changes[0].old_value)
            self.assertEqual(11, report.changed[0].field_changes[0].new_value)
