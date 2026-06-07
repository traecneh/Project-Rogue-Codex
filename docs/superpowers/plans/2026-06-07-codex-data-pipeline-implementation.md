# Codex Data Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first Codex-only data pipeline slice for drop-source overrides, validation, and site integration for weapons, armors, and monsters.

**Architecture:** Add a small Python command package under `tools/codex_pipeline/` for validation and future exports, plus a site-owned `data/codex-overrides/drop_sources.json` file. The static site will fetch that override file and derive both item-to-monster and monster-to-item views from it instead of maintaining duplicated inline maps.

**Tech Stack:** Python 3.12 standard library, `unittest`, static HTML/JavaScript, existing `RogueCodexUtils` helper namespace.

---

## File Structure

- Create `tools/__init__.py`: makes `tools` importable for `python -m tools.codex_pipeline`.
- Create `tools/codex_pipeline/__init__.py`: package marker and version.
- Create `tools/codex_pipeline/__main__.py`: forwards module execution to the CLI.
- Create `tools/codex_pipeline/cli.py`: implements `validate`, `validate-drops`, and `validate-site`.
- Create `tools/codex_pipeline/config.py`: centralizes repo paths and default source paths.
- Create `tools/codex_pipeline/drops.py`: loads drop override JSON, normalizes names, and derives reverse mappings.
- Create `tools/codex_pipeline/validators/__init__.py`: validator exports.
- Create `tools/codex_pipeline/validators/site.py`: validates JSON parsing, manifests, drop references, and inline script parsing.
- Create `data/codex-overrides/drop_sources.json`: single Codex source of truth for special weapon and armor drops.
- Create `tests/codex_pipeline/test_drops.py`: tests drop loading, normalization, symmetry, and Iceburst regression.
- Create `tests/codex_pipeline/test_site_validation.py`: tests manifest and inline-script validation helpers.
- Modify `js/utils.js`: add shared drop-source fetch and derivation helpers under `window.RogueCodexUtils`.
- Modify `pages/items/armors.html`: load shared drop overrides and remove the inline `UNIQUE_ARMOR_DROP_SOURCES` source of truth.
- Modify `pages/enemies/monsters.html`: load shared drop overrides and remove inline `UNIQUE_WEAPON_DROPS` / `UNIQUE_ARMOR_DROPS` sources of truth.

---

### Task 1: Add Drop Override Data And Python Package Skeleton

**Files:**
- Create: `tools/__init__.py`
- Create: `tools/codex_pipeline/__init__.py`
- Create: `tools/codex_pipeline/__main__.py`
- Create: `tools/codex_pipeline/cli.py`
- Create: `tools/codex_pipeline/config.py`
- Create: `data/codex-overrides/drop_sources.json`
- Test: `tests/codex_pipeline/test_drops.py`

- [ ] **Step 1: Write the failing package and override smoke tests**

Create `tests/codex_pipeline/test_drops.py`:

```python
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
python -m unittest tests.codex_pipeline.test_drops -v
```

Expected: FAIL or ERROR because `tools.codex_pipeline.config` and `data/codex-overrides/drop_sources.json` do not exist yet.

- [ ] **Step 3: Add minimal package files**

Create `tools/__init__.py`:

```python
"""Local tooling packages for the Project Rogue Codex."""
```

Create `tools/codex_pipeline/__init__.py`:

```python
"""Codex-only data pipeline for Project Rogue site exports."""

__version__ = "0.1.0"
```

Create `tools/codex_pipeline/config.py`:

```python
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
```

Create `tools/codex_pipeline/cli.py`:

```python
from __future__ import annotations

import argparse


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Project Rogue Codex data pipeline")
    parser.add_argument("command", choices=["validate", "validate-drops", "validate-site"])
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    parser.parse_args(argv)
    return 0
```

Create `tools/codex_pipeline/__main__.py`:

```python
from __future__ import annotations

from .cli import main


raise SystemExit(main())
```

- [ ] **Step 4: Add the initial override file**

Create `data/codex-overrides/drop_sources.json`:

