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
    detailName: "Short Sword",
    detailQuery: "Short Sword",
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
      console.log("SMOKE OK perks: deep link, search, filters, source links");
    } catch (error) {
      failures.push(`SMOKE ERROR perks: ${formatError(error)}`);
    }
  } finally {
    await browser.close();
    if (server) await server.close();
  }

  if (failures.length) {
    failures.forEach((failure) => console.error(failure));
    process.exit(1);
  }
  console.log(`SMOKE OK site: ${smokeSpecs.length + 2} page(s) checked at ${baseUrl}`);
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
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    await page.goto(joinUrl(baseUrl, PERKS_RUNIC_PATH), { waitUntil: "load" });
    await page.locator("#perk-search").waitFor({ state: "visible" });
    await page.locator('[data-perk-name="Runic"].perk-selected').waitFor({ state: "visible" });
    await assertPerkSources(page);

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
