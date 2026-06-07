# Codex Data Pipeline Design

Date: 2026-06-07

Note: this is the original planning spec. The current operational reference is
`docs/codex-pipeline-architecture.md`.

## Context

The Project Rogue Codex is a static site in `C:\Users\traec\Desktop\Python\projects\project-rogue-codex`.
The canonical game client data lives in `C:\Users\traec\Desktop\Client`, especially `data\*.dat`, generated JSON exports, and `gf_json` image metadata.
Older extraction and analysis scripts live in `C:\Users\traec\Desktop\Python\projects\project-rogue`, mixed with unrelated toolkit, automation, runtime, archive, and build files.

This phase focuses only on Codex data and export work. Toolkit automation, route running, overlays, memory tools, packaging, and runtime logs are out of scope.

## Goals

- Create a repeatable Codex-only data pipeline for weapons, armors, monsters, and their images.
- Keep the published site outputs stable unless a data correction is intentional.
- Move Codex-specific corrections, especially drop-source overrides, out of duplicated HTML maps and into a single data file.
- Validate generated outputs before they are synced into the site.
- Make future Codex updates simple enough to run with a small set of commands.

## Non-Goals

- Rebuild the static site into a framework.
- Refactor the Project Rogue toolkit or automation scripts.
- Solve every Codex data type in phase one, such as races, perks, XP, skills, maps, or calculators.
- Delete old scripts or archives before the replacement pipeline proves it can reproduce the needed Codex outputs.

## Proposed Location

The new pipeline should live inside the Codex repo:

```text
tools/codex_pipeline/
```

This keeps the pipeline close to the site data it produces and avoids coupling the Codex update flow to unrelated toolkit code. The pipeline may read from the old script repo and client folder, but it should not require toolkit modules.

## Initial Structure

```text
tools/codex_pipeline/
  __init__.py
  __main__.py
  cli.py
  config.py
  extractors/
    __init__.py
    armors.py
    monsters.py
    weapons.py
  overrides/
    __init__.py
    drops.py
  sync.py
  validators/
    __init__.py
    data.py
    drops.py
    images.py
```

Site-owned override data should live in:

```text
data/codex-overrides/drop_sources.json
```

Generated or synced Codex outputs should continue to land in the existing site paths:

```text
pages/items/weapons_data05.json
pages/items/armors_data06.json
pages/enemies/monsters_data03.json
images/weapons/
images/armors/
images/monsters/
```

## Data Flow

1. Read source data from the client folder.
2. Run weapon, armor, and monster extraction into normalized intermediate records.
3. Apply Codex overrides.
4. Validate the final records, image references, manifests, and drop mappings.
5. Sync the final JSON and image outputs into the static site.
6. Run the existing site checks before a commit or push.

The first implementation can wrap existing extraction logic where that is safer than rewriting. The important boundary is that the new pipeline exposes one clear Codex command surface and one clear output contract.

## Drop Sources

Drop-source overrides are currently duplicated in page scripts:

- `pages/items/armors.html` contains item-to-monster special armor drops.
- `pages/enemies/monsters.html` contains monster-to-armor special drops.

Phase one should replace that duplicated source of truth with `data/codex-overrides/drop_sources.json`.

The override format should be item-centric because Codex users usually report issues as "this item drops from these monsters":

```json
{
  "schemaVersion": 1,
  "armors": {
    "Iceburst Amulet": ["Ice Devil", "Greater Yeti"]
  },
  "weapons": {
    "Rune Sword": ["Rune Warrior", "Balron", "Demon Lord"]
  }
}
```

The pipeline and site code can derive the reverse monster-to-items view from this one file. Validators must check both directions so item pages and monster pages cannot drift apart again.

## Commands

The command surface should be small:

```powershell
python -m tools.codex_pipeline validate
python -m tools.codex_pipeline doctor
python -m tools.codex_pipeline game-update-report
python -m tools.codex_pipeline drop-report
python -m tools.codex_pipeline export-client-data
python -m tools.codex_pipeline unknown-fields
python -m tools.codex_pipeline diff-generated
python -m tools.codex_pipeline sync-generated
python -m tools.codex_pipeline verify-live
```

Command behavior:

- `validate`: read current site outputs and overrides, then report data, image, manifest, and drop-source issues.
- `doctor`: check extractor scripts, source `.dat` files, destination folders, and extractor syntax before export.
- `game-update-report`: run a review-only export and summarize generated-vs-site JSON changes plus client-vs-site image asset changes after a game update.
- `drop-report`: audit drop-source overrides and the derived monster loot view.
- `export-client-data`: produce weapon, armor, and monster JSON from source data into an intermediate output folder.
- `unknown-fields`: inventory `unknown_*` fields in site or generated data for mapping research.
- `diff-generated`: compare generated output against the current site JSON before copying files.
- `sync-generated`: copy reviewed generated outputs into the existing site paths.
- `verify-live`: confirm deployed GitHub Pages JSON matches local site JSON after push and deployment.

## Validation Rules

Phase-one validation should cover:

- JSON files parse.
- Required fields exist for weapons, armors, and monsters.
- Item and monster names are non-empty.
- Duplicate names are reported with IDs so they can be classified as intentional or accidental.
- Every listed image exists.
- Image manifests do not include themselves.
- Drop-source override item names exist in Codex data.
- Drop-source override monster names exist in Codex data.
- Item-to-monster and monster-to-item views derived from overrides are symmetric.
- Existing inline page scripts touched by this work parse successfully.

## Site Integration

The site should continue to work as a static site. No build step should be required for normal browsing.

For drop overrides, the preferred site integration is:

1. Pages fetch `data/codex-overrides/drop_sources.json`.
2. Shared helper code normalizes item and monster names.
3. Item pages derive "Drops From" from the override file plus level-based rules.
4. Monster pages derive special loot entries from the same override file plus level-based rules.

This keeps manual data corrections editable as plain JSON and avoids duplicated JavaScript maps.

## Testing

Initial tests should be script-level tests rather than a full browser test suite:

- A regression test for Iceburst Amulet dropping from Ice Devil and Greater Yeti.
- A symmetry test for item-to-monster and monster-to-item derived mappings.
- A validation test that catches nonexistent item and monster names in override data.
- An image-manifest test that catches missing files and self-references.
- A smoke test that parses touched inline page scripts.

Browser checks can be added after the data pipeline is stable.

## Rollout Plan

1. Add the pipeline package, override file, and validators without changing generated site data.
2. Add the Iceburst Amulet override to the single override file.
3. Update armor and monster pages to use the override file instead of duplicated inline maps.
4. Run validation against the current site data.
5. Add extraction/sync commands that reproduce current weapons, armors, and monsters outputs.
6. Only after validation is stable, use the pipeline for future data refreshes.

## Risks

- Existing extraction scripts may contain undocumented assumptions. Wrapping them first is safer than rewriting them in one pass.
- Some duplicate names may be intentional game data. Validators should report duplicates but not fail until intentional duplicates are classified.
- Static fetch behavior depends on serving the site over HTTP. The README should eventually document that local file browsing is not enough for data-backed pages.
- Large image and JSON outputs can make diffs noisy. Sync commands should report exactly which outputs changed.

## Success Criteria

Phase one is successful when:

- A Codex-only pipeline command can validate current items, monsters, images, manifests, and drop overrides.
- Iceburst Amulet is represented in a single drop override file and appears correctly from both armor and monster page logic.
- The old duplicated special-drop maps are removed or no longer used as sources of truth.
- The pipeline can sync validated item and monster data into the existing site paths.
- The site remains static and deployable through the current GitHub Pages workflow.