```json
{
  "schemaVersion": 1,
  "armors": {
    "Iceburst Amulet": ["Ice Devil", "Greater Yeti"],
    "Mystic Robe": ["Dark Monk"],
    "Rune Armor": ["Balron", "Demon Lord"],
    "Rune Lord's Robe": ["Hell Spawn", "Balron", "Demon Lord"],
    "Rune Helmet": ["Balron", "Demon Lord"],
    "Rune Shield": ["Werewolf", "Demon", "Infernal", "Hell Spawn"],
    "Rune Leggings": ["Hell Spawn"],
    "Rune Gauntlets": ["Demon", "Infernal"],
    "Banished Gauntlets": ["Banished Spirit"],
    "Banished Shield": ["Banished Spirit", "Banished Soldier"],
    "Banished Platemail": ["Banished Knight"],
    "Banished Helmet": ["Banished Knight"],
    "Banished Leggings": ["Banished Soldier"]
  },
  "weapons": {
    "Rune Sword": ["Rune Warrior", "Balron", "Demon Lord"],
    "Vengeance Hammer": ["Banished Knight", "Banished Warden"]
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run:

```powershell
python -m unittest tests.codex_pipeline.test_drops -v
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add tools data/codex-overrides/drop_sources.json tests/codex_pipeline/test_drops.py
git commit -m "Add Codex drop override skeleton"
```

---

### Task 2: Add Drop Mapping Utilities And Tests

**Files:**
- Create: `tools/codex_pipeline/drops.py`
- Modify: `tests/codex_pipeline/test_drops.py`

- [ ] **Step 1: Extend tests for normalization and reverse mappings**

Append these tests to `DropSourcesSmokeTests` in `tests/codex_pipeline/test_drops.py`:

```python
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```powershell
python -m unittest tests.codex_pipeline.test_drops -v
```

Expected: ERROR because `tools.codex_pipeline.drops` does not exist.

- [ ] **Step 3: Add minimal drop utility implementation**

Create `tools/codex_pipeline/drops.py`:

```python
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


DROP_KINDS = ("armors", "weapons")


def normalize_name(value: Any) -> str:
    return str(value or "").strip()


def normalize_key(value: Any) -> str:
    return normalize_name(value).lower()


def normalize_slug(value: Any) -> str:
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9_-]+", "-", normalize_key(value)))


def load_drop_sources(path: Path) -> dict[str, dict[str, list[str]]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if raw.get("schemaVersion") != 1:
        raise ValueError(f"Unsupported drop source schemaVersion: {raw.get('schemaVersion')!r}")

    result: dict[str, dict[str, list[str]]] = {}
    for kind in DROP_KINDS:
        entries = raw.get(kind, {})
        if not isinstance(entries, dict):
            raise ValueError(f"{kind} drop sources must be an object")

        normalized_entries: dict[str, list[str]] = {}
        for item_name, monster_names in entries.items():
            item = normalize_name(item_name)
            if not item:
                raise ValueError(f"{kind} drop source contains an empty item name")
            if not isinstance(monster_names, list):
                raise ValueError(f"{kind} drop source for {item!r} must be a list")
            monsters = [normalize_name(name) for name in monster_names if normalize_name(name)]
            if not monsters:
                raise ValueError(f"{kind} drop source for {item!r} must include at least one monster")
            normalized_entries[item] = monsters
        result[kind] = normalized_entries
    return result


def derive_monster_drops(sources: dict[str, dict[str, list[str]]]) -> dict[str, dict[str, list[str]]]:
    reverse: dict[str, dict[str, list[str]]] = {kind: {} for kind in DROP_KINDS}
    for kind in DROP_KINDS:
        for item_name, monster_names in sources.get(kind, {}).items():
            for monster_name in monster_names:
                monster_id = normalize_slug(monster_name)
                reverse[kind].setdefault(monster_id, [])
                if item_name not in reverse[kind][monster_id]:
                    reverse[kind][monster_id].append(item_name)
    return reverse
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```powershell
python -m unittest tests.codex_pipeline.test_drops -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add tools/codex_pipeline/drops.py tests/codex_pipeline/test_drops.py
git commit -m "Add Codex drop mapping utilities"
```

---

### Task 3: Add Site Data Validation

**Files:**
- Create: `tools/codex_pipeline/validators/__init__.py`
- Create: `tools/codex_pipeline/validators/site.py`
- Create: `tests/codex_pipeline/test_site_validation.py`
- Modify: `tools/codex_pipeline/cli.py`

- [ ] **Step 1: Write failing validator tests**

Create `tests/codex_pipeline/test_site_validation.py`:

```python
import tempfile
import textwrap
import unittest
from pathlib import Path

