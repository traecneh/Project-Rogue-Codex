# project-rogue-codex

Minimal project README added during workspace cleanup.

## Status

This project has been moved under projects/ and given a baseline layout. The next useful step is to document purpose, setup, and expected inputs/outputs in more detail.

## Likely entry files

- `index.html`
- `nav.html`

## Notes

- Project type: Static web
- This README is intentionally minimal and should be replaced with project-specific instructions when the project is revisited.

## Codex Data Pipeline

Codex-only validation and export tooling lives in `tools/codex_pipeline/`. Extractor scripts are repo-owned under `tools/codex_pipeline/extractors/`; the configured game client `.dat` files remain external inputs under `C:\Users\traec\Desktop\Client\data`.

For the current source-of-truth flow, module map, safe change pattern, and verification sequence, see `docs/codex-pipeline-architecture.md`.

Run validation before committing data or drop-source changes:

```powershell
python -m tools.codex_pipeline validate
```

GitHub Actions also runs the unit tests, Codex validation, and whitespace checks on pushes and pull requests targeting `main`.

The first pipeline slice validates weapons, armors, monsters, image manifests, inline page scripts, special drop-source overrides from `data/codex-overrides/drop_sources.json`, and corrupted perk label overrides from `data/codex-overrides/perk_labels.json`.

Before exporting from local game client data, check the configured extractor scripts, source `.dat` files, destination folders, and extractor syntax:

```powershell
python -m tools.codex_pipeline doctor
```

`validate-sources` is an alias for the same pre-export check.

Export client data into the intermediate generated-output folder without touching site files:

```powershell
python -m tools.codex_pipeline export-client-data
```

Armor exports preserve existing site values for audited unknown fields (`unknown_26`, `unknown_27`) and suppress newly generated `unknown_29` values until those fields are mapped to a known meaning. Meaningful generated fields such as perks, corrupted perks, and image frame data still appear in review diffs. Corrupted perk labels that only match the base perk fallback are removed so unknown corrupted perk values stay numeric until they are explicitly mapped in `data/codex-overrides/perk_labels.json`.

Sync generated files into the site after reviewing them:

```powershell
python -m tools.codex_pipeline diff-generated
python -m tools.codex_pipeline sync-generated --dry-run
python -m tools.codex_pipeline sync-generated
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

After pushing `main`, verify the public site and deployed JSON data match the local site data:

```powershell
python -m tools.codex_pipeline verify-live
```

Use `--site-url` if the deployment target changes.
