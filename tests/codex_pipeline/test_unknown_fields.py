import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tools.codex_pipeline.exports import ExportTarget


class UnknownFieldInventoryTests(unittest.TestCase):
    def test_build_unknown_field_reports_summarizes_unknown_fields(self):
        from tools.codex_pipeline.unknowns import build_unknown_field_reports

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            site_path = root / "site" / "fake.json"
            site_path.parent.mkdir()
            site_path.write_text(
                json.dumps(
                    [
                        {
                            "id": 1,
                            "name": "Plain Sword",
                            "fields": {"unknown_2": 0, "known": 9},
                        },
                        {
                            "id": 2,
                            "name": "Fire Sword",
                            "fields": {"unknown_2": 5, "unknown_10": 3},
                        },
                        {
                            "id": 3,
                            "name": "Ice Sword",
                            "fields": {"unknown_2": 5, "unknown_10": 0},
                        },
                    ]
                ),
                encoding="utf-8",
            )
            target = ExportTarget("weapons", root / "extract.py", root / "source.dat", "fake.json", site_path)

            reports = build_unknown_field_reports([target])

        self.assertEqual(1, len(reports))
        report = reports[0]
        self.assertEqual("weapons", report.target_name)
        self.assertEqual(3, report.record_count)
        self.assertEqual(["unknown_2", "unknown_10"], [field.name for field in report.fields])

        unknown_2 = report.fields[0]
        self.assertEqual(3, unknown_2.record_count)
        self.assertEqual(2, unknown_2.nonzero_count)
        self.assertEqual([0, 5], unknown_2.values)
        self.assertEqual(["Fire Sword=5", "Ice Sword=5"], unknown_2.samples)

        unknown_10 = report.fields[1]
        self.assertEqual(2, unknown_10.record_count)
        self.assertEqual(1, unknown_10.nonzero_count)
        self.assertEqual([0, 3], unknown_10.values)
        self.assertEqual(["Fire Sword=3"], unknown_10.samples)

    def test_build_unknown_field_reports_can_read_generated_output(self):
        from tools.codex_pipeline.unknowns import build_unknown_field_reports

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            output_dir = root / "generated"
            output_dir.mkdir()
            generated_path = output_dir / "fake.json"
            site_path = root / "site" / "fake.json"
            site_path.parent.mkdir()
            site_path.write_text('[{"name": "Site", "fields": {"unknown_1": 1}}]', encoding="utf-8")
            generated_path.write_text(
                '[{"name": "Generated", "fields": {"unknown_7": 70}}]',
                encoding="utf-8",
            )
            target = ExportTarget("armors", root / "extract.py", root / "source.dat", "fake.json", site_path)

            reports = build_unknown_field_reports([target], source="generated", output_dir=output_dir)

        self.assertEqual(["unknown_7"], [field.name for field in reports[0].fields])
        self.assertEqual(["Generated=70"], reports[0].fields[0].samples)

    def test_build_unknown_field_reports_sorts_numeric_values_numerically(self):
        from tools.codex_pipeline.unknowns import build_unknown_field_reports

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            site_path = root / "site" / "fake.json"
            site_path.parent.mkdir()
            site_path.write_text(
                json.dumps(
                    [
                        {"name": "A", "fields": {"unknown_1": 10}},
                        {"name": "B", "fields": {"unknown_1": 2}},
                        {"name": "C", "fields": {"unknown_1": 0}},
                    ]
                ),
                encoding="utf-8",
            )
            target = ExportTarget("weapons", root / "extract.py", root / "source.dat", "fake.json", site_path)

            reports = build_unknown_field_reports([target])

        self.assertEqual([0, 2, 10], reports[0].fields[0].values)

    def test_cli_prints_unknown_field_inventory(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.unknowns import UnknownFieldReport, UnknownFieldTargetReport

        report = UnknownFieldTargetReport(
            target_name="weapons",
            data_path=Path("weapons.json"),
            record_count=2,
            fields=[
                UnknownFieldReport(
                    name="unknown_2",
                    record_count=2,
                    nonzero_count=1,
                    values=[0, 5],
                    samples=["Fire Sword=5"],
                )
            ],
        )
        output = io.StringIO()
        with (
            patch.object(cli, "resolve_targets", return_value=[]),
            patch.object(cli, "build_unknown_field_reports", return_value=[report]),
            patch("sys.stdout", output),
        ):
            exit_code = cli.main(["unknown-fields", "--target", "weapons", "--source", "site"])

        self.assertEqual(0, exit_code)
        printed = output.getvalue()
        self.assertIn("UNKNOWN FIELDS weapons: 1 field(s), 1 with nonzero values", printed)
        self.assertIn("unknown_2: records=2 nonzero=1 values=[0, 5] samples=Fire Sword=5", printed)
