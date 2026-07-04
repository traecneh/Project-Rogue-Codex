# Collectables And Useables Pages Design

## Goal

Add first-class Codex pages for the packed `collectables.json` and `useables.json` data from `rogue_data.vpack`.

These pages should sit under the `Items & Enemies` navigation section after `Monsters` and should match the existing visual language of the `Weapons`, `Armors`, and `Monsters` pages.

## Approved Direction

Use two standalone pages:

- `pages/items/collectables.html`
- `pages/items/useables.html`

Both pages should share a compact catalog implementation rather than cloning separate page scripts. The shared implementation should keep the current item-page conventions: search controls, multi-select filters, a table, a top detail panel, pixel-art icons, sortable columns, and deep-linkable details.

## Data Pipeline

Promote `collectables.json` and `useables.json` to configured export targets.

The packed JSON mapper should output site-ready JSON lists beside the existing item data:

- `pages/items/collectables_data.json`
- `pages/items/useables_data.json`

Each record should include:

- `id`
- `name`
- `fields.value`
- `fields.use_type`
- `fields.crafting_material_type`
- `fields.crafting_material_amount`
- `fields.crafting_difficulty`
- `fields.crafting_requirement`
- `fields.emits_light`
- `fields.animated`
- `fields.animation_frame_count`
- `fields.animation_type`
- `fields.frame_1_*` through `fields.frame_9_*`

Records with missing names or `Unused` names should be skipped, matching the packed weapon and armor behavior.

## Images

Both datasets use `itemgraph.json` frame coordinates, so atlas extraction should support these targets:

- `images/collectables`
- `images/useables`

The existing chroma-key transparency behavior should apply to these icons as well.

Each image folder should have its own `manifest.json` so the shared page image loader can resolve icons by item name and preserve existing fallback behavior.

## Page Behavior

Each page should support:

- Search by name, id, use type, value, traits, and material fields.
- Multi-select filtering by use type.
- Multi-select filtering by traits: `Emits Light`, `Animated`, and material/crafting-related fields.
- Click a row to show the detail panel.
- Update the URL when a detail is selected.
- Restore the selected item after browser refresh.
- Clear the URL when the detail panel is closed.

Detail URLs should use ids as the primary route key because the data contains duplicate names:

- `Demonic Remains` appears twice in collectables.
- `Scroll of Imbuement` appears three times in useables.

## Display

The first pass should stay conservative and match the current site styling.

Table columns:

- Image
- Name
- Use Type
- Value
- Traits

Detail panel fields:

- ID
- Value
- Use Type
- Crafting Requirement
- Crafting Material Type
- Crafting Material Amount
- Crafting Difficulty
- Animation Frames
- Animation Type
- Traits

Use badges for traits such as `Emits Light`, `Animated`, and `Crafting Data`.

Use type labels should be conservative. Clearly inferred labels can be shown, but raw numeric ids should remain available in details to avoid overclaiming unknown semantics.

## Navigation And Search

Add `Collectables` and `Useables` to `nav.html` after `Monsters`.

Add base page entries and item-level entries to `js/site-search.js` so site search can find the new pages and individual items.

Use item detail URLs like:

- `pages/items/collectables.html?collectable=24`
- `pages/items/useables.html?useable=10`

## Validation And Testing

Add focused coverage for:

- Packed JSON mapping for collectables and useables.
- Export target resolution.
- Atlas target support for both datasets.
- Site validation for the new HTML, JS, data, image manifests, and nav links.
- Smoke coverage for list load, row click, detail deep link, reload persistence, and close-route clearing.

Run at least:

```powershell
python -m unittest discover -s tests -v
python -m tools.codex_pipeline validate
python -m tools.codex_pipeline smoke-site
git diff --check
```

## Out Of Scope

Do not build a recipe system, drop-source model, or gameplay guide content for these pages in the first pass.

Do not guess unconfirmed use-type semantics beyond conservative display labels and raw numeric ids.

Do not redesign Weapons, Armors, or Monsters as part of this work.
