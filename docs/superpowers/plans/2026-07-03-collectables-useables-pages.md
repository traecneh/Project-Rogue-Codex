# Collectables And Useables Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add packed-data-backed Collectables and Useables pages under Items & Enemies, styled like the existing Weapons, Armors, and Monsters pages.

**Architecture:** Treat `collectables` and `useables` as first-class export, asset, manifest, live-verify, and smoke-test targets. Build the frontend with two small HTML shells and one shared catalog script/CSS pair configured by page-level `data-*` attributes. Use id-based detail routes to avoid duplicate display-name ambiguity.

**Tech Stack:** Static HTML/CSS/JavaScript, Python `unittest`, existing `tools.codex_pipeline` CLI, VPACK packed JSON mapper, Pillow atlas extraction, Playwright smoke runner.

---

## File Structure

- Modify `tools/codex_pipeline/config.py`: add site data paths and image directories for collectables/useables.
- Modify `tools/codex_pipeline/packed_json.py`: add packed JSON filename mapping plus shared flat-item mapper for collectables/useables.
- Modify `tools/codex_pipeline/exports.py`: add export targets and allow packed-only targets to skip legacy extractor scripts when VPACK is available.
- Modify `tools/codex_pipeline/sources.py`: make source validation accept packed-only targets without a legacy extractor script.
- Modify `tools/codex_pipeline/assets.py`: add asset targets for generated atlas output and manifest validation.
- Modify `tools/codex_pipeline/atlas_assets.py`: map both targets to `itemgraph.json`.
- Modify `tools/codex_pipeline/freshness.py`: include new data and asset targets in `data/codex_manifest.json`.
- Modify `tools/codex_pipeline/deploy.py`: include new live data and asset targets in `verify-live` / `verify-deploy`.
- Modify `tools/codex_pipeline/cli.py`: validate new HTML, CSS, JS, data, and image manifest paths.
- Create `pages/items/collectables.html`: Collectables page shell.
- Create `pages/items/useables.html`: Useables page shell.
- Create `css/misc-items.css`: shared styling copied from the existing item-page visual language.
- Create `js/misc-items-page.js`: shared catalog behavior for both pages.
- Modify `nav.html`: add Collectables and Useables after Monsters.
- Modify `js/site-search.js`: add base page search entries and item-level search entries.
- Modify `tools/codex_pipeline/site_smoke.mjs`: add smoke specs for both pages.
- Create generated site data: `pages/items/collectables_data.json`, `pages/items/useables_data.json`.
- Create generated image folders: `images/collectables/`, `images/useables/`, each with `manifest.json`.
- Modify tests:
  - `tests/codex_pipeline/test_packed_json.py`
  - `tests/codex_pipeline/test_exports.py`
  - `tests/codex_pipeline/test_sources.py`
  - `tests/codex_pipeline/test_atlas_assets.py`
  - `tests/codex_pipeline/test_site_validation.py`
  - `tests/codex_pipeline/test_deploy.py`
  - `tests/codex_pipeline/test_site_smoke.py`

## Working Tree Note

The repository may already contain unrelated modified files. Before each commit, run `git status --short` and stage only the files listed in that task.

---

### Task 1: Packed JSON Mapping

**Files:**
- Modify: `tests/codex_pipeline/test_packed_json.py`
- Modify: `tools/codex_pipeline/packed_json.py`

- [ ] **Step 1: Add failing mapper tests**

Append these tests to `PackedJsonMapperTests` in `tests/codex_pipeline/test_packed_json.py`:

```python
    def test_maps_collectables_json_to_site_shape(self):
        from tools.codex_pipeline.packed_json import map_packed_json_target

        packed_files = {
            "collectables.json": {
                "schema_version": 1,
                "collectables": [
                    {
                        "id": 24,
                        "name": "Soul of Flame",
                        "value": 5000,
                        "use_type": 0,
                        "crafting_material_type": 0,
                        "crafting_material_amount": 0,
                        "crafting_difficulty": -50,
                        "crafting_requirement": 0,
                        "emits_light": 1,
                        "animated": 1,
                        "animation_frame_count": 5,
                        "animation_type": 1,
                        "frames": [{"x": 3, "y": 4, "w": 16, "h": 16}],
                    },
                    {"id": 99, "name": "Unused", "frames": []},
                    {"id": 100, "name": "", "frames": []},
                ],
            }
        }

        records = map_packed_json_target("collectables", packed_files)

        self.assertEqual(1, len(records))
        record = records[0]
        fields = record["fields"]
        self.assertEqual(24, record["id"])
        self.assertEqual("Soul of Flame", record["name"])
        self.assertEqual(5000, fields["value"])
        self.assertEqual(0, fields["use_type"])
        self.assertEqual(-50, fields["crafting_difficulty"])
        self.assertEqual(1, fields["emits_light"])
        self.assertEqual(1, fields["animated"])
        self.assertEqual(5, fields["animation_frame_count"])
        self.assertEqual(1, fields["animation_type"])
        self.assertEqual(3, fields["frame_1_x"])
        self.assertEqual(16, fields["frame_1_width"])
        self.assertEqual(0, fields["frame_2_width"])

    def test_maps_useables_json_to_site_shape(self):
        from tools.codex_pipeline.packed_json import map_packed_json_target

        packed_files = {
            "useables.json": {
                "schema_version": 1,
                "useables": [
                    {
                        "id": 10,
                        "name": "Carpentry Saw",
                        "value": 250,
                        "use_type": 15,
                        "crafting_material_type": 0,
                        "crafting_material_amount": 0,
                        "crafting_difficulty": 0,
                        "crafting_requirement": 0,
                        "emits_light": 0,
                        "animated": 0,
                        "animation_frame_count": 0,
                        "animation_type": 0,
                        "frames": [{"x": 8, "y": 9, "w": 16, "h": 16}],
                    }
                ],
            }
        }

        records = map_packed_json_target("useables", packed_files)

        self.assertEqual(1, len(records))
        fields = records[0]["fields"]
        self.assertEqual(10, records[0]["id"])
        self.assertEqual("Carpentry Saw", records[0]["name"])
        self.assertEqual(250, fields["value"])
        self.assertEqual(15, fields["use_type"])
        self.assertEqual(8, fields["frame_1_x"])
        self.assertEqual(16, fields["frame_1_width"])
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
python -m unittest tests.codex_pipeline.test_packed_json.PackedJsonMapperTests.test_maps_collectables_json_to_site_shape tests.codex_pipeline.test_packed_json.PackedJsonMapperTests.test_maps_useables_json_to_site_shape -v
```

Expected: both tests fail with `VpackError: collectables does not support packed JSON mapping` or `VpackError: useables does not support packed JSON mapping`.

- [ ] **Step 3: Add packed mapping implementation**

In `tools/codex_pipeline/packed_json.py`, extend the filename map:

```python
PACKED_JSON_FILENAMES_BY_TARGET = {
    "weapons": "weapons.json",
    "armors": "armors.json",
    "monsters": "monsters.json",
    "collectables": "collectables.json",
    "useables": "useables.json",
}
```

In `map_packed_json_target`, add the two cases before the final `else`:

```python
    elif target_name == "collectables":
        records = _map_simple_items(data, "collectables")
    elif target_name == "useables":
        records = _map_simple_items(data, "useables")
```

