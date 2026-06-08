# Build Planner Compact Redesign Design

## Goal

Redesign the Build Planner into a compact, tooltip-friendly planning surface while preserving the current planner formulas, item data sources, rarity behavior, and compressed share URL behavior.

## Current State

The Build Planner is implemented as a single large HTML file at `pages/General/build-planner.html`. It contains inline CSS, repeated slot markup, a bundled `LZString` implementation, item loading, state encoding/decoding, slot rendering, rarity controls, character controls, summary calculations, and share-link behavior.

Useful existing behavior to preserve:

- Loads weapons, armors, perks, and allowlists from existing Codex data files.
- Searches weapons and armors and assigns the selected item to the proper slot.
- Displays item links back to the Weapons and Armors detail pages.
- Supports rarity tier changes, manually adjusted bonus stats, and extra perks.
- Calculates combined gear stats and character-derived values.
- Encodes the build into the short `b=` URL parameter and supports legacy `build=`.
- Keeps the Share Build action based on the current URL.

Observed problems:

- Desktop first viewport is dominated by empty slot cards; calculated results start below the fold.
- Mobile first viewport is dominated by the sidebar, and planner content begins far below the fold.
- Empty slot cards show rarity, stat, and perk controls before an item is selected.
- Formula details rely on native `title` attributes, which are hard to scan and poor on touch devices.
- The page is difficult to maintain because layout, styling, state, data loading, rendering, and calculations are all inline.

## Selected Approach

Use the "Compact Planner + Extracted Module" approach.

The first implementation pass should:

- Move planner CSS into `css/build-planner.css`.
- Move planner JavaScript into `js/build-planner.js`.
- Keep the current data model, formulas, and URL state encoding stable.
- Redesign the visible planner surface so it is denser and easier to scan.
- Replace always-visible empty-slot controls with contextual controls.
- Add test coverage around extraction, URL state support, and the compact UI contracts.

This approach improves the user-facing planner and makes future formula or workflow changes safer without attempting a full rebuild in one pass.

## Layout Design

The planner page should keep the site's existing dark, compact Codex style.

Top planner toolbar:

- Search input for weapons and armors.
- Share Build button.
- Reset Build button.
- Compact build status text showing selected slot count and base stat allocation state.

Main planner surface:

- A compact gear grid with the same slots: Weapon, Shield, Helmet, Chest, Leggings, Gauntlets, Cosmetic.
- Empty slot tiles should show only slot label, empty placeholder, and a clear affordance that the slot can be filled by search.
- Filled slot tiles should show item image, name, rarity, and key compact stats.
- Slot controls for rarity, bonus stats, and extra perk should appear in a focused selected-slot editor instead of being shown on every slot at all times.

Selected slot editor:

- Shows when a filled slot is selected.
- Includes item name/link, rarity stepper, bonus stat steppers, extra perk select, perk tier select, and clear slot.
- Uses compact rows and tooltips for labels where space is tight.
- Does not duplicate controls across every inactive slot.

Summary area:

- Move high-value calculated outputs closer to the top.
- Use a compact summary strip or dense grid for Armor, DPS, Weight, To Hit, Strength, Constitution, Dexterity, Max Health, Regen, DR, Crit, and Melee Multiplier.
- Keep resistance and perk lists as compact chips.
- Replace native `title` formula details with reusable CSS/JS tooltip pills so formula details are visible on hover/focus and more usable on touch.

Mobile behavior:

- Planner content should be reachable quickly after navigation.
- Gear slots should stack in a compact two-column or single-column grid depending on width.
- Summary and selected-slot editor should collapse into clearly separated compact sections.
- Controls must not overflow or require horizontal scrolling.

## Data And State

Do not change the meaning of the existing build state in this pass.

State requirements:

- Continue reading `b=` first and `build=` second.
- Continue encoding new shared state into `b=`.
- Preserve encoded fields for character values, race, selected slots, item kind, item name, rarity index, extra perk, extra perk tier, and bonus stats.
- Keep selected item links compatible with current item detail URLs.
- Keep formulas unchanged unless a separate later task explicitly audits formula correctness.

## Architecture

Create these page assets:

- `css/build-planner.css`: all planner-specific styles currently inline in `build-planner.html`, plus compact redesign styles.
- `js/build-planner.js`: all planner-specific behavior currently inline in `build-planner.html`.

Keep `pages/General/build-planner.html` responsible for:

- Page metadata.
- Shared site script and stylesheet imports.
- Static planner markup container.
- Loading the extracted planner stylesheet and script.

Inside `js/build-planner.js`, use small named functions grouped by responsibility:

- Data loading and normalization.
- State encode/decode/persistence.
- Slot rendering and slot editor rendering.
- Character input handling.
- Calculation and summary rendering.
- Search suggestions and item assignment.
- Tooltip behavior.

The first pass may keep these functions in one file, but the file should be organized so future extraction into smaller modules is straightforward.

## Testing

Add focused tests under `tests/codex_pipeline/test_site_validation.py` for:

- Build Planner uses external `css/build-planner.css`.
- Build Planner uses external `js/build-planner.js`.
- Build Planner no longer contains a large inline planner script or inline planner stylesheet.
- Planner script still includes support for `b=` and legacy `build=` state params.
- Planner script still supports `compressToEncodedURIComponent` and `decompressFromEncodedURIComponent`.
- Planner script exposes or contains the selected-slot editor contract.
- Planner CSS contains compact slot tile and tooltip styles.

Run existing full verification after implementation:

- `python -m unittest discover -s tests -v`
- `python -m tools.codex_pipeline validate`
- `python -m tools.codex_pipeline smoke-site --smoke-timeout-ms 20000`
- `npm run smoke-site -- --smoke-timeout-ms 20000`
- Browser QA against local Build Planner.

Browser QA should verify:

- Page loads without console errors.
- Search suggestions still appear.
- Selecting a weapon fills the Weapon slot.
- Selecting armor fills the matching armor slot.
- Rarity controls update the selected slot.
- Share URL contains `b=`.
- Reloading the share URL restores the selected build.
- Summary values update after character and gear changes.
- Desktop and mobile layouts do not horizontally overflow.

## Non-Goals

Do not change game formulas in this pass.

Do not replace the site with a framework.

Do not introduce a large dependency for the planner.

Do not redesign unrelated static stats/system pages.

Do not remove legacy `build=` decode support.

Do not create a copy-link icon-only affordance unless the existing Share Build button is preserved or clearly replaced by an accessible equivalent.

## Risks

The highest risk is breaking build share links during extraction. Tests and browser QA must cover encode, decode, persistence, reload, and legacy read behavior.

The second risk is layout regression on mobile because the global sidebar currently dominates the first viewport. The planner redesign should avoid adding more vertical height before useful planner content.

The third risk is formula drift. Implementation should move and organize current logic without changing formulas.
