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

Codex-only validation and future export tooling lives in `tools/codex_pipeline/`.

Run validation before committing data or drop-source changes:

```powershell
python -m tools.codex_pipeline validate
```

The first pipeline slice validates weapons, armors, monsters, image manifests, inline page scripts, and special drop-source overrides from `data/codex-overrides/drop_sources.json`.

Export client data into the intermediate generated-output folder without touching site files:

```powershell
python -m tools.codex_pipeline export-client-data
```

Armor exports preserve existing site values for audited unknown fields (`unknown_26`, `unknown_27`) and suppress newly generated `unknown_29` values until those fields are mapped to a known meaning. Meaningful generated fields such as perks, corrupted perks, and image frame data still appear in review diffs.

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
