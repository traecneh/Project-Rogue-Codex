# Codex Data Pipeline Architecture

This document describes the current Project Rogue Codex data pipeline. It is the
reference to use before changing extractors, overrides, generated data, or live
deployment checks.

## Source Of Truth

The static site data lives in this repository:

- `pages/items/weapons_data05.json`
- `pages/items/armors_data06.json`
- `pages/enemies/monsters_data03.json`
- `data/codex-overrides/drop_sources.json`
- `data/codex-overrides/perk_labels.json`

The game client source data is external and configured in
`tools/codex_pipeline/config.py`:

- `C:\Users\traec\Desktop\Client\data\data03.dat` for monsters
- `C:\Users\traec\Desktop\Client\data\data05.dat` for weapons
- `C:\Users\traec\Desktop\Client\data\data06.dat` for armors

Set `PROJECT_ROGUE_CLIENT_ROOT` to point the pipeline at a different local
client install for source checks, exports, and asset inventory. For example:

```powershell
$env:PROJECT_ROGUE_CLIENT_ROOT = "C:\Users\traec\Desktop\Project Rogue\Client"
python -m tools.codex_pipeline doctor
python -m tools.codex_pipeline source-inventory
python -m tools.codex_pipeline vpack-info
```

The July 2026 client package moved the direct `.dat` files into
`Data\ClientPack\rogue_data.vpack`. The pipeline detects that packed source and
blocks export with a clear message until VPACK unpacking is supported.
`source-inventory` reports the currently selected client source shape, including
legacy `.dat` availability, VPACK path, size, SHA-256, and header bytes.
`vpack-info` inspects the VPACK fixed header and reads `ProjectRogue.log` for
the packed file names the client loaded. The current packed client reports
build `1`, schema `1`, crypto `1`, compression `1`, and 11 packed JSON files:
`Map.json`, `safezones.json`, `locales.json`, `tiles.json`, `npcs.json`,
`monsters.json`, `objecttypes.json`, `weapons.json`, `armors.json`,
`collectables.json`, and `useables.json`.

The pipeline writes generated client exports to
`generated-output/codex-data/` first. Site JSON is only changed after an
explicit sync.

## Data Flow

```text
Client .dat files
  -> tools/codex_pipeline/extractors/
  -> generated-output/codex-data/*.json
  -> diff-generated review
  -> sync-generated / export-sync
  -> pages/** site JSON
  -> validate
  -> push main
  -> GitHub Pages
  -> verify-deploy
```

For normal data refreshes, use this sequence:

```powershell
python -m tools.codex_pipeline doctor
python -m tools.codex_pipeline game-update-report
python -m tools.codex_pipeline game-update-workflow
python -m tools.codex_pipeline export-client-data
python -m tools.codex_pipeline diff-generated
python -m tools.codex_pipeline sync-generated --dry-run
python -m tools.codex_pipeline sync-generated
python -m tools.codex_pipeline validate
python -m tools.codex_pipeline smoke-site
```

After pushing `main`, confirm the public site:

```powershell
python -m tools.codex_pipeline verify-deploy
```

## Command Surface

The CLI entry point is:

```powershell
python -m tools.codex_pipeline <command>
```

Important commands:

- `doctor` / `validate-sources`: confirms extractor scripts, client source data,
  site destination folders, and extractor syntax.
- `game-update-report`: runs a review-only game update pass: source checks,
  export to generated output, generated-vs-site diffs, generated unknown-field
  inventory, client-vs-site asset image diffs, generated drop-source
  validation, and generated corrupted-perk validation.
- `game-update-workflow`: runs the standard game-update review sequence in
  order. Use `--apply` to sync reviewed generated data and image assets, and
  `verify-deploy` after deployment to wait for GitHub Actions/Pages and check
  the live site.
- `export-client-data`: runs configured extractors and writes generated JSON to
  `generated-output/codex-data/`.
- `unknown-fields`: inventories `unknown_*` fields in current site data, or in
  generated output with `--source generated`.
- `diff-generated`: compares generated JSON against current site JSON without
  copying files.
- `sync-generated`: copies generated JSON into site paths. Use `--dry-run` for a
  review-only pass.
- `sync-assets`: copies reviewed client image changes into site image folders,
  removes stale site images, and regenerates manifests when filenames change.
- `export-sync`: runs export and sync in one step.
- `validate`: validates site JSON, overrides, image manifests, inline page
  scripts, configured JavaScript files, drop references, and corrupted perk
  labels.
- `smoke-site`: starts a temporary local static server and uses Playwright to
  verify Monsters, Weapons, and Armors deep links, reload persistence,
  row-click URL updates, Close URL clearing, and detail-panel cross-links. Use
  `--live` to run the same checks against `--site-url`.
