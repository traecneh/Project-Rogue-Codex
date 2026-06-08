# Build Planner Compact Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the Build Planner into maintainable CSS/JS assets and redesign it into a compact planning surface while preserving formulas and share links.

**Architecture:** Keep the planner as a static site page with plain HTML/CSS/JavaScript. Move planner-specific style and behavior out of `pages/General/build-planner.html` into `css/build-planner.css` and `js/build-planner.js`, then make the visible UI denser by hiding empty-slot controls, adding a quick summary strip, and centralizing active-slot editing.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, existing Codex data JSON, Python unittest validation, local browser QA.

---

## File Structure

- Modify `pages/General/build-planner.html`: remove planner inline style/script, add external asset references, add compact toolbar/status/reset/quick-summary/editor markup.
- Create `css/build-planner.css`: planner-specific extracted styles plus compact tile, active-slot editor, quick-summary, and tooltip styles.
- Create `js/build-planner.js`: extracted planner behavior plus compact UI state, reset action, status updates, quick-summary updates, and active-slot editor behavior.
- Modify `tests/codex_pipeline/test_site_validation.py`: add Build Planner extraction and compact-UI contract tests.

## Task 1: Add Failing Build Planner Validation Tests

**Files:**
- Modify: `tests/codex_pipeline/test_site_validation.py`

- [ ] **Step 1: Add tests for external assets and state contracts**

Add these tests to `SiteValidationTests` after the existing item page tests:

```python
    def test_build_planner_uses_external_assets(self):
        from tools.codex_pipeline.config import REPO_ROOT

        html = (REPO_ROOT / "pages" / "General" / "build-planner.html").read_text(encoding="utf-8")

        self.assertIn('<link rel="stylesheet" href="css/build-planner.css" />', html)
        self.assertIn('<script src="js/build-planner.js" defer></script>', html)
        self.assertNotIn("<style>", html)
        self.assertNotIn("const RARITY_TIERS = [", html)
        self.assertNotIn("var LZString=function()", html)

    def test_build_planner_script_preserves_share_state_contract(self):
        from tools.codex_pipeline.config import REPO_ROOT

        script = (REPO_ROOT / "js" / "build-planner.js").read_text(encoding="utf-8")

        self.assertIn('const SHORT_STATE_PARAM = "b";', script)
        self.assertIn('const LEGACY_STATE_PARAM = "build";', script)
        self.assertIn("compressToEncodedURIComponent", script)
        self.assertIn("decompressFromEncodedURIComponent", script)
        self.assertIn("getBuildParamFromSearch", script)
        self.assertIn("applySavedState", script)

    def test_build_planner_compact_ui_contracts(self):
        from tools.codex_pipeline.config import REPO_ROOT

        html = (REPO_ROOT / "pages" / "General" / "build-planner.html").read_text(encoding="utf-8")
        script = (REPO_ROOT / "js" / "build-planner.js").read_text(encoding="utf-8")
        css = (REPO_ROOT / "css" / "build-planner.css").read_text(encoding="utf-8")

        self.assertIn('id="reset-build"', html)
        self.assertIn('id="planner-status"', html)
        self.assertIn('id="quick-summary"', html)
        self.assertIn('id="slot-editor"', html)
        self.assertIn("const selectSlot", script)
        self.assertIn("const updatePlannerStatus", script)
        self.assertIn("const updateSlotEditor", script)
        self.assertIn("const resetBuild", script)
        self.assertIn(".slot-card:not(.has-item) .slot-rarity", css)
        self.assertIn(".slot-editor", css)
        self.assertIn(".formula-tip", css)
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```powershell
python -m unittest tests.codex_pipeline.test_site_validation.SiteValidationTests.test_build_planner_uses_external_assets tests.codex_pipeline.test_site_validation.SiteValidationTests.test_build_planner_script_preserves_share_state_contract tests.codex_pipeline.test_site_validation.SiteValidationTests.test_build_planner_compact_ui_contracts -v
```

Expected: all three tests fail because the external files and compact UI contracts do not exist yet.

## Task 2: Extract Inline Planner CSS And JavaScript

**Files:**
- Modify: `pages/General/build-planner.html`
- Create: `css/build-planner.css`
- Create: `js/build-planner.js`

- [ ] **Step 1: Move the inline `<style>` content to `css/build-planner.css`**

Create `css/build-planner.css` with the exact current planner CSS from the inline `<style>` block, then remove the inline `<style>` block from `build-planner.html`.

Insert this stylesheet reference after `css/styles.css`:

```html
    <link rel="stylesheet" href="css/styles.css" />
    <link rel="stylesheet" href="css/build-planner.css" />
