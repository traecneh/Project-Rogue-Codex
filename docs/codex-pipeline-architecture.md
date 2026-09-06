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
python -m tools.codex_pipeline vpack-extract --output-dir generated-output\vpack
```

The July 2026 client package moved the direct `.dat` files into
`Data\ClientPack\rogue_data.vpack`. The pipeline detects that packed source,
can decrypt and extract the packed JSON files, and blocks the legacy export path
until the new JSON schema is mapped into the Codex site format.
`source-inventory` reports the currently selected client source shape, including
legacy `.dat` availability, VPACK path, size, SHA-256, and header bytes.
`vpack-info` inspects the VPACK fixed header and reads `ProjectRogue.log` for
the packed file names the client loaded. The current packed client reports
build `1`, schema `1`, crypto `1`, compression `1`, and 11 packed JSON files:
`Map.json`, `safezones.json`, `locales.json`, `tiles.json`, `npcs.json`,
`monsters.json`, `objecttypes.json`, `weapons.json`, `armors.json`,
`collectables.json`, and `useables.json`.
`vpack-extract` verifies the AES-GCM payload and per-file SHA-256 values before
writing extracted JSON files.

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
  -> release-check
  -> push main
  -> GitHub Pages
  -> verify-deploy
```

For normal data refreshes, use this sequence:

```powershell
python -m tools.codex_pipeline game-update-workflow
python -m tools.codex_pipeline export-client-data
python -m tools.codex_pipeline diff-generated
python -m tools.codex_pipeline sync-generated --dry-run
python -m tools.codex_pipeline sync-generated
python -m tools.codex_pipeline validate
python -m tools.codex_pipeline smoke-site
git commit
python -m tools.codex_pipeline release-check
```

After pushing `main`, confirm the public site:

```powershell
python -m tools.codex_pipeline verify-deploy --impact-plan generated-output/codex-data/impact_validation_plan.json
```

## Command Surface

The CLI entry point is:

```powershell
python -m tools.codex_pipeline <command>
```

Important commands:

- `client-inventory`: inventories the configured client install, packed VPACK
  files, packed JSON record shapes, atlas dimensions/hashes, and diagnostic
  file keys. Use `--diff-snapshot` to compare against
  `data/client_inventory_snapshot.json`; use `--write-snapshot` after accepting a
  new client baseline.
- `doctor` / `validate-sources`: confirms extractor scripts, client source data,
  site destination folders, and extractor syntax.
- `game-update-report`: runs a review-only game update pass: source checks,
  export to generated output, generated-vs-site diffs, generated unknown-field
  inventory, client-vs-site asset image diffs, generated drop-source
  validation, and generated corrupted-perk validation.