from tools.codex_pipeline.config import DROP_SOURCES_PATH


class SiteValidationTests(unittest.TestCase):
    def test_manifest_self_reference_is_an_error(self):
        from tools.codex_pipeline.validators.site import validate_manifest_entries

        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            (folder / "Axe.gif").write_bytes(b"gif")
            issues = validate_manifest_entries(folder, ["images/weapons/Axe.gif", "images/weapons/manifest.json"])

        self.assertIn("manifest includes itself", "\n".join(issue.message for issue in issues))

    def test_drop_overrides_reference_existing_data(self):
        from tools.codex_pipeline.validators.site import validate_drop_references
        from tools.codex_pipeline.drops import load_drop_sources

        sources = load_drop_sources(DROP_SOURCES_PATH)
        issues = validate_drop_references(
            sources,
            armor_names={"Iceburst Amulet"},
            weapon_names={"Rune Sword", "Vengeance Hammer"},
            monster_names={"Ice Devil", "Greater Yeti", "Rune Warrior", "Balron", "Demon Lord", "Banished Knight", "Banished Warden"},
        )

        messages = [issue.message for issue in issues]
        self.assertNotIn("Iceburst Amulet", "\n".join(messages))

    def test_inline_script_parser_reports_syntax_errors(self):
        from tools.codex_pipeline.validators.site import validate_inline_scripts

        html = "<html><body><script>const x = ;</script></body></html>"
        issues = validate_inline_scripts("broken.html", html)

        self.assertEqual(len(issues), 1)
        self.assertIn("broken.html inline script #1", issues[0].message)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```powershell
python -m unittest tests.codex_pipeline.test_site_validation -v
```

Expected: ERROR because `tools.codex_pipeline.validators.site` does not exist.

- [ ] **Step 3: Add validator implementation**

Create `tools/codex_pipeline/validators/__init__.py`:

```python
"""Validation helpers for Codex pipeline outputs."""
```

Create `tools/codex_pipeline/validators/site.py`:

```python
from __future__ import annotations

import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from tools.codex_pipeline.drops import DROP_KINDS, normalize_key


@dataclass(frozen=True)
class ValidationIssue:
    severity: str
    message: str


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def collect_names(path: Path) -> set[str]:
    data = read_json(path)
    if not isinstance(data, list):
        return set()
    return {normalize_key(row.get("name")) for row in data if isinstance(row, dict) and normalize_key(row.get("name"))}


def validate_manifest_entries(folder: Path, entries: Iterable[str]) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    actual = {path.name for path in folder.iterdir() if path.is_file()}
    for entry in entries:
        name = Path(str(entry).replace("\\", "/")).name
        if name == "manifest.json":
            issues.append(ValidationIssue("error", f"{folder / 'manifest.json'} manifest includes itself"))
        elif name not in actual:
            issues.append(ValidationIssue("error", f"{folder / 'manifest.json'} lists missing image {name}"))
    return issues


def validate_drop_references(
    sources: dict[str, dict[str, list[str]]],
    *,
    armor_names: set[str],
    weapon_names: set[str],
    monster_names: set[str],
) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    item_sets = {
        "armors": {normalize_key(name) for name in armor_names},
        "weapons": {normalize_key(name) for name in weapon_names},
    }
    monsters = {normalize_key(name) for name in monster_names}

    for kind in DROP_KINDS:
        for item_name, drop_monsters in sources.get(kind, {}).items():
            if normalize_key(item_name) not in item_sets[kind]:
                issues.append(ValidationIssue("error", f"{kind} drop override item not found: {item_name}"))
            for monster_name in drop_monsters:
                if normalize_key(monster_name) not in monsters:
                    issues.append(ValidationIssue("error", f"{kind} drop override monster not found: {monster_name}"))
    return issues


def validate_inline_scripts(label: str, html: str) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    script_re = re.compile(r"<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>", re.IGNORECASE)
    for index, match in enumerate(script_re.finditer(html), start=1):
        code = match.group(1).strip()
        if not code:
            continue
        completed = subprocess.run(
            ["node", "--check", "-"],
            input=code,
            text=True,
            capture_output=True,
        )
        if completed.returncode != 0:
            detail = (completed.stderr or completed.stdout).strip().splitlines()[0]
            issues.append(ValidationIssue("error", f"{label} inline script #{index} failed parse: {detail}"))
    return issues
```