```

- [ ] **Step 2: Move the inline planner script to `js/build-planner.js`**

Create `js/build-planner.js` with the exact JavaScript currently inside the final inline `<script>` block, excluding the outer `<script>` tags.

Replace the removed inline script with:

```html
    <script src="js/build-planner.js" defer></script>
```

Place it after the existing `js/nav-core.js` import in the page head so planner behavior loads after shared utilities:

```html
    <script src="js/nav-core.js" defer></script>
    <script src="js/build-planner.js" defer></script>
```

- [ ] **Step 3: Verify extraction**

Run:

```powershell
node --check js\build-planner.js
python -m unittest tests.codex_pipeline.test_site_validation.SiteValidationTests.test_build_planner_uses_external_assets tests.codex_pipeline.test_site_validation.SiteValidationTests.test_build_planner_script_preserves_share_state_contract -v
```

Expected: `node --check` passes, and the first two Build Planner tests pass. The compact UI test still fails.

## Task 3: Add Compact Toolbar, Quick Summary, And Slot Editor Markup

**Files:**
- Modify: `pages/General/build-planner.html`
- Modify: `css/build-planner.css`

- [ ] **Step 1: Replace the search row with a compact toolbar**

In `build-planner.html`, replace the current `.search-bar` opening structure with:

```html
          <div class="planner-toolbar" aria-label="Build planner tools">
            <div class="planner-search-wrap">
              <input
                type="text"
                id="gear-search"
                class="search-input"
                placeholder="Search weapons or armors..."
                autocomplete="off"
              />
              <div
                id="gear-suggestions"
                class="search-suggestions"
                role="listbox"
                aria-label="Search suggestions"
                style="display: none"
              ></div>
            </div>
            <button type="button" id="share-build" class="share-button">Share Build</button>
            <button type="button" id="reset-build" class="share-button share-button--secondary">Reset</button>
            <div id="planner-status" class="planner-status" role="status" aria-live="polite">0 / 7 slots selected</div>
          </div>
```

- [ ] **Step 2: Add a quick summary strip above the gear grid**

Insert this immediately after the planner toolbar:

```html
          <section id="quick-summary" class="quick-summary" aria-label="Build summary">
            <div class="quick-summary-card">
              <span class="quick-summary-label">Armor</span>
              <span class="quick-summary-value" data-quick-stat="armor">0</span>
            </div>
            <div class="quick-summary-card">
              <span class="quick-summary-label">DPS</span>
              <span class="quick-summary-value" data-quick-stat="dps">0</span>
            </div>
            <div class="quick-summary-card">
              <span class="quick-summary-label">Weight</span>
              <span class="quick-summary-value" data-quick-stat="weight">0</span>
            </div>
            <div class="quick-summary-card">
              <span class="quick-summary-label">STR</span>
              <span class="quick-summary-value" data-quick-stat="str">0</span>
            </div>
            <div class="quick-summary-card">
              <span class="quick-summary-label">CON</span>
              <span class="quick-summary-value" data-quick-stat="con">0</span>
            </div>
            <div class="quick-summary-card">
              <span class="quick-summary-label">DEX</span>
              <span class="quick-summary-value" data-quick-stat="dex">0</span>
            </div>
            <div class="quick-summary-card">
              <span class="quick-summary-label">HP</span>
              <span class="quick-summary-value" data-quick-stat="health">0</span>
            </div>
            <div class="quick-summary-card">
              <span class="quick-summary-label">DR</span>
              <span class="quick-summary-value" data-quick-stat="dr">0%</span>
            </div>
          </section>
```

- [ ] **Step 3: Wrap gear grid and editor in a planner workspace**

Wrap the existing `.planner-grid` with:

```html
          <div class="planner-workspace">
            <section class="planner-gear-panel" aria-label="Gear slots">
              <div class="planner-grid">
                ...
              </div>
            </section>
            <aside id="slot-editor" class="slot-editor" aria-live="polite">
              <div class="slot-editor-empty">Select a filled slot to edit rarity, bonus stats, and extra perk.</div>
            </aside>
          </div>
```

- [ ] **Step 4: Add compact CSS contracts**

Append these styles to `css/build-planner.css`:

```css
.planner-toolbar {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto auto minmax(140px, auto);
  gap: 0.6rem;
  align-items: center;
  margin: 0 0 0.75rem;
}

