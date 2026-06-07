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
  -> verify-live
```

For normal data refreshes, use this sequence:

```powershell
python -m tools.codex_pipeline doctor
python -m tools.codex_pipeline export-client-data
python -m tools.codex_pipeline diff-generated
python -m tools.codex_pipeline sync-generated --dry-run
python -m tools.codex_pipeline sync-generated
python -m tools.codex_pipeline validate
```

After pushing `main`, confirm the public site:

```powershell
python -m tools.codex_pipeline verify-live
```

## Command Surface

The CLI entry point is:

```powershell
python -m tools.codex_pipeline <command>
```

Important commands:

- `doctor` / `validate-sources`: confirms extractor scripts, client source data,
  site destination folders, and extractor syntax.
- `export-client-data`: runs configured extractors and writes generated JSON to
  `generated-output/codex-data/`.
- `diff-generated`: compares generated JSON against current site JSON without
  copying files.
- `sync-generated`: copies generated JSON into site paths. Use `--dry-run` for a
  review-only pass.
- `export-sync`: runs export and sync in one step.
- `validate`: validates site JSON, overrides, image manifests, inline page
  scripts, configured JavaScript files, drop references, and corrupted perk
  labels.
- `verify-live`: fetches the deployed GitHub Pages site and confirms live JSON
  matches local site JSON.

`--target monsters`, `--target weapons`, and `--target armors` can narrow export,
sync, diff, and source-check commands.

## Module Map

Core package:

- `tools/codex_pipeline/cli.py`: command dispatch and validation orchestration.
- `tools/codex_pipeline/config.py`: repository paths, external client paths, site
  data paths, override paths, and image directories.
- `tools/codex_pipeline/exports.py`: export target definitions, extractor
  subprocess execution, generated-output normalization, diff reporting, and site
  sync.
- `tools/codex_pipeline/sources.py`: pre-export source checks used by `doctor`.
- `tools/codex_pipeline/deploy.py`: live GitHub Pages data comparison.
- `tools/codex_pipeline/drops.py`: drop-source override loading, name
  normalization, and reverse monster-drop derivation.
- `tools/codex_pipeline/perks.py`: corrupted perk label override loading.
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
python -m unittest discover -s tests -v
python -m tools.codex_pipeline validate
python -m tools.codex_pipeline verify-live
git diff --check
```

GitHub Actions runs the Codex data checks on pushes and pull requests targeting
`main`. GitHub Pages deployment then publishes the static site from `main`.

## Safe Change Pattern

For data or extractor changes:

1. Run `doctor`.
2. Export to `generated-output/codex-data/`.
3. Review `diff-generated`.
4. Sync only intentional generated changes.
5. Run unit tests and `validate`.
6. Commit and push.
7. Wait for GitHub Actions and Pages.
8. Run `verify-live`.

For override-only changes:

1. Edit the override JSON.
2. Run unit tests and `validate`.
3. Confirm affected pages still derive data from the shared override file.
4. Commit, push, wait for Pages, and run `verify-live`.

## Current Boundary

This pipeline intentionally focuses on Codex data and export flow only. It does
not refactor the older `project-rogue` script collection, toolkit automation,
runtime logs, packaging, or unrelated game tooling.