- [ ] **Step 4: Run validator tests to verify they pass**

Run:

```powershell
python -m unittest tests.codex_pipeline.test_site_validation -v
```

Expected: PASS.

- [ ] **Step 5: Wire CLI validate command**

Replace `tools/codex_pipeline/cli.py` with:

```python
from __future__ import annotations

import argparse
import json

from tools.codex_pipeline.config import (
    ARMOR_IMAGES_DIR,
    ARMORS_DATA_PATH,
    DROP_SOURCES_PATH,
    MONSTER_IMAGES_DIR,
    MONSTERS_DATA_PATH,
    REPO_ROOT,
    WEAPON_IMAGES_DIR,
    WEAPONS_DATA_PATH,
)
from tools.codex_pipeline.drops import load_drop_sources
from tools.codex_pipeline.validators.site import (
    ValidationIssue,
    collect_names,
    validate_drop_references,
    validate_inline_scripts,
    validate_manifest_entries,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Project Rogue Codex data pipeline")
    parser.add_argument("command", choices=["validate", "validate-drops", "validate-site"])
    return parser


def _print_issues(issues: list[ValidationIssue]) -> int:
    for issue in issues:
        print(f"{issue.severity.upper()}: {issue.message}")
    return 1 if any(issue.severity == "error" for issue in issues) else 0


def run_validate() -> int:
    sources = load_drop_sources(DROP_SOURCES_PATH)
    issues: list[ValidationIssue] = []
    weapon_names = collect_names(WEAPONS_DATA_PATH)
    armor_names = collect_names(ARMORS_DATA_PATH)
    monster_names = collect_names(MONSTERS_DATA_PATH)
    issues.extend(
        validate_drop_references(
            sources,
            armor_names=armor_names,
            weapon_names=weapon_names,
            monster_names=monster_names,
        )
    )
    for folder in [WEAPON_IMAGES_DIR, ARMOR_IMAGES_DIR, MONSTER_IMAGES_DIR]:
        manifest_path = folder / "manifest.json"
        entries = json.loads(manifest_path.read_text(encoding="utf-8"))
        issues.extend(validate_manifest_entries(folder, entries))
    for path in [REPO_ROOT / "pages" / "items" / "armors.html", REPO_ROOT / "pages" / "enemies" / "monsters.html"]:
        issues.extend(validate_inline_scripts(str(path.relative_to(REPO_ROOT)), path.read_text(encoding="utf-8")))
    return _print_issues(issues)


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command in {"validate", "validate-drops", "validate-site"}:
        return run_validate()
    parser.error(f"Unsupported command: {args.command}")
    return 2
```

- [ ] **Step 6: Run CLI validation and record current failures**

Run:

```powershell
python -m tools.codex_pipeline validate
```

Expected before manifest cleanup: FAIL with errors for `images/armors/manifest.json` and `images/monsters/manifest.json` including themselves.

- [ ] **Step 7: Commit**

```powershell
git add tools/codex_pipeline tests/codex_pipeline
git commit -m "Add Codex site validators"
```

---

### Task 4: Clean Existing Image Manifests

**Files:**
- Modify: `images/armors/manifest.json`
- Modify: `images/monsters/manifest.json`