Add this helper near the existing mapper functions:

```python
def _simple_item_records(data: Mapping[str, Any], key: str) -> list[Mapping[str, Any]]:
    items = data.get(key)
    if not isinstance(items, list):
        raise VpackError(f"packed {key} JSON does not contain a {key} array")
    return [item for item in items if isinstance(item, Mapping) and _is_named_record(item)]


def _map_simple_items(data: Mapping[str, Any], key: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for item in _simple_item_records(data, key):
        fields = {
            "value": _int_value(item, "value"),
            "use_type": _int_value(item, "use_type"),
            "crafting_material_type": _int_value(item, "crafting_material_type"),
            "crafting_material_amount": _int_value(item, "crafting_material_amount"),
            "crafting_difficulty": _int_value(item, "crafting_difficulty"),
            "crafting_requirement": _int_value(item, "crafting_requirement"),
            "emits_light": _int_value(item, "emits_light"),
            "animated": _int_value(item, "animated"),
            "animation_frame_count": _int_value(item, "animation_frame_count"),
            "animation_type": _int_value(item, "animation_type"),
        }
        _add_frames(fields, item.get("frames"))
        records.append(
            {
                "id": _int_value(item, "id"),
                "name": _display_name(item.get("name")),
                "fields": fields,
            }
        )
    return records
```

- [ ] **Step 4: Run mapper tests to verify they pass**

Run:

```powershell
python -m unittest tests.codex_pipeline.test_packed_json.PackedJsonMapperTests.test_maps_collectables_json_to_site_shape tests.codex_pipeline.test_packed_json.PackedJsonMapperTests.test_maps_useables_json_to_site_shape -v
```

Expected: `OK`.

- [ ] **Step 5: Commit mapper support**

Run:

```powershell
git add tests/codex_pipeline/test_packed_json.py tools/codex_pipeline/packed_json.py
git commit -m "Add packed collectables useables mapping"
```

---

### Task 2: Pipeline Target Wiring

**Files:**
- Modify: `tests/codex_pipeline/test_exports.py`
- Modify: `tests/codex_pipeline/test_sources.py`
- Modify: `tests/codex_pipeline/test_atlas_assets.py`
- Modify: `tests/codex_pipeline/test_deploy.py`
- Modify: `tools/codex_pipeline/config.py`
- Modify: `tools/codex_pipeline/exports.py`
- Modify: `tools/codex_pipeline/sources.py`
- Modify: `tools/codex_pipeline/assets.py`
- Modify: `tools/codex_pipeline/atlas_assets.py`
- Modify: `tools/codex_pipeline/freshness.py`
- Modify: `tools/codex_pipeline/deploy.py`

- [ ] **Step 1: Add failing target tests**

Update `test_resolve_targets_defaults_to_site_data_exports` in `tests/codex_pipeline/test_exports.py`:

```python
    def test_resolve_targets_defaults_to_site_data_exports(self):
        targets = resolve_targets()
        self.assertEqual(
            [target.name for target in targets],
            ["monsters", "weapons", "armors", "collectables", "useables"],
        )
```

Add this test to `ExportCommandTests`:

```python
    def test_export_client_data_uses_packed_vpack_without_legacy_extractor(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "data" / "collectables.dat"
            vpack = root / "data" / "ClientPack" / "rogue_data.vpack"
            site_path = root / "site" / "collectables.json"
            output_dir = root / "generated"
            vpack.parent.mkdir(parents=True)
            vpack.write_bytes(b"VPACK test pack")
            target = ExportTarget(
                name="collectables",
                extractor_script=root / "missing_extract_collectables.py",
                source_data=source,
                output_filename="collectables_data.json",
                site_path=site_path,
            )
            packed_files = {
                "collectables.json": {
                    "collectables": [
                        {
                            "id": 1,
                            "name": "Gold",
                            "value": 1,
                            "use_type": 0,
                            "frames": [],
                        }
                    ]
                }
            }

            with patch("tools.codex_pipeline.exports.read_packed_json_files", return_value=packed_files):
                results = export_client_data([target], output_dir=output_dir, python_executable=sys.executable)

            self.assertIn("mapped packed VPACK JSON source", results[0].stdout)
            exported = json.loads((output_dir / "collectables_data.json").read_text(encoding="utf-8"))
            self.assertEqual("Gold", exported[0]["name"])
            self.assertEqual(1, exported[0]["fields"]["value"])
```

Add this test to `tests/codex_pipeline/test_sources.py`:

```python
    def test_validate_export_sources_allows_packed_only_supported_target_without_extractor(self):
        from tools.codex_pipeline.exports import ExportTarget
        from tools.codex_pipeline.sources import validate_export_sources

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            site_path = root / "site" / "collectables_data.json"
            source_data = root / "data" / "collectables.dat"
            vpack = root / "data" / "ClientPack" / "rogue_data.vpack"
            site_path.parent.mkdir(parents=True)
            vpack.parent.mkdir(parents=True)
            vpack.write_bytes(b"VPACK test pack")
            target = ExportTarget(
                name="collectables",
                extractor_script=root / "missing.py",
                source_data=source_data,
                output_filename="collectables_data.json",
                site_path=site_path,
            )

            results = validate_export_sources([target])

        messages = "\n".join(result.message for result in results)
        self.assertNotIn("extractor not found", messages)
        self.assertIn("using packed JSON mapper", messages)
        self.assertTrue(all(result.ok for result in results))
```

Add this test to `tests/codex_pipeline/test_atlas_assets.py`:

```python
    def test_extract_atlas_assets_uses_itemgraph_for_collectables_and_useables(self):
        from tools.codex_pipeline.atlas_assets import has_atlas_source

        with tempfile.TemporaryDirectory() as tmp:
            gf_json_dir = Path(tmp)
            (gf_json_dir / "itemgraph.json").write_text('{"Data": ""}', encoding="utf-8")

            self.assertTrue(has_atlas_source("collectables", gf_json_dir=gf_json_dir))
            self.assertTrue(has_atlas_source("useables", gf_json_dir=gf_json_dir))
```

Add this test to `tests/codex_pipeline/test_deploy.py`:

```python
    def test_default_live_targets_include_collectables_and_useables(self):
        from tools.codex_pipeline.deploy import DEFAULT_LIVE_ASSET_TARGETS, DEFAULT_LIVE_DATA_TARGETS

        self.assertIn("collectables", [target.name for target in DEFAULT_LIVE_DATA_TARGETS])
        self.assertIn("useables", [target.name for target in DEFAULT_LIVE_DATA_TARGETS])
        self.assertIn("collectables", [target.name for target in DEFAULT_LIVE_ASSET_TARGETS])
        self.assertIn("useables", [target.name for target in DEFAULT_LIVE_ASSET_TARGETS])
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
python -m unittest tests.codex_pipeline.test_exports.ExportCommandTests.test_resolve_targets_defaults_to_site_data_exports tests.codex_pipeline.test_exports.ExportCommandTests.test_export_client_data_uses_packed_vpack_without_legacy_extractor tests.codex_pipeline.test_sources.SourceValidationTests.test_validate_export_sources_allows_packed_only_supported_target_without_extractor tests.codex_pipeline.test_atlas_assets.AtlasAssetTests.test_extract_atlas_assets_uses_itemgraph_for_collectables_and_useables tests.codex_pipeline.test_deploy.DeployTests.test_default_live_targets_include_collectables_and_useables -v
```

