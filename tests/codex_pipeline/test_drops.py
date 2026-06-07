import json
import unittest
from pathlib import Path

from tools.codex_pipeline.config import REPO_ROOT, DROP_SOURCES_PATH


class DropSourcesSmokeTests(unittest.TestCase):
    def test_drop_sources_file_exists_with_iceburst_override(self):
        self.assertEqual(REPO_ROOT.name, "project-rogue-codex")
        data = json.loads(DROP_SOURCES_PATH.read_text(encoding="utf-8"))
        self.assertEqual(data["schemaVersion"], 1)
        self.assertIn("Iceburst Amulet", data["armors"])
        self.assertEqual(data["armors"]["Iceburst Amulet"], ["Ice Devil", "Greater Yeti"])


if __name__ == "__main__":
    unittest.main()