- `game-update-workflow`: runs the standard game-update review sequence in
  order, starting with `client-inventory --diff-snapshot`. Use `--apply` to sync
  reviewed generated data and image assets. After apply syncs and validation
  succeed, the workflow refreshes `data/client_inventory_snapshot.json` with the
  accepted client install baseline. Use `--write-summary` to write
  `generated-output/codex-data/game_update_workflow_summary.md`,
  `generated-output/codex-data/gameplay_impact_report.md`, the deterministic
  machine-readable companion `generated-output/codex-data/gameplay_impact_report.json`,
  and `generated-output/codex-data/impact_validation_plan.json`. The validation
  plan maps changed elements, perks, public records, and other gameplay fields to
  the exact interconnected site surfaces and automated runners that must verify
  them.
  The gameplay report filters animation, price, raw, and metadata churn while
  preserving readable player-facing changes. The workflow summary covers
  client inventory changes, generated data diffs,
  hidden exclusion counts, image diffs, priority-vs-churn image counts, capped
  priority image details, unknown-field counts, blockers, and the recommended
  next action. Use it with `--write-image-review` to add links to the generated
  image-review Markdown and contact sheets. Records and images blocked in
  `data/allowlists.json` are treated as hidden during generated data diff
  review, asset review, and asset sync. Low-priority image churn alone does not
  block sync readiness; added, removed, meaningful, or unreadable images still
  require review before apply. Workflow asset sync defaults to priority scope;
  pass `--image-sync-scope all` only when intentionally syncing low-priority
  changed-image churn. Add `--risk-gate` to an apply run to enforce the impact
  policy: low-risk-only changes may apply automatically, medium risk requires
  `--write-summary`, and high risk additionally requires
  `--acknowledge-impact DIGEST`, using the exact deterministic digest printed by
  the reviewed report. The apply run rebuilds the impact report and rejects a
  stale or mismatched digest. This opt-in gate is independent of the existing
  `--force-apply` sync-readiness override. After apply validation, any routed
  browser checks automatically run through `smoke-site`; a failure prevents the
  client inventory snapshot from being accepted. Pass an existing artifact with
  `smoke-site --impact-plan PATH` to reproduce the routed page groups and record
  probes directly. The plan retains every affected public record; browser
  execution checks every addition/removal and five deterministic changed records
  per target for search, deep links, rendered images, and relationship
  destinations. Each CLI smoke run writes `impact_validation_results.json` with
  the reviewed report digest, selected groups and records, status, timing,
  failure evidence, and a deterministic fingerprint of the tested static site
  tree. Apply workflows link the result from the workflow summary,
  including failed evidence before refusing snapshot acceptance. After push,
  `verify-deploy --impact-plan PATH` requires that passed local evidence, a
  clean tracked worktree, no untracked deployable files, and a local `HEAD`
  matching the requested deployment commit. Before marking deployment as
  running, it also requires `origin` to identify the configured GitHub
  repository and `origin/<branch>` to resolve remotely to the same commit. It
  rejects evidence whose static site fingerprint differs from that commit,
  waits for GitHub Actions/Pages, reruns the same routed checks live without
  overwriting the local result, and writes `deployment_validation_results.json`.
  That final evidence binds the report digest to the deployed commit, Codex
  content digest, workflow outcomes, live file checks, and live smoke result.
  A successful run then atomically archives the finalized ledger and every
  hashed artifact under `generated-output/game-update-history/<run-id>/`.
  The archive manifest records the commit, report and source digests, sizes, and
  checksums; an existing matching archive is verified rather than overwritten.
  The sibling `game_update_run.json` ledger uses the report digest plus a stable
  client-inventory fingerprint as its run identity. It preserves progress for a
  repeated review of the same client, starts fresh for a different client, and
  tracks discovery, review, apply, local validation, baseline acceptance,
  commit, deployment, and live validation. `game-update-status` revalidates
  recorded artifact hashes and, after local validation, derives the exact next
  action from source-tree, worktree, local-commit, and remote-branch provenance.
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
- `bump-static-version`: updates validated HTML `css/` and `js/` links to a
  shared cache-busting token, writes
  `data/codex-overrides/static_asset_version.txt`, and ensures HTML no-cache
  meta tags are present.
- `validate`: validates site JSON, overrides, image manifests, inline page
  scripts, configured JavaScript files, drop references, and corrupted perk
  labels.
- `release-check`: runs local release gates: `validate`, static asset version
  drift detection, and clean git status. Use `--verify-live` to include the
  public live-site verification step.
- `smoke-site`: starts a temporary local static server and uses Playwright to
  verify Monsters, Weapons, and Armors deep links, reload persistence,
  row-click URL updates, Close URL clearing, and detail-panel cross-links. Use
  `--live` to run the same checks against `--site-url`.
- `drop-report`: audits drop-source overrides and prints both the item-centric
  source view and derived monster-centric loot view.
- `verify-deploy`: waits for the expected GitHub Actions and Pages runs for the
  current clean commit, then runs `verify-live` and `smoke-site --live`. It
  fingerprints the deployable HTML, CSS, JavaScript, data, and image tree before
  polling GitHub, verifies the configured repository and pushed branch directly
  from `origin`, and requires live smoke evidence to identify the same tree. Pass
  `--impact-plan PATH` to require its sibling local smoke evidence and rerun the
  exact routed checks. The command writes separate live-smoke and deployment
  evidence artifacts and seals completed update-run evidence into an immutable
  archive; without a plan it retains full-site smoke behavior.