Expected: failures mention missing default targets, missing extractor, or atlas source not configured.

- [ ] **Step 3: Add config paths**

In `tools/codex_pipeline/config.py`, add:

```python
COLLECTABLES_DATA_PATH = REPO_ROOT / "pages" / "items" / "collectables_data.json"
USEABLES_DATA_PATH = REPO_ROOT / "pages" / "items" / "useables_data.json"

COLLECTABLE_IMAGES_DIR = REPO_ROOT / "images" / "collectables"
USEABLE_IMAGES_DIR = REPO_ROOT / "images" / "useables"
```

- [ ] **Step 4: Add export targets and packed-only fallback**

In `tools/codex_pipeline/exports.py`, import `COLLECTABLES_DATA_PATH` and `USEABLES_DATA_PATH`.

Add targets to `DEFAULT_EXPORT_TARGETS` after `armors`:

```python
    "collectables": ExportTarget(
        name="collectables",
        extractor_script=EXTRACTORS_DIR / "extract_collectables_data.py",
        source_data=CLIENT_DATA_DIR / "collectables.dat",
        output_filename="collectables_data.json",
        site_path=COLLECTABLES_DATA_PATH,
    ),
    "useables": ExportTarget(
        name="useables",
        extractor_script=EXTRACTORS_DIR / "extract_useables_data.py",
        source_data=CLIENT_DATA_DIR / "useables.dat",
        output_filename="useables_data.json",
        site_path=USEABLES_DATA_PATH,
    ),
```

In `export_client_data`, move the extractor existence check into the legacy branch. Replace the start of the loop with:

```python
        generated_path = target.generated_path(output_dir)
        _prepare_generated_path(generated_path)
        if not target.source_data.is_file():
            vpack_path = find_packed_vpack_source(target.source_data)
            if vpack_path is None:
                raise ExportError(f"{target.name} source data not found: {target.source_data}")
            if not is_packed_json_target_supported(target.name):
                raise ExportError(f"{target.name} does not support packed VPACK JSON export: {vpack_path}")

            try:
                packed_files = packed_file_cache.get(vpack_path)
                if packed_files is None:
                    packed_files = read_packed_json_files(vpack_path)
                    packed_file_cache[vpack_path] = packed_files
                site_records = (
                    _read_json_list(target.site_path, target, "site output")
                    if target.site_path.is_file()
                    else []
                )
                records = map_packed_json_target(target.name, packed_files, site_records=site_records)
            except VpackError as exc:
                raise ExportError(f"{target.name} packed VPACK JSON export failed: {exc}") from exc

            _write_json_list(generated_path, records)
            _validate_generated_json(generated_path, target)
            _normalize_generated_output_for_site(target, generated_path)
            _validate_generated_json(generated_path, target)
            results.append(
                ExportResult(
                    target=target,
                    generated_path=generated_path,
                    stdout=f"mapped packed VPACK JSON source: {vpack_path}",
                    stderr="",
                )
            )
            continue

        if not target.extractor_script.is_file():
            raise ExportError(f"{target.name} extractor not found: {target.extractor_script}")
```

Remove the duplicate original VPACK block that followed the old extractor check.

- [ ] **Step 5: Make source validation accept packed-only targets**

In `tools/codex_pipeline/sources.py`, add:

```python
def _requires_legacy_extractor(target: ExportTarget) -> bool:
    if target.source_data.is_file():
        return True
    return find_packed_vpack_source(target.source_data) is None or not is_packed_json_target_supported(target.name)
```

Replace the extractor and syntax checks in `validate_export_sources` with:

```python
        if _requires_legacy_extractor(target):
            results.append(_file_check(target.name, "extractor", target.extractor_script, "extractor not found"))
            results.append(_source_data_check(target))
            results.append(_site_destination_check(target))
            results.append(_syntax_check(target))
        else:
            results.append(_source_data_check(target))
            results.append(_site_destination_check(target))
```

- [ ] **Step 6: Add assets, atlas, manifest, and live targets**

In `tools/codex_pipeline/assets.py`, import `COLLECTABLE_IMAGES_DIR` and `USEABLE_IMAGES_DIR`, then extend `DEFAULT_ASSET_TARGETS`:

```python
    AssetTarget("collectables", COLLECTABLE_IMAGES_DIR, COLLECTABLE_IMAGES_DIR),
    AssetTarget("useables", USEABLE_IMAGES_DIR, USEABLE_IMAGES_DIR),
```

In `tools/codex_pipeline/atlas_assets.py`, extend `ATLAS_FILENAMES_BY_TARGET`:

```python
    "collectables": "itemgraph.json",
    "useables": "itemgraph.json",
```

In `tools/codex_pipeline/freshness.py`, import new paths and extend defaults:

```python
    ManifestDataTarget("collectables", COLLECTABLES_DATA_PATH, "pages/items/collectables_data.json"),
    ManifestDataTarget("useables", USEABLES_DATA_PATH, "pages/items/useables_data.json"),
```

```python
    ManifestAssetTarget(
        "collectables",
        COLLECTABLE_IMAGES_DIR,
        COLLECTABLE_IMAGES_DIR / "manifest.json",
        "images/collectables/manifest.json",
    ),
    ManifestAssetTarget(
        "useables",
        USEABLE_IMAGES_DIR,
        USEABLE_IMAGES_DIR / "manifest.json",
        "images/useables/manifest.json",
    ),
```

In `tools/codex_pipeline/deploy.py`, import new paths and extend live targets:

```python
    LiveDataTarget("collectables", COLLECTABLES_DATA_PATH, "pages/items/collectables_data.json"),
    LiveDataTarget("useables", USEABLES_DATA_PATH, "pages/items/useables_data.json"),
```

```python
    LiveAssetTarget(
        "collectables",
        COLLECTABLE_IMAGES_DIR,
        COLLECTABLE_IMAGES_DIR / "manifest.json",
        "images/collectables/manifest.json",
    ),
    LiveAssetTarget(
        "useables",
        USEABLE_IMAGES_DIR,
        USEABLE_IMAGES_DIR / "manifest.json",
        "images/useables/manifest.json",
    ),
```

- [ ] **Step 7: Run target tests**

Run:

```powershell
python -m unittest tests.codex_pipeline.test_exports tests.codex_pipeline.test_sources tests.codex_pipeline.test_atlas_assets tests.codex_pipeline.test_deploy -v
```

Expected: `OK`.

- [ ] **Step 8: Commit pipeline wiring**

Run:

```powershell
git add tests/codex_pipeline/test_exports.py tests/codex_pipeline/test_sources.py tests/codex_pipeline/test_atlas_assets.py tests/codex_pipeline/test_deploy.py tools/codex_pipeline/config.py tools/codex_pipeline/exports.py tools/codex_pipeline/sources.py tools/codex_pipeline/assets.py tools/codex_pipeline/atlas_assets.py tools/codex_pipeline/freshness.py tools/codex_pipeline/deploy.py
git commit -m "Wire collectables useables pipeline targets"
```

---

### Task 3: Generate Data And Icons

**Files:**
- Create: `pages/items/collectables_data.json`
- Create: `pages/items/useables_data.json`
- Create: `images/collectables/*`
- Create: `images/useables/*`
- Modify: `data/codex_manifest.json`