- [ ] **Step 1: Run validation to confirm manifest failures**

Run:

```powershell
python -m tools.codex_pipeline validate
```

Expected: FAIL with these messages:

```text
ERROR: ...images\armors\manifest.json manifest includes itself
ERROR: ...images\monsters\manifest.json manifest includes itself
```

- [ ] **Step 2: Remove self-references from manifests**

Edit `images/armors/manifest.json` and remove this entry:

```json
"images/armors/manifest.json"
```

Edit `images/monsters/manifest.json` and remove this entry:

```json
"images/monsters/manifest.json"
```

Keep valid JSON commas after removal.

- [ ] **Step 3: Run validation to verify manifests pass**

Run:

```powershell
python -m tools.codex_pipeline validate
```

Expected: PASS, or only warnings if warning support has been added. There should be no manifest self-reference error.

- [ ] **Step 4: Commit**

```powershell
git add images/armors/manifest.json images/monsters/manifest.json
git commit -m "Clean Codex image manifests"
```

---

### Task 5: Add Shared Drop Source Helpers To Site JavaScript

**Files:**
- Modify: `js/utils.js`

- [ ] **Step 1: Write a failing Node smoke test command**

Run:

```powershell
@'
const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync('js/utils.js', 'utf8');
new vm.Script(code, { filename: 'js/utils.js' });
if (!code.includes('loadDropSources')) throw new Error('loadDropSources helper missing');
if (!code.includes('getDropSourceItemNamesByMonster')) throw new Error('monster reverse helper missing');
if (!code.includes('getDropSourceMonsterIdsByItem')) throw new Error('item source helper missing');
console.log('drop source helpers present');
'@ | node -
```

Expected: FAIL with `loadDropSources helper missing`.

- [ ] **Step 2: Add helper state and URL functions near the existing allowlists state**

In `js/utils.js`, after:

```js
  let allowlistsPromise = null;
  let allowlistsCache = null;
```

add:

```js
  const DROP_SOURCES_SCHEMA_VERSION = 1;
  let dropSourcesPromise = null;
  let dropSourcesCache = null;
```

After `getAllowlistsUrl()`, add:

```js
  function getDropSourcesUrl() {
    try {
      const base = typeof document !== "undefined" && document.baseURI ? document.baseURI : window.location.href;
      const resolved = new URL("data/codex-overrides/drop_sources.json", base);
      if (resolved.protocol === "http:" || resolved.protocol === "https:") {
        resolved.searchParams.set("v", String(DROP_SOURCES_SCHEMA_VERSION));
      }
      return resolved.toString();
    } catch (error) {
      return "data/codex-overrides/drop_sources.json";
    }
  }
```

- [ ] **Step 3: Add normalization and derivation helpers before the `window.RogueCodexUtils` export**

Add this block before the final `window.RogueCodexUtils = Object.assign(...)`:

