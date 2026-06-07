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