.planner-search-wrap {
  position: relative;
  min-width: 0;
}

.planner-status {
  color: var(--text-muted);
  font-size: 0.85rem;
  text-align: right;
}

.share-button--secondary {
  background: var(--bg-panel-dark);
}

.quick-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(82px, 1fr));
  gap: 0.45rem;
  margin: 0 0 0.75rem;
}

.quick-summary-card {
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  background: var(--bg-panel-dark);
  padding: 0.45rem 0.55rem;
  min-width: 0;
}

.quick-summary-label {
  display: block;
  color: var(--text-muted);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.quick-summary-value {
  display: block;
  color: var(--text-main);
  font-weight: 700;
  line-height: 1.2;
}

.planner-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(240px, 300px);
  gap: 0.75rem;
  align-items: start;
}

.planner-gear-panel {
  min-width: 0;
}

.slot-editor {
  position: sticky;
  top: 0.75rem;
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  background: var(--bg-panel);
  padding: 0.75rem;
  min-height: 180px;
}

.slot-editor-empty {
  color: var(--text-muted);
  font-size: 0.9rem;
  line-height: 1.4;
}

.slot-card:not(.has-item) .slot-rarity,
.slot-card:not(.has-item) .slot-stat-adjust,
.slot-card:not(.has-item) .slot-extra-perk {
  display: none;
}

.slot-card {
  min-height: 112px;
  border-radius: 8px;
}

.slot-card.is-selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent), 0 8px 18px rgba(0, 0, 0, 0.35);
}

.formula-tip {
  cursor: help;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 0.2em;
}

@media (max-width: 760px) {
  .planner-toolbar {
    grid-template-columns: 1fr 1fr;
  }

  .planner-search-wrap,
  .planner-status {
    grid-column: 1 / -1;
  }

  .planner-status {
    text-align: left;
  }

  .planner-workspace {
    grid-template-columns: 1fr;
  }

  .slot-editor {
    position: static;
  }
}
```

- [ ] **Step 5: Verify compact contracts pass**

Run:

```powershell
python -m unittest tests.codex_pipeline.test_site_validation.SiteValidationTests.test_build_planner_compact_ui_contracts -v
```

Expected: the test fails only on JavaScript functions not yet added.

## Task 4: Add Compact Planner Behavior

**Files:**
- Modify: `js/build-planner.js`

- [ ] **Step 1: Add selected slot state and quick summary element lookup**

Near `const selectedBySlot = {};`, add:

```js
        let selectedSlotName = "";
        const quickSummaryEls = {
          armor: document.querySelector('[data-quick-stat="armor"]'),
          dps: document.querySelector('[data-quick-stat="dps"]'),
          weight: document.querySelector('[data-quick-stat="weight"]'),
          str: document.querySelector('[data-quick-stat="str"]'),
          con: document.querySelector('[data-quick-stat="con"]'),
          dex: document.querySelector('[data-quick-stat="dex"]'),
          health: document.querySelector('[data-quick-stat="health"]'),
          dr: document.querySelector('[data-quick-stat="dr"]'),
        };
