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

Codex-only validation and export tooling lives in `tools/codex_pipeline/`. Extractor scripts are repo-owned under `tools/codex_pipeline/extractors/`; configured game client data remains an external input. Current clients can be read from the packed `Data\ClientPack\rogue_data.vpack` source, with `PROJECT_ROGUE_CLIENT_ROOT` available when the install path differs from the default.

For the current source-of-truth flow, module map, safe change pattern, and verification sequence, see `docs/codex-pipeline-architecture.md`.

Run validation before committing data or drop-source changes:

```powershell
python -m tools.codex_pipeline validate
```

Run browser smoke checks before pushing page behavior changes. This starts a
temporary local static server and verifies Monsters, Weapons, and Armors deep
links, reload persistence, row-click URL updates, Close URL clearing, and
detail-panel cross-links:

```powershell
npm install
python -m tools.codex_pipeline smoke-site
```

GitHub Actions also runs the unit tests, `release-check`, local browser smoke checks, and whitespace checks on pushes and pull requests targeting `main`.

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

To run the normal review workflow in one command. This starts with a client install inventory diff against `data/client_inventory_snapshot.json`, then runs the export/data/image review steps:

```powershell
python -m tools.codex_pipeline game-update-workflow
```

Add `--write-summary` when you want a compact review artifact at `generated-output/codex-data/game_update_workflow_summary.md` with client inventory changes, generated data diffs, hidden exclusion counts, image diffs, priority-vs-churn image counts, capped priority image details, unknown-field counts, blockers, and the recommended next action. Use it with `--write-image-review` to add links to the generated image-review Markdown and contact sheets. Records and images blocked in `data/allowlists.json` are treated as hidden during generated data diff review, asset review, and asset sync. Low-priority image churn alone does not block sync readiness; added, removed, meaningful, or unreadable images still require review before apply.

To inspect or refresh the client install baseline directly:

```powershell
python -m tools.codex_pipeline client-inventory --diff-snapshot
python -m tools.codex_pipeline client-inventory --write-snapshot
```

Use `--apply` to sync reviewed generated data and image assets. After apply syncs and local validation succeed, the workflow refreshes `data/client_inventory_snapshot.json` so the accepted client install becomes the new baseline. After a push/deploy, run `verify-deploy` to wait for GitHub Actions/Pages and check the live site.

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

For atlas-based update reviews, `game-update-workflow` defaults asset syncing to priority scope, which applies added/removed images and meaningful or unreadable changed images while leaving background-only or encoding-only churn untouched. Use `--image-sync-scope all` only when you intentionally want to sync low-priority changed-image churn:

```powershell
python -m tools.codex_pipeline sync-assets --dry-run --asset-source atlas --image-sync-scope priority
python -m tools.codex_pipeline game-update-workflow --apply --force-apply
```

To export and sync in one step after you are comfortable with the generated output:

```powershell
python -m tools.codex_pipeline export-sync
```

Use `--target monsters`, `--target weapons`, or `--target armors` to run a narrower export or sync.

When CSS or JavaScript changes, bump the shared static asset version so browsers fetch the new files instead of serving stale cached assets:

```powershell
python -m tools.codex_pipeline bump-static-version --asset-version codex-YYYY-MM-DD
```

The command updates local `css/` and `js/` links in validated HTML pages, writes `data/codex-overrides/static_asset_version.txt`, and ensures the HTML no-cache meta tags are present. Use a new token for each frontend release that changes static assets.

Before pushing a release commit, run the release gate from a clean worktree:

```powershell
python -m tools.codex_pipeline release-check
```

`release-check` runs Codex validation, confirms validated HTML pages are already on the configured static asset version, and fails if Git reports uncommitted changes. Add `--verify-live` only when you intentionally want to include live-site checks in the same command.

The static site is published from `origin/main` to:

```text
https://traecneh.github.io/Project-Rogue-Codex/
```

After pushing `main`, wait for GitHub Actions/Pages and verify the public site in one command:

```powershell
python -m tools.codex_pipeline verify-deploy
```

This waits for the expected GitHub workflow runs for the current commit, verifies deployed JSON data, image manifests, deployed image hashes, and runs live page behavior smoke checks. The lower-level commands remain available when you need to run one part directly:

```powershell
python -m tools.codex_pipeline verify-live
python -m tools.codex_pipeline smoke-site --live
```

Use `--site-url` if the deployment target changes.
