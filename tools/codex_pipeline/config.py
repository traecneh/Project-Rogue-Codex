from __future__ import annotations

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
CLIENT_ROOT = Path(r"C:\Users\traec\Desktop\Client")
CLIENT_DATA_DIR = CLIENT_ROOT / "data"
CLIENT_GF_JSON_DIR = CLIENT_ROOT / "gf_json"

DROP_SOURCES_PATH = REPO_ROOT / "data" / "codex-overrides" / "drop_sources.json"

WEAPONS_DATA_PATH = REPO_ROOT / "pages" / "items" / "weapons_data05.json"
ARMORS_DATA_PATH = REPO_ROOT / "pages" / "items" / "armors_data06.json"
MONSTERS_DATA_PATH = REPO_ROOT / "pages" / "enemies" / "monsters_data03.json"

WEAPON_IMAGES_DIR = REPO_ROOT / "images" / "weapons"
ARMOR_IMAGES_DIR = REPO_ROOT / "images" / "armors"
MONSTER_IMAGES_DIR = REPO_ROOT / "images" / "monsters"
