from __future__ import annotations

import os
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
CLIENT_ROOT = Path(os.environ.get("PROJECT_ROGUE_CLIENT_ROOT", r"C:\Users\traec\Desktop\Client")).expanduser()
CLIENT_DATA_DIR = CLIENT_ROOT / "data"
CLIENT_PACK_PATH = CLIENT_ROOT / "Data" / "ClientPack" / "rogue_data.vpack"
CLIENT_LOG_PATH = CLIENT_ROOT / "ProjectRogue.log"
CLIENT_GF_JSON_DIR = CLIENT_ROOT / "gf_json"
CLIENT_IMAGE_DIR = CLIENT_GF_JSON_DIR / "images"
CLIENT_WEAPON_IMAGES_DIR = CLIENT_IMAGE_DIR / "Weapons"
CLIENT_ARMOR_IMAGES_DIR = CLIENT_IMAGE_DIR / "Armors"
CLIENT_MONSTER_IMAGES_DIR = CLIENT_IMAGE_DIR / "Monsters"
EXTRACTORS_DIR = REPO_ROOT / "tools" / "codex_pipeline" / "extractors"

DROP_SOURCES_PATH = REPO_ROOT / "data" / "codex-overrides" / "drop_sources.json"
ITEM_RELATIONSHIP_OVERRIDES_PATH = REPO_ROOT / "data" / "codex-overrides" / "item_relationships.json"
ITEM_RELATIONSHIP_TARGETS_PATH = REPO_ROOT / "data" / "codex-overrides" / "item_relationship_targets.json"
PERK_LABEL_OVERRIDES_PATH = REPO_ROOT / "data" / "codex-overrides" / "perk_labels.json"
GENERATED_OUTPUT_DIR = REPO_ROOT / "generated-output" / "codex-data"
GENERATED_ATLAS_ASSET_DIR = REPO_ROOT / "generated-output" / "atlas-assets"
GENERATED_IMAGE_REVIEW_DIR = REPO_ROOT / "generated-output" / "image-review"
CODEX_MANIFEST_PATH = REPO_ROOT / "data" / "codex_manifest.json"

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