```js
  function normalizeDropName(value) {
    return (value === null || value === undefined ? "" : String(value)).trim();
  }

  function normalizeDropKey(value) {
    return normalizeDropName(value).toLowerCase();
  }

  function normalizeDropSlug(value) {
    return normalizeDropKey(value)
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function createEmptyDropSources() {
    return {
      schemaVersion: DROP_SOURCES_SCHEMA_VERSION,
      armors: {},
      weapons: {},
      reverse: {
        armors: {},
        weapons: {},
      },
    };
  }

  function normalizeDropSourceData(data) {
    const source = data && typeof data === "object" ? data : {};
    const result = createEmptyDropSources();
    ["armors", "weapons"].forEach((kind) => {
      const entries = source[kind] && typeof source[kind] === "object" ? source[kind] : {};
      Object.entries(entries).forEach(([itemName, monsterNames]) => {
        const item = normalizeDropName(itemName);
        if (!item || !Array.isArray(monsterNames)) return;
        const monsters = monsterNames.map(normalizeDropName).filter(Boolean);
        if (!monsters.length) return;
        result[kind][normalizeDropKey(item)] = {
          name: item,
          monsters,
          monsterIds: monsters.map(normalizeDropSlug),
        };
        monsters.forEach((monsterName) => {
          const monsterId = normalizeDropSlug(monsterName);
          if (!monsterId) return;
          result.reverse[kind][monsterId] = result.reverse[kind][monsterId] || [];
          if (!result.reverse[kind][monsterId].includes(item)) {
            result.reverse[kind][monsterId].push(item);
          }
        });
      });
    });
    return result;
  }

  function loadDropSources() {
    if (dropSourcesCache) return Promise.resolve(dropSourcesCache);
    if (dropSourcesPromise) return dropSourcesPromise;
    dropSourcesPromise = fetchJsonCached(getDropSourcesUrl(), {
      cacheKey: `drop-sources-v${DROP_SOURCES_SCHEMA_VERSION}`,
      ttlMs: DEFAULT_JSON_TTL_MS,
    })
      .then((data) => {
        dropSourcesCache = normalizeDropSourceData(data);
        return dropSourcesCache;
      })
      .catch(() => {
        dropSourcesCache = createEmptyDropSources();
        return dropSourcesCache;
      })
      .finally(() => {
        dropSourcesPromise = null;
      });
    return dropSourcesPromise;
  }

  function getDropSourceMonsterIdsByItem(dropSources, kind, itemName) {
    const safe = dropSources || createEmptyDropSources();
    const entry = safe[kind]?.[normalizeDropKey(itemName)];
    return Array.isArray(entry?.monsterIds) ? entry.monsterIds : [];
  }

  function getDropSourceItemNamesByMonster(dropSources, kind, monsterName) {
    const safe = dropSources || createEmptyDropSources();
    const monsterId = normalizeDropSlug(monsterName);
    const entries = safe.reverse?.[kind]?.[monsterId];
    return Array.isArray(entries) ? entries : [];
  }
```

- [ ] **Step 4: Export the helpers**

In the final `Object.assign` export in `js/utils.js`, add:

```js
    createEmptyDropSources,
    getDropSourceItemNamesByMonster,
    getDropSourceMonsterIdsByItem,
    loadDropSources,
    normalizeDropSourceData,
    normalizeDropSlug,
```

- [ ] **Step 5: Run the smoke test and parser**

Run:

```powershell
@'
const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync('js/utils.js', 'utf8');
new vm.Script(code, { filename: 'js/utils.js' });
if (!code.includes('loadDropSources')) throw new Error('loadDropSources helper missing');
if (!code.includes('getDropSourceItemNamesByMonster')) throw new Error('monster reverse helper missing');
if (!code.includes('getDropSourceMonsterIdsByItem')) throw new Error('item source helper missing');
console.log('drop source helpers present');
'@ | node -
```

Expected: PASS with `drop source helpers present`.

- [ ] **Step 6: Commit**

```powershell
git add js/utils.js
git commit -m "Add shared drop source helpers"
```

---

### Task 6: Update Armor Page To Use Shared Drop Overrides

**Files:**
- Modify: `pages/items/armors.html`

- [ ] **Step 1: Write failing page-source smoke check**

Run:

```powershell
@'
const fs = require('fs');
const html = fs.readFileSync('pages/items/armors.html', 'utf8');
if (html.includes('const UNIQUE_ARMOR_DROP_SOURCES')) {
  throw new Error('armor page still defines UNIQUE_ARMOR_DROP_SOURCES');
}
if (!html.includes('loadDropSources')) {
  throw new Error('armor page does not load shared drop sources');
}
console.log('armor page uses shared drop sources');
'@ | node -
```

Expected: FAIL because `UNIQUE_ARMOR_DROP_SOURCES` is still present.

- [ ] **Step 2: Add local drop source loader state**

In `pages/items/armors.html`, after the `loadAllowlists` constant, add:

```js
        const loadDropSources =
          typeof utils.loadDropSources === "function" ? () => utils.loadDropSources() : () => Promise.resolve(null);
        let dropSources =
          typeof utils.createEmptyDropSources === "function"
            ? utils.createEmptyDropSources()
            : { armors: {}, weapons: {}, reverse: { armors: {}, weapons: {} } };
```

