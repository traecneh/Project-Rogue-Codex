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

Add `--write-summary` when you want compact review artifacts at `generated-output/codex-data/game_update_workflow_summary.md`, `generated-output/codex-data/gameplay_impact_report.md`, `generated-output/codex-data/gameplay_impact_report.json`, `generated-output/codex-data/impact_validation_plan.json`, and `generated-output/codex-data/game_update_run.json`. The gameplay reports keep public additions/removals and readable changes to combat, defense, requirements, elements, perks, progression, monster traits, and tatter drops while counting and filtering animation, price, raw, and metadata churn. The JSON companion assigns deterministic high, medium, or low review risk to each signal for future automated Codex update runs. The impact validation plan maps those signals to the affected site surfaces: element changes route resistance and monster-recommendation checks; perk changes route perks, item cards, recommendations, and the build planner; public additions/removals route search, images, deep links, and relationships. The run ledger combines the report digest with a client-inventory fingerprint, tracks every workflow stage and artifact hash, and exposes the exact next action. The workflow summary also covers client inventory changes, generated data diffs, hidden exclusions, image diffs, unknown fields, blockers, and the recommended next action. Use it with `--write-image-review` to add links to the generated image-review Markdown and contact sheets. Records and images blocked in `data/allowlists.json` are treated as hidden during generated data diff review, asset review, and asset sync. Low-priority image churn alone does not block sync readiness; added, removed, meaningful, or unreadable images still require review before apply.

Use `--risk-gate` with `game-update-workflow --apply` to enforce the gameplay-impact policy. Low-risk-only runs may apply automatically and medium-risk runs require `--write-summary`. High-risk review artifacts include a deterministic `sha256:...` report digest; pass that exact value with `--acknowledge-impact DIGEST` on the apply run. The workflow rebuilds the report and rejects stale or mismatched acknowledgements. This gate is opt-in and independent of `--force-apply`, which continues to control the existing sync-readiness check.

```powershell
python -m tools.codex_pipeline game-update-workflow --risk-gate --write-summary
python -m tools.codex_pipeline game-update-workflow --apply --risk-gate --write-summary --acknowledge-impact sha256:<reviewed-digest>
```

To inspect or refresh the client install baseline directly:

```powershell
python -m tools.codex_pipeline client-inventory --diff-snapshot
python -m tools.codex_pipeline client-inventory --write-snapshot
```

Use `--apply` to sync reviewed generated data and image assets. After apply syncs and local validation succeed, the workflow automatically runs the browser smoke suite when the impact plan routes any browser checks. Only then does it refresh `data/client_inventory_snapshot.json` so the accepted client install becomes the new baseline. After a push/deploy, run `verify-deploy` with the reviewed impact plan to bind the local evidence, deployed commit, and live checks to the same report digest.

To reproduce only the browser checks selected for a reviewed update, pass its plan to `smoke-site`. Plan-aware smoke runs execute the affected page groups, every added or removed public record, and a deterministic five changed records per affected data type. Record probes verify site search, detail routes and reloads, rendered images, and local relationship destinations when those checks are routed. Every CLI smoke run writes `impact_validation_results.json` under its output directory by default, recording the report digest, selected groups and records, pass/fail results, durations, failure details, and a deterministic fingerprint of the tested HTML, CSS, JavaScript, data, and image tree. Use `--smoke-results-path` to choose another evidence location.

```powershell
python -m tools.codex_pipeline smoke-site --impact-plan generated-output/codex-data/impact_validation_plan.json
python -m tools.codex_pipeline game-update-status
python -m tools.codex_pipeline game-update-history
python -m tools.codex_pipeline verify-deploy --impact-plan generated-output/codex-data/impact_validation_plan.json
```

`game-update-status` verifies every recorded artifact hash and, once local validation is complete, compares the reviewed source fingerprint with the current tree, worktree state, local `HEAD`, configured GitHub repository, and `origin/<branch>`. It reports actionable states such as `READY_TO_COMMIT`, `READY_TO_PUSH`, `READY_TO_DEPLOY`, `STALE_EVIDENCE`, or `REMOTE_DIVERGED` without changing the ledger. Use `--update-run-path` for a non-default review directory. Rechecking the same client update preserves completed stages; a different client-inventory fingerprint starts a fresh run. Deployment refuses a ledger with incomplete local stages or artifact hashes from another review.

The deployment verifier requires local `HEAD` to resolve to the requested deployment commit, a clean tracked worktree, and no untracked files in the deployable site tree. It then verifies that `origin` identifies the configured GitHub repository and queries the remote directly to require `origin/<branch>` at that same commit. With a plan, it also requires the sibling `game_update_run.json` and local `impact_validation_results.json`, verifies their digest and artifact hashes, and rejects smoke evidence whose source-tree fingerprint differs from the committed site. It preserves the local result, reruns the same routed checks against the live site into `live_impact_validation_results.json`, and writes `deployment_validation_results.json` in that directory. After a successful live verification, it atomically archives the finalized ledger and every hashed run artifact under `generated-output/game-update-history/<run-id>/`, with an archive manifest containing the report digest, commit, source fingerprint, file sizes, and checksums. Existing archives are verified and reused but never overwritten. The final deployment record includes the archive path, local and remote Git provenance, the source-tree and Codex content digests, plan and evidence hashes, GitHub workflow results, deployed-data checks, and the live browser result. Use `--update-run-path`, `--local-smoke-results-path`, `--deployment-results-path`, or `--update-archive-dir` only when those artifacts live elsewhere.

Run `game-update-history` to list every archived release and recheck all archived sizes and hashes. Pass `--update-run-path` to additionally require that a completed active run has a valid matching archive. The command returns a failure status for corrupt archives, invalid identities, or missing completed-run evidence.

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

After pushing `main`, wait for GitHub Actions/Pages and verify the public site in one command. For a game-data update, pass the reviewed plan so deployment verification rejects stale local evidence and reruns the same routed checks live:

```powershell
python -m tools.codex_pipeline verify-deploy --impact-plan generated-output/codex-data/impact_validation_plan.json
```

Without `--impact-plan`, `verify-deploy` retains the full-site behavior for ordinary site changes. Both modes first seal the clean local commit, deployable source-tree fingerprint, configured GitHub repository, and pushed remote branch head. They then wait for the expected GitHub workflow runs for that commit, verify deployed JSON data, image manifests, image hashes, and the Codex manifest, run live page behavior smoke checks, and write deployment evidence. The lower-level commands remain available when you need to run one part directly:

```powershell
python -m tools.codex_pipeline verify-live
python -m tools.codex_pipeline smoke-site --live
```

Use `--site-url` if the deployment target changes.
