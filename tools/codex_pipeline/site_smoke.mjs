import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root || path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".."));
const timeoutMs = Number(args.timeoutMs || 20000);
const configuredBaseUrl = args.baseUrl ? normalizeBaseUrl(args.baseUrl) : null;
const RUNE_SWORD_DETAIL_PATH = "pages/items/weapons.html?weapon=Rune%20Sword";
const PERKS_RUNIC_PATH = "/pages/systems/perks.html?perk=Runic";

const smokeSpecs = [
  {
    assertDetail: assertWeaponDetailEnhancements,
    detailName: "Rune Sword",
    detailQuery: "Rune Sword",
    label: "weapons",
    listPath: "/pages/items/weapons.html",
    detailSelector: "#item-details",
    rowSelector: "#items-body tr[data-id]",
    detailLinkSelector: '#details-properties a[href*="pages/enemies/monsters.html?monster="]',
    queryKey: "weapon",
  },
  {
    detailName: "Brown Tunic",
    detailQuery: "Brown Tunic",
    label: "armors",
    listPath: "/pages/items/armors.html",
    detailSelector: "#item-details",
    rowSelector: "#items-body tr[data-id]",
    detailLinkSelector: '#details-properties a[href*="pages/enemies/monsters.html?monster="]',
    queryKey: "armor",
  },
  {
    detailName: "Bat",
    detailQuery: "bat",
    label: "monsters",
    listPath: "/pages/enemies/monsters.html",
    detailSelector: "#monster-details",
    rowSelector: "#monsters-body tr[data-id]",
    detailLinkSelector:
      '#monster-details a[href*="pages/items/weapons.html?weapon="], #monster-details a[href*="pages/items/armors.html?armor="]',
    queryKey: "monster",
  },
];

main().catch((error) => {
  console.error(`SMOKE ERROR site: ${formatError(error)}`);
  process.exit(1);
});

async function main() {
  const { chromium } = await importPlaywright();
  const server = configuredBaseUrl ? null : await startStaticServer(root);
  const baseUrl = configuredBaseUrl || `http://127.0.0.1:${server.port}/`;
  const browser = await launchBrowser(chromium);
  const failures = [];

  try {
    for (const spec of smokeSpecs) {
      try {
        await runSpec(browser, baseUrl, spec);
        console.log(`SMOKE OK ${spec.label}: deep link, reload, row route, close route, detail links`);
      } catch (error) {
        failures.push(`SMOKE ERROR ${spec.label}: ${formatError(error)}`);
      }
    }
    try {
      await runBuildPlannerSpec(browser, baseUrl);
      console.log("SMOKE OK build planner: search, rarity, share reload, reset");
    } catch (error) {
      failures.push(`SMOKE ERROR build planner: ${formatError(error)}`);
    }
    try {
      await runPerksSpec(browser, baseUrl);
      console.log("SMOKE OK perks: deep link, search, filters, source links, tooltips");
    } catch (error) {
      failures.push(`SMOKE ERROR perks: ${formatError(error)}`);
    }
    try {
      await runRaritySpec(browser, baseUrl);
      console.log("SMOKE OK rarity: reference table, deterministic roll, upgrade preview");
    } catch (error) {
      failures.push(`SMOKE ERROR rarity: ${formatError(error)}`);
    }
    try {
      await runRerollSpec(browser, baseUrl);
      console.log("SMOKE OK re-roll: decision reference, flow, related links");
    } catch (error) {
      failures.push(`SMOKE ERROR re-roll: ${formatError(error)}`);
    }
    try {
      await runDeconstructSpec(browser, baseUrl);
      console.log("SMOKE OK deconstruct: shard decision reference, flow, related links");
    } catch (error) {
      failures.push(`SMOKE ERROR deconstruct: ${formatError(error)}`);
    }
    try {
      await runAscendSpec(browser, baseUrl);
      console.log("SMOKE OK ascend: progression reference, decision guidance, related links");
    } catch (error) {
      failures.push(`SMOKE ERROR ascend: ${formatError(error)}`);
    }
    try {
      await runCraftSpec(browser, baseUrl);
      console.log("SMOKE OK craft: ascendancy shop, imbuement crafting, related links");
    } catch (error) {
      failures.push(`SMOKE ERROR craft: ${formatError(error)}`);
    }
    try {
      await runImbuementsSpec(browser, baseUrl);
      console.log("SMOKE OK imbuements: targeting flow, source mechanics, related links");
    } catch (error) {
      failures.push(`SMOKE ERROR imbuements: ${formatError(error)}`);
    }
    try {
      await runPurgeSpec(browser, baseUrl);
      console.log("SMOKE OK purge: cleanup roles, recovery rules, related links");
    } catch (error) {
      failures.push(`SMOKE ERROR purge: ${formatError(error)}`);
    }
    try {
      await runEncounterSpec(browser, baseUrl);
      console.log("SMOKE OK encounter: state flow, elite variants, related links");
    } catch (error) {
      failures.push(`SMOKE ERROR encounter: ${formatError(error)}`);
    }
    try {
      await runPvpSpec(browser, baseUrl);
      console.log("SMOKE OK pvp: rule reference, loot flow, related links");
    } catch (error) {
      failures.push(`SMOKE ERROR pvp: ${formatError(error)}`);
    }
    try {
      await runCorruptionSpec(browser, baseUrl);
      console.log("SMOKE OK corruption: corrupted innates, cleanse flow, related links");
    } catch (error) {
      failures.push(`SMOKE ERROR corruption: ${formatError(error)}`);
    }
    try {
      await runCraftingSpec(browser, baseUrl);
      console.log("SMOKE OK crafting: armor reference, set preview, materials calculator");
    } catch (error) {
      failures.push(`SMOKE ERROR crafting: ${formatError(error)}`);
    }
  } finally {
    await browser.close();
    if (server) await server.close();
  }

  if (failures.length) {
    failures.forEach((failure) => console.error(failure));
    process.exit(1);
  }
  console.log(`SMOKE OK site: ${smokeSpecs.length + 13} page(s) checked at ${baseUrl}`);
}

async function importPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    throw new Error(
      `Playwright is not installed. Run "npm install" before "python -m tools.codex_pipeline smoke-site". ${formatError(error)}`
    );
  }
}

async function launchBrowser(chromium) {
  const attempts = [
    { label: "bundled Chromium", options: {} },
    { label: "Chrome", options: { channel: "chrome" } },
    { label: "Microsoft Edge", options: { channel: "msedge" } },
  ];
  let lastError = null;
  for (const attempt of attempts) {
    try {
      return await chromium.launch({ headless: true, ...attempt.options });
    } catch (error) {
      lastError = `${attempt.label}: ${formatError(error)}`;
    }
  }
  throw new Error(
    `Unable to launch a browser. Run "npx playwright install chromium" or install Chrome/Edge. ${lastError}`
  );
}

