from __future__ import annotations

import os
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
_CONFIGURED_CLIENT_ROOT = os.environ.get("PROJECT_ROGUE_CLIENT_ROOT")
_DEFAULT_CLIENT_ROOTS = (
    Path(r"C:\Users\traec\Desktop\Project Rogue\Client"),
    Path(r"C:\Users\traec\Desktop\Client"),
)
CLIENT_ROOT = (
    Path(_CONFIGURED_CLIENT_ROOT).expanduser()
    if _CONFIGURED_CLIENT_ROOT
    else next((path for path in _DEFAULT_CLIENT_ROOTS if path.is_dir()), _DEFAULT_CLIENT_ROOTS[0])
)
CLIENT_DATA_DIR = CLIENT_ROOT / "data"
CLIENT_PACK_PATH = CLIENT_ROOT / "Data" / "ClientPack" / "rogue_data.vpack"
CLIENT_GRAPHICS_PACK_PATH = CLIENT_ROOT / "Data" / "GraphicsPack" / "rogue_graphics.vpack"
CLIENT_LOG_PATH = CLIENT_ROOT / "ProjectRogue.log"
CLIENT_GF_JSON_DIR = CLIENT_ROOT / "gf_json"
CLIENT_IMAGE_DIR = CLIENT_GF_JSON_DIR / "images"
CLIENT_WEAPON_IMAGES_DIR = CLIENT_IMAGE_DIR / "Weapons"
CLIENT_ARMOR_IMAGES_DIR = CLIENT_IMAGE_DIR / "Armors"
CLIENT_MONSTER_IMAGES_DIR = CLIENT_IMAGE_DIR / "Monsters"
EXTRACTORS_DIR = REPO_ROOT / "tools" / "codex_pipeline" / "extractors"

DROP_SOURCES_PATH = REPO_ROOT / "data" / "codex-overrides" / "drop_sources.json"
ALLOWLISTS_PATH = REPO_ROOT / "data" / "allowlists.json"
ITEM_RELATIONSHIP_OVERRIDES_PATH = REPO_ROOT / "data" / "codex-overrides" / "item_relationships.json"
ITEM_RELATIONSHIP_TARGETS_PATH = REPO_ROOT / "data" / "codex-overrides" / "item_relationship_targets.json"
PERK_LABEL_OVERRIDES_PATH = REPO_ROOT / "data" / "codex-overrides" / "perk_labels.json"
GENERATED_OUTPUT_DIR = REPO_ROOT / "generated-output" / "codex-data"
GENERATED_ATLAS_ASSET_DIR = REPO_ROOT / "generated-output" / "atlas-assets"
GENERATED_GRAPHICS_PACK_DIR = REPO_ROOT / "generated-output" / "graphics-pack"
GENERATED_IMAGE_REVIEW_DIR = REPO_ROOT / "generated-output" / "image-review"
CODEX_MANIFEST_PATH = REPO_ROOT / "data" / "codex_manifest.json"
CLIENT_INVENTORY_SNAPSHOT_PATH = REPO_ROOT / "data" / "client_inventory_snapshot.json"
PLAYER_TABLES_DATA_PATH = REPO_ROOT / "data" / "player_tables.json"
QUESTS_DATA_PATH = REPO_ROOT / "pages" / "General" / "quests_data.json"

WEAPONS_DATA_PATH = REPO_ROOT / "pages" / "items" / "weapons_data05.json"
ARMORS_DATA_PATH = REPO_ROOT / "pages" / "items" / "armors_data06.json"
COLLECTABLES_DATA_PATH = REPO_ROOT / "pages" / "items" / "collectables_data.json"
USEABLES_DATA_PATH = REPO_ROOT / "pages" / "items" / "useables_data.json"
MONSTERS_DATA_PATH = REPO_ROOT / "pages" / "enemies" / "monsters_data03.json"

WEAPON_IMAGES_DIR = REPO_ROOT / "images" / "weapons"
ARMOR_IMAGES_DIR = REPO_ROOT / "images" / "armors"
COLLECTABLE_IMAGES_DIR = REPO_ROOT / "images" / "collectables"
USEABLE_IMAGES_DIR = REPO_ROOT / "images" / "useables"
MONSTER_IMAGES_DIR = REPO_ROOT / "images" / "monsters"
