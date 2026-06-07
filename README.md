# Project Rogue Codex

Static reference site for Project Rogue game data, including weapons, armors, monsters, systems pages, and supporting assets.

## Site Entry Points

- `index.html`: static-site entry page.
- `nav.html`: shared navigation markup.
- `pages/`: content and data pages.
- `js/`: shared browser-side behavior.
- `css/`: shared styling.
- `images/`: item, monster, race, and UI assets.

## Codex Data Pipeline

Codex-only validation and export tooling lives in `tools/codex_pipeline/`. Extractor scripts are repo-owned under `tools/codex_pipeline/extractors/`; the configured game client `.dat` files remain external inputs under `C:\Users\traec\Desktop\Client\data`.

For the current source-of-truth flow, module map, safe change pattern, and verification sequence, see `docs/codex-pipeline-architecture.md`.

Run validation before committing data or drop-source changes:

```powershell
python -m tools.codex_pipeline validate
```

GitHub Actions also runs the unit tests, Codex validation, and whitespace checks on pushes and pull requests targeting `main`.

The first pipeline slice validates weapons, armors, monsters, image manifests, inline page scripts, special drop-source overrides from `data/codex-overrides/drop_sources.json`, and corrupted perk label overrides from `data/codex-overrides/perk_labels.json`.

Audit drop-source overrides and the derived monster loot view:

```powershell
python -m tools.codex_pipeline drop-report
```

Before exporting from local game client data, check the configured extractor scripts, source `.dat` files, destination folders, and extractor syntax:

```powershell
python -m tools.codex_pipeline doctor
```

`validate-sources` is an alias for the same pre-export check.

After a game update, generate a review-only update report. This exports current client data into `generated-output/codex-data/`, compares it against the site JSON, compares client images against site images, reports generated unknown fields, validates drop overrides against generated data, and reports whether generated output is safe to review and sync:

```powershell
python -m tools.codex_pipeline game-update-report
```

To run the normal review workflow in one command:

```powershell
python -m tools.codex_pipeline game-update-workflow
```

Use `--apply` to sync reviewed generated data and image assets, and `--verify-live` after a push/deploy when the public site should match local files.

Export client data into the intermediate generated-output folder without touching site files:

```powershell
python -m tools.codex_pipeline export-client-data
```

Inventory current unknown fields in site data, or generated output after an export:

```powershell
python -m tools.codex_pipeline unknown-fields
python -m tools.codex_pipeline unknown-fields --source generated
```

Armor exports preserve existing site values for audited unknown fields (`unknown_26`, `unknown_27`) and suppress newly generated `unknown_29` values until those fields are mapped to a known meaning. Meaningful generated fields such as perks, corrupted perks, and image frame data still appear in review diffs. Corrupted perk labels that only match the base perk fallback are removed so unknown corrupted perk values stay numeric until they are explicitly mapped in `data/codex-overrides/perk_labels.json`.

Sync generated files into the site after reviewing them:

```powershell
python -m tools.codex_pipeline diff-generated
python -m tools.codex_pipeline sync-generated --dry-run
python -m tools.codex_pipeline sync-generated
```

Sync reviewed client image changes into the site image folders:

```powershell
python -m tools.codex_pipeline sync-assets --dry-run
python -m tools.codex_pipeline sync-assets
```

To export and sync in one step after you are comfortable with the generated output:

```powershell
python -m tools.codex_pipeline export-sync
```

Use `--target monsters`, `--target weapons`, or `--target armors` to run a narrower export or sync.

The static site is published from `origin/main` to:

```text
https://traecneh.github.io/Project-Rogue-Codex/
```

After pushing `main`, verify the public site, deployed JSON data, image manifests, and deployed image hashes match the local site:

```powershell
python -m tools.codex_pipeline verify-live
```

Use `--site-url` if the deployment target changes.