async function runSpec(browser, baseUrl, spec) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await openDetail(page, baseUrl, spec);
    await assertDetailState(page, spec, "deep link");
    await assertDetailLinks(page, spec);
    if (typeof spec.assertDetail === "function") {
      await spec.assertDetail(page);
    }

    await page.reload({ waitUntil: "load" });
    await waitForRows(page, spec);
    await assertDetailState(page, spec, "reload");

    await page.goto(joinUrl(baseUrl, spec.listPath), { waitUntil: "load" });
    await waitForRows(page, spec);
    const clickedName = await clickFirstRow(page, spec);
    await page.waitForURL((url) => url.searchParams.has(spec.queryKey), { timeout: timeoutMs });
    await assertDetailVisible(page, spec);
    await assertUrlHasQuery(page, spec.queryKey);
    const routedName = await getDetailName(page);
    if (!routedName || routedName !== clickedName) {
      throw new Error(`row click selected "${routedName}" instead of "${clickedName}"`);
    }

    await page.locator("#details-close").click();
    await page.waitForFunction((queryKey) => !new URL(window.location.href).searchParams.has(queryKey), spec.queryKey);
    const stillVisible = await page.locator(`${spec.detailSelector}.show`).count();
    if (stillVisible) throw new Error("close route left detail panel visible");

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function runBuildPlannerSpec(browser, baseUrl) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await page.goto(joinUrl(baseUrl, "/pages/General/build-planner.html"), { waitUntil: "load" });
    await page.locator("#gear-search").waitFor({ state: "visible" });
    await assertNoBuildPlannerSlotEditor(page);

    await assertBuildPlannerSuggestionLink(page, "Rune Sword");
    await assertBuildPlannerSuggestionDeltas(page, "Rune Sword");
    await assertBuildPlannerIssueIndicators(page);
    await selectBuildPlannerItem(page, "Rune Sword");
    await assertBuildPlannerWeapon(page, "Rune Sword");
    await assertBuildPlannerItemLinks(page, "Rune Sword");
    await assertNumberGreaterThan(page, '[data-quick-stat="dps"]', 0, "quick DPS");
    await assertBuildPlannerSummaryTooltips(page);

    await page.locator('[data-slot="Weapon"] [data-rarity-inc]').click();
    await page.waitForFunction(() => {
      const label = document.querySelector('[data-slot="Weapon"] [data-rarity-label]');
      return label && label.textContent.trim() !== "Common";
    });
    await assertBuildPlannerQuickStatGain(page);

    await page.locator("#share-build").click();
    const sharedUrl = page.url();
    if (!new URL(sharedUrl).searchParams.has("b")) {
      throw new Error("Build Planner URL is missing compressed b state after sharing");
    }

    await page.reload({ waitUntil: "load" });
    await assertBuildPlannerWeapon(page, "Rune Sword");
    const restoredRarity = (await page.locator('[data-slot="Weapon"] [data-rarity-label]').textContent()).trim();
    if (restoredRarity !== "Uncommon") {
      throw new Error(`share reload restored weapon rarity "${restoredRarity}" instead of "Uncommon"`);
    }

    await page.locator("#reset-build").click();
    await page.waitForFunction(() => !document.querySelector(".slot-card.has-item"));
    const selectedCount = await page.locator(".slot-card.has-item").count();
    if (selectedCount) throw new Error(`reset left ${selectedCount} selected slot(s)`);

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function runPerksSpec(browser, baseUrl) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  await page.setViewportSize({ width: 1280, height: 1000 });
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await page.goto(joinUrl(baseUrl, PERKS_RUNIC_PATH), { waitUntil: "load" });
    await page.locator("#perk-search").waitFor({ state: "visible" });
    await page.locator("#perk-speed-context").waitFor({ state: "visible" });
    await page.locator('[data-perk-name="Runic"].perk-selected').waitFor({ state: "visible" });
    await assertPerkSources(page);
    await assertPerkMathTooltip(page);

    await page.locator("#perk-search").fill("lifesteal");
    await page.waitForFunction(() => {
      const lifesteal = document.querySelector('[data-perk-name="Lifesteal"]');
      const runic = document.querySelector('[data-perk-name="Runic"]');
      return lifesteal && !lifesteal.classList.contains("perk-card-hidden") && runic?.classList.contains("perk-card-hidden");
    });

    await page.locator("#perk-clear").click();
    await page.locator("#perk-type-filter").selectOption("unique");
    await page.waitForFunction(() => {
      const unique = document.querySelector('[data-perk-name="Blood Siphon"]');
      const standard = document.querySelector('[data-perk-name="Beastslayer"]');
      return unique && !unique.classList.contains("perk-card-hidden") && standard?.classList.contains("perk-card-hidden");
    });

    await page.locator("#perk-type-filter").selectOption("");
    await page.locator("#perk-group-filter").selectOption("Resistances");
    await page.waitForFunction(() => {
      const resist = document.querySelector('[data-perk-name="Demon Blood"]');
      const sustain = document.querySelector('[data-perk-name="Lifesteal"]');
      return resist && !resist.classList.contains("perk-card-hidden") && sustain?.classList.contains("perk-card-hidden");
    });

    await page.locator("#perk-clear").click();
    await page.locator("#perk-jump").selectOption("Runic");
    await page.locator('[data-perk-name="Runic"].perk-selected').waitFor({ state: "visible" });
    if (!new URL(page.url()).searchParams.has("perk")) {
      throw new Error("Perks page did not write selected perk query state");
    }
    await page.locator('[data-perk-name="Runic"]').click();
    await page.waitForFunction(() => {
      const runic = document.querySelector('[data-perk-name="Runic"]');
      const jump = document.querySelector("#perk-jump");
      const params = new URL(window.location.href).searchParams;
      return runic && !runic.classList.contains("perk-selected") && jump?.value === "" && !params.has("perk");
    });

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function runRaritySpec(browser, baseUrl) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await page.goto(joinUrl(baseUrl, "/pages/systems/rarity.html"), { waitUntil: "load" });
    await page.locator(".rarity-reference-table").waitFor({ state: "visible" });
    const referenceText = (await page.locator(".rarity-reference-table").textContent()).trim();
    for (const expected of ["Common", "Ascendant", "Bonus Stats", "Perk Chance", "Item Power", "x12"]) {
      if (!referenceText.includes(expected)) {
        throw new Error(`Rarity reference table missing "${expected}": "${referenceText}"`);
      }
    }
    if (referenceText.includes("Normal")) {
      throw new Error(`Rarity reference table still used Normal terminology: "${referenceText}"`);
    }

    const upgradeButton = page.locator("[data-rarity-upgrade]");
    if (!(await upgradeButton.isDisabled())) {
      throw new Error("Rarity upgrade button should be disabled before the first roll");
    }

    await page.evaluate(() => {
      const values = [0.01, 0.99, 0.5, 0.25, 0.75, 0.4, 0.6, 0.3, 0.7];
      let index = 0;
      Math.random = () => values[index++] ?? 0.5;
    });
    await page.locator("[data-rarity-roll]").click();
    await page.waitForFunction(() => document.querySelector("[data-rarity-result]")?.textContent?.includes("Common"));
    const rolledText = (await page.locator("[data-rarity-result]").textContent()).trim();
    for (const expected of ["Rarity", "Common", "Max Rarity", "Ascendant", "Bonus stats", "Item Power", "x1", "Split"]) {
      if (!rolledText.includes(expected)) {
        throw new Error(`Rarity roll result missing "${expected}": "${rolledText}"`);
      }
    }
    if (await upgradeButton.isDisabled()) {
      throw new Error(`Rarity upgrade button stayed disabled after Common roll with Ascendant max: "${rolledText}"`);
    }

    await upgradeButton.click();
    await page.waitForFunction(() => document.querySelector("[data-rarity-result]")?.textContent?.includes("Uncommon"));
    const upgradedText = (await page.locator("[data-rarity-result]").textContent()).trim();
    for (const expected of ["Rarity", "Uncommon", "Max Rarity", "Ascendant", "Item Power", "x2"]) {
      if (!upgradedText.includes(expected)) {
        throw new Error(`Rarity upgrade result missing "${expected}": "${upgradedText}"`);
      }
    }

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function runRerollSpec(browser, baseUrl) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await page.goto(joinUrl(baseUrl, "/pages/systems/re-roll.html"), { waitUntil: "load" });
    await page.locator(".reroll-compare-grid").waitFor({ state: "visible" });
    const pageText = (await page.locator("#reroll-basics").textContent()).trim();
    for (const expected of [
      "What Changes",
      "What Does Not Change",
      "Re-Roll Flow",
      "Before You Roll",
      "When Re-Roll Helps",
      "Reroll Shards",
      "Reroll Stone",
      "Current Rarity",
      "Max Rarity",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Re-Roll page missing "${expected}": "${pageText}"`);
      }
    }

    for (const href of [
      "pages/systems/rarity.html",
      "pages/items/weapons.html",
      "pages/items/armors.html",
      "pages/systems/deconstruct.html",
      "pages/systems/crafting.html",
    ]) {
      const count = await page.locator(`.reroll-link-grid a[href="${href}"]`).count();
      if (count !== 1) {
        throw new Error(`Re-Roll related link expected one "${href}", found ${count}`);
      }
    }

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function runDeconstructSpec(browser, baseUrl) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await page.goto(joinUrl(baseUrl, "/pages/systems/deconstruct.html"), { waitUntil: "load" });
    await page.locator(".deconstruct-decision-grid").waitFor({ state: "visible" });
    const pageText = (await page.locator("#deconstruct-basics").textContent()).trim();
    for (const expected of [
      "What Deconstruct Returns",
      "What Affects Value",
      "Deconstruct Flow",
      "Deconstruct or Keep",
      "Bulk Safety",
      "Dirty Loot",
      "Half Value",
      "No Takebacks",
      "Ascendency Shards",
      "T1 Imbuements",
      "25 Tattered Imbuements",
      "Deconstruct All",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Deconstruct page missing "${expected}": "${pageText}"`);
      }
    }

    for (const href of [
      "pages/items/weapons.html",
      "pages/items/armors.html",
      "pages/systems/re-roll.html",
      "pages/systems/ascend.html",
      "pages/systems/craft.html",
      "pages/systems/rarity.html",
    ]) {
      const count = await page.locator(`.deconstruct-link-grid a[href="${href}"]`).count();
      if (count !== 1) {
        throw new Error(`Deconstruct related link expected one "${href}", found ${count}`);
      }
    }

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function runAscendSpec(browser, baseUrl) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await page.goto(joinUrl(baseUrl, "/pages/systems/ascend.html"), { waitUntil: "load" });
    await page.locator(".ascend-compare-grid").waitFor({ state: "visible" });
    const pageText = (await page.locator("#ascend-basics").textContent()).trim();
    for (const expected of [
      "What Ascend Uses",
      "What Changes",
      "What Stays Fixed",
      "Ascend Flow",
      "Ascend or Save",
      "Current Rarity",
      "Max Rarity",
      "Promotion Cost",
      "Ascendency Shards",
      "One Tier",
      "Item Ceiling",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Ascend page missing "${expected}": "${pageText}"`);
      }
    }

    for (const href of [
      "pages/items/weapons.html",
      "pages/items/armors.html",
      "pages/systems/deconstruct.html",
      "pages/systems/rarity.html",
      "pages/systems/re-roll.html",
      "pages/General/build-planner.html",
    ]) {
      const count = await page.locator(`.ascend-link-grid a[href="${href}"]`).count();
      if (count !== 1) {
        throw new Error(`Ascend related link expected one "${href}", found ${count}`);
      }
    }

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function runCraftSpec(browser, baseUrl) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await page.goto(joinUrl(baseUrl, "/pages/systems/craft.html"), { waitUntil: "load" });
    await page.locator(".craft-shop-grid").waitFor({ state: "visible" });
    const pageText = (await page.locator("#craft-basics").textContent()).trim();
    for (const expected of [
      "Craft Menu Role",
      "Ethereal Shard Purchases",
      "Scrolls of Imbuement",
      "Craft vs Crafting",
      "Ethereal Shards",
      "Augment Orb",
      "Race Change Scroll",
      "250 Tattered Imbuements",
      "25 Tattered Imbuements",
      "Epic+ Only",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Craft page missing "${expected}": "${pageText}"`);
      }
    }

    for (const href of [
      "pages/systems/crafting.html",
      "pages/systems/imbuements.html",
      "pages/systems/deconstruct.html",
      "pages/systems/purge.html",
      "pages/systems/rarity.html",
      "pages/systems/ascend.html",
    ]) {
      const count = await page.locator(`.craft-link-grid a[href="${href}"]`).count();
      if (count !== 1) {
        throw new Error(`Craft related link expected one "${href}", found ${count}`);
      }
    }

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function runImbuementsSpec(browser, baseUrl) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await page.goto(joinUrl(baseUrl, "/pages/systems/imbuements.html"), { waitUntil: "load" });
    await page.locator(".imbuement-flow").waitFor({ state: "visible" });
    const pageText = (await page.locator("#imbuement-basics").textContent()).trim();
    for (const expected of [
      "Targeted Perk Path",
      "Imbuement Flow",
      "Source Mechanics",
      "Tier Roll Odds",
      "Targeting Decisions",
      "Tattered Imbuement",
      "Scroll of Imbuement",
      "250 Matching Tatters",
      "25 Tattered Imbuements",
      "Epic+ Item",
      "Uncommon Tatter",
      "Rare Tatter",
      "Level Scaling",
      "80% T1",
      "15% T2",
      "5% T3",
      "Hell Spawn",
      "Bloodthirster",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Imbuements page missing "${expected}": "${pageText}"`);
      }
    }

    for (const href of [
      "pages/systems/perks.html?perk=Bloodthirster",
      "pages/enemies/monsters.html?monster=hell-spawn",
      "pages/enemies/monsters.html?monster=werewolf",
    ]) {
      const count = await page.locator(`.imbuement-example-grid a[href="${href}"]`).count();
      if (count !== 1) {
        throw new Error(`Imbuements example link expected one "${href}", found ${count}`);
      }
    }

    for (const href of [
      "pages/systems/perks.html",
      "pages/enemies/monsters.html",
      "pages/systems/craft.html",
      "pages/systems/purge.html",
      "pages/items/weapons.html",
      "pages/items/armors.html",
    ]) {
      const count = await page.locator(`.imbuement-link-grid a[href="${href}"]`).count();
      if (count !== 1) {
        throw new Error(`Imbuements related link expected one "${href}", found ${count}`);
      }
    }

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function runPurgeSpec(browser, baseUrl) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await page.goto(joinUrl(baseUrl, "/pages/systems/purge.html"), { waitUntil: "load" });
    await page.locator(".purge-compare-grid").waitFor({ state: "visible" });
    const pageText = (await page.locator("#purge-basics").textContent()).trim();
    for (const expected of [
      "Cleanup Roles",
      "Purge or Cleanse",
      "What Purge Removes",
      "What Cleanse Removes",
      "Recovery Rules",
      "Cleanup Flow",
      "Before You Confirm",
      "Special Effect",
      "Corrupted Innate",
      "25 Tattered Imbuements",
      "No Tier Refund",
      "No Item Reset",
      "Epic+ Item",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Purge page missing "${expected}": "${pageText}"`);
      }
    }

    for (const href of [
      "pages/systems/imbuements.html",
      "pages/systems/corruption.html",
      "pages/systems/craft.html",
      "pages/systems/deconstruct.html",
      "pages/items/weapons.html",
      "pages/items/armors.html",
    ]) {
      const count = await page.locator(`.purge-link-grid a[href="${href}"]`).count();
      if (count !== 1) {
        throw new Error(`Purge related link expected one "${href}", found ${count}`);
      }
    }

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function runEncounterSpec(browser, baseUrl) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await page.goto(joinUrl(baseUrl, "/pages/systems/encounter.html"), { waitUntil: "load" });
    await page.locator(".encounter-variant-grid").waitFor({ state: "visible" });
    const pageText = (await page.locator("#encounter-basics").textContent()).trim();
    for (const expected of [
      "Encounter Flow",
      "Active vs Passive",
      "Escalation Flow",
      "Variant Rules",
      "Despawns and Leashes",
      "Prolonged Activity",
      "10 chunks (160 tiles)",
      "4+ minutes Passive",
      "1 minute of continuous Active time",
      "6-minute grace window",
      "Purple Lightning",
      "Green Lightning",
      "Yellow Lightning",
      "1 in 33",
      "1 in 66",
      "1 in 100",
      "Night only",
      "Corrupts loot",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Encounter page missing "${expected}": "${pageText}"`);
      }
    }

    for (const src of ["images/elite.gif", "images/corrupted.gif", "images/elite+.gif"]) {
      const count = await page.locator(`.encounter-variant-grid img[src="${src}"]`).count();
      if (count !== 1) {
        throw new Error(`Encounter variant image expected one "${src}", found ${count}`);
      }
    }

    for (const href of [
      "pages/systems/corruption.html",
      "pages/enemies/monsters.html",
      "pages/items/weapons.html",
      "pages/items/armors.html",
      "pages/systems/rarity.html",
      "pages/General/play-the-game.html",
    ]) {
      const count = await page.locator(`.encounter-link-grid a[href="${href}"]`).count();
      if (count !== 1) {
        throw new Error(`Encounter related link expected one "${href}", found ${count}`);
      }
    }

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function runPvpSpec(browser, baseUrl) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await page.goto(joinUrl(baseUrl, "/pages/systems/pvp-system.html"), { waitUntil: "load" });
    await page.locator(".pvp-flow").waitFor({ state: "visible" });
    const pageText = (await page.locator("#pvp-basics").textContent()).trim();
    for (const expected of [
      "PVP at a Glance",
      "Safe Zones and Flagging",
      "Death and Loot Flow",
      "Criminal Consequences",
      "Tracking and Community",
      "Safe Zone Dove",
      "Open Combat",
      "Body Timers",
      "4 minutes",
      "10 minutes",
      "Looted Item Flag",
      "Clean Ground Drop",
      "Criminal Status",
      "5 minutes out of sight",
      "2 counts",
      "1 count",
      "50+ Counts",
      "criminal gate",
      "global-chat",
      "kill-feed",
      "leaderboard-levels",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`PVP page missing "${expected}": "${pageText}"`);
      }
    }

    for (const href of [
      "pages/systems/anti-zerg.html",
      "pages/systems/guild.html",
      "pages/items/weapons.html",
      "pages/items/armors.html",
      "pages/enemies/monsters.html",
      "pages/General/play-the-game.html",
    ]) {
      const count = await page.locator(`.pvp-link-grid a[href="${href}"]`).count();
      if (count !== 1) {
        throw new Error(`PVP related link expected one "${href}", found ${count}`);
      }
    }

    await assertMobilePageFirstNavigation(page, baseUrl, "/pages/systems/pvp-system.html");

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function runCorruptionSpec(browser, baseUrl) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await page.goto(joinUrl(baseUrl, "/pages/systems/corruption.html"), { waitUntil: "load" });
    await page.locator(".corruption-compare-grid").waitFor({ state: "visible" });
    const pageText = (await page.locator("#corruption-basics").textContent()).trim();
    for (const expected of [
      "Corruption Roles",
      "Corrupted Innate",
      "Hard Bosses",
      "Cleanse with Purge",
      "What Corruption Changes",
      "Cleanse Flow",
      "Before You Cleanse",
      "No Item Reset",
      "Purge Tool",
      "Epidemic T3",
      "Crimson Feast T1",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Corruption page missing "${expected}": "${pageText}"`);
      }
    }

    const exampleCount = await page.locator('.corruption-example-card[href="pages/items/weapons.html?weapon=Dark%20Sword"]').count();
    if (exampleCount !== 1) {
      throw new Error(`Corruption example link expected one Dark Sword link, found ${exampleCount}`);
    }

    for (const href of [
      "pages/systems/purge.html",
      "pages/systems/imbuements.html",
      "pages/systems/rarity.html",
      "pages/systems/re-roll.html",
      "pages/items/weapons.html",
      "pages/items/armors.html",
    ]) {
      const count = await page.locator(`.corruption-link-grid a[href="${href}"]`).count();
      if (count !== 1) {
        throw new Error(`Corruption related link expected one "${href}", found ${count}`);
      }
    }

    await assertMobilePageFirstNavigation(page, baseUrl, "/pages/systems/corruption.html");

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function assertMobilePageFirstNavigation(page, baseUrl, pathName) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(joinUrl(baseUrl, pathName), { waitUntil: "load" });
  await page.locator(".content-title").waitFor({ state: "visible" });
  await page.locator(".sidebar").waitFor({ state: "attached" });

  const collapsedMetrics = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const title = document.querySelector(".content-title")?.getBoundingClientRect();
    const sidebar = document.querySelector(".sidebar");
    return {
      horizontalOverflow: Math.max(root.scrollWidth, body.scrollWidth) > root.clientWidth + 1,
      sidebarCollapsed: Boolean(sidebar?.classList.contains("collapsed")),
      titleTop: title?.top ?? null,
      viewportHeight: root.clientHeight,
    };
  });
  if (!collapsedMetrics.sidebarCollapsed) {
    throw new Error(`Mobile navigation should start collapsed so page content is first: ${JSON.stringify(collapsedMetrics)}`);
  }
  if (collapsedMetrics.titleTop === null || collapsedMetrics.titleTop < 0 || collapsedMetrics.titleTop > 180) {
    throw new Error(`Mobile page title should be in the first viewport: ${JSON.stringify(collapsedMetrics)}`);
  }
  if (collapsedMetrics.horizontalOverflow) {
    throw new Error(`Mobile layout has horizontal overflow: ${JSON.stringify(collapsedMetrics)}`);
  }

  const toggle = page.locator("[data-collapse-toggle]");
  const toggleCount = await toggle.count();
  if (toggleCount !== 1) {
    throw new Error(`Mobile navigation toggle expected one control, found ${toggleCount}`);
  }
  await toggle.click();
  await page.waitForFunction(() => !document.querySelector(".sidebar")?.classList.contains("collapsed"));
  const expandedMetrics = await page.evaluate(() => {
    const search = document.querySelector(".nav-search-input")?.getBoundingClientRect();
    const sidebar = document.querySelector(".sidebar")?.getBoundingClientRect();
    return {
      searchTop: search?.top ?? null,
      sidebarTop: sidebar?.top ?? null,
      sidebarHeight: sidebar?.height ?? null,
      sidebarCollapsed: Boolean(document.querySelector(".sidebar")?.classList.contains("collapsed")),
    };
  });
  if (expandedMetrics.sidebarCollapsed || expandedMetrics.searchTop === null || expandedMetrics.searchTop > 360) {
    throw new Error(`Mobile navigation did not expand into reachable view: ${JSON.stringify(expandedMetrics)}`);
  }

  await toggle.click();
  await page.waitForFunction(() => document.querySelector(".sidebar")?.classList.contains("collapsed"));
  const recollapsedMetrics = await page.evaluate(() => {
    const title = document.querySelector(".content-title")?.getBoundingClientRect();
    return {
      sidebarCollapsed: Boolean(document.querySelector(".sidebar")?.classList.contains("collapsed")),
      titleTop: title?.top ?? null,
    };
  });
  if (!recollapsedMetrics.sidebarCollapsed || recollapsedMetrics.titleTop === null || recollapsedMetrics.titleTop > 180) {
    throw new Error(`Mobile navigation did not return to page-first layout: ${JSON.stringify(recollapsedMetrics)}`);
  }
}