- `game-update-status`: reads `game_update_run.json`, revalidates artifact hashes
  and source provenance, and reports whether the run is ready to commit, push,
  or deploy, or is blocked by stale evidence or a diverged remote. It does not
  change pipeline state.
- `game-update-history`: lists immutable completed-run archives and verifies
  their identities, required evidence files, sizes, and checksums. With
  `--update-run-path`, it also detects a completed active run whose matching
  archive is missing or invalid.
- `verify-live`: fetches the deployed GitHub Pages site and confirms live JSON,
  image manifests, and deployed image hashes match local site files.

`--target monsters`, `--target weapons`, and `--target armors` can narrow export,
sync, diff, and source-check commands.

## Module Map

Core package:

- `tools/codex_pipeline/cli.py`: command dispatch and validation orchestration.
- `tools/codex_pipeline/deployment_validation.py`: reviewed-plan/local-smoke
  binding, evidence validation, artifact hashing, and deployment-result output.
- `tools/codex_pipeline/evidence_archive.py`: atomic, idempotent completed-run
  evidence archiving and checksum verification.
- `tools/codex_pipeline/provenance.py`: deterministic deployable-site
  fingerprinting and clean Git worktree inspection for smoke and deployment
  evidence.
- `tools/codex_pipeline/update_run.py`: update-run identity, stage transitions,
  artifact hashes, deployment prerequisites, and next-action derivation.
- `tools/codex_pipeline/update_status.py`: read-only artifact, source-tree,
  worktree, commit, and remote provenance assessment for update-run status.
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
- `tools/codex_pipeline/gameplay_impact.py`: semantic player-facing change and
  risk classification with compact Markdown and machine-readable JSON reports.
- `tools/codex_pipeline/impact_validation.py`: deterministic impact-to-surface
  validation routing and machine-readable plan generation.
- `tools/codex_pipeline/sources.py`: pre-export source checks used by `doctor`.
- `tools/codex_pipeline/deploy.py`: live GitHub Pages data, manifest, and image
  hash comparison.
- `tools/codex_pipeline/static_assets.py`: static CSS/JS asset versioning and
  HTML no-cache helpers.
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

The frontend static asset cache-busting token is centralized in:

```text
data/codex-overrides/static_asset_version.txt
```

When CSS or JavaScript changes, run:

```powershell
python -m tools.codex_pipeline bump-static-version --asset-version codex-YYYY-MM-DD
```

Use a new token per frontend release that changes local `css/` or `js/` files.
The command rewrites validated HTML references and preserves external URLs,
images, and data files.

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
git diff --check
```

Before pushing a release commit, run this from a clean worktree:

```powershell
python -m tools.codex_pipeline release-check
```

After pushing `main`, confirm the public site:

```powershell
python -m tools.codex_pipeline verify-deploy --impact-plan generated-output/codex-data/impact_validation_plan.json
```

GitHub Actions runs `release-check`, unit tests, local smoke checks, and
whitespace checks on pushes and pull requests targeting `main`. GitHub Pages
deployment then publishes the static site from `main`.

## Safe Change Pattern

For data or extractor changes:

1. Run `game-update-workflow`.
2. Review the gameplay impact, client inventory diff, generated-vs-site diffs,
   asset image diffs, and update warnings, or rerun with `--write-summary` for
   the compact workflow artifacts.
3. Sync only intentional generated data and asset changes, or rerun with
   `--apply` after review. Successful apply refreshes the client inventory
   snapshot after validation.
4. Run unit tests, `validate`, and `smoke-site`.
5. If CSS or JavaScript changed, run `bump-static-version`.
6. Commit.
7. Run `release-check` from the clean worktree.
8. Push and run `verify-deploy --impact-plan generated-output/codex-data/impact_validation_plan.json`.

For override-only changes:

1. Edit the override JSON.
2. Run unit tests and `validate`.
3. Confirm affected pages still derive data from the shared override file.
4. Commit.
5. Run `release-check` from the clean worktree.
6. Push and run `verify-deploy`.

## Current Boundary

This pipeline intentionally focuses on Codex data and export flow only. It does
not refactor the older `project-rogue` script collection, toolkit automation,
runtime logs, packaging, or unrelated game tooling.