- [ ] **Step 1: Export packed data**

Run:

```powershell
$env:PROJECT_ROGUE_CLIENT_ROOT = "C:\Users\traec\Desktop\Project Rogue\Client"
python -m tools.codex_pipeline export-client-data --target collectables --target useables
```

Expected output includes:

```text
EXPORT OK collectables
EXPORT OK useables
```

- [ ] **Step 2: Sync generated data**

Run:

```powershell
python -m tools.codex_pipeline sync-generated --target collectables --target useables
```

Expected output includes:

```text
SYNC OK collectables
SYNC OK useables
```

- [ ] **Step 3: Extract atlas icons**

Run:

```powershell
python -m tools.codex_pipeline extract-atlas-assets --target collectables --target useables --asset-source atlas
```

Expected output includes:

```text
ATLAS EXTRACT collectables
ATLAS EXTRACT useables
```

- [ ] **Step 4: Sync atlas icons into site image folders**

Run:

```powershell
python -m tools.codex_pipeline sync-assets --target collectables --target useables --asset-source atlas
```

Expected output includes:

```text
ASSET SYNC collectables
ASSET SYNC useables
```

- [ ] **Step 5: Refresh the Codex manifest**

Run:

```powershell
python -m tools.codex_pipeline refresh-manifest
```

Expected output includes:

```text
MANIFEST OK data/codex_manifest.json
```

- [ ] **Step 6: Sanity-check generated counts**

Run:

```powershell
@'
import json
from pathlib import Path
for path in [Path("pages/items/collectables_data.json"), Path("pages/items/useables_data.json")]:
    data = json.loads(path.read_text(encoding="utf-8"))
    print(path.name, len(data))
'@ | python -
```

Expected:

```text
collectables_data.json 92
useables_data.json 22
```

- [ ] **Step 7: Commit generated data and icons**

Run:

```powershell
git add pages/items/collectables_data.json pages/items/useables_data.json images/collectables images/useables data/codex_manifest.json
git commit -m "Add collectables useables data assets"
```

---

### Task 4: Shared Catalog Pages

**Files:**
- Create: `pages/items/collectables.html`
- Create: `pages/items/useables.html`
- Create: `css/misc-items.css`
- Create: `js/misc-items-page.js`
- Modify: `tools/codex_pipeline/cli.py`
- Modify: `tests/codex_pipeline/test_site_validation.py`

- [ ] **Step 1: Add failing validation tests for page assets**

Add this test to `tests/codex_pipeline/test_site_validation.py`:

```python
    def test_misc_item_pages_are_registered_for_validation(self):
        from tools.codex_pipeline import cli
        from tools.codex_pipeline.config import REPO_ROOT

        self.assertIn(REPO_ROOT / "pages" / "items" / "collectables.html", cli.VALIDATED_HTML_PATHS)
        self.assertIn(REPO_ROOT / "pages" / "items" / "useables.html", cli.VALIDATED_HTML_PATHS)
        self.assertIn(REPO_ROOT / "css" / "misc-items.css", cli.VALIDATED_STYLE_PATHS)
        self.assertIn(REPO_ROOT / "js" / "misc-items-page.js", cli.VALIDATED_SCRIPT_PATHS)

    def test_misc_items_page_supports_id_deep_links_and_trait_filters(self):
        from tools.codex_pipeline.config import REPO_ROOT

        script = (REPO_ROOT / "js" / "misc-items-page.js").read_text(encoding="utf-8")

        self.assertIn("createRouteHelpers", script)
        self.assertIn("queryKey", script)
        self.assertIn("Emits Light", script)
        self.assertIn("Animated", script)
        self.assertIn("Crafting Data", script)
        self.assertIn("getItemSearchText(item).includes(searchTerm.toLowerCase())", script)
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
python -m unittest tests.codex_pipeline.test_site_validation.SiteValidationTests.test_misc_item_pages_are_registered_for_validation tests.codex_pipeline.test_site_validation.SiteValidationTests.test_misc_items_page_supports_id_deep_links_and_trait_filters -v
```

Expected: first test fails because paths are not registered; second fails because `js/misc-items-page.js` does not exist.

- [ ] **Step 3: Create HTML shells**

Create `pages/items/collectables.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Collectables - Project Rogue Codex</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base href="../../" />
    <link rel="icon" type="image/x-icon" href="images/project-rogue-favicon.ico" />
    <link rel="icon" type="image/png" sizes="32x32" href="images/project-rogue-favicon-32.png" />
    <link rel="icon" type="image/png" sizes="64x64" href="images/project-rogue-favicon-64.png" />
    <link rel="icon" type="image/png" sizes="180x180" href="images/project-rogue-favicon-180.png" />
    <link rel="icon" type="image/png" sizes="512x512" href="images/project-rogue-favicon-512.png" />
    <link rel="stylesheet" href="css/styles.css" />
    <link rel="stylesheet" href="css/misc-items.css" />
    <script src="js/utils.js"></script>
    <script src="js/items-page-utils.js"></script>
    <script src="js/site-search.js" defer></script>
    <script src="js/weapon-specialty.js" defer></script>
    <script src="js/stat-widgets.js" defer></script>
    <script src="js/keyword-links.js" defer></script>
    <script src="js/cursor-toggle.js" defer></script>
    <script src="js/perks.js" defer></script>
    <script src="js/rarity-roller.js" defer></script>
    <script src="js/nav-core.js" defer></script>
  </head>
  <body>
    <div
      class="layout misc-items-page"
      data-page-title="Collectables"
      data-data-file="collectables_data.json"
      data-image-folder="collectables"
      data-query-key="collectable"
      data-count-label="collectables"
      data-search-placeholder="Search collectables by any field..."
    >
      <div id="sidebar-root"></div>
      <main class="main-content">
        <header class="content-header">
          <h1 class="content-title">Collectables</h1>
        </header>
        <section class="item-details" id="item-details" aria-live="polite">
          <div class="item-details-header">
            <div class="item-title-group">
              <div class="details-image-group">
                <img id="details-image" class="item-thumb" alt="" />
                <div id="details-image-fallback" class="no-image-fallback">No Image</div>
              </div>
              <h2 id="details-name" class="content-title details-title"></h2>
            </div>
            <button type="button" class="details-button details-close" id="details-close">Close</button>
          </div>
          <div class="item-details-body">
            <div id="details-properties" class="item-details-grid"></div>
          </div>
        </section>
        <div class="content-section">
          <div class="item-controls">
            <input id="item-search" class="item-search" type="search" aria-label="Search collectables" />
            <p class="item-count" id="item-count"></p>
          </div>
          <div class="item-filters" aria-label="Filters">
            <div class="item-filter">
              <label class="filter-label" for="filter-use-type">Use Type</label>
              <select id="filter-use-type" class="filter-select" multiple aria-label="Filter by use type"></select>
            </div>
            <div class="item-filter">
              <label class="filter-label" for="filter-trait">Traits</label>
              <select id="filter-trait" class="filter-select" multiple aria-label="Filter by traits"></select>
            </div>
          </div>
          <div class="items-table-wrapper">
            <table class="items-table" aria-describedby="item-search">
              <thead><tr id="items-head-row"></tr></thead>
              <tbody id="items-body"></tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
    <script src="js/misc-items-page.js" defer></script>
  </body>
</html>
```