- [ ] **Step 3: Remove the inline armor drop map**

Delete the full `const UNIQUE_ARMOR_DROP_SOURCES = { ... };` block from `pages/items/armors.html`.

- [ ] **Step 4: Read unique monster ids from the shared override data**

In `createDropsFromPill`, replace:

```js
              const uniqueMonsterIds = UNIQUE_ARMOR_DROP_SOURCES[normalizeFilterValue(item?.name)] || null;
```

with:

```js
              const uniqueMonsterIds =
                typeof utils.getDropSourceMonsterIdsByItem === "function"
                  ? utils.getDropSourceMonsterIdsByItem(dropSources, "armors", item?.name)
                  : [];
```

- [ ] **Step 5: Load drop sources during initialization**

In the `Promise.all` inside `init`, change:

```js
              loadAllowlists(),
```

to:

```js
              loadAllowlists(),
              loadDropSources(),
```

Change the `.then` parameter list from:

```js
              .then(([data, perksData, monstersData, allowlists]) => {
```

to:

```js
              .then(([data, perksData, monstersData, allowlists, loadedDropSources]) => {
```

After `applyAllowlists(allowlists);`, add:

```js
                dropSources =
                  loadedDropSources ||
                  (typeof utils.createEmptyDropSources === "function"
                    ? utils.createEmptyDropSources()
                    : dropSources);
```

- [ ] **Step 6: Run page smoke and inline parser checks**

Run:

```powershell
@'
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('pages/items/armors.html', 'utf8');
if (html.includes('const UNIQUE_ARMOR_DROP_SOURCES')) throw new Error('armor page still defines UNIQUE_ARMOR_DROP_SOURCES');
if (!html.includes('loadDropSources')) throw new Error('armor page does not load shared drop sources');
const re = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;
while ((match = re.exec(html))) {
  count += 1;
  const code = match[1].trim();
  if (code) new vm.Script(code, { filename: `pages/items/armors.html inline #${count}` });
}
console.log('armor page uses shared drop sources and parses');
'@ | node -
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add pages/items/armors.html
git commit -m "Use shared armor drop overrides"
```

---

### Task 7: Update Monster Page To Use Shared Drop Overrides

**Files:**
- Modify: `pages/enemies/monsters.html`

- [ ] **Step 1: Write failing page-source smoke check**

Run:

```powershell
@'
const fs = require('fs');
const html = fs.readFileSync('pages/enemies/monsters.html', 'utf8');
if (html.includes('const UNIQUE_ARMOR_DROPS')) throw new Error('monster page still defines UNIQUE_ARMOR_DROPS');
if (html.includes('const UNIQUE_WEAPON_DROPS')) throw new Error('monster page still defines UNIQUE_WEAPON_DROPS');
if (!html.includes('loadDropSources')) throw new Error('monster page does not load shared drop sources');
console.log('monster page uses shared drop sources');
'@ | node -
```

Expected: FAIL because both inline maps are still present.

- [ ] **Step 2: Add local drop source loader state**

In `pages/enemies/monsters.html`, after the `loadAllowlists` constant, add:

```js
        const loadDropSources =
          typeof utils.loadDropSources === "function" ? () => utils.loadDropSources() : () => Promise.resolve(null);
        let dropSources =
          typeof utils.createEmptyDropSources === "function"
            ? utils.createEmptyDropSources()
            : { armors: {}, weapons: {}, reverse: { armors: {}, weapons: {} } };
```

- [ ] **Step 3: Remove inline monster drop maps**

Delete the full `const UNIQUE_WEAPON_DROPS = { ... };` block.

Delete the full `const UNIQUE_ARMOR_DROPS = { ... };` block.

- [ ] **Step 4: Read unique weapon names from shared override data**

In `renderLootTable`, replace:

```js
            const monsterKey = normalizeMonsterId(monster.name || monster.id);
            const uniqueWeaponNames = Array.isArray(UNIQUE_WEAPON_DROPS[monsterKey])
              ? UNIQUE_WEAPON_DROPS[monsterKey]
              : [];