```

- [ ] **Step 2: Add planner status and selected slot editor functions**

After `clearSlot`, add:

```js
        const updatePlannerStatus = () => {
          const status = document.getElementById("planner-status");
          if (!status) return;
          const selectedCount = Object.keys(selectedBySlot).length;
          const level = getCharStat("char-level");
          const baseStatLimit = getBaseStatLimit(level);
          const baseStatSpent =
            Math.max(0, getCharStat("char-str") + getCharStat("char-dex") + getCharStat("char-con") - BASE_STAT_START);
          const remaining = baseStatLimit - baseStatSpent;
          const statText = remaining >= 0 ? `${remaining} stat pts open` : `${Math.abs(remaining)} stat pts over`;
          status.textContent = `${selectedCount} / ${slotEls.size} slots selected · ${statText}`;
        };

        const selectSlot = (slot) => {
          selectedSlotName = slot || "";
          slotEls.forEach((card, cardSlot) => {
            card.classList.toggle("is-selected", Boolean(selectedSlotName && cardSlot === selectedSlotName));
          });
          updateSlotEditor();
        };

        const updateSlotEditor = () => {
          const editor = document.getElementById("slot-editor");
          if (!editor) return;
          const slot = selectedSlotName;
          const data = slot ? selectedBySlot[slot] : null;
          if (!slot || !data) {
            editor.innerHTML = '<div class="slot-editor-empty">Select a filled slot to edit rarity, bonus stats, and extra perk.</div>';
            return;
          }
          const rarity = getRarityTier(data.rarityIndex);
          const cap = getRarityStatCap(data.rarityIndex);
          const used = getBonusStatSum(data);
          editor.innerHTML = `
            <div class="slot-editor-header">
              <div>
                <div class="slot-label">${slot}</div>
                <a class="slot-name slot-item-link" href="${getItemHref(data)}">${data.name || "Unknown"}</a>
              </div>
              <button type="button" class="slot-clear is-visible" data-editor-clear>Clear</button>
            </div>
            <div class="slot-editor-row">
              <span>Rarity</span>
              <div class="slot-editor-controls">
                <button type="button" class="rarity-btn" data-editor-rarity-dec>-</button>
                <strong>${rarity.label}</strong>
                <button type="button" class="rarity-btn" data-editor-rarity-inc>+</button>
              </div>
            </div>
            <div class="slot-editor-row">
              <span>Bonus Stats</span>
              <span>${used} / ${cap}</span>
            </div>
            <div class="slot-editor-stat-grid">
              ${["str", "dex", "con"]
                .map((stat) => {
                  const key = stat === "str" ? "bonusStr" : stat === "dex" ? "bonusDex" : "bonusCon";
                  return `
                    <div class="stat-row" data-editor-stat="${stat}">
                      <button type="button" class="rarity-btn" data-editor-stat-dec>-</button>
                      <span class="stat-value">${toNumber(data[key])}</span>
                      <button type="button" class="rarity-btn" data-editor-stat-inc>+</button>
                      <span class="stat-label">${stat.toUpperCase()}</span>
                    </div>
                  `;
                })
                .join("")}
            </div>
          `;
          editor.querySelector("[data-editor-clear]")?.addEventListener("click", () => clearSlot(slot));
          editor.querySelector("[data-editor-rarity-dec]")?.addEventListener("click", () => adjustRarity(slot, -1));
          editor.querySelector("[data-editor-rarity-inc]")?.addEventListener("click", () => adjustRarity(slot, 1));
          editor.querySelectorAll("[data-editor-stat]").forEach((row) => {
            const stat = row.dataset.editorStat;
            row.querySelector("[data-editor-stat-dec]")?.addEventListener("click", () => adjustStat(slot, stat, -1));
            row.querySelector("[data-editor-stat-inc]")?.addEventListener("click", () => adjustStat(slot, stat, 1));
          });
        };
```

- [ ] **Step 3: Keep status and editor synchronized**

Update these functions:

```js
// At the end of setSlotImage, before schedulePersistState:
selectSlot(slot);
updatePlannerStatus();

// At the end of clearSlot, before schedulePersistState:
if (selectedSlotName === slot) selectSlot("");
updatePlannerStatus();

// At the end of updateSlotRarityUI:
if (selectedSlotName === slot) updateSlotEditor();

// At the end of updateStatAdjustUI:
if (selectedSlotName === slot) updateSlotEditor();
```

Add click selection inside the existing `slotEls.forEach((card, slot) => { ... })` block:

```js
          card.addEventListener("click", (event) => {
            if (event.target.closest("a, button, select")) return;
            if (selectedBySlot[slot]) selectSlot(slot);
          });
```

- [ ] **Step 4: Add reset behavior**

Add:

```js
        const resetBuild = () => {
          Array.from(slotEls.keys()).forEach((slot) => clearSlot(slot));
          ["char-level", "char-str", "char-dex", "char-con", "char-skill"].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.value = id === "char-level" ? "1" : id === "char-skill" ? "0" : "5";
            el.dispatchEvent(new Event("input", { bubbles: true }));
          });
          if (raceSelect) raceSelect.value = "";
          selectSlot("");
          updateTotals();
          persistStateNow();
        };
```

Wire it near the share button listener:

```js
        const resetBtn = document.getElementById("reset-build");
        if (resetBtn) {
          resetBtn.addEventListener("click", resetBuild);
        }