Create `pages/items/useables.html` with the same markup and these page-level values:

```html
      class="layout misc-items-page"
      data-page-title="Useables"
      data-data-file="useables_data.json"
      data-image-folder="useables"
      data-query-key="useable"
      data-count-label="useables"
      data-search-placeholder="Search useables by any field..."
```

Use `Useables - Project Rogue Codex` for the `<title>`, `Useables` for the `<h1>`, and `Search useables` for the search `aria-label`.

- [ ] **Step 4: Create shared CSS**

Create `css/misc-items.css` by copying the reusable item table/detail/filter rules from `css/armors.css`:

```css
.item-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1rem;
}

.item-search {
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  background: var(--bg-panel-dark);
  color: var(--text-main);
  width: min(420px, 100%);
}

.item-count {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-muted);
}

.item-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 0 0 0.5rem;
}

.item-filter {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 220px;
}

.filter-label {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin: 0;
}

.filter-select {
  background: var(--bg-panel-dark);
  color: var(--text-main);
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  padding: 0.35rem 0.45rem;
  min-height: 120px;
  max-height: 180px;
  overflow: auto;
}

.items-table-wrapper {
  overflow: visible;
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  background: var(--bg-panel);
  box-shadow: 0 0 0 1px #0b0f16, 0 8px 16px rgba(0, 0, 0, 0.55);
}

.items-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 640px;
}

.items-table thead {
  background: linear-gradient(to bottom, #303540, #252a33);
  position: sticky;
  top: 0;
  z-index: 3;
}

.items-table th,
.items-table td {
  padding: 0.55rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid #2f333b;
  font-size: 0.92rem;
}

.items-table th {
  background: linear-gradient(to bottom, #303540, #252a33);
  position: sticky;
  top: 0;
  z-index: 2;
  cursor: pointer;
  user-select: none;
  letter-spacing: 0.02em;
  color: #f9fafb;
  white-space: nowrap;
}

.items-table tbody tr {
  background: var(--bg-panel-dark);
}

.items-table tbody tr:nth-child(2n) {
  background: #1d222b;
}

.items-table tbody tr:hover {
  background: rgba(75, 255, 75, 0.08);
  cursor: pointer;
}

.item-link {
  color: inherit;
  font-weight: 700;
  text-decoration: none;
}

.item-link:hover,
.item-link:focus-visible {
  color: var(--accent);
  text-decoration: underline;
}

.item-thumb {
  width: 32px;
  height: 32px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--border-soft);
  background: #0f1218;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

.no-image,
.no-image-fallback {
  width: 32px;
  height: 32px;
  display: none;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  background: #0f1218;
  color: var(--text-muted);
  font-size: 0.82rem;
  text-align: center;
}

.item-details {
  display: none;
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  background: linear-gradient(135deg, #20252e, #141821);
  box-shadow: 0 0 0 1px #0b0f16, 0 12px 22px rgba(0, 0, 0, 0.65);
}

.item-details.show {
  display: block;
}

.item-details-header,
.item-title-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.item-details-header {
  justify-content: space-between;
  margin-bottom: 0.6rem;
}

.item-details .item-thumb,
.item-details .no-image-fallback {
  width: 64px;
  height: 64px;
}

.details-button,
.details-close {
  border: 1px solid var(--border-soft);
  background: linear-gradient(135deg, rgba(50, 60, 75, 0.9), rgba(20, 24, 32, 0.9));
  color: var(--text-main);
  padding: 0.45rem 0.9rem;
  border-radius: 6px;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1.2;
  min-height: 2.35rem;
}

.item-details-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem 1rem;
}

.detail-cell {
  padding: 0.3rem 0;
}

.detail-label {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin: 0 0 0.1rem;
  display: block;
}

.detail-value {
  font-weight: 700;
  color: #fff;
}

.detail-divider {
  grid-column: 1 / -1;
  height: 1px;
  margin: 0.35rem 0 0.25rem;
  background: var(--border-soft);
  opacity: 0.6;
}

.detail-badge-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.detail-pill,
.table-trait-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: linear-gradient(135deg, rgba(44, 50, 64, 0.9), rgba(28, 33, 43, 0.9));
  color: #e8ecf2;
  font-weight: 700;
  letter-spacing: 0.03em;
  font-size: 0.78rem;
  text-transform: uppercase;
}

.detail-pill.emits-light,
.table-trait-pill.emits-light {
  border-color: rgba(255, 210, 105, 0.42);
  color: #ffe2a1;
}

.detail-pill.is-craftable,
.table-trait-pill.is-craftable {
  border-color: rgba(75, 255, 75, 0.35);
}

.table-empty {
  text-align: center;
  padding: 1rem;
  color: var(--text-muted);
}

@media (max-width: 640px) {
  .item-details-grid {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }
}
```

- [ ] **Step 5: Create shared page script**

Create `js/misc-items-page.js`:

```javascript
(() => {
  const root = document.querySelector(".misc-items-page");
  if (!root) return;

  const itemUtils = window.RogueCodexItemPageUtils || {};
  const utils = window.RogueCodexUtils || {};
  const fetchJsonCached =
    utils.fetchJsonCached ||
    ((targetUrl) =>
      fetch(targetUrl)
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null));
  const normalizeFilterValue =
    utils.normalizeFilterValue || ((value) => (value || "").toString().trim().toLowerCase());
  const normalizeItemId = itemUtils.normalizeItemId || ((value) => String(value || "").trim().toLowerCase());
  const formatNumber = itemUtils.formatNumber || ((value) => (value === null || value === undefined ? "-" : String(value)));
  const formatValue = itemUtils.formatValue || ((value) => (value === null || value === undefined || value === "" ? "-" : String(value)));

  const page = {
    title: root.dataset.pageTitle || "Items",
    dataFile: root.dataset.dataFile || "",
    imageFolder: root.dataset.imageFolder || "items",
    queryKey: root.dataset.queryKey || "item",
    countLabel: root.dataset.countLabel || "items",
    searchPlaceholder: root.dataset.searchPlaceholder || "Search items by any field...",
  };

  const dataUrl = new URL(page.dataFile, window.location.href);
  const searchInput = document.getElementById("item-search");
  const useTypeFilter = document.getElementById("filter-use-type");
  const traitFilter = document.getElementById("filter-trait");
  const tableHeadRow = document.getElementById("items-head-row");
  const tableBody = document.getElementById("items-body");
  const countLabel = document.getElementById("item-count");
  const details = document.getElementById("item-details");
  const closeBtn = document.getElementById("details-close");
  const detailFields = {
    name: document.getElementById("details-name"),
    image: document.getElementById("details-image"),
    imageFallback: document.getElementById("details-image-fallback"),
    properties: document.getElementById("details-properties"),
  };

  const CRAFTING_FIELD_NAMES = [
    "crafting_requirement",
    "crafting_material_type",
    "crafting_material_amount",
    "crafting_difficulty",
  ];

  const USE_TYPE_LABELS = {
    0: "Other",
    10: "Mining",
    11: "Ore",
    12: "Material",
    13: "Woodcutting",
    14: "Milling",
    15: "Carpentry",
    16: "Fishing",
    17: "Raw Food",
    50: "Healing",
    51: "Cure",
    52: "Greater Cure",
    53: "Berserk",
  };

  const TRAIT_FILTERS = [
    { key: "emits-light", label: "Emits Light", predicate: (item) => item.emitsLight },
    { key: "animated", label: "Animated", predicate: (item) => item.animated },
    { key: "crafting-data", label: "Crafting Data", predicate: (item) => item.hasCraftingData },
  ];

  const COLUMNS = [
    { key: "image", label: "Image", sortable: false },
    { key: "name", label: "Name" },
    { key: "useTypeLabel", label: "Use Type" },
    { key: "value", label: "Value", format: (value) => formatNumber(value) },
    { key: "traits", label: "Traits", sortable: false },
  ];

  let items = [];
  let sortKey = "name";
  let sortDir = "asc";
  let searchTerm = "";
  let selectedUseTypes = new Set();
  let selectedTraits = new Set();

  const imageLoader = itemUtils.createImageLoader
    ? itemUtils.createImageLoader(page.imageFolder)
    : { ensureImage: () => {} };

  const route = itemUtils.createRouteHelpers({
    fallbackPath: `pages/items/${page.imageFolder}.html`,
    getItemId: (item) => String(item.id),
    getItemName: (item) => item.name,
    queryKeys: [page.queryKey, "item"],
    stateKey: page.queryKey,
    normalizeId: normalizeItemId,
  });

  const getUseTypeLabel = (value) => {
    const numeric = Number(value);
    return Object.prototype.hasOwnProperty.call(USE_TYPE_LABELS, numeric)
      ? USE_TYPE_LABELS[numeric]
      : `Type ${formatValue(value)}`;
  };

  const hasCraftingData = (fields) =>
    CRAFTING_FIELD_NAMES.some((fieldName) => Number(fields[fieldName] || 0) !== 0);

  const normalizeItem = (record) => {
    const fields = record && typeof record.fields === "object" ? record.fields : {};
    const useType = fields.use_type;
    const item = {
      id: record.id,
      name: record.name || `Item ${record.id}`,
      fields,
      value: Number(fields.value || 0),
      useType,
      useTypeLabel: getUseTypeLabel(useType),
      emitsLight: Number(fields.emits_light) === 1,
      animated: Number(fields.animated) === 1,
      animationFrameCount: Number(fields.animation_frame_count || 0),
      animationType: Number(fields.animation_type || 0),
      hasCraftingData: hasCraftingData(fields),
    };
    item.searchText = getItemSearchText(item);
    return item;
  };

  const getTraitLabels = (item) => {
    const labels = [];
    if (item.emitsLight) labels.push("Emits Light");
    if (item.animated) labels.push("Animated");
    if (item.hasCraftingData) labels.push("Crafting Data");
    return labels;
  };

  const getItemSearchText = (item) =>
    [
      item.id,
      item.name,
      item.value,
      item.useType,
      item.useTypeLabel,
      ...getTraitLabels(item),
      item.fields.crafting_requirement,
      item.fields.crafting_material_type,
      item.fields.crafting_material_amount,
      item.fields.crafting_difficulty,
    ]
      .filter((value) => value !== null && value !== undefined && value !== "")
      .join(" ")
      .toLowerCase();

  const createTraitPill = (label) => {
    const span = document.createElement("span");
    span.className = "table-trait-pill";
    if (label === "Emits Light") span.classList.add("emits-light");
    if (label === "Crafting Data") span.classList.add("is-craftable");
    span.textContent = label;
    return span;
  };

  const renderTraitList = (item) => {
    const labels = getTraitLabels(item);
    if (!labels.length) return "-";
    const wrapper = document.createElement("div");
    wrapper.className = "detail-badge-list";
    labels.forEach((label) => wrapper.appendChild(createTraitPill(label)));
    return wrapper;
  };

  const createCell = (label, value) => itemUtils.createCell(label, value);
  const addDivider = (container) => itemUtils.addDivider(container);
  const addRow = (container, entries, cols) => itemUtils.addRow(container, entries, cols);

  const renderDetails = (item, replaceHistory = false) => {
    if (!item) return;
    details.classList.add("show");
    detailFields.name.textContent = item.name;
    imageLoader.ensureImage(detailFields.image, detailFields.imageFallback, item, page.imageFolder);
    detailFields.properties.innerHTML = "";
    addRow(
      detailFields.properties,
      [
        ["ID", formatValue(item.id)],
        ["Value", formatNumber(item.value)],
        ["Use Type", `${item.useTypeLabel} (${formatValue(item.useType)})`],
        ["Animation Frames", formatNumber(item.animationFrameCount)],
      ],
      4
    );
    addDivider(detailFields.properties);
    addRow(
      detailFields.properties,
      [
        ["Crafting Requirement", formatNumber(item.fields.crafting_requirement || 0)],
        ["Crafting Material Type", formatNumber(item.fields.crafting_material_type || 0)],
        ["Crafting Material Amount", formatNumber(item.fields.crafting_material_amount || 0)],
        ["Crafting Difficulty", formatNumber(item.fields.crafting_difficulty || 0)],
      ],
      4
    );
    addDivider(detailFields.properties);
    detailFields.properties.appendChild(createCell("Traits", renderTraitList(item)));
    route.updateDetailUrl(item, { replace: replaceHistory });
  };

  const renderEmpty = (message) => {
    tableBody.innerHTML = "";
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.className = "table-empty";
    cell.colSpan = COLUMNS.length;
    cell.textContent = message;
    row.appendChild(cell);
    tableBody.appendChild(row);
  };

  const renderHead = () => {
    tableHeadRow.innerHTML = "";
    COLUMNS.forEach((column) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = column.label;
      if (column.sortable !== false) {
        th.dataset.sortKey = column.key;
        const indicator = document.createElement("span");
        indicator.className = "sort-indicator";
        indicator.textContent = sortKey === column.key ? (sortDir === "asc" ? "↑" : "↓") : "↕";
        th.appendChild(indicator);
        th.addEventListener("click", () => {
          if (sortKey === column.key) {
            sortDir = sortDir === "asc" ? "desc" : "asc";
          } else {
            sortKey = column.key;
            sortDir = "asc";
          }
          render();
        });
      }
      tableHeadRow.appendChild(th);
    });
  };

  const passesFilters = (item) => {
    if (searchTerm && !getItemSearchText(item).includes(searchTerm.toLowerCase())) return false;
    if (selectedUseTypes.size && !selectedUseTypes.has(String(item.useType))) return false;
    if (selectedTraits.size) {
      const selected = Array.from(selectedTraits);
      if (!selected.every((traitKey) => TRAIT_FILTERS.find((trait) => trait.key === traitKey)?.predicate(item))) {
        return false;
      }
    }
    return true;
  };

  const sortItems = (list) => {
    const direction = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = itemUtils.normalizeSortValue ? itemUtils.normalizeSortValue(a[sortKey]) : a[sortKey];
      const bv = itemUtils.normalizeSortValue ? itemUtils.normalizeSortValue(b[sortKey]) : b[sortKey];
      if (av < bv) return -1 * direction;
      if (av > bv) return 1 * direction;
      return a.name.localeCompare(b.name);
    });
  };

  const renderRows = (visible) => {
    tableBody.innerHTML = "";
    visible.forEach((item) => {
      const row = document.createElement("tr");
      row.dataset.id = String(item.id);
      row.addEventListener("click", () => renderDetails(item));
      COLUMNS.forEach((column) => {
        const td = document.createElement("td");
        if (column.key === "image") {
          const img = document.createElement("img");
          const fallback = document.createElement("span");
          img.className = "item-thumb";
          img.alt = "";
          fallback.className = "no-image";
          fallback.textContent = "No Image";
          td.appendChild(img);
          td.appendChild(fallback);
          imageLoader.ensureImage(img, fallback, item, page.imageFolder);
        } else if (column.key === "name") {
          const link = document.createElement("a");
          link.href = route.buildDetailStateUrl(item);
          link.className = "item-link";
          link.textContent = item.name;
          link.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            renderDetails(item);
          });
          td.appendChild(link);
        } else if (column.key === "traits") {
          const rendered = renderTraitList(item);
          if (rendered instanceof Node) td.appendChild(rendered);
          else td.textContent = rendered;
        } else {
          td.textContent = column.format ? column.format(item[column.key]) : formatValue(item[column.key]);
        }
        row.appendChild(td);
      });
      tableBody.appendChild(row);
    });
  };

  const render = () => {
    renderHead();
    const visible = sortItems(items.filter(passesFilters));
    countLabel.textContent = `Showing ${visible.length.toLocaleString("en-US")} of ${items.length.toLocaleString("en-US")} ${page.countLabel}`;
    if (!visible.length) {
      renderEmpty(`No ${page.countLabel} match your filters.`);
      return;
    }
    renderRows(visible);
  };

  const populateFilters = () => {
    const useTypes = Array.from(new Set(items.map((item) => String(item.useType)))).sort((a, b) => Number(a) - Number(b));
    itemUtils.setOptions(
      useTypeFilter,
      useTypes.map((value) => ({ value, label: `${getUseTypeLabel(value)} (${value})` }))
    );
    itemUtils.setOptions(traitFilter, TRAIT_FILTERS.map((trait) => ({ value: trait.key, label: trait.label })));
  };

  const closeDetails = () => {
    details.classList.remove("show");
    route.updateListUrl();
  };

  searchInput.placeholder = page.searchPlaceholder;
  searchInput.addEventListener("input", () => {
    searchTerm = searchInput.value.trim();
    render();
  });
  useTypeFilter.addEventListener("change", () => {
    selectedUseTypes = new Set(Array.from(useTypeFilter.selectedOptions).map((option) => option.value));
    render();
  });
  traitFilter.addEventListener("change", () => {
    selectedTraits = new Set(Array.from(traitFilter.selectedOptions).map((option) => option.value));
    render();
  });
  itemUtils.enableToggleSelect(useTypeFilter);
  itemUtils.enableToggleSelect(traitFilter);
  closeBtn.addEventListener("click", closeDetails);
  window.addEventListener("popstate", () => {
    const selected = route.getSelectedFromLocation(items);
    if (selected) renderDetails(selected, true);
    else details.classList.remove("show");
  });

  fetchJsonCached(dataUrl.toString())
    .then((data) => {
      items = Array.isArray(data) ? data.map(normalizeItem) : [];
      populateFilters();
      render();
      const selected = route.getSelectedFromLocation(items);
      if (selected) renderDetails(selected, true);
    })
    .catch(() => {
      items = [];
      renderEmpty(`Unable to load ${page.countLabel}.`);
    });
})();
```

