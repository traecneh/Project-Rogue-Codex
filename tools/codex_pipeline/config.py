from __future__ import annotations

from pathlib import Path


WORKTREE_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = WORKTREE_ROOT.parent.parent if WORKTREE_ROOT.parent.name == ".worktrees" else WORKTREE_ROOT
CLIENT_ROOT = Path(r"C:\Users\traec\Desktop\Client")
CLIENT_DATA_DIR = CLIENT_ROOT / "data"
CLIENT_GF_JSON_DIR = CLIENT_ROOT / "gf_json"

DROP_SOURCES_PATH = WORKTREE_ROOT / "data" / "codex-overrides" / "drop_sources.json"

WEAPONS_DATA_PATH = WORKTREE_ROOT / "pages" / "items" / "weapons_data05.json"
ARMORS_DATA_PATH = WORKTREE_ROOT / "pages" / "items" / "armors_data06.json"
MONSTERS_DATA_PATH = WORKTREE_ROOT / "pages" / "enemies" / "monsters_data03.json"

WEAPON_IMAGES_DIR = WORKTREE_ROOT / "images" / "weapons"
ARMOR_IMAGES_DIR = WORKTREE_ROOT / "images" / "armors"
MONSTER_IMAGES_DIR = WORKTREE_ROOT / "images" / "monsters"