async function runCraftingSpec(browser, baseUrl) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await page.goto(joinUrl(baseUrl, "/pages/systems/crafting.html"), { waitUntil: "load" });
    await page.locator(".crafting-cost-grid").waitFor({ state: "visible" });
    const pageText = (await page.locator("#crafting-basics").textContent()).trim();
    for (const expected of [
      "Armor Crafting Scope",
      "Frost vs Dragon Materials",
      "Material Costs",
      "Crafting Flow",
      "Materials Calculator",
      "Set Preview",
      "Ice Crystals",
      "Dragon Scales",
      "Hammer & Anvil",
      "100% Success",
      "Random Rarity",
      "Full Suit",
      "455",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Crafting page missing "${expected}": "${pageText}"`);
      }
    }

    await page.locator('[data-set-option="black"]').click();
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll("[data-slot-preview]")).every((img) => img.alt.includes("Black Dragon"))
    );
    const blackHelmSrc = await page.locator('[data-slot-preview][data-slot="helm"]').getAttribute("src");
    if (!blackHelmSrc || !blackHelmSrc.includes("Black%20Dragon%20Helmet")) {
      throw new Error(`Crafting set preview did not swap to Black Dragon helm: "${blackHelmSrc}"`);
    }

    await page.locator("[data-materials-range]").evaluate((slider) => {
      slider.value = "100";
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.locator('[data-slot="plate"] [data-qty-plus]').click();
    await page.waitForFunction(() => document.querySelector("[data-material-summary]")?.textContent?.includes("Need 58 more"));
    const summaryText = (await page.locator("[data-material-summary]").textContent()).trim();
    if (!summaryText.includes("Need 58 more") || !summaryText.includes("1 Plate")) {
      throw new Error(`Crafting calculator summary was unexpected: "${summaryText}"`);
    }
    await page.locator('[data-slot="plate"] [data-qty-minus]').click();
    await page.waitForFunction(
      () => document.querySelector("[data-material-summary]")?.textContent?.trim() === "Select at least one slot to see totals."
    );

    for (const href of [
      "pages/systems/craft.html",
      "pages/items/armors.html",
      "pages/systems/rarity.html",
      "pages/systems/deconstruct.html",
      "pages/General/build-planner.html",
    ]) {
      const count = await page.locator(`.crafting-link-grid a[href="${href}"]`).count();
      if (count !== 1) {
        throw new Error(`Crafting related link expected one "${href}", found ${count}`);
      }
    }

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function selectBuildPlannerItem(page, itemName) {
  await page.locator("#gear-search").fill(itemName);
  const suggestion = page.locator("#gear-suggestions .suggestion").filter({ hasText: itemName }).first();
  await suggestion.waitFor({ state: "visible" });
  await suggestion.locator(".suggestion-meta").click();
}

async function assertBuildPlannerWeapon(page, expectedName) {
  await page.waitForFunction(
    (name) => {
      const card = document.querySelector('[data-slot="Weapon"]');
      const actualName = card?.querySelector("[data-slot-item]")?.textContent?.trim();
      return card?.classList.contains("has-item") && actualName === name;
    },
    expectedName,
    { timeout: timeoutMs }
  );
  const actualName = (await page.locator('[data-slot="Weapon"] [data-slot-item]').textContent()).trim();
  if (actualName !== expectedName) {
    throw new Error(`Build Planner weapon slot selected "${actualName}" instead of "${expectedName}"`);
  }
}

async function assertNoBuildPlannerSlotEditor(page) {
  const editorCount = await page.locator("#slot-editor").count();
  if (editorCount) throw new Error("Build Planner rendered the removed selected-slot editor");
}

async function assertBuildPlannerSuggestionLink(page, itemName) {
  await page.locator("#gear-search").fill(itemName);
  const suggestionLink = page.locator("#gear-suggestions .suggestion-link").filter({ hasText: itemName }).first();
  await suggestionLink.waitFor({ state: "visible" });
  const href = await suggestionLink.getAttribute("href");
  if (href !== RUNE_SWORD_DETAIL_PATH) {
    throw new Error(`Build Planner suggestion link expected ${RUNE_SWORD_DETAIL_PATH}, got "${href}"`);
  }
}

async function assertBuildPlannerSuggestionDeltas(page, itemName) {
  const suggestion = page.locator("#gear-suggestions .suggestion").filter({ hasText: itemName }).first();
  const deltaRow = suggestion.locator(".suggestion-deltas");
  await deltaRow.waitFor({ state: "visible" });
  const text = (await deltaRow.textContent()).trim();
  if (!text.includes("DPS") || !text.includes("+")) {
    throw new Error(`Build Planner suggestion deltas did not show positive DPS, got "${text}"`);
  }
  const direction = await deltaRow.locator("[data-delta-direction]").first().getAttribute("data-delta-direction");
  if (!["up", "down"].includes(direction)) {
    throw new Error(`Build Planner suggestion delta direction was "${direction}"`);
  }
}

async function assertBuildPlannerItemLinks(page, expectedName) {
  const link = page.locator('[data-slot="Weapon"] [data-slot-item]');
  const href = await link.getAttribute("href");
  const text = (await link.textContent()).trim();
  if (text !== expectedName) {
    throw new Error(`Build Planner selected item link text expected "${expectedName}", got "${text}"`);
  }
  if (href !== RUNE_SWORD_DETAIL_PATH) {
    throw new Error(`Build Planner selected item link expected ${RUNE_SWORD_DETAIL_PATH}, got "${href}"`);
  }
}

async function assertBuildPlannerSummaryTooltips(page) {
  await page.locator("#build-details").waitFor({ state: "visible" });
  const duplicateCount = await page.locator("#calc-dr, #calc-max-health, #sum-armor, #sum-weight, #sum-dps, #sum-str, #sum-con, #sum-dex").count();
  if (duplicateCount) {
    throw new Error(`Build Planner rendered ${duplicateCount} duplicate summary value(s) below the top strip`);
  }
  const detailsText = (await page.locator("#build-details").textContent()).trim();
  if (!detailsText.includes("Build Details") || !detailsText.includes("Health Regen") || !detailsText.includes("Element")) {
    throw new Error(`Build Planner details section was incomplete: "${detailsText}"`);
  }
  const armorTitle = await page.locator('[data-quick-stat="armor"]').evaluate((node) =>
    node.closest(".quick-summary-card")?.getAttribute("title") || node.getAttribute("title") || ""
  );
  if (!armorTitle.includes("Base armor") || !armorTitle.includes("Rarity bonus")) {
    throw new Error(`Build Planner quick Armor tooltip missing breakdown: "${armorTitle}"`);
  }
  const regenTitle = await page.locator("#calc-regen").evaluate((node) =>
    node.closest(".summary-card")?.getAttribute("title") || node.getAttribute("title") || ""
  );
  if (!regenTitle.includes("Total Constitution")) {
    throw new Error(`Build Planner Health Regen tooltip missing breakdown: "${regenTitle}"`);
  }
}

async function assertBuildPlannerIssueIndicators(page) {
  await page.locator("#build-issues").waitFor({ state: "visible" });
  const initialText = (await page.locator("#build-issues").textContent()).trim();
  if (!initialText.includes("Missing 6 core slots")) {
    throw new Error(`Build Planner issue strip did not report missing core slots: "${initialText}"`);
  }
  const missingLevel = await page.locator('[data-build-issue="missing-slots"]').getAttribute("data-issue-level");
  if (missingLevel !== "warning") {
    throw new Error(`Build Planner missing-slots issue level expected warning, got "${missingLevel}"`);
  }

  await selectBuildPlannerItem(page, "Dark Sword");
  await assertBuildPlannerWeapon(page, "Dark Sword");
  await page.waitForFunction(() => document.querySelector("#build-issues")?.textContent?.includes("unmet req"));
  const requirementChip = page.locator('[data-build-issue="requirements"]');
  await requirementChip.waitFor({ state: "visible" });
  const requirementLevel = await requirementChip.getAttribute("data-issue-level");
  if (requirementLevel !== "error") {
    throw new Error(`Build Planner requirements issue level expected error, got "${requirementLevel}"`);
  }
  const requirementTitle = (await requirementChip.getAttribute("title")) || "";
  if (!requirementTitle.includes("Dark Sword") || !requirementTitle.includes("Skill") || !requirementTitle.includes("Level")) {
    throw new Error(`Build Planner requirement issue did not include Dark Sword skill/level details: "${requirementTitle}"`);
  }
}

async function assertPerkSources(page) {
  const sourceText = (await page.locator('[data-perk-name="Runic"] .perk-source-list').textContent()).trim();
  if (!sourceText.includes("Weapon: Rune Sword") || !sourceText.includes("Armor: Scabbard of Arcus")) {
    throw new Error(`Runic perk source list missing expected item links: "${sourceText}"`);
  }
  const weaponHref = await page
    .locator('[data-perk-name="Runic"] .perk-source-chip[href*="weapons.html?weapon=Rune%20Sword"]')
    .getAttribute("href");
  if (!weaponHref) {
    throw new Error("Runic perk source list missing Rune Sword detail link");
  }
}

async function assertPerkMathTooltip(page) {
  const bloodlust = page.locator('[data-perk-name="Bloodlust"]');
  await bloodlust.scrollIntoViewIfNeeded();
  const trigger = bloodlust.locator(".perk-math-trigger");
  await trigger.hover();
  const initialText = (await bloodlust.locator(".perk-math-tooltip").textContent()).trim();
  for (const expected of ["Stack examples", "1x T1", "3x T3", "15% trigger chance", "9 procs/min"]) {
    if (!initialText.includes(expected)) {
      throw new Error(`Bloodlust tooltip missing "${expected}": "${initialText}"`);
    }
  }
  const separatorCount = await bloodlust.locator(".perk-math-separator").count();
  if (separatorCount < 3) {
    throw new Error(`Bloodlust tooltip expected at least 3 separators, found ${separatorCount}`);
  }
  const scenarioLabels = await bloodlust.locator(".perk-math-scenario").allTextContents();
  for (const expected of ["1x T1:", "3x T1:", "3x T2:", "3x T3:"]) {
    if (!scenarioLabels.includes(expected)) {
      throw new Error(`Bloodlust tooltip missing scenario label "${expected}": ${scenarioLabels.join(", ")}`);
    }
  }
  const titleAlign = await bloodlust
    .locator(".perk-math-title")
    .evaluate((element) => window.getComputedStyle(element).textAlign);
  if (titleAlign !== "center") {
    throw new Error(`Bloodlust tooltip title should be centered, got "${titleAlign}"`);
  }
  await assertTooltipCoversOverlappingTriggers(page, bloodlust);

  await page.locator("#perk-speed-context").selectOption("1500");
  await trigger.hover();
  const slowerText = (await bloodlust.locator(".perk-math-tooltip").textContent()).trim();
  if (!slowerText.includes("1500ms") || !slowerText.includes("6 procs/min")) {
    throw new Error(`Bloodlust tooltip did not update for slower weapon speed: "${slowerText}"`);
  }

  const demonBloodText = (await page.locator('[data-perk-name="Demon Blood"] .perk-math-tooltip').textContent()).trim();
  for (const expected of ["Fire resistance", "1x T1: +8%", "3x T3: +36%"]) {
    if (!demonBloodText.includes(expected)) {
      throw new Error(`Demon Blood tooltip missing "${expected}": "${demonBloodText}"`);
    }
  }

  await assertDamageReductionExample(page, "Juggernaut", [
    "Example: 1,000 incoming damage",
    "1x T1: 750 damage taken",
    "3x T1: 1 proc 750, 2 procs 562.5, 3 procs 421.88 damage taken",
    "3x T2: 1 proc 700, 2 procs 490, 3 procs 343 damage taken",
    "3x T3: 1 proc 650, 2 procs 422.5, 3 procs 274.63 damage taken",
  ]);
  await assertDamageReductionExample(page, "Parry", [
    "Example: 1,000 incoming damage",
    "1x T1: 300 damage taken",
    "3x T1: 1 proc 300, 2 procs 90, 3 procs 27 damage taken",
    "3x T2: 1 proc 200, 2 procs 40, 3 procs 8 damage taken",
    "3x T3: 1 proc 100, 2 procs 10, 3 procs 1 damage taken",
  ]);
  await assertIndependentProcExample(page, "Bloodthirster", [
    "Independent copies roll separately",
    "3x T1: independent rolls; 1 proc 4%, 2 procs 8%, 3 procs 12% max health heal",
    "3x T3: independent rolls; 1 proc 8%, 2 procs 16%, 3 procs 24% max health heal",
  ]);
}

async function assertDamageReductionExample(page, perkName, expectedLines) {
  const tooltipText = (await page.locator(`[data-perk-name="${perkName}"] .perk-math-tooltip`).textContent()).trim();
  for (const expected of expectedLines) {
    if (!tooltipText.includes(expected)) {
      throw new Error(`${perkName} tooltip missing damage example "${expected}": "${tooltipText}"`);
    }
  }
}

async function assertIndependentProcExample(page, perkName, expectedLines) {
  const tooltipText = (await page.locator(`[data-perk-name="${perkName}"] .perk-math-tooltip`).textContent()).trim();
  for (const expected of expectedLines) {
    if (!tooltipText.includes(expected)) {
      throw new Error(`${perkName} tooltip missing independent proc example "${expected}": "${tooltipText}"`);
    }
  }
}

async function assertTooltipCoversOverlappingTriggers(page, activeCard) {
  const result = await activeCard.evaluate((card) => {
    const tooltip = card.querySelector(".perk-math-tooltip");
    if (!tooltip) return { error: "Tooltip missing" };
    const tooltipRect = tooltip.getBoundingClientRect();
    const overlappingTriggers = Array.from(document.querySelectorAll(".perk-math-trigger"))
      .filter((trigger) => !card.contains(trigger))
      .map((trigger) => {
        const rect = trigger.getBoundingClientRect();
        return { trigger, rect };
      })
      .filter(
        ({ rect }) =>
          rect.left < tooltipRect.right &&
          rect.right > tooltipRect.left &&
          rect.top < tooltipRect.bottom &&
          rect.bottom > tooltipRect.top
      );

    if (!overlappingTriggers.length) return { error: "No overlapping stacking trigger found for regression check" };

    const leaks = overlappingTriggers
      .map(({ trigger, rect }) => {
        const x = (rect.left + rect.right) / 2;
        const y = (rect.top + rect.bottom) / 2;
        const top = document.elementFromPoint(x, y);
        return {
          perk: trigger.closest("[data-perk-name]")?.dataset.perkName || "unknown",
          topClass: top?.className || "",
          topPerk: top?.closest?.("[data-perk-name]")?.dataset.perkName || "",
          tooltipContainsTop: tooltip.contains(top),
        };
      })
      .filter((sample) => !sample.tooltipContainsTop);

    return {
      leaks,
      overlapCount: overlappingTriggers.length,
    };
  });

  if (result.error) {
    throw new Error(result.error);
  }
  if (result.leaks.length) {
    throw new Error(`Perk tooltip did not cover overlapping STACKING trigger(s): ${JSON.stringify(result.leaks)}`);
  }
}

async function assertNumberGreaterThan(page, selector, minimum, label) {
  const text = (await page.locator(selector).textContent()).trim();
  const value = Number(text.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(value) || value <= minimum) {
    throw new Error(`${label} expected to be greater than ${minimum}, got "${text}"`);
  }
}

async function assertBuildPlannerQuickStatGain(page) {
  const stats = await page.evaluate(() =>
    ["str", "con", "dex"].map((stat) => Number(document.querySelector(`[data-quick-stat="${stat}"]`)?.textContent || 0))
  );
  const total = stats.reduce((sum, value) => sum + value, 0);
  if (total <= 15) {
    throw new Error(`quick STR/CON/DEX expected rarity stat gain, got ${stats.join("/")}`);
  }
}

async function assertWeaponDetailEnhancements(page) {
  const runicLink = page
    .locator('#details-properties a.perk-link[href*="pages/systems/perks.html?perk=Runic"]')
    .first();
  await runicLink.waitFor({ state: "attached" });
  await assertWeaponTableScanMetrics(page);

  const detailText = (await page.locator("#details-properties").textContent()).trim();
  if (!detailText.includes("Weapon Speed") || (!detailText.includes("1,000") && !detailText.includes("1000"))) {
    throw new Error(`Rune Sword detail missing weapon speed context: "${detailText}"`);
  }

  const speedTooltip = (await page.locator("#details-properties .weapon-speed-pill .detail-tooltip").textContent()).trim();
  if (!speedTooltip.includes("Base weapon speed") || !speedTooltip.includes("1.00 attacks/sec")) {
    throw new Error(`Weapon speed tooltip missing expected context: "${speedTooltip}"`);
  }

  const weaponDetailUrl = page.url();
  await runicLink.click();
  await page.waitForURL((url) => url.pathname.endsWith("/pages/systems/perks.html") && url.searchParams.get("perk") === "Runic", {
    timeout: timeoutMs,
  });
  await page.locator('[data-perk-name="Runic"].perk-selected').waitFor({ state: "visible" });
  await page.goto(weaponDetailUrl, { waitUntil: "load" });
  await page.locator('#details-properties a.perk-link[href*="pages/systems/perks.html?perk=Runic"]').first().waitFor({
    state: "attached",
  });
}

async function assertWeaponTableScanMetrics(page) {
  const tableText = (await page.locator("#items-body").textContent()).trim();
  if (!tableText.includes("Rune Sword") || !tableText.includes("1,000 ms")) {
    throw new Error(`Rune Sword table row missing compact speed column: "${tableText}"`);
  }

  const dpsTooltip = (await page.locator("#items-body .dps-breakdown-tooltip").textContent()).trim();
  const expected = ["DPS Breakdown", "80 - 150", "1,000 ms", "1.00 attacks/sec"];
  expected.forEach((value) => {
    if (!dpsTooltip.includes(value)) {
      throw new Error(`Rune Sword DPS tooltip missing "${value}": "${dpsTooltip}"`);
    }
  });
}

async function openDetail(page, baseUrl, spec) {
  const url = joinUrl(baseUrl, spec.listPath, {
    [spec.queryKey]: spec.detailQuery,
  });
  await page.goto(url, { waitUntil: "load" });
  await waitForRows(page, spec);
}

function joinUrl(baseUrl, pathname, query = {}) {
  const url = new URL(pathname.replace(/^\/+/, ""), normalizeBaseUrl(baseUrl));
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function normalizeBaseUrl(baseUrl) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

async function waitForRows(page, spec) {
  await page.locator(spec.rowSelector).first().waitFor({ state: "attached" });
}

async function assertDetailState(page, spec, action) {
  await assertDetailVisible(page, spec);
  const detailName = await getDetailName(page);
  if (detailName !== spec.detailName) {
    throw new Error(`${action} selected "${detailName}" instead of "${spec.detailName}"`);
  }
  await assertUrlHasQuery(page, spec.queryKey);
}

async function assertDetailVisible(page, spec) {
  await page.locator(`${spec.detailSelector}.show`).waitFor({ state: "visible" });
}

async function assertUrlHasQuery(page, queryKey) {
  const hasQuery = await page.evaluate((key) => new URL(window.location.href).searchParams.has(key), queryKey);
  if (!hasQuery) throw new Error(`URL is missing ${queryKey} query state`);
}

async function assertDetailLinks(page, spec) {
  await page.locator(spec.detailLinkSelector).first().waitFor({ state: "attached" });
  const linkCount = await page.locator(spec.detailLinkSelector).count();
  if (!linkCount) throw new Error("detail panel did not render expected cross-page links");
}

async function clickFirstRow(page, spec) {
  const name = await page.locator(spec.rowSelector).first().evaluate((row) => {
    const link = row.querySelector("a");
    return (link?.textContent || row.children[1]?.textContent || row.textContent || "").trim();
  });
  await page.locator(spec.rowSelector).first().click();
  return name;
}

async function getDetailName(page) {
  return (await page.locator("#details-name").textContent()).trim();
}

async function startStaticServer(siteRoot) {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const requestedPath = decodeURIComponent(url.pathname);
    let filePath = path.resolve(siteRoot, `.${requestedPath}`);
    if (!filePath.startsWith(siteRoot)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    try {
      const fileStat = await stat(filePath);
      if (fileStat.isDirectory()) filePath = path.join(filePath, "index.html");
      response.writeHead(200, { "Content-Type": contentType(filePath) });
      createReadStream(filePath).pipe(response);
    } catch (error) {
      response.writeHead(404);
      response.end("Not found");
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    close: () => new Promise((resolve) => server.close(resolve)),
    port: server.address().port,
  };
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === "--root") {
      parsed.root = rawArgs[index + 1];
      index += 1;
    } else if (arg === "--timeout-ms") {
      parsed.timeoutMs = rawArgs[index + 1];
      index += 1;
    } else if (arg === "--base-url") {
      parsed.baseUrl = rawArgs[index + 1];
      index += 1;
    }
  }
  return parsed;
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return (
    {
      ".css": "text/css",
      ".gif": "image/gif",
      ".html": "text/html",
      ".ico": "image/x-icon",
      ".js": "text/javascript",
      ".json": "application/json",
      ".png": "image/png",
    }[ext] || "application/octet-stream"
  );
}

function formatError(error) {
  return error && error.message ? error.message : String(error);
}