```

with:

```js
            const monsterKey = normalizeMonsterId(monster.name || monster.id);
            const uniqueWeaponNames =
              typeof utils.getDropSourceItemNamesByMonster === "function"
                ? utils.getDropSourceItemNamesByMonster(dropSources, "weapons", monster.name || monster.id)
                : [];
```

- [ ] **Step 5: Read unique armor names from shared override data**

In `renderLootTable`, replace:

```js
            const armorMonsterKey = normalizeMonsterId(monster.name || monster.id);
            const uniqueArmorNames = Array.isArray(UNIQUE_ARMOR_DROPS[armorMonsterKey])
              ? UNIQUE_ARMOR_DROPS[armorMonsterKey]
              : [];
```

with:

```js
            const armorMonsterKey = normalizeMonsterId(monster.name || monster.id);
            const uniqueArmorNames =
              typeof utils.getDropSourceItemNamesByMonster === "function"
                ? utils.getDropSourceItemNamesByMonster(dropSources, "armors", monster.name || monster.id)
                : [];
```

- [ ] **Step 6: Load drop sources during initialization**

In the `Promise.all` inside `init`, change:

```js
            loadAllowlists(),
```

to:

```js
            loadAllowlists(),
            loadDropSources(),
```

Change the `.then` parameter list from:

```js
            .then(([monsterData, weaponData, armorData, resistancesData, allowlists]) => {
```

to:

```js
            .then(([monsterData, weaponData, armorData, resistancesData, allowlists, loadedDropSources]) => {
```

After `applyAllowlists(allowlists);`, add:

```js
              dropSources =
                loadedDropSources ||
                (typeof utils.createEmptyDropSources === "function"
                  ? utils.createEmptyDropSources()
                  : dropSources);
```

- [ ] **Step 7: Run page smoke and inline parser checks**

Run:

```powershell
@'
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('pages/enemies/monsters.html', 'utf8');
if (html.includes('const UNIQUE_ARMOR_DROPS')) throw new Error('monster page still defines UNIQUE_ARMOR_DROPS');
if (html.includes('const UNIQUE_WEAPON_DROPS')) throw new Error('monster page still defines UNIQUE_WEAPON_DROPS');
if (!html.includes('loadDropSources')) throw new Error('monster page does not load shared drop sources');
const re = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;
while ((match = re.exec(html))) {
  count += 1;
  const code = match[1].trim();
  if (code) new vm.Script(code, { filename: `pages/enemies/monsters.html inline #${count}` });
}
console.log('monster page uses shared drop sources and parses');
'@ | node -
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add pages/enemies/monsters.html
git commit -m "Use shared monster drop overrides"
```

---

### Task 8: Final Validation And Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run complete validation**

Run:

```powershell
python -m unittest discover -s tests -v
python -m tools.codex_pipeline validate
```

Expected: both commands PASS.

- [ ] **Step 2: Add concise README usage**

Append this section to `README.md`:

````markdown
## Codex Data Pipeline

Codex-only validation and future export tooling lives in `tools/codex_pipeline/`.

Run validation before committing data or drop-source changes:

```powershell
python -m tools.codex_pipeline validate
```

The first pipeline slice validates weapons, armors, monsters, image manifests, inline page scripts, and special drop-source overrides from `data/codex-overrides/drop_sources.json`.
````

- [ ] **Step 3: Run validation again**

Run:

```powershell
python -m unittest discover -s tests -v
python -m tools.codex_pipeline validate
```

Expected: both commands PASS.

- [ ] **Step 4: Review final diff**

Run:

```powershell
git status --short --branch
git diff --stat HEAD
```

Expected: only README changes are unstaged after the previous task commits.

- [ ] **Step 5: Commit README**

```powershell
git add README.md
git commit -m "Document Codex data validation"
```

- [ ] **Step 6: Provide next recommendation**

After all tasks pass, recommend the next phase:

```text
Next recommendation: add export commands that wrap the existing client data extractors and write to an intermediate generated-output folder before syncing into the site.
```

Do not push unless the user asks to publish the completed work.