- [ ] **Step 6: Register files for validation**

In `tools/codex_pipeline/cli.py`, add to `VALIDATED_HTML_PATHS`:

```python
    REPO_ROOT / "pages" / "items" / "collectables.html",
    REPO_ROOT / "pages" / "items" / "useables.html",
```

Add to `VALIDATED_STYLE_PATHS`:

```python
    REPO_ROOT / "css" / "misc-items.css",
```

Add to `VALIDATED_SCRIPT_PATHS`:

```python
    REPO_ROOT / "js" / "misc-items-page.js",
```

- [ ] **Step 7: Run page validation tests**

Run:

```powershell
python -m unittest tests.codex_pipeline.test_site_validation.SiteValidationTests.test_misc_item_pages_are_registered_for_validation tests.codex_pipeline.test_site_validation.SiteValidationTests.test_misc_items_page_supports_id_deep_links_and_trait_filters -v
```

Expected: `OK`.

- [ ] **Step 8: Commit shared pages**

Run:

```powershell
git add pages/items/collectables.html pages/items/useables.html css/misc-items.css js/misc-items-page.js tools/codex_pipeline/cli.py tests/codex_pipeline/test_site_validation.py
git commit -m "Add collectables useables catalog pages"
```

---

### Task 5: Navigation, Search, And Smoke Coverage

**Files:**
- Modify: `nav.html`
- Modify: `js/site-search.js`
- Modify: `tools/codex_pipeline/site_smoke.mjs`
- Modify: `tests/codex_pipeline/test_site_validation.py`
- Modify: `tests/codex_pipeline/test_site_smoke.py`

- [ ] **Step 1: Add failing nav/search tests**

Add this test to `tests/codex_pipeline/test_site_validation.py`:

```python
    def test_nav_and_site_search_include_collectables_and_useables(self):
        from tools.codex_pipeline.config import REPO_ROOT

        nav = (REPO_ROOT / "nav.html").read_text(encoding="utf-8")
        search = (REPO_ROOT / "js" / "site-search.js").read_text(encoding="utf-8")

        self.assertIn('href="pages/items/collectables.html">Collectables</a>', nav)
        self.assertIn('href="pages/items/useables.html">Useables</a>', nav)
        self.assertIn('title: "Collectables"', search)
        self.assertIn('title: "Useables"', search)
        self.assertIn("loadMiscItemSearchIndex", search)
        self.assertIn("pages/items/collectables.html?collectable=", search)
        self.assertIn("pages/items/useables.html?useable=", search)
```

Add this test to `tests/codex_pipeline/test_site_smoke.py`:

```python
    def test_smoke_specs_include_collectables_and_useables(self):
        from tools.codex_pipeline.config import REPO_ROOT

        runner = (REPO_ROOT / "tools" / "codex_pipeline" / "site_smoke.mjs").read_text(encoding="utf-8")

        self.assertIn('label: "collectables"', runner)
        self.assertIn('label: "useables"', runner)
        self.assertIn('/pages/items/collectables.html', runner)
        self.assertIn('/pages/items/useables.html', runner)
        self.assertIn('queryKey: "collectable"', runner)
        self.assertIn('queryKey: "useable"', runner)
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
python -m unittest tests.codex_pipeline.test_site_validation.SiteValidationTests.test_nav_and_site_search_include_collectables_and_useables tests.codex_pipeline.test_site_smoke.SiteSmokeTests.test_smoke_specs_include_collectables_and_useables -v
```

Expected: failures mention missing nav links, search entries, or smoke specs.

- [ ] **Step 3: Add navigation links**

In `nav.html`, add after the Monsters `<li>`:

```html
        <li class="nav-link-item">
          <a class="nav-link" href="pages/items/collectables.html">Collectables</a>
        </li>
        <li class="nav-link-item">
          <a class="nav-link" href="pages/items/useables.html">Useables</a>
        </li>
```

