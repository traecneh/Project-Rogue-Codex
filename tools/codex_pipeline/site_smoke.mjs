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
const PROJECT_ROGUE_FILTER_SELECTOR = '[data-era-filter="project-rogue"]';

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
      await runHomeSpec(browser, baseUrl);
      console.log("SMOKE OK home: countdown, timeline filter, related links");
    } catch (error) {
      failures.push(`SMOKE ERROR home: ${formatError(error)}`);
    }
    try {
      await runBuildPlannerSpec(browser, baseUrl);
      console.log("SMOKE OK build planner: search, rarity, share reload, reset");
    } catch (error) {
      failures.push(`SMOKE ERROR build planner: ${formatError(error)}`);
    }
    try {
      await runPlayTheGameSpec(browser, baseUrl);
      console.log("SMOKE OK play the game: Discord setup, CTA, related links");
    } catch (error) {
      failures.push(`SMOKE ERROR play the game: ${formatError(error)}`);
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
      await runAntiZergSpec(browser, baseUrl);
      console.log("SMOKE OK anti-zerg: rule reference, calculator, related links");
    } catch (error) {
      failures.push(`SMOKE ERROR anti-zerg: ${formatError(error)}`);
    }
    try {
      await runMonsterDamageReductionSpec(browser, baseUrl);
      console.log("SMOKE OK monster damage reduction: scaling reference, calculator, related links");
    } catch (error) {
      failures.push(`SMOKE ERROR monster damage reduction: ${formatError(error)}`);
    }
    try {
      await runExperienceSpec(browser, baseUrl);
      console.log("SMOKE OK experience: pool reference, simulator, related links");
    } catch (error) {
      failures.push(`SMOKE ERROR experience: ${formatError(error)}`);
    }
    try {
      await runLevelSpec(browser, baseUrl);
      console.log("SMOKE OK level: XP rules, calculator, milestones, related links");
    } catch (error) {
      failures.push(`SMOKE ERROR level: ${formatError(error)}`);
    }
    try {
      await runSkillsSpec(browser, baseUrl);
      console.log("SMOKE OK skills: melee reference, requirement preview, XP chart, related links");
    } catch (error) {
      failures.push(`SMOKE ERROR skills: ${formatError(error)}`);
    }
    try {
      await runRacesSpec(browser, baseUrl);
      console.log("SMOKE OK races: race bonuses, requirement preview, related links");
    } catch (error) {
      failures.push(`SMOKE ERROR races: ${formatError(error)}`);
    }
    try {
      await runStrengthSpec(browser, baseUrl);
      console.log("SMOKE OK strength: formulas, calculator, benchmarks, related links");
    } catch (error) {
      failures.push(`SMOKE ERROR strength: ${formatError(error)}`);
    }
    try {
      await runConstitutionSpec(browser, baseUrl);
      console.log("SMOKE OK constitution: health, regen, benchmarks, related links");
    } catch (error) {
      failures.push(`SMOKE ERROR constitution: ${formatError(error)}`);
    }
    try {
      await runDexteritySpec(browser, baseUrl);
      console.log("SMOKE OK dexterity: multiplier, crit, damage reduction, related links");
    } catch (error) {
      failures.push(`SMOKE ERROR dexterity: ${formatError(error)}`);
    }
    try {
      await runResistancesSpec(browser, baseUrl);
      console.log("SMOKE OK resistances: player cap preview, monster type matchups, related links");
    } catch (error) {
      failures.push(`SMOKE ERROR resistances: ${formatError(error)}`);
    }
    try {
      await runGuildSpec(browser, baseUrl);
      console.log("SMOKE OK guild: management reference, party preview, related links");
    } catch (error) {
      failures.push(`SMOKE ERROR guild: ${formatError(error)}`);
    }
    try {
      await runChatSpec(browser, baseUrl);
      console.log("SMOKE OK chat: channel reference, send preview, related links");
    } catch (error) {
      failures.push(`SMOKE ERROR chat: ${formatError(error)}`);
    }
    try {
      await runFloorCleanupSpec(browser, baseUrl);
      console.log("SMOKE OK floor cleanup: timing reference, preview, related links");
    } catch (error) {
      failures.push(`SMOKE ERROR floor cleanup: ${formatError(error)}`);
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
  console.log(`SMOKE OK site: ${smokeSpecs.length + 28} page(s) checked at ${baseUrl}`);
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

async function runHomeSpec(browser, baseUrl) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await page.goto(joinUrl(baseUrl, "/index.html"), { waitUntil: "load" });
    await page.locator(".countdown-panel").waitFor({ state: "visible" });
    await page.locator(".home-timeline").waitFor({ state: "visible" });
    const pageText = (await page.locator(".main-content").textContent()).trim();
    for (const expected of [
      "Nocturne Blight",
      "Project Rogue Timeline",
      "Dransik Classic",
      "Project Rogue Begins",
      "Fresh Wipes & Live Upkeep",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Home page missing "${expected}": "${pageText}"`);
      }
    }

    for (const href of [
      "https://traecneh.github.io/Project-Rogue-Map/",
      "pages/stats/resistances.html",
      "pages/systems/rarity.html",
      "pages/systems/crafting.html",
      "pages/systems/corruption.html",
      "pages/systems/experience.html",
    ]) {
      const count = await page.locator(`.home-link-grid a[href="${href}"]`).count();
      if (count !== 1) {
        throw new Error(`Home related link expected one "${href}", found ${count}`);
      }
    }

    await assertHomeTimelineFilter(page, "all", 10, ["Dransik Classic", "Fresh Wipes & Live Upkeep"], []);
    await page.locator(PROJECT_ROGUE_FILTER_SELECTOR).waitFor({ state: "visible" });
    await assertHomeTimelineFilter(page, "project-rogue", 2, ["Project Rogue Begins", "Fresh Wipes & Live Upkeep"], [
      "Dransik Classic",
    ]);
    await assertHomeTimelineFilter(page, "origins", 3, ["Dransik Classic", "Ashen Empires Era"], [
      "Project Rogue Begins",
    ]);
    await assertMobilePageFirstNavigation(page, baseUrl, "/index.html");

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function assertHomeTimelineFilter(page, filterName, expectedCount, visibleText, hiddenText) {
  await page.locator(`[data-era-filter="${filterName}"]`).click();
  await page.waitForFunction(
    ({ count }) => document.querySelectorAll("[data-home-timeline-item]:not([hidden])").length === count,
    { count: expectedCount },
    { timeout: timeoutMs }
  );
  const pressed = await page.locator(`[data-era-filter="${filterName}"]`).getAttribute("aria-pressed");
  if (pressed !== "true") {
    throw new Error(`Home filter "${filterName}" should be aria-pressed=true, got "${pressed}"`);
  }
  const countText = (await page.locator("[data-home-result-count]").textContent()).trim();
  if (!countText.startsWith(String(expectedCount))) {
    throw new Error(`Home filter "${filterName}" count expected ${expectedCount}, got "${countText}"`);
  }
  const visibleTimelineText = (await page.locator(".home-timeline").textContent()).trim();
  for (const expected of visibleText) {
    if (!visibleTimelineText.includes(expected)) {
      throw new Error(`Home filter "${filterName}" hidden expected visible text "${expected}": "${visibleTimelineText}"`);
    }
  }
  for (const unexpected of hiddenText) {
    const stillVisible = await page
      .locator(`[data-home-timeline-item]:not([hidden])`)
      .filter({ hasText: unexpected })
      .count();
    if (stillVisible) {
      throw new Error(`Home filter "${filterName}" should hide "${unexpected}"`);
    }
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

async function runPlayTheGameSpec(browser, baseUrl) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await page.goto(joinUrl(baseUrl, "/pages/General/play-the-game.html"), { waitUntil: "load" });
    await page.locator(".play-discord-panel").waitFor({ state: "visible" });
    const pageText = (await page.locator("#play-basics").textContent()).trim();
    for (const expected of [
      "Discord-First Setup",
      "Join the Discord",
      "#welcome",
      "Create Your Account",
      "Log In and Play",
      "https://discord.gg/DW6zcWy",
      "Related Pages",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Play the Game page missing "${expected}": "${pageText}"`);
      }
    }

    const discordLinkCount = await page.locator('a[href="https://discord.gg/DW6zcWy"]').count();
    if (discordLinkCount !== 1) {
      throw new Error(`Play the Game expected one Discord CTA, found ${discordLinkCount}`);
    }

    const monsterCount = await page.locator("[data-play-monster]").count();
    const eliteCount = await page.locator("[data-play-elite]").count();
    if (monsterCount !== 1 || eliteCount !== 1) {
      throw new Error(`Play the Game escort assets missing: monster=${monsterCount}, elite=${eliteCount}`);
    }

    for (const href of [
      "pages/General/build-planner.html",
      "pages/items/weapons.html",
      "pages/items/armors.html",
      "pages/enemies/monsters.html",
      "pages/systems/chat.html",
      "pages/systems/experience.html",
    ]) {
      const count = await page.locator(`.play-link-grid a[href="${href}"]`).count();
      if (count !== 1) {
        throw new Error(`Play the Game related link expected one "${href}", found ${count}`);
      }
    }

    await assertMobilePageFirstNavigation(page, baseUrl, "/pages/General/play-the-game.html");

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