- `drop-report`: audits drop-source overrides and prints both the item-centric
  source view and derived monster-centric loot view.
- `verify-deploy`: waits for the expected GitHub Actions and Pages runs for the
  current commit, then runs `verify-live` and `smoke-site --live`.
- `verify-live`: fetches the deployed GitHub Pages site and confirms live JSON,
  image manifests, and deployed image hashes match local site files.

`--target monsters`, `--target weapons`, and `--target armors` can narrow export,
sync, diff, and source-check commands.

## Module Map

Core package:

- `tools/codex_pipeline/cli.py`: command dispatch and validation orchestration.
- `tools/codex_pipeline/config.py`: repository paths, external client paths, site
  data paths, override paths, and image directories.
- `tools/codex_pipeline/assets.py`: client-vs-site image inventory, hash
  comparison, asset sync, and manifest consistency reports.
- `tools/codex_pipeline/drop_audit.py`: drop-source audit report assembly and
  validation issue collection.
- `tools/codex_pipeline/exports.py`: export target definitions, extractor
  subprocess execution, generated-output normalization, diff reporting, and site
  sync.
- `tools/codex_pipeline/game_update.py`: review-only game update report
  orchestration.
- `tools/codex_pipeline/sources.py`: pre-export source checks used by `doctor`.
- `tools/codex_pipeline/deploy.py`: live GitHub Pages data, manifest, and image
  hash comparison.
- `tools/codex_pipeline/drops.py`: drop-source override loading, name
  normalization, and reverse monster-drop derivation.
- `tools/codex_pipeline/perks.py`: corrupted perk label override loading.
- `tools/codex_pipeline/unknowns.py`: unknown-field inventory reports for site
  or generated data.
- `tools/codex_pipeline/validators/site.py`: site data, overrides, manifests,
  inline scripts, and JavaScript validation helpers.

Extractor package:

- `tools/codex_pipeline/extractors/shared.py`: binary record helpers, shared
  extractor CLI parsing, extractor run configuration, output writing, backup,
  hash, and diff helpers.
- `tools/codex_pipeline/extractors/field_schemas.py`: known word-index field
  names for monsters, weapons, and armors.
- `tools/codex_pipeline/extractors/monster_metadata.py`: monster labels, flag
  enrichment, and warning generation.
- `tools/codex_pipeline/extractors/item_metadata.py`: weapon/armor labels,
  derived value, perk labels, corrupted perk labels, and item perk reporting.
- `tools/codex_pipeline/extractors/extract_monsters_data03.py`: monster parser
  for `data03.dat`.
- `tools/codex_pipeline/extractors/extract_weapons_data05.py`: weapon parser for
  `data05.dat`.
- `tools/codex_pipeline/extractors/extract_armors_data06.py`: armor parser for
  `data06.dat`.

## Overrides

Drop-source corrections are centralized in:

```text
data/codex-overrides/drop_sources.json
```

This file is item-centric. Site code and pipeline validation derive the reverse
monster-to-item view from the same file so item pages and monster pages do not
drift.

Corrupted perk label corrections are centralized in:

```text
data/codex-overrides/perk_labels.json
```

During export normalization, explicit labels are applied and configured unknowns
remove generated labels. This prevents uncertain corrupted perk values from being
published as misleading text.

## Generated Output Rules

Generated records are normalized before review and sync:

- Generated JSON must be a list.
- Armor fields `unknown_26`, `unknown_27`, and `unknown_29` are normalized
  against existing site data until their meanings are mapped.
- Untrusted corrupted perk labels are removed unless an override confirms them.
- `diff-generated` reports added, removed, and changed records by stable record
  identity instead of raw line diffs where possible.

## Validation And CI

Local verification should include:

```powershell
npm install
python -m unittest discover -s tests -v
python -m tools.codex_pipeline validate
python -m tools.codex_pipeline smoke-site
python -m tools.codex_pipeline verify-deploy
git diff --check
```

GitHub Actions runs the Codex data checks on pushes and pull requests targeting
`main`. GitHub Pages deployment then publishes the static site from `main`.

## Safe Change Pattern

For data or extractor changes:

1. Run `game-update-workflow`.
2. Review generated-vs-site diffs, asset image diffs, and update warnings.
3. Sync only intentional generated data and asset changes, or rerun with
   `--apply` after review.
4. Run unit tests and `validate`.
5. Commit and push.
6. Run `verify-deploy`.

For override-only changes:

1. Edit the override JSON.
2. Run unit tests and `validate`.
3. Confirm affected pages still derive data from the shared override file.
4. Commit, push, and run `verify-deploy`.

## Current Boundary

This pipeline intentionally focuses on Codex data and export flow only. It does
not refactor the older `project-rogue` script collection, toolkit automation,
runtime logs, packaging, or unrelated game tooling.