- [ ] **Step 4: Add base search entries**

In `js/site-search.js`, add entries after Monsters:

```javascript
  {
    title: "Collectables",
    url: "pages/items/collectables.html",
    category: "Items",
    description: "Collectable items, materials, consumables, values, and traits.",
    keywords: ["collectables", "collectibles", "materials", "potions", "ores", "shards"],
  },
  {
    title: "Useables",
    url: "pages/items/useables.html",
    category: "Items",
    description: "Useable tools, scrolls, shards, and utility items.",
    keywords: ["useables", "usables", "tools", "scrolls", "pickaxe", "fishing"],
  },
```

- [ ] **Step 5: Add item-level search loading**

In `js/site-search.js`, add shared helpers near `buildArmorSearchEntry`:

```javascript
function buildMiscItemSearchEntry(item, config) {
  if (!item || typeof item !== "object") return null;
  const fields = item.fields && typeof item.fields === "object" ? item.fields : {};
  const id = item.id;
  const name = String(item.name || "").trim();
  if (!name) return null;
  const parts = [];
  if (fields.value !== undefined) parts.push(`Value ${fields.value}`);
  if (fields.use_type !== undefined) parts.push(`Use ${fields.use_type}`);
  if (Number(fields.emits_light) === 1) parts.push("Emits Light");
  if (Number(fields.animated) === 1) parts.push("Animated");
  const routeKey = id !== null && id !== undefined ? id : name;
  const keywords = [
    name,
    id,
    fields.use_type,
    fields.value,
    fields.crafting_material_type,
    fields.crafting_material_amount,
    Number(fields.emits_light) === 1 ? "emits light" : "",
    Number(fields.animated) === 1 ? "animated" : "",
  ].filter(Boolean);

  return normalizeSearchEntry({
    title: name,
    url: `${config.url}?${config.queryKey}=${encodeURIComponent(routeKey)}`,
    category: config.category,
    description: parts.join(" | ") || config.description,
    keywords,
  });
}

function loadMiscItemSearchIndex(config) {
  if (config.promise) return config.promise;
  const absoluteUrl = getAbsoluteUrl(config.dataFile);
  config.promise = fetchJsonMaybeCached(absoluteUrl, `Failed to fetch ${config.dataFile}`)
    .then((data) => {
      const list = Array.isArray(data) ? data : [];
      config.index = list.map((item) => buildMiscItemSearchEntry(item, config)).filter(Boolean);
      return config.index;
    })
    .catch(() => {
      config.index = [];
      return config.index;
    });
  return config.promise;
}
```

Add module-level config objects:

```javascript
const COLLECTABLE_SEARCH_CONFIG = {
  dataFile: "pages/items/collectables_data.json",
  url: "pages/items/collectables.html",
  queryKey: "collectable",
  category: "Collectables",
  description: "Collectable item value, use type, and traits.",
  index: [],
  promise: null,
};

const USEABLE_SEARCH_CONFIG = {
  dataFile: "pages/items/useables_data.json",
  url: "pages/items/useables.html",
  queryKey: "useable",
  category: "Useables",
  description: "Useable tool, scroll, or utility item.",
  index: [],
  promise: null,
};
```

Where the dynamic indexes are gathered for nav search results, include:

```javascript
    loadMiscItemSearchIndex(COLLECTABLE_SEARCH_CONFIG),
    loadMiscItemSearchIndex(USEABLE_SEARCH_CONFIG),
```

Use the existing pattern around `loadMonsterSearchIndex`, `loadWeaponSearchIndex`, and `loadArmorSearchIndex` to merge these returned arrays into the result list.

- [ ] **Step 6: Add smoke specs**

In `tools/codex_pipeline/site_smoke.mjs`, append to `smokeSpecs`:

```javascript
  {
    detailName: "Soul of Flame",
    detailQuery: "24",
    label: "collectables",
    listPath: "/pages/items/collectables.html",
    detailSelector: "#item-details",
    rowSelector: "#items-body tr[data-id]",
    detailLinkSelector: "",
    queryKey: "collectable",
  },
  {
    detailName: "Carpentry Saw",
    detailQuery: "10",
    label: "useables",
    listPath: "/pages/items/useables.html",
    detailSelector: "#item-details",
    rowSelector: "#items-body tr[data-id]",
    detailLinkSelector: "",
    queryKey: "useable",
  },
```

If `runSpec` always expects `detailLinkSelector`, change its detail-link assertion block to:

```javascript
  if (spec.detailLinkSelector) {
    const detailLinkCount = await page.locator(spec.detailLinkSelector).count();
    if (detailLinkCount < 1) {
      throw new Error(`${spec.label} expected at least one detail link matching ${spec.detailLinkSelector}`);
    }
  }
```

- [ ] **Step 7: Run nav/search/smoke tests**

Run:

```powershell
python -m unittest tests.codex_pipeline.test_site_validation.SiteValidationTests.test_nav_and_site_search_include_collectables_and_useables tests.codex_pipeline.test_site_smoke.SiteSmokeTests.test_smoke_specs_include_collectables_and_useables -v
```

Expected: `OK`.

- [ ] **Step 8: Commit nav/search/smoke wiring**

Run:

```powershell
git add nav.html js/site-search.js tools/codex_pipeline/site_smoke.mjs tests/codex_pipeline/test_site_validation.py tests/codex_pipeline/test_site_smoke.py
git commit -m "Add collectables useables navigation search smoke"
```

---

### Task 6: Final Verification

**Files:**
- All files changed by Tasks 1-5.

- [ ] **Step 1: Run unit tests**

Run:

```powershell
python -m unittest discover -s tests -v
```

Expected: `OK`.

- [ ] **Step 2: Run site validation**

Run:

```powershell
python -m tools.codex_pipeline validate
```

Expected output ends with validation success and no `ERROR` lines.

- [ ] **Step 3: Run local smoke test**

Run:

```powershell
python -m tools.codex_pipeline smoke-site
```

Expected output includes:

```text
SMOKE OK collectables
SMOKE OK useables
SMOKE OK site
```

- [ ] **Step 4: Run whitespace check**

Run:

```powershell
git diff --check
```

Expected: no output.

- [ ] **Step 5: Review changed files**

Run:

```powershell
git status --short
git diff --stat
```

Expected: only collectables/useables pipeline, page, data, image, nav/search, smoke, manifest, and test files are modified or added.

- [ ] **Step 6: Resolve verification failures in the owning task**

If Steps 1-4 expose a failure, stop final verification, return to the task that introduced the failing file, make the fix in that task's files, rerun that task's focused tests, and rerun this final verification task from Step 1.

If Steps 1-4 pass without further edits, do not create another commit.

---

## Self-Review

Spec coverage:

- First-class pages are covered by Task 4.
- Export targets and packed mapping are covered by Tasks 1 and 2.
- Atlas images and manifests are covered by Tasks 2 and 3.
- Existing page styling is covered by Task 4 using the item table/detail CSS pattern.
- ID deep links are covered by Task 4 route helpers and Task 5 smoke specs.
- Nav and search are covered by Task 5.
- Validation and smoke coverage are covered by Tasks 4, 5, and 6.

No unresolved template markers are present in this plan. Function names and route keys are consistent across tasks: `collectables`, `useables`, `collectable`, and `useable`.