```

- [ ] **Step 5: Update quick summary values inside `updateTotals`**

After setting the existing summary totals and calculated values, add:

```js
          if (quickSummaryEls.armor) quickSummaryEls.armor.textContent = totalArmor;
          if (quickSummaryEls.dps) quickSummaryEls.dps.textContent = totalDps;
          if (quickSummaryEls.weight) quickSummaryEls.weight.textContent = totalWeight;
          if (quickSummaryEls.str) quickSummaryEls.str.textContent = totalStr;
          if (quickSummaryEls.con) quickSummaryEls.con.textContent = totalCon;
          if (quickSummaryEls.dex) quickSummaryEls.dex.textContent = totalDex;
          if (quickSummaryEls.health) quickSummaryEls.health.textContent = maxHealth;
          if (quickSummaryEls.dr) quickSummaryEls.dr.textContent = `${dr.toFixed(2)}%`;
          updatePlannerStatus();
          updateSlotEditor();
```

- [ ] **Step 6: Verify JavaScript contracts**

Run:

```powershell
node --check js\build-planner.js
python -m unittest tests.codex_pipeline.test_site_validation.SiteValidationTests.test_build_planner_compact_ui_contracts -v
```

Expected: both commands pass.

## Task 5: Local Browser QA

**Files:**
- No planned source edits unless QA finds defects.

- [ ] **Step 1: Start a local server**

Run:

```powershell
$port = 8123
$proc = Start-Process -FilePath python -ArgumentList @('-m','http.server',"$port",'--bind','127.0.0.1') -WorkingDirectory 'C:\Users\traec\Desktop\Python\projects\project-rogue-codex\.worktrees\codex-data-pipeline' -WindowStyle Hidden -PassThru
"$($proc.Id),$port" | Set-Content -Path "$env:TEMP\project-rogue-codex-http.pid"
```

- [ ] **Step 2: Browser-check the planner**

Open:

```text
http://127.0.0.1:8123/pages/General/build-planner.html
```

Verify:

- No console errors.
- Search for `Rune Sword`, select it, and Weapon fills.
- Search for `Brown Tunic`, select it, and Chest fills.
- Click filled Weapon slot, then rarity and stat controls update the slot and quick summary.
- Share Build changes/copies a URL containing `?b=`.
- Reloading that URL restores selected items and character values.
- Reset clears selected slots and restores default character values.
- Mobile width has no horizontal overflow.

- [ ] **Step 3: Stop the local server**

Run:

```powershell
if (Test-Path "$env:TEMP\project-rogue-codex-http.pid") {
  $parts = (Get-Content "$env:TEMP\project-rogue-codex-http.pid") -split ','
  Stop-Process -Id $parts[0] -Force -ErrorAction SilentlyContinue
  Remove-Item "$env:TEMP\project-rogue-codex-http.pid" -ErrorAction SilentlyContinue
}
```

## Task 6: Full Verification, Commit, Push, Deploy Check

**Files:**
- Commit all source and test files touched by Tasks 1-4.

- [ ] **Step 1: Run full verification**

Run:

```powershell
python -m unittest discover -s tests -v
python -m tools.codex_pipeline validate
python -m tools.codex_pipeline smoke-site --smoke-timeout-ms 20000
npm run smoke-site -- --smoke-timeout-ms 20000
git diff --check
```

Expected: every command exits `0`.

- [ ] **Step 2: Commit implementation**

Run:

```powershell
git add -- pages/General/build-planner.html css/build-planner.css js/build-planner.js tests/codex_pipeline/test_site_validation.py
git diff --cached --check
git commit -m "Redesign Build Planner layout"
```

- [ ] **Step 3: Push to live branch**

Run:

```powershell
git push origin HEAD:main
```

- [ ] **Step 4: Verify live deployment**

Run:

```powershell
python -m tools.codex_pipeline verify-deploy --deploy-timeout-seconds 480 --poll-seconds 10 --timeout-seconds 30 --smoke-timeout-ms 20000
```

Expected: GitHub Actions and Pages deployment complete successfully, live data/image checks pass, and live smoke checks pass.

---

## Self-Review

Spec coverage:

- External CSS/JS extraction is covered by Tasks 1 and 2.
- Compact toolbar, reset, status, quick summary, and selected-slot editor are covered by Tasks 3 and 4.
- URL state compatibility is covered by Tasks 1, 2, 5, and 6.
- Formula preservation is covered by limiting Task 4 to mirrored quick-summary values and retaining existing calculations.
- Browser QA and deployment verification are covered by Tasks 5 and 6.

Placeholder scan:

- This plan contains no `TBD`, `TODO`, or unspecified implementation steps.

Type consistency:

- Function names used in tests match Task 4 definitions: `selectSlot`, `updatePlannerStatus`, `updateSlotEditor`, `resetBuild`.
- File paths match the approved design.
