import json
import unittest
from pathlib import Path

from tools.codex_pipeline.config import REPO_ROOT, DROP_SOURCES_PATH


class DropSourcesSmokeTests(unittest.TestCase):
    def test_drop_sources_file_exists_with_iceburst_override(self):
        expected_root = Path(__file__).resolve().parents[2]
        self.assertEqual(REPO_ROOT, expected_root)
        self.assertEqual(
            DROP_SOURCES_PATH,
            REPO_ROOT / "data" / "codex-overrides" / "drop_sources.json",
        )
        self.assertTrue(DROP_SOURCES_PATH.is_file())
        data = json.loads(DROP_SOURCES_PATH.read_text(encoding="utf-8"))
        self.assertEqual(data["schemaVersion"], 1)
        self.assertIn("Iceburst Amulet", data["armors"])
        self.assertEqual(data["armors"]["Iceburst Amulet"], ["Ice Devil", "Greater Yeti"])

    def test_normalize_slug_matches_site_monster_ids(self):
        from tools.codex_pipeline.drops import normalize_slug

        self.assertEqual(normalize_slug("Ice Devil"), "ice-devil")
        self.assertEqual(normalize_slug("Greater Yeti"), "greater-yeti")
        self.assertEqual(normalize_slug("Hell Spawn"), "hell-spawn")

    def test_iceburst_mapping_is_available_in_both_directions(self):
        from tools.codex_pipeline.drops import derive_monster_drops, load_drop_sources

        sources = load_drop_sources(DROP_SOURCES_PATH)
        self.assertEqual(
            sources["armors"]["Iceburst Amulet"],
            ["Ice Devil", "Greater Yeti"],
        )

        reverse = derive_monster_drops(sources)
        self.assertEqual(reverse["armors"]["ice-devil"], ["Iceburst Amulet"])
        self.assertEqual(reverse["armors"]["greater-yeti"], ["Iceburst Amulet"])


if __name__ == "__main__":
    unittest.main()