async function runAntiZergSpec(browser, baseUrl) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await page.goto(joinUrl(baseUrl, "/pages/systems/anti-zerg.html"), { waitUntil: "load" });
    await page.locator(".anti-zerg-calculator").waitFor({ state: "visible" });
    const pageText = (await page.locator("#anti-zerg-basics").textContent()).trim();
    for (const expected of [
      "Anti-Zerg at a Glance",
      "Mode and Sizing Rules",
      "Focus Fire and Collaboration",
      "Damage Reduction Calculator",
      "Reduction Reference",
      "Moderation Rules",
      "Warfront Mode",
      "Open-World Mode",
      "3-Minute High-Water",
      "128x128 Tiles",
      "10+ direct attacks",
      "66%",
      "5-Minute Activity",
      "10.0 EFFECTIVE",
      "750 to 1500",
      "10 chunks (160 tiles)",
      "180 seconds",
      "20%",
      "30%",
      "27.27%",
      "Self-Heal Mirror",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Anti-Zerg page missing "${expected}": "${pageText}"`);
      }
    }

    for (const href of [
      "pages/systems/pvp-system.html",
      "pages/systems/guild.html",
      "pages/items/weapons.html",
      "pages/items/armors.html",
      "pages/enemies/monsters.html",
      "pages/General/play-the-game.html",
    ]) {
      const count = await page.locator(`.anti-zerg-link-grid a[href="${href}"]`).count();
      if (count !== 1) {
        throw new Error(`Anti-Zerg related link expected one "${href}", found ${count}`);
      }
    }

    await assertAntiZergCalculator(page, 3, 8, "30%", "My guild receives the max 30% damage reduction.");
    await assertAntiZergCalculator(page, 1, 2, "20%", "My guild receives 20% damage reduction in this matchup.");
    await assertAntiZergCalculator(page, 8, 12, "27.27%", "My guild receives 27.27% damage reduction in this matchup.");
    await assertAntiZergCalculator(page, 12, 14, "7.69%", "My guild receives 7.69% damage reduction in this matchup.");
    await assertAntiZergCalculator(page, 8, 3, "30%", "Enemy guild receives the max 30% damage reduction.");
    await assertAntiZergCalculator(page, 6, 6, "0%", "Both guilds are the same size");

    await assertMobilePageFirstNavigation(page, baseUrl, "/pages/systems/anti-zerg.html");

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function assertAntiZergCalculator(page, myGuildSize, enemyGuildSize, expectedValue, expectedNote) {
  await page.locator("[data-smaller-range]").evaluate((input, value) => {
    input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, myGuildSize);
  await page.locator("[data-bigger-range]").evaluate((input, value) => {
    input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, enemyGuildSize);

  await page.waitForFunction(
    ({ expected }) => document.querySelector("[data-reduction-result]")?.textContent?.trim() === expected,
    { expected: expectedValue },
    { timeout: timeoutMs }
  );

  const resultText = (await page.locator("[data-reduction-result]").textContent()).trim();
  const scenarioText = (await page.locator("[data-reduction-scenario]").textContent()).trim();
  const noteText = (await page.locator("[data-reduction-note]").textContent()).trim();
  if (resultText !== expectedValue) {
    throw new Error(`Anti-Zerg calculator expected ${expectedValue}, got "${resultText}"`);
  }
  if (!noteText.includes(expectedNote)) {
    throw new Error(`Anti-Zerg calculator note missing "${expectedNote}": "${noteText}"`);
  }
  if (!scenarioText.includes("guild")) {
    throw new Error(`Anti-Zerg calculator scenario did not describe guild matchup: "${scenarioText}"`);
  }
}

async function runMonsterDamageReductionSpec(browser, baseUrl) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await page.goto(joinUrl(baseUrl, "/pages/systems/monster-damage-reduction.html"), { waitUntil: "load" });
    await page.locator(".monster-dr-calculator").waitFor({ state: "visible" });
    const pageText = (await page.locator("#monster-dr-basics").textContent()).trim();
    for (const expected of [
      "Monster Damage Reduction at a Glance",
      "Scaling Rules",
      "Damage Reduction Calculator",
      "Threshold Reference",
      "Example Outcomes",
      "Related Pages",
      "+20 level gap",
      "+30 level gap",
      "25%",
      "Level 100 Cap",
      "monsters 100+ count as 100",
      "Player Level",
      "Monster Level",
      "Level Difference",
      "Monster Damage Dealt",
      "Your Damage vs Monster",
      "12.5%",
      "112.5%",
      "87.5%",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Monster Damage Reduction page missing "${expected}": "${pageText}"`);
      }
    }

    for (const href of [
      "pages/enemies/monsters.html",
      "pages/items/weapons.html",
      "pages/items/armors.html",
      "pages/systems/anti-zerg.html",
      "pages/systems/pvp-system.html",
      "pages/General/build-planner.html",
    ]) {
      const count = await page.locator(`.monster-dr-link-grid a[href="${href}"]`).count();
      if (count !== 1) {
        throw new Error(`Monster Damage Reduction related link expected one "${href}", found ${count}`);
      }
    }

    await assertMonsterDamageReductionCalculator(page, 25, 50, {
      gap: "+25",
      scaling: "12.5%",
      monsterDamage: "112.5%",
      playerDamage: "87.5%",
      note: "monsters deal 12.5% more damage",
    });
    await assertMonsterDamageReductionCalculator(page, 50, 60, {
      gap: "+10",
      scaling: "0%",
      monsterDamage: "100%",
      playerDamage: "100%",
      note: "scaling starts at +20",
    });
    await assertMonsterDamageReductionCalculator(page, 25, 55, {
      gap: "+30",
      scaling: "25%",
      monsterDamage: "125%",
      playerDamage: "75%",
      note: "monsters deal 25% more damage",
    });
    await assertMonsterDamageReductionCalculator(page, 25, 120, {
      gap: "+75",
      scaling: "25%",
      monsterDamage: "125%",
      playerDamage: "75%",
      note: "Using treated level 100 for scaling.",
      cap: "(treated as 100)",
    });

    await assertMobilePageFirstNavigation(page, baseUrl, "/pages/systems/monster-damage-reduction.html");

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function assertMonsterDamageReductionCalculator(page, playerLevel, monsterLevel, expected) {
  await page.locator("[data-player-input]").evaluate((input, value) => {
    input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, playerLevel);
  await page.locator("[data-monster-input]").evaluate((input, value) => {
    input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, monsterLevel);

  await page.waitForFunction(
    ({ scaling }) => document.querySelector("[data-scaling-value]")?.textContent?.trim() === scaling,
    { scaling: expected.scaling },
    { timeout: timeoutMs }
  );

  const state = await page.evaluate(() => ({
    cap: document.querySelector("[data-monster-cap]")?.textContent?.trim() || "",
    gap: document.querySelector("[data-level-gap]")?.textContent?.trim() || "",
    monsterDamage: document.querySelector("[data-monster-damage]")?.textContent?.trim() || "",
    note: document.querySelector("[data-result-note]")?.textContent?.trim() || "",
    playerDamage: document.querySelector("[data-player-damage]")?.textContent?.trim() || "",
    scaling: document.querySelector("[data-scaling-value]")?.textContent?.trim() || "",
  }));

  for (const [key, value] of Object.entries(expected)) {
    if (key === "note") {
      if (!state.note.includes(value)) {
        throw new Error(`Monster DR calculator note missing "${value}": "${state.note}"`);
      }
    } else if (state[key] !== value) {
      throw new Error(`Monster DR calculator expected ${key}="${value}", got "${state[key]}"`);
    }
  }
}

async function runExperienceSpec(browser, baseUrl) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await page.goto(joinUrl(baseUrl, "/pages/systems/experience.html"), { waitUntil: "load" });
    await page.locator(".experience-sim-widget").waitFor({ state: "visible" });
    const pageText = (await page.locator("#experience-basics").textContent()).trim();
    for (const expected of [
      "Experience Pool at a Glance",
      "Daily Pool Build",
      "Combat Conversion",
      "Experience Pool Simulator",
      "XP Threshold Reference",
      "Related Pages",
      "Levels 1-89",
      "+3.0 levels per 24 hours",
      "Levels 90+",
      "+1.0 level per 24 hours",
      "3.0 levels",
      "Double XP",
      "1% of a level",
      "0.01 pool",
      "150-235 XP",
      "XP Multiplier",
      "Weapon Speed",
      "Projected XP / Second",
      "Est. Time to Level",
      "Run Tick",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Experience page missing "${expected}": "${pageText}"`);
      }
    }

    for (const href of [
      "pages/General/build-planner.html",
      "pages/systems/perks.html",
      "pages/systems/monster-damage-reduction.html",
      "pages/items/weapons.html",
      "pages/items/armors.html",
      "pages/enemies/monsters.html",
      "pages/General/play-the-game.html",
    ]) {
      const count = await page.locator(`.experience-link-grid a[href="${href}"]`).count();
      if (count !== 1) {
        throw new Error(`Experience related link expected one "${href}", found ${count}`);
      }
    }

    await assertExperienceSimulator(page);
    await assertMobilePageFirstNavigation(page, baseUrl, "/pages/systems/experience.html");

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function runLevelSpec(browser, baseUrl) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await page.goto(joinUrl(baseUrl, "/pages/stats/level.html"), { waitUntil: "load" });
    await page.locator(".level-xp-widget").waitFor({ state: "visible" });
    const pageText = (await page.locator(".main-content").textContent()).trim();
    for (const expected of [
      "Level at a Glance",
      "Damage to XP Preview",
      "Milestone Reference",
      "Level XP Requirements",
      "Related Pages",
      "Level 105",
      "1:1 Damage",
      "Experience Pool",
      "Catch-Up",
      "Weekend / Event",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Level page missing "${expected}": "${pageText}"`);
      }
    }

    for (const href of [
      "pages/systems/experience.html",
      "pages/General/build-planner.html",
      "pages/systems/monster-damage-reduction.html",
      "pages/items/weapons.html",
      "pages/items/armors.html",
      "pages/enemies/monsters.html",
    ]) {
      const count = await page.locator(`.level-link-grid a[href="${href}"]`).count();
      if (count !== 1) {
        throw new Error(`Level related link expected one "${href}", found ${count}`);
      }
    }

    await assertLevelXpWidget(page);
    await assertMobilePageFirstNavigation(page, baseUrl, "/pages/stats/level.html");

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function assertLevelXpWidget(page) {
  await page.locator(".level-milestone-card").first().waitFor({ state: "visible" });
  const milestoneCount = await page.locator(".level-milestone-card").count();
  if (milestoneCount !== 7) {
    throw new Error(`Level page expected 7 milestone cards, found ${milestoneCount}`);
  }

  const rowCount = await page.locator("#level-xp-chart .weight-row").count();
  if (rowCount !== 105) {
    throw new Error(`Level XP chart expected 105 rows, found ${rowCount}`);
  }

  let state = await readLevelXpState(page);
  for (const [key, expected] of Object.entries({
    damage: "100",
    base: "100",
    boosts: "0",
    multiplier: "1x",
    total: "100",
  })) {
    if (state[key] !== expected) {
      throw new Error(`Level XP widget expected ${key}="${expected}", got "${state[key]}"`);
    }
  }

  await setLevelDamage(page, 250);
  await page.waitForFunction(
    () => document.querySelector("[data-level-total-xp]")?.textContent?.trim() === "250",
    undefined,
    { timeout: timeoutMs }
  );

  await page.locator('[data-level-boost="pool"]').click();
  await page.waitForFunction(
    () => document.querySelector("[data-level-total-xp]")?.textContent?.trim() === "500",
    undefined,
    { timeout: timeoutMs }
  );
  state = await readLevelXpState(page);
  if (state.multiplier !== "2x" || state.boosts !== "1") {
    throw new Error(`Level XP widget expected one active boost after pool click: ${JSON.stringify(state)}`);
  }

  await page.locator('[data-level-boost="catchup"]').click();
  await page.waitForFunction(
    () => document.querySelector("[data-level-total-xp]")?.textContent?.trim() === "750",
    undefined,
    { timeout: timeoutMs }
  );

  await page.locator('[data-level-boost="pool"]').click();
  await page.waitForFunction(
    () => document.querySelector("[data-level-total-xp]")?.textContent?.trim() === "500",
    undefined,
    { timeout: timeoutMs }
  );
  state = await readLevelXpState(page);
  if (state.poolPressed !== "false" || state.catchupPressed !== "true" || state.multiplier !== "2x") {
    throw new Error(`Level XP widget did not preserve toggle state correctly: ${JSON.stringify(state)}`);
  }
}

async function setLevelDamage(page, value) {
  await page.locator("[data-level-damage-slider]").evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

async function readLevelXpState(page) {
  return await page.evaluate(() => ({
    base: document.querySelector("[data-level-base-xp]")?.textContent?.trim() || "",
    boosts: document.querySelector("[data-level-boost-count]")?.textContent?.trim() || "",
    catchupPressed: document.querySelector('[data-level-boost="catchup"]')?.getAttribute("aria-pressed") || "",
    damage: document.querySelector("[data-level-damage-value]")?.textContent?.trim() || "",
    multiplier: document.querySelector("[data-level-multiplier]")?.textContent?.trim() || "",
    poolPressed: document.querySelector('[data-level-boost="pool"]')?.getAttribute("aria-pressed") || "",
    total: document.querySelector("[data-level-total-xp]")?.textContent?.trim() || "",
  }));
}

async function runSkillsSpec(browser, baseUrl) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await page.goto(joinUrl(baseUrl, "/pages/stats/skills.html"), { waitUntil: "load" });
    await page.locator(".skills-requirement-widget").waitFor({ state: "visible" });
    const pageText = (await page.locator(".main-content").textContent()).trim();
    for (const expected of [
      "Skills at a Glance",
      "Melee Skill Set",
      "Requirement Preview",
      "Skill XP Requirements",
      "Related Pages",
      "Large Blades",
      "Axes",
      "Blunts",
      "Polearms",
      "Small Blades",
      "Race bonuses do not count toward equipment requirements",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Skills page missing "${expected}": "${pageText}"`);
      }
    }

    for (const href of [
      "pages/stats/races.html",
      "pages/General/build-planner.html",
      "pages/items/weapons.html",
      "pages/items/armors.html",
      "pages/stats/level.html",
      "pages/systems/experience.html",
    ]) {
      const count = await page.locator(`.skills-link-grid a[href="${href}"]`).count();
      if (count !== 1) {
        throw new Error(`Skills related link expected one "${href}", found ${count}`);
      }
    }

    await assertSkillsRequirementWidget(page);
    await assertMobilePageFirstNavigation(page, baseUrl, "/pages/stats/skills.html");

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function assertSkillsRequirementWidget(page) {
  const rowCount = await page.locator("#skill-xp-chart .weight-row").count();
  if (rowCount !== 111) {
    throw new Error(`Skills XP chart expected 111 rows, found ${rowCount}`);
  }

  let state = await readSkillsRequirementState(page);
  for (const [key, expected] of Object.entries({
    base: "80",
    effective: "80",
    requirement: "90",
    status: "Requirement unmet",
  })) {
    if (state[key] !== expected) {
      throw new Error(`Skills requirement widget expected ${key}="${expected}", got "${state[key]}"`);
    }
  }

  await page.locator("[data-skill-race-toggle]").click();
  await page.waitForFunction(
    () => document.querySelector("[data-skill-effective]")?.textContent?.trim() === "90",
    undefined,
    { timeout: timeoutMs }
  );
  state = await readSkillsRequirementState(page);
  if (state.status !== "Requirement unmet" || state.note !== "Race bonus is visible, but base skill is still short.") {
    throw new Error(`Skills race bonus should not satisfy equipment requirements: ${JSON.stringify(state)}`);
  }

  await setSkillsRange(page, "[data-skill-base-slider]", 90);
  await page.waitForFunction(
    () => document.querySelector("[data-skill-status]")?.textContent?.trim() === "Meets requirement",
    undefined,
    { timeout: timeoutMs }
  );
  state = await readSkillsRequirementState(page);
  if (state.base !== "90" || state.effective !== "100" || state.status !== "Meets requirement") {
    throw new Error(`Skills base requirement check did not update correctly: ${JSON.stringify(state)}`);
  }

  await setSkillsRange(page, "[data-skill-requirement-slider]", 105);
  await page.waitForFunction(
    () => document.querySelector("[data-skill-status]")?.textContent?.trim() === "Requirement unmet",
    undefined,
    { timeout: timeoutMs }
  );
}

async function setSkillsRange(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

async function readSkillsRequirementState(page) {
  return await page.evaluate(() => ({
    base: document.querySelector("[data-skill-base]")?.textContent?.trim() || "",
    effective: document.querySelector("[data-skill-effective]")?.textContent?.trim() || "",
    note: document.querySelector("[data-skill-note]")?.textContent?.trim() || "",
    requirement: document.querySelector("[data-skill-requirement]")?.textContent?.trim() || "",
    status: document.querySelector("[data-skill-status]")?.textContent?.trim() || "",
    racePressed: document.querySelector("[data-skill-race-toggle]")?.getAttribute("aria-pressed") || "",
  }));
}

async function runRacesSpec(browser, baseUrl) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await page.goto(joinUrl(baseUrl, "/pages/stats/races.html"), { waitUntil: "load" });
    await page.locator(".races-preview-widget").waitFor({ state: "visible" });
    const pageText = (await page.locator(".main-content").textContent()).trim();
    for (const expected of [
      "Races at a Glance",
      "Playable Race Bonuses",
      "Race Bonus Preview",
      "Equipment Requirement Rule",
      "Related Pages",
      "Human",
      "Tundrian",
      "Brimlock",
      "Komodan",
      "Elf",
      "Orc",
      "Gnoll",
      "Dark Elf",
      "Base values pass equipment checks",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Races page missing "${expected}": "${pageText}"`);
      }
    }

    for (const href of [
      "pages/stats/skills.html",
      "pages/stats/strength.html",
      "pages/stats/constitution.html",
      "pages/stats/dexterity.html",
      "pages/General/build-planner.html",
      "pages/systems/perks.html",
    ]) {
      const count = await page.locator(`.races-link-grid a[href="${href}"]`).count();
      if (count !== 1) {
        throw new Error(`Races related link expected one "${href}", found ${count}`);
      }
    }

    await assertRacesPreview(page);
    await assertMobilePageFirstNavigation(page, baseUrl, "/pages/stats/races.html");

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function assertRacesPreview(page) {
  let state = await readRacesPreviewState(page);
  for (const [key, expected] of Object.entries({
    base: "85",
    effectiveSkill: "90",
    effectiveStat: "90",
    requirement: "90",
    selected: "Human",
    status: "Requirement unmet",
  })) {
    if (state[key] !== expected) {
      throw new Error(`Races preview expected ${key}="${expected}", got "${state[key]}"`);
    }
  }
  if (!state.note.includes("Race bonus is visible")) {
    throw new Error(`Races preview initial rule note was incorrect: ${JSON.stringify(state)}`);
  }

  await page.locator('[data-race-option="tundrian"]').click();
  await page.waitForFunction(
    () => document.querySelector("[data-race-selected-name]")?.textContent?.trim() === "Tundrian",
    undefined,
    { timeout: timeoutMs }
  );
  state = await readRacesPreviewState(page);
  if (state.selected !== "Tundrian" || state.effectiveStat !== "95" || state.effectiveSkill !== "90") {
    throw new Error(`Races preview did not apply Tundrian bonuses: ${JSON.stringify(state)}`);
  }
  if (state.status !== "Requirement unmet") {
    throw new Error(`Races preview incorrectly let a race bonus pass the requirement: ${JSON.stringify(state)}`);
  }

  await setRacesRange(page, "[data-race-base-slider]", 90);
  await page.waitForFunction(
    () => document.querySelector("[data-race-requirement-status]")?.textContent?.trim() === "Meets requirement",
    undefined,
    { timeout: timeoutMs }
  );
  state = await readRacesPreviewState(page);
  if (state.base !== "90" || state.effectiveStat !== "100" || state.effectiveSkill !== "95") {
    throw new Error(`Races preview did not update base slider correctly: ${JSON.stringify(state)}`);
  }

  await setRacesRange(page, "[data-race-requirement-slider]", 105);
  await page.waitForFunction(
    () => document.querySelector("[data-race-requirement-status]")?.textContent?.trim() === "Requirement unmet",
    undefined,
    { timeout: timeoutMs }
  );
}

async function setRacesRange(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

async function readRacesPreviewState(page) {
  return await page.evaluate(() => ({
    base: document.querySelector("[data-race-base]")?.textContent?.trim() || "",
    effectiveSkill: document.querySelector("[data-race-effective-skill]")?.textContent?.trim() || "",
    effectiveStat: document.querySelector("[data-race-effective-stat]")?.textContent?.trim() || "",
    note: document.querySelector("[data-race-rule-note]")?.textContent?.trim() || "",
    requirement: document.querySelector("[data-race-requirement]")?.textContent?.trim() || "",
    selected: document.querySelector("[data-race-selected-name]")?.textContent?.trim() || "",
    status: document.querySelector("[data-race-requirement-status]")?.textContent?.trim() || "",
    tundrianPressed: document.querySelector('[data-race-option="tundrian"]')?.getAttribute("aria-pressed") || "",
  }));
}

async function runStrengthSpec(browser, baseUrl) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await page.goto(joinUrl(baseUrl, "/pages/stats/strength.html"), { waitUntil: "load" });
    await page.locator(".strength-calculator-widget").waitFor({ state: "visible" });
    const pageText = (await page.locator(".main-content").textContent()).trim();
    for (const expected of [
      "Strength at a Glance",
      "Strength Calculator",
      "Weight Benchmarks",
      "Bleed Threshold",
      "Build Context",
      "Perks",
      "Equipment Reference",
      "Related Pages",
      "Melee Multiplier",
      "Max Weight",
      "Max Health",
      "100 Base Strength",
      "7.5% of hit damage",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Strength page missing "${expected}": "${pageText}"`);
      }
    }

    for (const href of [
      "pages/stats/races.html",
      "pages/stats/skills.html",
      "pages/stats/constitution.html",
      "pages/stats/dexterity.html",
      "pages/General/build-planner.html",
      "pages/items/weapons.html",
    ]) {
      const count = await page.locator(`.strength-link-grid a[href="${href}"]`).count();
      if (count !== 1) {
        throw new Error(`Strength related link expected one "${href}", found ${count}`);
      }
    }

    await assertStrengthCalculator(page);
    await assertMobilePageFirstNavigation(page, baseUrl, "/pages/stats/strength.html");

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function assertStrengthCalculator(page) {
  await page.locator("[data-strength-weight-chart] .strength-benchmark-card").first().waitFor({ state: "visible" });
  const benchmarkCount = await page.locator("[data-strength-weight-chart] .strength-benchmark-card").count();
  if (benchmarkCount !== 7) {
    throw new Error(`Strength page expected 7 weight benchmark cards, found ${benchmarkCount}`);
  }

  let state = await readStrengthCalculatorState(page);
  for (const [key, expected] of Object.entries({
    bleedChance: "10.0%",
    bleedDamage: "7.5",
    maxHealth: "2,470",
    maxWeight: "450",
    multiplier: "3.25x",
    strength: "100",
  })) {
    if (state[key] !== expected) {
      throw new Error(`Strength calculator expected ${key}="${expected}", got "${state[key]}"`);
    }
  }

  await setStrengthRange(page, "[data-strength-str-slider]", 150);
  await page.waitForFunction(
    () => document.querySelector("[data-strength-max-weight]")?.textContent?.trim() === "600",
    undefined,
    { timeout: timeoutMs }
  );
  state = await readStrengthCalculatorState(page);
  for (const [key, expected] of Object.entries({
    bleedChance: "15.0%",
    maxHealth: "2,570",
    maxWeight: "600",
    multiplier: "3.75x",
    strength: "150",
  })) {
    if (state[key] !== expected) {
      throw new Error(`Strength calculator after STR 150 expected ${key}="${expected}", got "${state[key]}"`);
    }
  }

  await setStrengthRange(page, "[data-strength-hit-slider]", 250);
  await page.waitForFunction(
    () => document.querySelector("[data-strength-bleed-damage]")?.textContent?.trim() === "18.75",
    undefined,
    { timeout: timeoutMs }
  );

  await setStrengthRange(page, "[data-strength-str-slider]", 80);
  await page.waitForFunction(
    () => document.querySelector("[data-strength-bleed-note]")?.textContent?.trim() === "Requires 100 base Strength.",
    undefined,
    { timeout: timeoutMs }
  );
  state = await readStrengthCalculatorState(page);
  if (state.bleedChance !== "0.0%" || state.bleedDamage !== "0" || state.note !== "Requires 100 base Strength.") {
    throw new Error(`Strength calculator should lock bleed below 100 base STR: ${JSON.stringify(state)}`);
  }
}

async function setStrengthRange(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

async function readStrengthCalculatorState(page) {
  return await page.evaluate(() => ({
    bleedChance: document.querySelector("[data-strength-bleed-chance]")?.textContent?.trim() || "",
    bleedDamage: document.querySelector("[data-strength-bleed-damage]")?.textContent?.trim() || "",
    dexterity: document.querySelector("[data-strength-dex]")?.textContent?.trim() || "",
    hit: document.querySelector("[data-strength-hit]")?.textContent?.trim() || "",
    level: document.querySelector("[data-strength-level]")?.textContent?.trim() || "",
    maxHealth: document.querySelector("[data-strength-max-health]")?.textContent?.trim() || "",
    maxWeight: document.querySelector("[data-strength-max-weight]")?.textContent?.trim() || "",
    multiplier: document.querySelector("[data-strength-multiplier]")?.textContent?.trim() || "",
    note: document.querySelector("[data-strength-bleed-note]")?.textContent?.trim() || "",
    skill: document.querySelector("[data-strength-skill]")?.textContent?.trim() || "",
    strength: document.querySelector("[data-strength-str]")?.textContent?.trim() || "",
  }));
}

async function runConstitutionSpec(browser, baseUrl) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await page.goto(joinUrl(baseUrl, "/pages/stats/constitution.html"), { waitUntil: "load" });
    await page.locator(".constitution-calculator-widget").waitFor({ state: "visible" });
    const pageText = (await page.locator(".main-content").textContent()).trim();
    for (const expected of [
      "Constitution at a Glance",
      "Constitution Calculator",
      "Regeneration Benchmarks",
      "Race Context",
      "Perks",
      "Equipment Reference",
      "Related Pages",
      "Max Health",
      "Baseline Regen",
      "Con / 3",
      "HP every 2 seconds",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Constitution page missing "${expected}": "${pageText}"`);
      }
    }

    for (const href of [
      "pages/stats/races.html",
      "pages/stats/strength.html",
      "pages/stats/dexterity.html",
      "pages/General/build-planner.html",
      "pages/items/armors.html",
      "pages/systems/perks.html",
    ]) {
      const count = await page.locator(`.constitution-link-grid a[href="${href}"]`).count();
      if (count !== 1) {
        throw new Error(`Constitution related link expected one "${href}", found ${count}`);
      }
    }

    await assertConstitutionCalculator(page);
    await assertMobilePageFirstNavigation(page, baseUrl, "/pages/stats/constitution.html");

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function assertConstitutionCalculator(page) {
  await page.locator("[data-constitution-regen-chart] .constitution-benchmark-card").first().waitFor({ state: "visible" });
  const benchmarkCount = await page.locator("[data-constitution-regen-chart] .constitution-benchmark-card").count();
  if (benchmarkCount !== 6) {
    throw new Error(`Constitution page expected 6 regen benchmark cards, found ${benchmarkCount}`);
  }

  let state = await readConstitutionCalculatorState(page);
  for (const [key, expected] of Object.entries({
    bonus: "0%",
    constitution: "150",
    effectiveRegen: "50.0 HP / 2s",
    level: "50",
    maxHealth: "2,370",
    regenPerSec: "25.0 HP/s",
    regenTick: "50.0 HP / 2s",
    strength: "50",
  })) {
    if (state[key] !== expected) {
      throw new Error(`Constitution calculator expected ${key}="${expected}", got "${state[key]}"`);
    }
  }

  await setConstitutionRange(page, "[data-constitution-con-slider]", 180);
  await page.waitForFunction(
    () => document.querySelector("[data-constitution-max-health]")?.textContent?.trim() === "2,670",
    undefined,
    { timeout: timeoutMs }
  );
  state = await readConstitutionCalculatorState(page);
  for (const [key, expected] of Object.entries({
    constitution: "180",
    effectiveRegen: "60.0 HP / 2s",
    maxHealth: "2,670",
    regenPerSec: "30.0 HP/s",
    regenTick: "60.0 HP / 2s",
  })) {
    if (state[key] !== expected) {
      throw new Error(`Constitution calculator after CON 180 expected ${key}="${expected}", got "${state[key]}"`);
    }
  }

  await setConstitutionRange(page, "[data-constitution-regen-bonus-slider]", 50);
  await page.waitForFunction(
    () => document.querySelector("[data-constitution-effective-regen]")?.textContent?.trim() === "90.0 HP / 2s",
    undefined,
    { timeout: timeoutMs }
  );
  state = await readConstitutionCalculatorState(page);
  if (state.bonus !== "50%" || state.effectiveRegen !== "90.0 HP / 2s") {
    throw new Error(`Constitution bonus regen state was unexpected: ${JSON.stringify(state)}`);
  }

  await setConstitutionRange(page, "[data-constitution-str-slider]", 120);
  await page.waitForFunction(
    () => document.querySelector("[data-constitution-max-health]")?.textContent?.trim() === "2,810",
    undefined,
    { timeout: timeoutMs }
  );
  state = await readConstitutionCalculatorState(page);
  if (state.strength !== "120" || state.maxHealth !== "2,810") {
    throw new Error(`Constitution Strength contribution was unexpected: ${JSON.stringify(state)}`);
  }
}

async function setConstitutionRange(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

async function readConstitutionCalculatorState(page) {
  return await page.evaluate(() => ({
    bonus: document.querySelector("[data-constitution-regen-bonus]")?.textContent?.trim() || "",
    constitution: document.querySelector("[data-constitution-con]")?.textContent?.trim() || "",
    effectiveRegen: document.querySelector("[data-constitution-effective-regen]")?.textContent?.trim() || "",
    level: document.querySelector("[data-constitution-level]")?.textContent?.trim() || "",
    maxHealth: document.querySelector("[data-constitution-max-health]")?.textContent?.trim() || "",
    regenPerSec: document.querySelector("[data-constitution-regen-per-sec]")?.textContent?.trim() || "",
    regenTick: document.querySelector("[data-constitution-regen-tick]")?.textContent?.trim() || "",
    strength: document.querySelector("[data-constitution-str]")?.textContent?.trim() || "",
  }));
}

async function runDexteritySpec(browser, baseUrl) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await page.goto(joinUrl(baseUrl, "/pages/stats/dexterity.html"), { waitUntil: "load" });
    await page.locator(".dexterity-calculator-widget").waitFor({ state: "visible" });
    const pageText = (await page.locator(".main-content").textContent()).trim();
    for (const expected of [
      "Dexterity at a Glance",
      "Dexterity Calculator",
      "Damage Reduction Benchmarks",
      "Race Context",
      "Build Context",
      "Perks",
      "Equipment Reference",
      "Related Pages",
      "Melee Multiplier",
      "Crit Chance",
      "Damage Reduction",
      "1.35x",
      "Base Dex / 2.5",
      "Total Dex * 0.00125",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Dexterity page missing "${expected}": "${pageText}"`);
      }
    }

    for (const href of [
      "pages/stats/races.html",
      "pages/stats/strength.html",
      "pages/stats/constitution.html",
      "pages/General/build-planner.html",
      "pages/items/weapons.html",
      "pages/systems/perks.html",
    ]) {
      const count = await page.locator(`.dexterity-link-grid a[href="${href}"]`).count();
      if (count !== 1) {
        throw new Error(`Dexterity related link expected one "${href}", found ${count}`);
      }
    }

    await assertDexterityCalculator(page);
    await assertMobilePageFirstNavigation(page, baseUrl, "/pages/stats/dexterity.html");

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function assertDexterityCalculator(page) {
  await page.locator("[data-dexterity-dr-chart] .dexterity-benchmark-card").first().waitFor({ state: "visible" });
  const benchmarkCount = await page.locator("[data-dexterity-dr-chart] .dexterity-benchmark-card").count();
  if (benchmarkCount !== 5) {
    throw new Error(`Dexterity page expected 5 damage reduction benchmark cards, found ${benchmarkCount}`);
  }

  let state = await readDexterityCalculatorState(page);
  for (const [key, expected] of Object.entries({
    critChance: "60.0%",
    critDexterity: "150",
    critMultiplier: "1.35x",
    dexterity: "50",
    dr: "13.04% DR",
    drDexterity: "120",
    multiplier: "2.75x",
    postDr: "869.6 / 1,000",
    skill: "50",
    strength: "50",
  })) {
    if (state[key] !== expected) {
      throw new Error(`Dexterity calculator expected ${key}="${expected}", got "${state[key]}"`);
    }
  }

  await setDexterityRange(page, "[data-dexterity-dex-slider]", 150);
  await page.waitForFunction(
    () => document.querySelector("[data-dexterity-multiplier]")?.textContent?.trim() === "3.25x",
    undefined,
    { timeout: timeoutMs }
  );
  state = await readDexterityCalculatorState(page);
  if (state.dexterity !== "150" || state.multiplier !== "3.25x") {
    throw new Error(`Dexterity multiplier state after DEX 150 was unexpected: ${JSON.stringify(state)}`);
  }

  await setDexterityRange(page, "[data-dexterity-crit-dex-slider]", 200);
  await page.waitForFunction(
    () => document.querySelector("[data-dexterity-crit-chance]")?.textContent?.trim() === "80.0%",
    undefined,
    { timeout: timeoutMs }
  );
  state = await readDexterityCalculatorState(page);
  if (state.critDexterity !== "200" || state.critChance !== "80.0%") {
    throw new Error(`Dexterity crit state after base DEX 200 was unexpected: ${JSON.stringify(state)}`);
  }

  await setDexterityRange(page, "[data-dexterity-dr-slider]", 200);
  await page.waitForFunction(
    () => document.querySelector("[data-dexterity-dr]")?.textContent?.trim() === "20.00% DR",
    undefined,
    { timeout: timeoutMs }
  );
  state = await readDexterityCalculatorState(page);
  if (state.drDexterity !== "200" || state.dr !== "20.00% DR" || state.postDr !== "800 / 1,000") {
    throw new Error(`Dexterity DR state after total DEX 200 was unexpected: ${JSON.stringify(state)}`);
  }
}

async function setDexterityRange(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

async function readDexterityCalculatorState(page) {
  return await page.evaluate(() => ({
    critChance: document.querySelector("[data-dexterity-crit-chance]")?.textContent?.trim() || "",
    critDexterity: document.querySelector("[data-dexterity-crit-dex]")?.textContent?.trim() || "",
    critMultiplier: document.querySelector("[data-dexterity-crit-multiplier]")?.textContent?.trim() || "",
    dexterity: document.querySelector("[data-dexterity-dex]")?.textContent?.trim() || "",
    dr: document.querySelector("[data-dexterity-dr]")?.textContent?.trim() || "",
    drDexterity: document.querySelector("[data-dexterity-dr-dex]")?.textContent?.trim() || "",
    multiplier: document.querySelector("[data-dexterity-multiplier]")?.textContent?.trim() || "",
    postDr: document.querySelector("[data-dexterity-post-dr]")?.textContent?.trim() || "",
    skill: document.querySelector("[data-dexterity-skill]")?.textContent?.trim() || "",
    strength: document.querySelector("[data-dexterity-str]")?.textContent?.trim() || "",
  }));
}

async function runResistancesSpec(browser, baseUrl) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await page.goto(joinUrl(baseUrl, "/pages/stats/resistances.html"), { waitUntil: "load" });
    await page.locator(".resistance-calculator-widget").waitFor({ state: "visible" });
    const pageText = (await page.locator(".main-content").textContent()).trim();
    for (const expected of [
      "Resistance at a Glance",
      "Player Damage Preview",
      "Monster Type Matchups",
      "Build Context",
      "Perks",
      "Related Pages",
      "60%",
      "Applied after armor",
      "Weak To",
      "Resistant To",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Resistances page missing "${expected}": "${pageText}"`);
      }
    }

    for (const href of [
      "pages/items/armors.html",
      "pages/General/build-planner.html",
      "pages/enemies/monsters.html",
      "pages/items/weapons.html",
      "pages/systems/perks.html",
      "pages/systems/pvp-system.html",
    ]) {
      const count = await page.locator(`.resistance-link-grid a[href="${href}"]`).count();
      if (count !== 1) {
        throw new Error(`Resistances related link expected one "${href}", found ${count}`);
      }
    }

    await assertResistanceCalculator(page);
    await assertResistanceNeutralToggle(page);
    await assertMobilePageFirstNavigation(page, baseUrl, "/pages/stats/resistances.html");

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function assertResistanceCalculator(page) {
  await page.locator("[data-resistance-type-grid] [data-resistance-type-card]").first().waitFor({ state: "visible" });
  const typeCardCount = await page.locator("[data-resistance-type-grid] [data-resistance-type-card]").count();
  if (typeCardCount !== 11) {
    throw new Error(`Resistances page expected 11 monster type cards, found ${typeCardCount}`);
  }

  const humanoidText = (await page.locator('[data-resistance-type-card="humanoid"]').textContent()).trim();
  for (const expected of ["Humanoid", "Poison", "Disease", "Acid", "Cold"]) {
    if (!humanoidText.includes(expected)) {
      throw new Error(`Humanoid resistance card missing "${expected}": "${humanoidText}"`);
    }
  }

  let state = await readResistanceCalculatorState(page);
  for (const [key, expected] of Object.entries({
    capWarning: "25% before the 60% cap.",
    effective: "35.0%",
    finalDamage: "650 / 1,000",
    incoming: "1,000",
    reducedDamage: "350",
    resistance: "35",
  })) {
    if (state[key] !== expected) {
      throw new Error(`Resistance calculator expected ${key}="${expected}", got "${state[key]}"`);
    }
  }

  await setResistanceRange(page, "[data-resistance-value-slider]", 75);
  await page.waitForFunction(
    () => document.querySelector("[data-resistance-final-damage]")?.textContent?.trim() === "400 / 1,000",
    undefined,
    { timeout: timeoutMs }
  );
  state = await readResistanceCalculatorState(page);
  if (
    state.resistance !== "75" ||
    state.effective !== "60.0%" ||
    state.finalDamage !== "400 / 1,000" ||
    !state.capWarning.includes("15% over cap ignored")
  ) {
    throw new Error(`Resistance capped state after 75% was unexpected: ${JSON.stringify(state)}`);
  }

  await setResistanceRange(page, "[data-resistance-incoming-slider]", 2000);
  await page.waitForFunction(
    () => document.querySelector("[data-resistance-final-damage]")?.textContent?.trim() === "800 / 2,000",
    undefined,
    { timeout: timeoutMs }
  );
  state = await readResistanceCalculatorState(page);
  if (state.incoming !== "2,000" || state.finalDamage !== "800 / 2,000" || state.reducedDamage !== "1,200") {
    throw new Error(`Resistance damage state after 2,000 incoming was unexpected: ${JSON.stringify(state)}`);
  }
}

async function assertResistanceNeutralToggle(page) {
  const neutralGroups = page.locator('[data-resistance-group="neutral"]');
  const neutralGroupCount = await neutralGroups.count();
  if (neutralGroupCount < 1) {
    throw new Error("Resistances page expected neutral matchup groups");
  }
  const hiddenBefore = await page.locator('[data-resistance-group="neutral"][hidden]').count();
  if (hiddenBefore !== neutralGroupCount) {
    throw new Error(`Neutral groups should start hidden, hidden ${hiddenBefore} of ${neutralGroupCount}`);
  }

  await page.locator("[data-neutral-toggle]").click();
  await page.waitForFunction(
    () => document.querySelector("[data-neutral-toggle]")?.getAttribute("aria-pressed") === "true",
    undefined,
    { timeout: timeoutMs }
  );
  const hiddenAfter = await page.locator('[data-resistance-group="neutral"][hidden]').count();
  if (hiddenAfter !== 0) {
    throw new Error(`Neutral groups should be visible after toggle, still hidden ${hiddenAfter}`);
  }
}

async function setResistanceRange(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

async function readResistanceCalculatorState(page) {
  return await page.evaluate(() => ({
    capWarning: document.querySelector("[data-resistance-cap-warning]")?.textContent?.trim() || "",
    effective: document.querySelector("[data-resistance-effective]")?.textContent?.trim() || "",
    finalDamage: document.querySelector("[data-resistance-final-damage]")?.textContent?.trim() || "",
    incoming: document.querySelector("[data-resistance-incoming]")?.textContent?.trim() || "",
    reducedDamage: document.querySelector("[data-resistance-reduced-damage]")?.textContent?.trim() || "",
    resistance: document.querySelector("[data-resistance-value]")?.textContent?.trim() || "",
  }));
}

async function assertExperienceSimulator(page) {
  await setExperienceInput(page, "[data-xp-level-input]", 10);
  await setExperienceInput(page, "[data-xp-current-input]", 0);
  await setExperienceInput(page, "[data-xp-pool-input]", 1);
  await setExperienceInput(page, "[data-xp-min-input]", 100);
  await setExperienceInput(page, "[data-xp-max-input]", 100);
  await setExperienceInput(page, "[data-xp-multiplier-input]", 1.07);
  await setExperienceInput(page, "[data-xp-speed-input]", 1000);

  await page.waitForFunction(
    () => document.querySelector("[data-xp-rate]")?.textContent?.trim() === "107 xp/s",
    undefined,
    { timeout: timeoutMs }
  );

  await page.locator("[data-xp-run-tick]").click();
  await page.waitForFunction(
    () => document.querySelector("[data-xp-total]")?.textContent?.trim() === "214",
    undefined,
    { timeout: timeoutMs }
  );

  let state = await readExperienceState(page);
  for (const [key, expected] of Object.entries({
    base: "107",
    bonus: "107",
    current: "214",
    currentInput: "214",
    pool: "0.99",
    poolInput: "0.99",
    progress: "2.1%",
    total: "214",
  })) {
    if (state[key] !== expected) {
      throw new Error(`Experience simulator expected ${key}="${expected}", got "${state[key]}"`);
    }
  }

  await setExperienceInput(page, "[data-xp-pool-input]", 0);
  await page.locator("[data-xp-run-tick]").click();
  await page.waitForFunction(
    () => document.querySelector("[data-xp-bonus]")?.textContent?.trim() === "0",
    undefined,
    { timeout: timeoutMs }
  );
  state = await readExperienceState(page);
  if (state.total !== "107" || state.bonus !== "0") {
    throw new Error(`Experience simulator empty-pool tick expected total 107 and bonus 0: ${JSON.stringify(state)}`);
  }

  await setExperienceInput(page, "[data-xp-level-input]", 90);
  await page.waitForFunction(
    () => document.querySelector("[data-xp-build-rate]")?.textContent?.trim() === "+1.0 levels per 24 hours",
    undefined,
    { timeout: timeoutMs }
  );
}

async function setExperienceInput(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

async function readExperienceState(page) {
  return await page.evaluate(() => ({
    base: document.querySelector("[data-xp-base]")?.textContent?.trim() || "",
    bonus: document.querySelector("[data-xp-bonus]")?.textContent?.trim() || "",
    current: document.querySelector("[data-xp-current]")?.textContent?.trim() || "",
    currentInput: document.querySelector("[data-xp-current-input]")?.value || "",
    pool: document.querySelector("[data-xp-pool-remaining]")?.textContent?.trim() || "",
    poolInput: document.querySelector("[data-xp-pool-input]")?.value || "",
    progress: document.querySelector("[data-xp-progress]")?.textContent?.trim() || "",
    rate: document.querySelector("[data-xp-rate]")?.textContent?.trim() || "",
    total: document.querySelector("[data-xp-total]")?.textContent?.trim() || "",
  }));
}

async function runGuildSpec(browser, baseUrl) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await page.goto(joinUrl(baseUrl, "/pages/systems/guild.html"), { waitUntil: "load" });
    await page.locator(".guild-party-preview").waitFor({ state: "visible" });
    const pageText = (await page.locator("#guild-basics").textContent()).trim();
    for (const expected of [
      "Guild at a Glance",
      "Identity and Roster",
      "Rank and Management Flow",
      "Party Cycle Preview",
      "Operations Reference",
      "PVP and Group Context",
      "G",
      "50 members",
      "[Rank] Character Name",
      "Member",
      "Elder",
      "Council",
      "Leader",
      "Add Member",
      "Kick Member",
      "Promote",
      "Demote",
      "Guild Party",
      "Party A",
      "Party B",
      "Party C",
      "Leave",
      "Anti-Zerg sizing",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Guild page missing "${expected}": "${pageText}"`);
      }
    }

    for (const href of [
      "pages/systems/anti-zerg.html",
      "pages/systems/pvp-system.html",
      "pages/systems/chat.html",
      "pages/items/weapons.html",
      "pages/items/armors.html",
      "pages/enemies/monsters.html",
      "pages/General/play-the-game.html",
    ]) {
      const count = await page.locator(`.guild-link-grid a[href="${href}"]`).count();
      if (count !== 1) {
        throw new Error(`Guild related link expected one "${href}", found ${count}`);
      }
    }

    await assertGuildPartyPreview(page);
    await assertMobilePageFirstNavigation(page, baseUrl, "/pages/systems/guild.html");

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function assertGuildPartyPreview(page) {
  const currentParty = page.locator("[data-party-current]");
  await currentParty.waitFor({ state: "visible" });

  const initialText = (await currentParty.textContent()).trim();
  if (initialText !== "Party A") {
    throw new Error(`Guild party preview expected Party A initially, got "${initialText}"`);
  }

  await page.locator('[data-party-option="B"]').click();
  await page.waitForFunction(
    () => document.querySelector("[data-party-current]")?.textContent?.trim() === "Party B",
    undefined,
    { timeout: timeoutMs }
  );
  const selectedB = await page.locator('[data-party-option="B"]').getAttribute("aria-pressed");
  if (selectedB !== "true") {
    throw new Error(`Guild party preview did not mark Party B active, got aria-pressed="${selectedB}"`);
  }

  await page.locator("[data-party-cycle]").click();
  await page.waitForFunction(
    () => document.querySelector("[data-party-current]")?.textContent?.trim() === "Party C",
    undefined,
    { timeout: timeoutMs }
  );
  const partyCDescription = (await page.locator("[data-party-description]").textContent()).trim();
  if (!partyCDescription.includes("third guild party slot")) {
    throw new Error(`Guild party preview did not describe Party C: "${partyCDescription}"`);
  }

  await page.locator("[data-party-cycle]").click();
  await page.waitForFunction(
    () => document.querySelector("[data-party-current]")?.textContent?.trim() === "Party A",
    undefined,
    { timeout: timeoutMs }
  );
}

async function runChatSpec(browser, baseUrl) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await page.goto(joinUrl(baseUrl, "/pages/systems/chat.html"), { waitUntil: "load" });
    await page.locator(".chat-mode-preview").waitFor({ state: "visible" });
    const pageText = (await page.locator("#chat-basics").textContent()).trim();
    for (const expected of [
      "Chat at a Glance",
      "Viewing Channels",
      "Send Mode Preview",
      "Hotkeys and Input Flow",
      "Scope Reference",
      "All",
      "Local",
      "Global",
      "Guild",
      "T",
      "Tab",
      "Hold E",
      "Say",
      "Whisper",
      "Safe Zone Only",
      "World Channel",
      "Nearby Only",
      "Visible Area",
      "8 surrounding tiles",
      "server-wide messages sent from safe zones",
      "global-chat",
      "Discord",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Chat page missing "${expected}": "${pageText}"`);
      }
    }

    for (const href of [
      "pages/systems/guild.html",
      "pages/systems/pvp-system.html",
      "pages/systems/anti-zerg.html",
      "pages/General/play-the-game.html",
      "pages/items/weapons.html",
      "pages/items/armors.html",
    ]) {
      const count = await page.locator(`.chat-link-grid a[href="${href}"]`).count();
      if (count !== 1) {
        throw new Error(`Chat related link expected one "${href}", found ${count}`);
      }
    }

    await assertChatModePreview(page);
    await assertMobilePageFirstNavigation(page, baseUrl, "/pages/systems/chat.html");

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function assertChatModePreview(page) {
  const currentMode = page.locator("[data-chat-mode-current]");
  await currentMode.waitFor({ state: "visible" });

  const initialText = (await currentMode.textContent()).trim();
  if (initialText !== "Say") {
    throw new Error(`Chat mode preview expected Say initially, got "${initialText}"`);
  }

  await page.locator('[data-chat-mode="Global"]').click();
  await page.waitForFunction(
    () => document.querySelector("[data-chat-mode-current]")?.textContent?.trim() === "Global",
    undefined,
    { timeout: timeoutMs }
  );
  const globalPressed = await page.locator('[data-chat-mode="Global"]').getAttribute("aria-pressed");
  if (globalPressed !== "true") {
    throw new Error(`Chat mode preview did not mark Global active, got aria-pressed="${globalPressed}"`);
  }
  const globalText = (await page.locator(".chat-mode-output").textContent()).trim();
  if (!globalText.includes("server-wide messages sent from safe zones") || !globalText.includes("Safe Zone Only")) {
    throw new Error(`Chat Global mode did not show audience and safe-zone restriction: "${globalText}"`);
  }

  await page.locator('[data-chat-mode="Whisper"]').click();
  await page.waitForFunction(
    () => document.querySelector("[data-chat-mode-current]")?.textContent?.trim() === "Whisper",
    undefined,
    { timeout: timeoutMs }
  );
  const whisperText = (await page.locator(".chat-mode-output").textContent()).trim();
  if (!whisperText.includes("8 surrounding tiles") || !whisperText.includes("posts to Local")) {
    throw new Error(`Chat Whisper mode did not show tile-local scope: "${whisperText}"`);
  }

  await page.locator('[data-chat-mode="Guild"]').click();
  await page.waitForFunction(
    () => document.querySelector("[data-chat-mode-current]")?.textContent?.trim() === "Guild",
    undefined,
    { timeout: timeoutMs }
  );
  const guildText = (await page.locator(".chat-mode-output").textContent()).trim();
  if (!guildText.includes("members of your guild") || !guildText.includes("posts to Guild")) {
    throw new Error(`Chat Guild mode did not show guild scope: "${guildText}"`);
  }
}

async function runFloorCleanupSpec(browser, baseUrl) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await page.goto(joinUrl(baseUrl, "/pages/systems/floor-cleanup.html"), { waitUntil: "load" });
    await page.locator(".floor-cleanup-preview").waitFor({ state: "visible" });
    const pageText = (await page.locator("#floor-cleanup-basics").textContent()).trim();
    for (const expected of [
      "Floor Cleanup at a Glance",
      "Creeper Timing Rules",
      "Sweep Timing Preview",
      "Loot Lifetime Flow",
      "What Resets the Risk",
      "Related Pages",
      "Creeper",
      "3 minutes",
      "8 minutes",
      "8-11 minutes",
      "abandoned loot",
      "undisturbed time",
      "more than 8 minutes",
      "about 8 minutes",
      "up to 11 minutes",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Floor Cleanup page missing "${expected}": "${pageText}"`);
      }
    }

    for (const href of [
      "pages/systems/pvp-system.html",
      "pages/systems/corruption.html",
      "pages/systems/purge.html",
      "pages/items/weapons.html",
      "pages/items/armors.html",
      "pages/enemies/monsters.html",
      "pages/General/play-the-game.html",
    ]) {
      const count = await page.locator(`.floor-cleanup-link-grid a[href="${href}"]`).count();
      if (count !== 1) {
        throw new Error(`Floor Cleanup related link expected one "${href}", found ${count}`);
      }
    }

    await assertFloorCleanupPreview(page);
    await assertMobilePageFirstNavigation(page, baseUrl, "/pages/systems/floor-cleanup.html");

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function assertFloorCleanupPreview(page) {
  const title = page.locator("[data-cleanup-scenario-title]");
  await title.waitFor({ state: "visible" });

  const initialText = (await page.locator(".floor-cleanup-output").textContent()).trim();
  if (!initialText.includes("Worst Case") || !initialText.includes("about 8 minutes")) {
    throw new Error(`Floor Cleanup preview expected worst case initially, got "${initialText}"`);
  }

  await page.locator('[data-cleanup-scenario="after"]').click();
  await page.waitForFunction(
    () => document.querySelector("[data-cleanup-scenario-title]")?.textContent?.trim() === "Best Case",
    undefined,
    { timeout: timeoutMs }
  );
  const afterPressed = await page.locator('[data-cleanup-scenario="after"]').getAttribute("aria-pressed");
  if (afterPressed !== "true") {
    throw new Error(`Floor Cleanup preview did not mark after scenario active, got aria-pressed="${afterPressed}"`);
  }
  const afterText = (await page.locator(".floor-cleanup-output").textContent()).trim();
  if (!afterText.includes("up to 11 minutes") || !afterText.includes("next 3 minutes cleanup pass")) {
    throw new Error(`Floor Cleanup after scenario missing best-case timing: "${afterText}"`);
  }

  await page.locator('[data-cleanup-scenario="typical"]').click();
  await page.waitForFunction(
    () => document.querySelector("[data-cleanup-scenario-title]")?.textContent?.trim() === "Typical Window",
    undefined,
    { timeout: timeoutMs }
  );
  const typicalText = (await page.locator(".floor-cleanup-output").textContent()).trim();
  if (!typicalText.includes("8-11 minutes") || !typicalText.includes("3 minutes sweep cycle")) {
    throw new Error(`Floor Cleanup typical scenario missing lifetime window: "${typicalText}"`);
  }

  await page.locator('[data-cleanup-scenario="before"]').click();
  await page.waitForFunction(
    () => document.querySelector("[data-cleanup-scenario-title]")?.textContent?.trim() === "Worst Case",
    undefined,
    { timeout: timeoutMs }
  );
  const beforeText = (await page.locator(".floor-cleanup-output").textContent()).trim();
  if (!beforeText.includes("about 8 minutes") || !beforeText.includes("eligible when that sweep checks it")) {
    throw new Error(`Floor Cleanup before scenario missing threshold timing: "${beforeText}"`);
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
