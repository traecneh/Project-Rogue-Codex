import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root || path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".."));
const timeoutMs = Number(args.timeoutMs || 20000);
const configuredBaseUrl = args.baseUrl ? normalizeBaseUrl(args.baseUrl) : null;
const configuredImpactPlanPath = args.impactPlan ? path.resolve(args.impactPlan) : null;
const configuredResultsPath = args.resultsPath ? path.resolve(args.resultsPath) : null;
let loadedImpactPlan = null;
const DEFAULT_CHANGED_RECORD_PROBE_LIMIT = 5;
const RUNE_SWORD_DETAIL_PATH = "pages/items/weapons.html?weapon=227";
const PERKS_RUNIC_PATH = "/pages/systems/perks.html?perk=Runic";
const QUESTS_INVESTIGATE_PATH = "/pages/General/quests.html?quest=investigate-the-undead";
const QUESTS_MASTERY_PATH = "/pages/General/quests.html?quest=mastery-of-silvest";
const QUESTS_GRAVE_CONSEQUENCES_PATH = "/pages/General/quests.html?quest=grave-consequences";

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
    checkIds: ["weapons-page"],
  },
  {
    assertDetail: assertArmorResistanceFilters,
    detailName: "Bottomless Bag",
    detailQuery: "1006",
    label: "armors",
    listPath: "/pages/items/armors.html",
    detailSelector: "#item-details",
    rowSelector: "#items-body tr[data-id]",
    detailLinkSelector: '#details-properties a[href*="pages/enemies/monsters.html?monster="]',
    queryKey: "armor",
    checkIds: ["armors-page", "resistance-matchups"],
  },
  {
    detailName: "Ascendancy Shard",
    detailQuery: "54",
    label: "collectables",
    listPath: "/pages/items/collectables.html",
    detailSelector: "#item-details",
    rowSelector: "#items-body tr[data-id]",
    detailLinkSelector: "",
    duplicateRoute: { id: "37", detailName: "Wraithfire Shard" },
    detailTextIncludes: ["Item Context", "Used In", "Ascend System", "Found From", "Deconstruct System"],
    detailHrefIncludes: ["pages/systems/ascend.html", "pages/systems/deconstruct.html"],
    queryKey: "collectable",
    checkIds: ["collectables-page"],
  },
  {
    detailName: "Carpentry Saw",
    detailQuery: "10",
    label: "useables",
    listPath: "/pages/items/useables.html",
    detailSelector: "#item-details",
    rowSelector: "#items-body tr[data-id]",
    detailLinkSelector: "",
    duplicateRoute: { id: "76", detailName: "Scroll of Imbuement" },
    detailTextIncludes: ["Item Context", "Used In", "Carpentry"],
    detailHrefIncludes: ["pages/stats/skills.html#carpentry"],
    queryKey: "useable",
    checkIds: ["useables-page"],
  },
  {
    assertDetail: assertMonsterRecommendationEnhancements,
    detailName: "Goblin",
    detailQuery: "goblin",
    label: "monsters",
    listPath: "/pages/enemies/monsters.html",
    detailSelector: "#monster-details",
    rowSelector: "#monsters-body tr[data-id]",
    detailLinkSelector:
      '#monster-details a[href*="pages/items/weapons.html?weapon="], #monster-details a[href*="pages/items/armors.html?armor="]',
    queryKey: "monster",
    checkIds: ["monsters-page", "monster-recommendations"],
  },
];

const standaloneSmokeRuns = [
  { id: "home", checkIds: [], run: runHomeSpec, summary: "timeline focus and stories" },
  {
    id: "build planner",
    checkIds: ["build-planner"],
    run: runBuildPlannerSpec,
    summary: "search, rarity, share reload, reset",
  },
  { id: "play the game", checkIds: [], run: runPlayTheGameSpec, summary: "Discord invitation, setup steps, mobile navigation" },
  { id: "quests", checkIds: [], run: runQuestsSpec, summary: "deep links, objectives, filters, relationships, search" },
  { id: "perks", checkIds: ["perk-sources"], run: runPerksSpec, summary: "deep link, search, filters, source links, tooltips" },
  { id: "rarity", checkIds: [], run: runRaritySpec, summary: "reference table, deterministic roll, upgrade preview" },
  { id: "reforge", checkIds: [], run: runRerollSpec, summary: "decision reference, flow, related links" },
  { id: "deconstruct", checkIds: [], run: runDeconstructSpec, summary: "shard decision reference, flow, related links" },
  { id: "ascend", checkIds: [], run: runAscendSpec, summary: "progression reference, decision guidance, related links" },
  { id: "craft", checkIds: [], run: runCraftSpec, summary: "ascendancy shop, imbuement crafting, related links" },
  { id: "imbuements", checkIds: [], run: runImbuementsSpec, summary: "targeting flow, source mechanics, related links" },
  { id: "purge", checkIds: [], run: runPurgeSpec, summary: "cleanup roles, recovery rules, related links" },
  { id: "encounter", checkIds: [], run: runEncounterSpec, summary: "state flow, elite variants, related links" },
  { id: "pvp", checkIds: [], run: runPvpSpec, summary: "rule reference, loot flow, related links" },
  { id: "anti-zerg", checkIds: [], run: runAntiZergSpec, summary: "rule reference, calculator, related links" },
  {
    id: "monster damage reduction",
    checkIds: [],
    run: runMonsterDamageReductionSpec,
    summary: "scaling reference, calculator, related links",
  },
  { id: "experience", checkIds: [], run: runExperienceSpec, summary: "pool reference, simulator, related links" },
  { id: "level", checkIds: [], run: runLevelSpec, summary: "summary cards, interactive curve, simplified layout" },
  { id: "skills", checkIds: [], run: runSkillsSpec, summary: "summary cards, interactive curve, Level 0 start" },
  { id: "races", checkIds: [], run: runRacesSpec, summary: "race bonuses, requirement preview, related links" },
  { id: "strength", checkIds: [], run: runStrengthSpec, summary: "formulas, calculator, benchmarks, related links" },
  { id: "constitution", checkIds: [], run: runConstitutionSpec, summary: "health, regen, benchmarks, related links" },
  { id: "dexterity", checkIds: [], run: runDexteritySpec, summary: "multiplier, crit, damage reduction, related links" },
  {
    id: "resistances",
    checkIds: ["resistance-matchups"],
    run: runResistancesSpec,
    summary: "player cap preview, monster type matchups, related links",
  },
  { id: "guild", checkIds: [], run: runGuildSpec, summary: "management reference, party preview, related links" },
  { id: "chat", checkIds: [], run: runChatSpec, summary: "channel reference, send preview, related links" },
  { id: "floor cleanup", checkIds: [], run: runFloorCleanupSpec, summary: "timing reference, preview, related links" },
  { id: "corruption", checkIds: [], run: runCorruptionSpec, summary: "corrupted innates, cleanse flow, related links" },
  { id: "crafting", checkIds: [], run: runCraftingSpec, summary: "armor reference, set preview, materials calculator" },
];

const IMPACT_RECORD_CHECK_IDS = new Set(["site-search", "deep-links", "asset-coverage", "item-relationships"]);
const IMPACT_TARGET_CONFIG = Object.fromEntries(
  smokeSpecs.map((spec) => [
    spec.label,
    {
      category: spec.label.slice(0, 1).toUpperCase() + spec.label.slice(1),
      detailSelector: spec.detailSelector,
      listPath: spec.listPath,
      queryKey: spec.queryKey,
      rowSelector: spec.rowSelector,
    },
  ])
);

async function assertArmorResistanceFilters(page) {
  const popover = page.locator("#filter-resist + .filter-popover");
  for (const [resistance, expectedCount] of [
    ["holy", 14],
    ["dark", 15],
  ]) {
    if (!(await popover.evaluate(el => el.open))) await popover.locator("summary").click();
    const checkbox = popover.getByRole("checkbox", {name: new RegExp(resistance, "i")});
    await checkbox.check();
    await page.waitForFunction(
      ({ count }) => document.querySelectorAll("#items-body tr[data-id]").length === count,
      { count: expectedCount },
      { timeout: timeoutMs }
    );
    const countText = (await page.locator("#item-count").textContent()).trim();
    if (!countText.startsWith(String(expectedCount))) {
      throw new Error(`Armor ${resistance} filter expected ${expectedCount} results, got "${countText}"`);
    }
    await page.getByRole("button", {name: new RegExp(`Remove Resistances: ${resistance}`, "i")}).click();
  }
  if (await popover.evaluate(el => el.open)) await popover.locator("summary").click();
}

main().catch(async (error) => {
  const message = formatError(error);
  try {
    await writeFatalSmokeResults(message);
  } catch (writeError) {
    console.error(`SMOKE ERROR results: ${formatError(writeError)}`);
  }
  console.error(`SMOKE ERROR site: ${message}`);
  process.exitCode = 1;
});

async function main() {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const impactPlan = configuredImpactPlanPath ? await loadImpactPlan(configuredImpactPlanPath) : null;
  loadedImpactPlan = impactPlan;
  const routedCheckIds = new Set((impactPlan?.checks || []).map((check) => check.id));
  if (impactPlan) validateImpactPlanCoverage(impactPlan);
  const selectedDetailSpecs = impactPlan
    ? smokeSpecs.filter((spec) => spec.checkIds.some((checkId) => routedCheckIds.has(checkId)))
    : smokeSpecs;
  const selectedStandaloneRuns = impactPlan
    ? standaloneSmokeRuns.filter((run) => run.checkIds.some((checkId) => routedCheckIds.has(checkId)))
    : standaloneSmokeRuns;
  const selectedImpactRecords = impactPlan
    ? selectImpactRecords(
        impactPlan.affectedRecords || [],
        impactPlan.browserProbePolicy?.changedRecordsPerTarget
      )
    : [];
  const runRecordProbes =
    Boolean(impactPlan) &&
    selectedImpactRecords.length > 0 &&
    Array.from(IMPACT_RECORD_CHECK_IDS).some((checkId) => routedCheckIds.has(checkId));
  const { chromium } = await importPlaywright();
  const server = configuredBaseUrl ? null : await startStaticServer(root);
  const baseUrl = configuredBaseUrl || `http://127.0.0.1:${server.port}/`;
  const browser = await launchBrowser(chromium);
  const failures = [];
  const groupResults = [];
  const recordResults = [];
  let completedGroupCount = 0;

  if (impactPlan) {
    console.log(
      `SMOKE PLAN ${routedCheckIds.size} routed check(s), ${selectedImpactRecords.length}/${impactPlan.affectedRecords?.length || 0} record probe(s)`
    );
  }

  try {
    for (const spec of selectedDetailSpecs) {
      const groupStartedAt = Date.now();
      const groupCheckIds = impactPlan
        ? spec.checkIds.filter((checkId) => routedCheckIds.has(checkId))
        : spec.checkIds;
      try {
        await runSpec(browser, baseUrl, spec);
        console.log(`SMOKE OK ${spec.label}: deep link, reload, row route, close route, detail links`);
        groupResults.push(buildGroupResult(spec.label, "page", groupCheckIds, groupStartedAt));
      } catch (error) {
        const failure = `SMOKE ERROR ${spec.label}: ${formatError(error)}`;
        failures.push(failure);
        groupResults.push(buildGroupResult(spec.label, "page", groupCheckIds, groupStartedAt, failure));
      }
      completedGroupCount += 1;
    }
    for (const run of selectedStandaloneRuns) {
      const groupStartedAt = Date.now();
      const groupCheckIds = impactPlan
        ? run.checkIds.filter((checkId) => routedCheckIds.has(checkId))
        : run.checkIds;
      try {
        await run.run(browser, baseUrl);
        console.log(`SMOKE OK ${run.id}: ${run.summary}`);
        groupResults.push(buildGroupResult(run.id, "page", groupCheckIds, groupStartedAt));
      } catch (error) {
        const failure = `SMOKE ERROR ${run.id}: ${formatError(error)}`;
        failures.push(failure);
        groupResults.push(buildGroupResult(run.id, "page", groupCheckIds, groupStartedAt, failure));
      }
      completedGroupCount += 1;
    }
    if (runRecordProbes) {
      const groupStartedAt = Date.now();
      const groupCheckIds = Array.from(IMPACT_RECORD_CHECK_IDS).filter((checkId) => routedCheckIds.has(checkId));
      try {
        await runImpactRecordSpec(browser, baseUrl, selectedImpactRecords, routedCheckIds, recordResults);
        console.log(`SMOKE OK impact records: ${selectedImpactRecords.length} changed-data route(s)`);
        groupResults.push(
          buildGroupResult("impact records", "records", groupCheckIds, groupStartedAt)
        );
      } catch (error) {
        const failure = `SMOKE ERROR impact records: ${formatError(error)}`;
        failures.push(failure);
        groupResults.push(
          buildGroupResult("impact records", "records", groupCheckIds, groupStartedAt, failure)
        );
      }
      completedGroupCount += 1;
    }
  } finally {
    await browser.close();
    if (server) await server.close();
  }

  const completedAtMs = Date.now();
  const results = buildSmokeResults({
    baseUrl,
    completedAtMs,
    failures,
    groupResults,
    impactPlan,
    recordResults,
    routedCheckIds,
    selectedImpactRecords,
    startedAt,
    startedAtMs,
  });
  if (configuredResultsPath) {
    await writeSmokeResults(configuredResultsPath, results);
  }
  if (failures.length) {
    failures.forEach((failure) => console.error(failure));
    process.exitCode = 1;
    return;
  }
  console.log(`SMOKE OK site: ${completedGroupCount} validation group(s) checked at ${baseUrl}`);
}

async function loadImpactPlan(planPath) {
  let payload;
  try {
    payload = JSON.parse(await readFile(planPath, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read impact validation plan ${planPath}: ${formatError(error)}`);
  }
  if (!payload || !Array.isArray(payload.checks) || !Array.isArray(payload.affectedRecords)) {
    throw new Error(`Impact validation plan ${planPath} is missing checks or affectedRecords`);
  }
  return payload;
}

function validateImpactPlanCoverage(plan) {
  const supported = new Set(IMPACT_RECORD_CHECK_IDS);
  smokeSpecs.forEach((spec) => spec.checkIds.forEach((checkId) => supported.add(checkId)));
  standaloneSmokeRuns.forEach((run) => run.checkIds.forEach((checkId) => supported.add(checkId)));
  const unknown = plan.checks
    .filter((check) => Array.isArray(check.automatedBy) && check.automatedBy.includes("smoke-site"))
    .map((check) => check.id)
    .filter((checkId) => !supported.has(checkId));
  if (unknown.length) {
    throw new Error(`Impact validation plan contains unsupported browser check(s): ${unknown.join(", ")}`);
  }
}

function selectImpactRecords(records, configuredLimit) {
  const numericLimit = Number(configuredLimit);
  const changedRecordLimit = Number.isInteger(numericLimit) && numericLimit >= 0
    ? numericLimit
    : DEFAULT_CHANGED_RECORD_PROBE_LIMIT;
  const changedByTarget = new Map();
  return records.filter((record) => {
    if (!record || !IMPACT_TARGET_CONFIG[record.target]) return false;
    if (record.changeType !== "changed") return record.changeType === "added" || record.changeType === "removed";
    const count = changedByTarget.get(record.target) || 0;
    if (count >= changedRecordLimit) return false;
    changedByTarget.set(record.target, count + 1);
    return true;
  });
}

function buildGroupResult(id, kind, checkIds, startedAtMs, error = null) {
  return {
    id,
    kind,
    checkIds: Array.from(new Set(checkIds)).sort(),
    status: error ? "failed" : "passed",
    durationMs: Date.now() - startedAtMs,
    ...(error ? { error } : {}),
  };
}

function buildSmokeResults({
  baseUrl,
  completedAtMs,
  failures,
  groupResults,
  impactPlan,
  recordResults,
  routedCheckIds,
  selectedImpactRecords,
  startedAt,
  startedAtMs,
}) {
  const failedGroups = groupResults.filter((result) => result.status === "failed").length;
  const failedRecords = recordResults.filter((result) => result.status === "failed").length;
  return {
    schemaVersion: 1,
    reportDigest: impactPlan?.reportDigest || null,
    mode: impactPlan ? "impact-plan" : "full",
    target: configuredBaseUrl ? "live" : "local",
    status: failures.length ? "failed" : "passed",
    startedAt,
    completedAt: new Date(completedAtMs).toISOString(),
    durationMs: completedAtMs - startedAtMs,
    baseUrl,
    plan: impactPlan
      ? {
          file: configuredImpactPlanPath ? path.basename(configuredImpactPlanPath) : null,
          routedCheckIds: Array.from(routedCheckIds).sort(),
          affectedRecordCount: impactPlan.affectedRecords?.length || 0,
          selectedRecordCount: selectedImpactRecords.length,
          browserProbePolicy: impactPlan.browserProbePolicy || null,
        }
      : null,
    summary: {
      groupCount: groupResults.length,
      passedGroups: groupResults.length - failedGroups,
      failedGroups,
      recordCount: recordResults.length,
      passedRecords: recordResults.length - failedRecords,
      failedRecords,
    },
    groups: groupResults,
    records: recordResults,
    failures,
  };
}

async function writeSmokeResults(resultsPath, results) {
  await mkdir(path.dirname(resultsPath), { recursive: true });
  await writeFile(resultsPath, `${JSON.stringify(results, null, 2)}\n`, "utf8");
  console.log(`SMOKE RESULTS: ${resultsPath}`);
}

async function writeFatalSmokeResults(message) {
  if (!configuredResultsPath) return;
  const now = new Date().toISOString();
  await writeSmokeResults(configuredResultsPath, {
    schemaVersion: 1,
    reportDigest: loadedImpactPlan?.reportDigest || null,
    mode: configuredImpactPlanPath ? "impact-plan" : "full",
    target: configuredBaseUrl ? "live" : "local",
    status: "failed",
    startedAt: now,
    completedAt: now,
    durationMs: 0,
    baseUrl: configuredBaseUrl,
    plan: configuredImpactPlanPath
      ? {
          file: path.basename(configuredImpactPlanPath),
          routedCheckIds: (loadedImpactPlan?.checks || []).map((check) => check.id).sort(),
          affectedRecordCount: loadedImpactPlan?.affectedRecords?.length || 0,
          selectedRecordCount: 0,
          browserProbePolicy: loadedImpactPlan?.browserProbePolicy || null,
        }
      : null,
    summary: {
      groupCount: 0,
      passedGroups: 0,
      failedGroups: 0,
      recordCount: 0,
      passedRecords: 0,
      failedRecords: 0,
    },
    groups: [],
    records: [],
    failures: [`SMOKE ERROR site: ${message}`],
  });
}

async function runImpactRecordSpec(browser, baseUrl, records, checkIds, results) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    for (const record of records) {
      const recordStartedAt = Date.now();
      const runtimeErrorIndex = runtimeErrors.length;
      try {
        await assertImpactRecord(page, baseUrl, record, checkIds);
        const recordRuntimeErrors = runtimeErrors.slice(runtimeErrorIndex);
        if (recordRuntimeErrors.length) {
          throw new Error(`browser errors: ${recordRuntimeErrors.join("; ")}`);
        }
        results.push(buildRecordResult(record, checkIds, recordStartedAt));
        console.log(`SMOKE RECORD OK ${record.target} ${record.changeType}: ${record.label}`);
      } catch (error) {
        const failure = formatError(error);
        results.push(buildRecordResult(record, checkIds, recordStartedAt, failure));
        console.error(`SMOKE RECORD ERROR ${record.target} ${record.changeType}: ${record.label}: ${failure}`);
      }
    }
  } finally {
    await page.close();
  }
  const failed = results.filter((result) => result.status === "failed");
  if (failed.length) {
    throw new Error(`${failed.length}/${results.length} record probe(s) failed`);
  }
}

function buildRecordResult(record, checkIds, startedAtMs, error = null) {
  return {
    target: record.target,
    changeType: record.changeType,
    label: record.label,
    name: record.name,
    queryValue: record.queryValue,
    checkIds: Array.from(IMPACT_RECORD_CHECK_IDS).filter((checkId) => checkIds.has(checkId)).sort(),
    status: error ? "failed" : "passed",
    durationMs: Date.now() - startedAtMs,
    ...(error ? { error } : {}),
  };
}

async function assertImpactRecord(page, baseUrl, record, checkIds) {
  const config = IMPACT_TARGET_CONFIG[record.target];
  const expectedPresent = record.changeType !== "removed";
  if (checkIds.has("site-search")) {
    await assertImpactSearchRecord(page, baseUrl, record, config, expectedPresent);
  }

  const needsDetail =
    checkIds.has("deep-links") || checkIds.has("asset-coverage") || checkIds.has("item-relationships");
  if (!needsDetail) return;

  await page.goto(
    joinUrl(baseUrl, config.listPath, { [config.queryKey]: record.queryValue }),
    { waitUntil: "load" }
  );
  await waitForRows(page, { ...config, label: record.target });

  if (!expectedPresent) {
    if (await page.locator(`${config.detailSelector}.show`).count()) {
      throw new Error(`${record.label} still resolves through its removed ${record.target} route`);
    }
    return;
  }

  await page.locator(`${config.detailSelector}.show`).waitFor({ state: "visible" });
  const detailName = await getDetailName(page);
  if (detailName !== record.name) {
    throw new Error(`${record.label} route selected "${detailName}" instead of "${record.name}"`);
  }

  if (checkIds.has("asset-coverage")) {
    await assertImpactRecordImage(page, record);
  }
  if (checkIds.has("item-relationships")) {
    await assertImpactRelationshipLinks(page, record);
  }
  if (checkIds.has("deep-links")) {
    await page.reload({ waitUntil: "load" });
    await waitForRows(page, { ...config, label: record.target });
    await page.locator(`${config.detailSelector}.show`).waitFor({ state: "visible" });
    const reloadedName = await getDetailName(page);
    if (reloadedName !== record.name) {
      throw new Error(`${record.label} reload selected "${reloadedName}" instead of "${record.name}"`);
    }
  }
}

async function assertImpactSearchRecord(page, baseUrl, record, config, expectedPresent) {
  await page.goto(normalizeBaseUrl(baseUrl), { waitUntil: "load" });
  const input = page.locator("#site-search-input");
  await input.waitFor({ state: "attached" });
  await input.fill(record.name);

  const exactResult = () =>
    page.evaluate(
      ({ category, listPath, name, queryKey }) => {
        const matches = Array.from(document.querySelectorAll("a.nav-search-result"))
          .map((link) => ({
            category: (link.querySelector(".nav-search-tag")?.textContent || "").trim(),
            href: link.href || "",
            title: (link.querySelector(".nav-search-result-title")?.textContent || "").trim(),
          }))
          .filter((entry) => entry.title === name && entry.category === category);
        const match = matches.find((entry) => {
          const url = new URL(entry.href, window.location.href);
          return url.pathname.endsWith(listPath) && url.searchParams.has(queryKey);
        });
        return match || null;
      },
      { category: config.category, listPath: config.listPath, name: record.name, queryKey: config.queryKey }
    );

  if (expectedPresent) {
    await page.waitForFunction(
      ({ category, listPath, name, queryKey }) =>
        Array.from(document.querySelectorAll("a.nav-search-result")).some((link) => {
          const title = (link.querySelector(".nav-search-result-title")?.textContent || "").trim();
          const tag = (link.querySelector(".nav-search-tag")?.textContent || "").trim();
          const url = new URL(link.href || "", document.baseURI);
          return title === name && tag === category && url.pathname.endsWith(listPath) && url.searchParams.has(queryKey);
        }),
      { category: config.category, listPath: config.listPath, name: record.name, queryKey: config.queryKey },
      { timeout: timeoutMs }
    );
    if (!(await exactResult())) throw new Error(`${record.label} is missing from site search`);
    return;
  }

  await page.waitForTimeout(750);
  await input.fill("");
  await input.fill(record.name);
  await page.waitForTimeout(750);
  if (await exactResult()) throw new Error(`${record.label} still appears in site search after removal`);
}

async function assertImpactRecordImage(page, record) {
  const image = page.locator("#details-image");
  const src = (await image.getAttribute("src")) || "";
  if (src) {
    await page.waitForFunction(() => {
      const target = document.querySelector("#details-image");
      return Boolean(target && target.complete);
    });
  }
  const state = await image.evaluate((target) => {
    const style = window.getComputedStyle(target);
    return {
      loaded: Boolean(target.getAttribute("src") && target.complete && target.naturalWidth > 0),
      visible: style.display !== "none" && style.visibility !== "hidden",
    };
  });
  if (state.visible && !state.loaded) {
    throw new Error(`${record.label} renders a broken detail image`);
  }
  if (record.changeType === "added" && !state.loaded) {
    throw new Error(`${record.label} was added without a rendered detail image`);
  }
}

async function assertImpactRelationshipLinks(page, record) {
  const hrefs = await page.locator("#details-properties a[href]").evaluateAll((links) =>
    Array.from(new Set(links.map((link) => link.href || ""))).filter(
      (href) => href && !href.startsWith("#") && !/^(?:mailto:|javascript:)/i.test(href)
    )
  );
  for (const href of hrefs) {
    const target = new URL(href, page.url());
    if (target.origin !== new URL(page.url()).origin) continue;
    const response = await page.request.get(target.toString());
    if (!response.ok()) {
      throw new Error(`${record.label} relationship link returned ${response.status()}: ${href}`);
    }
  }
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
    await assertDetailRouteDoesNotFilterList(page, spec, "deep link");
    await assertDetailLinks(page, spec);
    await assertDetailTextIncludes(page, spec);
    await assertDetailHrefIncludes(page, spec);

    await page.reload({ waitUntil: "load" });
    await waitForRows(page, spec);
    await assertDetailState(page, spec, "reload");
    await assertDetailRouteDoesNotFilterList(page, spec, "reload");
    if (typeof spec.assertDetail === "function") {
      await spec.assertDetail(page);
    }


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

    if (await page.locator(`${spec.detailSelector}.inline-detail`).count()) {
      if (await page.locator("#details-close").isVisible()) throw new Error("desktop inline details still show a close button");
      await page.locator("tr.detail-selected-row > td").first().click();
    } else {
      await page.locator("#details-close").click();
    }
    await page.waitForFunction((queryKey) => !new URL(window.location.href).searchParams.has(queryKey), spec.queryKey);
    const stillVisible = await page.locator(`${spec.detailSelector}.show`).count();
    if (stillVisible) throw new Error("close route left detail panel visible");

    await assertDuplicateRouteStability(page, baseUrl, spec);

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
    await page.locator(".home-timeline").waitFor({ state: "visible" });
    const pageText = (await page.locator(".main-content").textContent()).trim();
    for (const expected of [
      "Project Rogue Timeline",
      "Dransik Classic",
      "Project Rogue Begins",
      "Fresh Wipes & Live Upkeep",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Home page missing "${expected}": "${pageText}"`);
      }
    }
    for (const removed of ["Next Wipe", "Awaiting official date", "No official wipe date has been announced"]) {
      if (pageText.includes(removed)) {
        throw new Error(`Home page still contains removed wipe text "${removed}"`);
      }
    }



    await assertHomeTimelineFocus(page);
    await assertMobilePageFirstNavigation(page, baseUrl, "/index.html");

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function assertHomeTimelineFocus(page) {
  if (await page.locator('[data-era-filter]').count()) throw new Error('Timeline filters should be removed');
  if (await page.locator('[data-home-timeline-item]:not([hidden])').count() !== 23) throw new Error('All timeline entries should remain visible');
  const target = page.locator('[data-home-timeline-item]').nth(5);
  await target.evaluate(item => item.scrollIntoView({block: 'center'}));
  await page.waitForFunction(() => document.querySelectorAll('[data-home-timeline-item]')[5].classList.contains('is-timeline-focus'));
  const scales = await page.locator('[data-home-timeline-item]').evaluateAll(items => items.map(item => Number(item.style.getPropertyValue('--timeline-scale'))));
  if (scales[5] !== 1 || scales[4] >= 1 || scales[3] >= scales[4]) throw new Error('Timeline focus should taper neighboring entries');
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.waitForFunction(() => !document.querySelector('.home-timeline').classList.contains('timeline-focus-enabled'));
  await page.emulateMedia({reducedMotion: 'no-preference'});
  const story = page.locator('#dransik-commercial .history-story');
  await story.locator('summary').click();
  await story.locator('.history-story-body').waitFor({state: 'visible'});
  if (!(await story.textContent()).includes('March 2003 was not the Ashen Empires rebrand')) throw new Error('Missing chronology correction');
  if (!(await story.locator('.history-sources a').count())) throw new Error('Missing history sources');
  await page.locator('#modern-vorlia').evaluate(item => item.scrollIntoView({block: 'center'}));
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#dransik-commercial .history-story')).opacity === '1');
  await page.locator('#modern-vorlia summary').click();
  await page.locator('#modern-vorlia .history-permalink').click();
  await page.reload({waitUntil: 'load'});
  await page.locator('#modern-vorlia .history-story-body').waitFor({state: 'visible'});
  if (!(await page.locator('#modern-vorlia').textContent()).includes('Unconfirmed relationship')) throw new Error('Missing provenance qualification');
  await page.locator('#modern-vorlia summary').press('Escape');
  await page.locator('#modern-vorlia .history-story-body').waitFor({state: 'hidden'});
  await page.setViewportSize({width: 390, height: 844});
  await page.locator('#modern-vorlia summary').click();
  await page.locator('#modern-vorlia .history-story-body').waitFor({state: 'visible'});
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('History overflows mobile viewport');
  await page.setViewportSize({width: 1280, height: 900});
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
    if (restoredRarity !== "Rare") {
      throw new Error(`share reload restored weapon rarity "${restoredRarity}" instead of "Rare"`);
    }

    await page.locator("#reset-build").click();
    await page.waitForFunction(() => !document.querySelector(".slot-card.has-item"));
    const selectedCount = await page.locator(".slot-card.has-item").count();
    if (selectedCount) throw new Error(`reset left ${selectedCount} selected slot(s)`);

    await assertBuildPlannerCorrections(page, baseUrl);

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
    for (const expected of ["Downloads and account setup are in Discord.", "Join the Discord", "#welcome", "Create your account", "Log in and play"]) {
      if (!pageText.includes(expected)) throw new Error(`Play setup missing ${expected}`);
    }
    const cta = page.locator('[data-discord-cta]');
    if (await cta.count() !== 1 || await cta.getAttribute('href') !== 'https://discord.gg/DW6zcWy') throw new Error('Missing Discord invitation');
    if (await cta.getAttribute('rel') !== 'noreferrer noopener') throw new Error('Discord link needs external-tab protection');
    if (await page.locator('.play-step-card').count() !== 3) throw new Error('Expected three setup steps');
    if (await page.locator('[data-play-escort-wrap], [data-play-monster], [data-play-elite]').count()) throw new Error('Orbiting CTA decoration should be removed');
    if (await page.locator('h2').filter({hasText: /^Related (Pages|Item Pages|Codex Tools)$/}).count()) throw new Error('Related footer should be removed');

    await assertMobilePageFirstNavigation(page, baseUrl, "/pages/General/play-the-game.html");

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function assertMonsterRecommendationEnhancements(page) {
  const originalUrl = page.url();
  const targetUrl = new URL(originalUrl);

  targetUrl.searchParams.set("monster", "dark-monk");
  await page.goto(targetUrl.toString(), { waitUntil: "load" });
  await page.evaluate(() => localStorage.removeItem("project-rogue-codex:monster-weapon-ranking-v2"));
  await page.evaluate(() => localStorage.removeItem("project-rogue-codex:monster-armor-ranking-v3"));
  await page.reload({ waitUntil: "load" });
  await page.locator("#monster-details.show").waitFor({ state: "visible" });
  const rankingToggles = page.locator("#recommended-weapons > .weapon-ranking-toggle");
  if ((await rankingToggles.count()) !== 1) {
    throw new Error(`Dark Monk expected one weapon-ranking toggle, found ${await rankingToggles.count()}`);
  }
  const toggleText = (await rankingToggles.textContent()).trim();
  if (!toggleText.includes("View rankings") || !toggleText.includes("Item Lv <= 90")) {
    throw new Error(`Dark Monk item-level ranking did not default to monster level + 5: "${toggleText}"`);
  }
  await rankingToggles.click();
  await page.locator("#recommended-weapons .weapon-ranking-panel").waitFor({ state: "visible" });
  const weaponPerksInput = page.locator("#recommended-weapons .weapon-ranking-perks input");
  if ((await weaponPerksInput.count()) !== 1 || !(await weaponPerksInput.isChecked())) {
    throw new Error("Weapon rankings did not default to confirmed innate perks enabled");
  }

  const shadowfangRow = page
    .locator('#recommended-weapons .weapon-ranking-row[data-element="Dark"][data-multiplier="1.3"]')
    .filter({ hasText: "Shadowfang" })
    .first();
  await shadowfangRow.waitFor({ state: "attached" });
  const shadowfangText = (await shadowfangRow.textContent()).trim();
  if (!shadowfangText.includes("Dark 1.3x")) {
    throw new Error(`Dark Monk recommendation did not explain Shadowfang matchup: "${shadowfangText}"`);
  }

  const uniqueInput = page.locator("#recommended-weapons .weapon-ranking-unique input");
  await uniqueInput.uncheck();
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll("#recommended-weapons .weapon-ranking-body .weapon-ranking-row")).every(
        (row) => Number(row.dataset.itemLevel) > 0
      ),
    undefined,
    { timeout: timeoutMs }
  );
  await uniqueInput.check();

  const rankingSearch = page.locator("#recommended-weapons .weapon-ranking-search-control input");
  await rankingSearch.fill("Shadowfang");
  await page.waitForFunction(
    () => document.querySelectorAll("#recommended-weapons .weapon-ranking-body .weapon-ranking-row").length === 1,
    undefined,
    { timeout: timeoutMs }
  );
  await rankingSearch.fill("");

  const maxItemLevelInput = page.locator("#recommended-weapons .weapon-ranking-item-level-input");
  await maxItemLevelInput.fill("60");
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll("#recommended-weapons .weapon-ranking-body .weapon-ranking-row")).every(
        (row) => Number(row.dataset.itemLevel) === 0 || Number(row.dataset.itemLevel) <= 60
      ),
    undefined,
    { timeout: timeoutMs }
  );

  const typeSelect = page.locator("#recommended-weapons .weapon-ranking-type-select");
  const hiddenRangedOptionCount = await typeSelect.locator('option[value="Bow"], option[value="Crossbow"]').count();
  if (hiddenRangedOptionCount) {
    throw new Error(`Hidden ranged weapon types remained in recommendation filters: ${hiddenRangedOptionCount}`);
  }
  await typeSelect.selectOption("Sword");
  const typeState = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("#recommended-weapons .weapon-ranking-body .weapon-ranking-row"));
    return { count: rows.length, allSwords: rows.every((row) => row.dataset.type === "Sword") };
  });
  if (!typeState.count || !typeState.allSwords) {
    throw new Error(`Weapon-type ranking filter failed: ${JSON.stringify(typeState)}`);
  }

  await maxItemLevelInput.fill("70");
  targetUrl.searchParams.set("monster", "dusk-mage");
  await page.goto(targetUrl.toString(), { waitUntil: "load" });
  await page.locator("#monster-details.show").waitFor({ state: "visible" });
  if (
    (await page.locator("#recommended-weapons .weapon-ranking-item-level-input").inputValue()) !== "70" ||
    (await page.locator("#recommended-weapons .weapon-ranking-type-select").inputValue()) !== "Sword"
  ) {
    throw new Error("Weapon-ranking preferences did not persist across monster navigation");
  }
  await page.reload({ waitUntil: "load" });
  await page.locator("#monster-details.show").waitFor({ state: "visible" });
  if (
    (await page.locator("#recommended-weapons .weapon-ranking-item-level-input").inputValue()) !== "70" ||
    (await page.locator("#recommended-weapons .weapon-ranking-type-select").inputValue()) !== "Sword"
  ) {
    throw new Error("Weapon-ranking preferences did not persist across reload");
  }

  const duskRankingToggle = page.locator("#recommended-weapons > .weapon-ranking-toggle");
  await duskRankingToggle.click();
  await page.locator("#recommended-weapons .weapon-ranking-reset").click();
  const resetState = await page.evaluate(() => ({
    maxItemLevel:
      document.querySelector("#recommended-weapons .weapon-ranking-item-level-input")?.value || "",
    type: document.querySelector("#recommended-weapons .weapon-ranking-type-select")?.value || "",
    unique: Boolean(document.querySelector("#recommended-weapons .weapon-ranking-unique input")?.checked),
    perks: Boolean(document.querySelector("#recommended-weapons .weapon-ranking-perks input")?.checked),
  }));
  if (
    resetState.maxItemLevel !== "60" ||
    resetState.type !== "all" ||
    !resetState.unique ||
    !resetState.perks
  ) {
    throw new Error(`Weapon-ranking reset did not restore Dusk Mage defaults: ${JSON.stringify(resetState)}`);
  }

  const armorToggle = page.locator("#recommended-armors > .armor-ranking-toggle");
  if ((await armorToggle.count()) !== 1) {
    throw new Error(`Dusk Mage expected one armor-ranking toggle, found ${await armorToggle.count()}`);
  }
  const armorToggleText = (await armorToggle.textContent()).trim();
  if (!armorToggleText.includes("View sets") || !armorToggleText.includes("Item Lv <= 60")) {
    throw new Error(`Dusk Mage armor ranking did not default to monster level + 5: "${armorToggleText}"`);
  }
  await armorToggle.click();
  await page.locator("#recommended-armors .armor-ranking-panel").waitFor({ state: "visible" });
  const armorPerksInput = page.locator("#recommended-armors .armor-ranking-perks input");
  if ((await armorPerksInput.count()) !== 1 || !(await armorPerksInput.isChecked())) {
    throw new Error("Armor rankings did not default to confirmed innate perks enabled");
  }
  if (await page.locator("#recommended-armors [data-include-shield]").count()) {
    throw new Error("Armor rankings still exposed a shield toggle");
  }
  const armorSetHeaderText = (
    await page.locator("#recommended-armors .armor-set-header").textContent()
  ).trim();
  if (armorSetHeaderText.includes("Weight") || armorSetHeaderText.includes("Pieces")) {
    throw new Error(`Armor set rankings still exposed removed columns: "${armorSetHeaderText}"`);
  }

  const firstArmorSet = page.locator("#recommended-armors .armor-set-card").first();
  await firstArmorSet.waitFor({ state: "attached" });
  const firstArmorSetText = (await firstArmorSet.locator(".armor-set-toggle").textContent()).trim();
  if (!firstArmorSetText.includes("Dark")) {
    throw new Error(`Dusk Mage armor set did not rank Dark resistance first: "${firstArmorSetText}"`);
  }
  const armorSetState = await firstArmorSet.evaluate((card) => ({
    resistance: Number(card.dataset.resistance),
    totalResistance: Number(card.dataset.totalResistance),
    armor: Number(card.dataset.armor),
    weight: Number(card.dataset.weight),
  }));
  if (
    armorSetState.resistance < 0 ||
    armorSetState.resistance > 60 ||
    armorSetState.totalResistance < armorSetState.resistance ||
    armorSetState.armor <= 0 ||
    armorSetState.weight < 0
  ) {
    throw new Error(`Dusk Mage armor set totals were invalid: ${JSON.stringify(armorSetState)}`);
  }

  await firstArmorSet.locator(".armor-set-toggle").click();
  const fivePieceRows = firstArmorSet.locator(".armor-piece-row");
  if ((await fivePieceRows.count()) !== 5) {
    throw new Error(`Shield armor set expected five linked pieces, found ${await fivePieceRows.count()}`);
  }
  const invalidArmorLinks = await fivePieceRows.locator('a[href*="armors.html?armor="]').count();
  if (invalidArmorLinks !== 5) {
    throw new Error(`Shield armor set expected five armor detail links, found ${invalidArmorLinks}`);
  }
  const armorItemLevelsValid = await fivePieceRows.evaluateAll((rows) =>
    rows.every((row) => Number(row.dataset.itemLevel) > 0 && Number(row.dataset.itemLevel) <= 60)
  );
  if (!armorItemLevelsValid) {
    throw new Error("Dusk Mage armor set included an item above the item-level limit");
  }
  const firstSetPieceText = (await fivePieceRows.allTextContents()).join(" ");
  if (firstSetPieceText.includes("Scabbard of Arcus")) {
    throw new Error("Dusk Mage armor set incorrectly included item-level 145 Scabbard of Arcus");
  }

  await page.locator("#armor-ranking-slot-tab").click();
  await page.locator("#recommended-armors .armor-slot-select").selectOption("chest");
  const armorSlotState = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("#recommended-armors .armor-slot-row[data-slot]"));
    return {
      count: rows.length,
      allChest: rows.every((row) => row.dataset.slot === "chest"),
      withinLimit: rows.every(
        (row) => Number(row.dataset.itemLevel) > 0 && Number(row.dataset.itemLevel) <= 60
      ),
    };
  });
  if (!armorSlotState.count || !armorSlotState.allChest || !armorSlotState.withinLimit) {
    throw new Error(`Armor slot ranking filter failed: ${JSON.stringify(armorSlotState)}`);
  }

  const armorSearch = page.locator("#recommended-armors .armor-ranking-search-control input");
  await armorSearch.fill("White Robe");
  await page.waitForFunction(
    () => document.querySelectorAll("#recommended-armors .armor-slot-row[data-slot]").length === 1,
    undefined,
    { timeout: timeoutMs }
  );
  await armorSearch.fill("");

  const armorMaxItemLevelInput = page.locator("#recommended-armors .armor-ranking-level-input");
  await armorMaxItemLevelInput.fill("65");
  await armorSearch.fill("Black Dragon Armor");
  await page.waitForFunction(
    () => document.querySelectorAll("#recommended-armors .armor-slot-row[data-slot]").length === 1,
    undefined,
    { timeout: timeoutMs }
  );
  const craftedArmorState = await page
    .locator("#recommended-armors .armor-slot-row[data-slot]")
    .first()
    .evaluate((row) => ({
      name: row.textContent,
      itemLevel: row.dataset.itemLevel,
      rawItemLevel: row.dataset.rawItemLevel,
      crafted: row.dataset.crafted,
    }));
  if (
    !craftedArmorState.name.includes("Black Dragon Armor") ||
    !craftedArmorState.name.includes("Crafted Lv 65") ||
    craftedArmorState.itemLevel !== "65" ||
    craftedArmorState.rawItemLevel !== "0" ||
    craftedArmorState.crafted !== "true"
  ) {
    throw new Error(`Crafted armor recommendation level was incorrect: ${JSON.stringify(craftedArmorState)}`);
  }
  await armorSearch.fill("");

  await page.locator("#recommended-armors .armor-slot-select").selectOption("shield");
  const getArmorPerkOrder = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll("#recommended-armors .armor-slot-row[data-slot]")).map(
        (row) => ({
          name: row.querySelector(".armor-ranking-name")?.textContent?.trim() || "",
          perkCategory: row.dataset.perkCategory || "",
          text: row.textContent || "",
        })
      )
    );
  const perksOnOrder = await getArmorPerkOrder();
  const blackDragonPerksOn = perksOnOrder.findIndex((row) => row.name === "Black Dragon Shield");
  const redDragonPerksOn = perksOnOrder.findIndex((row) => row.name === "Red Dragon Scale Shield");
  const blackDragonPerkRow = perksOnOrder[blackDragonPerksOn];
  if (
    blackDragonPerksOn < 0 ||
    redDragonPerksOn < 0 ||
    blackDragonPerksOn >= redDragonPerksOn ||
    blackDragonPerkRow?.perkCategory !== "matchup" ||
    !blackDragonPerkRow?.text.includes("Consecration (Tier 2)")
  ) {
    throw new Error(`Armor perk matchup ranking was incorrect: ${JSON.stringify(perksOnOrder)}`);
  }

  await armorPerksInput.uncheck();
  const perksOffOrder = await getArmorPerkOrder();
  const blackDragonPerksOff = perksOffOrder.findIndex((row) => row.name === "Black Dragon Shield");
  const redDragonPerksOff = perksOffOrder.findIndex((row) => row.name === "Red Dragon Scale Shield");
  if (
    blackDragonPerksOff < 0 ||
    redDragonPerksOff < 0 ||
    redDragonPerksOff >= blackDragonPerksOff ||
    perksOffOrder.some((row) => row.text.includes("Consecration (Tier 2)"))
  ) {
    throw new Error(`Armor perk toggle did not restore base ranking: ${JSON.stringify(perksOffOrder)}`);
  }
  await armorPerksInput.check();

  const armorUniqueInput = page.locator("#recommended-armors .armor-ranking-unique input");
  await armorUniqueInput.check();
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll("#recommended-armors .armor-slot-row[data-slot]")).some(
        (row) => Number(row.dataset.itemLevel) === 0
      ),
    undefined,
    { timeout: timeoutMs }
  );
  await armorUniqueInput.uncheck();
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll("#recommended-armors .armor-slot-row[data-slot]")).every(
        (row) => Number(row.dataset.itemLevel) > 0
      ),
    undefined,
    { timeout: timeoutMs }
  );
  await armorUniqueInput.check();

  await page.locator("#recommended-armors .armor-ranking-reset").click();
  const armorResetState = await page.evaluate(() => ({
    maxLevel: document.querySelector("#recommended-armors .armor-ranking-level-input")?.value || "",
    unique: Boolean(document.querySelector("#recommended-armors .armor-ranking-unique input")?.checked),
    perks: Boolean(document.querySelector("#recommended-armors .armor-ranking-perks input")?.checked),
    setsSelected: document.querySelector("#armor-ranking-sets-tab")?.getAttribute("aria-selected"),
  }));
  if (
    armorResetState.maxLevel !== "60" ||
    armorResetState.unique ||
    !armorResetState.perks ||
    armorResetState.setsSelected !== "true"
  ) {
    throw new Error(`Armor-ranking reset did not restore Dusk Mage defaults: ${JSON.stringify(armorResetState)}`);
  }

  targetUrl.searchParams.set("monster", "dark-druid");
  await page.goto(targetUrl.toString(), { waitUntil: "load" });
  await page.locator("#monster-details.show").waitFor({ state: "visible" });
  const darkDruidToggle = page.locator("#recommended-weapons > .weapon-ranking-toggle");
  const darkDruidToggleText = (await darkDruidToggle.textContent()).trim();
  if (!darkDruidToggleText.includes("Item Lv <= 85")) {
    throw new Error(`Dark Druid ranking did not default to item level 85: "${darkDruidToggleText}"`);
  }
  await darkDruidToggle.click();
  const darkSwordRows = page
    .locator('#recommended-weapons .weapon-ranking-row[data-item-level="145"]')
    .filter({ hasText: "Dark Sword" });
  if ((await darkSwordRows.count()) !== 0) {
    throw new Error("Dark Druid default recommendations incorrectly included item-level 145 Dark Sword");
  }

  const darkDruidMaxItemLevel = page.locator(
    "#recommended-weapons .weapon-ranking-item-level-input"
  );
  await darkDruidMaxItemLevel.fill("145");
  await darkSwordRows.waitFor({ state: "attached" });
  const darkSwordText = (await darkSwordRows.textContent()).trim();
  if (!darkSwordText.includes("Item Lv 145") || !darkSwordText.includes("Req 85")) {
    throw new Error(`Dark Sword ranking context was incomplete: "${darkSwordText}"`);
  }
  await page.locator("#recommended-weapons .weapon-ranking-reset").click();

  targetUrl.searchParams.set("monster", "ice-dragon");
  await page.goto(targetUrl.toString(), { waitUntil: "load" });
  await page.locator("#monster-details.show").waitFor({ state: "visible" });
  const iceDragonToggle = page.locator("#recommended-weapons > .weapon-ranking-toggle");
  const iceDragonToggleText = (await iceDragonToggle.textContent()).trim();
  if (!iceDragonToggleText.includes("Item Lv <= 70")) {
    throw new Error(`Ice Dragon ranking did not default to item level 70: "${iceDragonToggleText}"`);
  }
  const iceDragonArmorToggleText = (
    await page.locator("#recommended-armors > .armor-ranking-toggle").textContent()
  ).trim();
  if (!iceDragonArmorToggleText.includes("Item Lv <= 70")) {
    throw new Error(`Ice Dragon armor ranking did not default to item level 70: "${iceDragonArmorToggleText}"`);
  }
  await iceDragonToggle.click();
  const darknessFallsRow = page
    .locator(
      '#recommended-weapons .weapon-ranking-row[data-skill-requirement="50"][data-item-level="50"]'
    )
    .filter({ hasText: "Darkness Falls" });
  await darknessFallsRow.waitFor({ state: "attached" });
  const darknessFallsText = (await darknessFallsRow.textContent()).trim();
  if (!darknessFallsText.includes("Item Lv 50") || !darknessFallsText.includes("Req 50")) {
    throw new Error(`Darkness Falls ranking context was incomplete: "${darknessFallsText}"`);
  }
  const iceDragonMaxItemLevel = page.locator(
    "#recommended-weapons .weapon-ranking-item-level-input"
  );
  await iceDragonMaxItemLevel.fill("100");
  const dragonfireSpearRow = page
    .locator('#recommended-weapons .weapon-ranking-row[data-item-level="100"]')
    .filter({ hasText: "Dragonfire Spear" });
  await dragonfireSpearRow.waitFor({ state: "attached" });
  const dragonfirePerkState = await dragonfireSpearRow.evaluate((row) => ({
    text: row.textContent || "",
    category: row.dataset.perkCategory || "",
    bonus: Number(row.dataset.perkBonus),
    effective: Number(row.dataset.effectiveDps),
    estimated: Number(row.dataset.estimatedDps),
  }));
  if (
    !dragonfirePerkState.text.includes("Iceshatter (Tier 2)") ||
    dragonfirePerkState.category !== "matchup" ||
    Math.abs(dragonfirePerkState.bonus - 0.13) > 0.0001 ||
    Math.abs(
      dragonfirePerkState.estimated -
        dragonfirePerkState.effective * (1 + dragonfirePerkState.bonus)
    ) > 0.0001
  ) {
    throw new Error(
      `Weapon perk damage adjustment was incorrect: ${JSON.stringify(dragonfirePerkState)}`
    );
  }

  const iceDragonPerksInput = page.locator("#recommended-weapons .weapon-ranking-perks input");
  await iceDragonPerksInput.uncheck();
  const dragonfireBaseState = await dragonfireSpearRow.evaluate((row) => ({
    text: row.textContent || "",
    bonus: Number(row.dataset.perkBonus),
    effective: Number(row.dataset.effectiveDps),
    estimated: Number(row.dataset.estimatedDps),
  }));
  if (
    dragonfireBaseState.text.includes("Iceshatter (Tier 2)") ||
    dragonfireBaseState.bonus !== 0 ||
    Math.abs(dragonfireBaseState.estimated - dragonfireBaseState.effective) > 0.0001
  ) {
    throw new Error(
      `Weapon perk toggle did not restore base DPS: ${JSON.stringify(dragonfireBaseState)}`
    );
  }
  await iceDragonPerksInput.check();
  await page.locator("#recommended-weapons .weapon-ranking-reset").click();

  const originalViewport = page.viewportSize();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "load" });
  await page.locator("#monster-details.show").waitFor({ state: "visible" });
  const mobileToggle = page.locator("#recommended-weapons > .weapon-ranking-toggle");
  await mobileToggle.click();
  const mobilePanelMetrics = await page.evaluate(() => {
    const panel = document.querySelector("#recommended-weapons .weapon-ranking-panel");
    const bounds = panel?.getBoundingClientRect();
    return bounds
      ? {
          left: bounds.left,
          right: bounds.right,
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
        }
      : null;
  });
  if (
    !mobilePanelMetrics ||
    mobilePanelMetrics.left < 0 ||
    mobilePanelMetrics.right > mobilePanelMetrics.viewportWidth ||
    mobilePanelMetrics.documentWidth > mobilePanelMetrics.viewportWidth
  ) {
    throw new Error(`Monster recommendation panel overflowed mobile viewport: ${JSON.stringify(mobilePanelMetrics)}`);
  }
  const mobileArmorToggle = page.locator("#recommended-armors > .armor-ranking-toggle");
  await mobileArmorToggle.click();
  const mobileArmorPanelMetrics = await page.evaluate(() => {
    const panel = document.querySelector("#recommended-armors .armor-ranking-panel");
    const bounds = panel?.getBoundingClientRect();
    return bounds
      ? {
          left: bounds.left,
          right: bounds.right,
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
        }
      : null;
  });
  if (
    !mobileArmorPanelMetrics ||
    mobileArmorPanelMetrics.left < 0 ||
    mobileArmorPanelMetrics.right > mobileArmorPanelMetrics.viewportWidth ||
    mobileArmorPanelMetrics.documentWidth > mobileArmorPanelMetrics.viewportWidth
  ) {
    throw new Error(`Armor recommendation panel overflowed mobile viewport: ${JSON.stringify(mobileArmorPanelMetrics)}`);
  }
  if (originalViewport) {
    await page.setViewportSize(originalViewport);
  }

  await page.goto(originalUrl, { waitUntil: "load" });
  await page.locator("#monster-details.show").waitFor({ state: "visible" });
}

async function runQuestsSpec(browser, baseUrl) {
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  await page.setViewportSize({ width: 1365, height: 1000 });
  const runtimeErrors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !text.startsWith("Failed to load resource")) runtimeErrors.push(text);
  });
  page.on("pageerror", (error) => runtimeErrors.push(formatError(error)));

  try {
    const questDataResponse = await page.request.get(
      joinUrl(baseUrl, "/pages/General/quests_data.json")
    );
    if (!questDataResponse.ok()) {
      throw new Error(`Quest checks could not load quest data: ${questDataResponse.status()}`);
    }
    const questData = await questDataResponse.json();

    await page.goto(joinUrl(baseUrl, QUESTS_INVESTIGATE_PATH), { waitUntil: "load" });
    await page.locator(".quest-detail-title").waitFor({ state: "visible" });
    const title = (await page.locator(".quest-detail-title").textContent()).trim();
    if (title !== "Investigate the Undead") {
      throw new Error(`Quest deep link opened "${title}" instead of "Investigate the Undead"`);
    }

    const sourceEntries = [...(questData.quests || []), ...(questData.services || [])];
    const expectedDefaultOrder = sourceEntries
      .map((entry, sourceIndex) => ({ id: entry.id, level: entry.min_level, sourceIndex }))
      .sort((left, right) => left.level - right.level || left.sourceIndex - right.sourceIndex)
      .map((entry) => entry.id);
    const actualDefaultOrder = await page
      .locator("#quest-list [data-entry-id]")
      .evaluateAll((entries) => entries.map((entry) => entry.dataset.entryId));
    if (JSON.stringify(actualDefaultOrder) !== JSON.stringify(expectedDefaultOrder)) {
      throw new Error(
        `Quest list is not ordered by level with stable source ties: ${actualDefaultOrder.join(", ")}`
      );
    }

    await page.locator("#quest-search").fill("Silvest");
    await page.waitForFunction(
      () => document.querySelectorAll("#quest-list [data-entry-id]").length > 1
    );
    const filteredLevels = await page
      .locator("#quest-list .quest-list-heading .quest-badge")
      .allTextContents();
    const numericFilteredLevels = filteredLevels.map((label) =>
      Number.parseInt(label.replace(/\D+/g, ""), 10)
    );
    if (numericFilteredLevels.length < 2) {
      throw new Error(`Filtered quest list did not expose level badges: ${filteredLevels.join(", ")}`);
    }
    if (
      numericFilteredLevels.some(
        (level, index) => index > 0 && level < numericFilteredLevels[index - 1]
      )
    ) {
      throw new Error(`Filtered quest list is not ordered by level: ${filteredLevels.join(", ")}`);
    }
    await page.locator("#quest-search").fill("");
    await page.waitForFunction(
      (expectedCount) =>
        document.querySelectorAll("#quest-list [data-entry-id]").length === expectedCount,
      expectedDefaultOrder.length
    );

    const detailText = (await page.locator("#quest-detail").textContent()).trim();
    for (const expected of [
      "Deadly Kobold Spears",
      "Kill Dark Mages",
      "3 required",
      "Kill Skeleton Wolf",
      "1 required",
      "1,750 Experience",
    ]) {
      if (!detailText.includes(expected)) {
        throw new Error(`Investigate the Undead detail missing "${expected}": "${detailText}"`);
      }
    }

    for (const href of [
      "pages/enemies/monsters.html?monster=94",
      "pages/enemies/monsters.html?monster=58",
      "pages/enemies/monsters.html?monster=67",
    ]) {
      const count = await page.locator(`#quest-detail a[href="${href}"]`).count();
      if (count !== 1) {
        throw new Error(`Quest entity link expected one "${href}", found ${count}`);
      }
    }
    await page.locator('#quest-detail img[src*="Zombie-94.gif"]').waitFor({ state: "visible" });

    const zombiePage = await browser.newPage();
    try {
      zombiePage.setDefaultTimeout(timeoutMs);
      await zombiePage.goto(joinUrl(baseUrl, "/pages/enemies/monsters.html?monster=94"), {
        waitUntil: "load",
      });
      await zombiePage.locator("#monster-details.show").waitFor({ state: "visible" });
      const zombieName = (await zombiePage.locator("#details-name").textContent()).trim();
      const zombieLevel = (await zombiePage.locator("#details-level").textContent()).trim();
      if (zombieName !== "Zombie" || zombieLevel !== "10") {
        throw new Error(`Zombie ID 94 opened name="${zombieName}" level="${zombieLevel}"`);
      }
      await zombiePage.locator('#details-image[src*="Zombie-94.gif"]').waitFor({ state: "visible" });
      await zombiePage.locator("#monster-search").fill("Zombie");
      await zombiePage.waitForFunction(() => {
        const rows = Array.from(document.querySelectorAll("#monsters-body tr[data-id]"));
        return rows.length === 1 && rows[0].getAttribute("data-id") === "94";
      });
      await zombiePage
        .locator('#monsters-body tr[data-id="94"] img[src*="Zombie-94.gif"]')
        .waitFor({ state: "visible" });
    } finally {
      await zombiePage.close();
    }

    const masteryPage = await browser.newPage();
    try {
      masteryPage.setDefaultTimeout(timeoutMs);
      await masteryPage.goto(joinUrl(baseUrl, QUESTS_MASTERY_PATH), { waitUntil: "load" });
      const bottomlessBagLink = masteryPage.locator(
        '#quest-detail a[href="pages/items/armors.html?armor=1006"]'
      );
      await bottomlessBagLink.waitFor({ state: "visible" });
      const [rewardPage] = await Promise.all([masteryPage.waitForEvent('popup'), bottomlessBagLink.click()]);
      await rewardPage.waitForURL((url) => url.searchParams.get("armor") === "1006", {
        timeout: timeoutMs,
      });
      await rewardPage.locator("#item-details.show").waitFor({ state: "visible" });
      const armorName = (await rewardPage.locator("#details-name").textContent()).trim();
      const armorSearch = await rewardPage.locator("#item-search").inputValue();
      await rewardPage.close();
      if (!masteryPage.url().includes('quest=mastery-of-silvest')) throw new Error('Reward link replaced the quest route');
      if (armorName !== "Bottomless Bag" || armorSearch) {
        throw new Error(
          `Bottomless Bag quest link opened name="${armorName}" with search="${armorSearch}"`
        );
      }
    } finally {
      await masteryPage.close();
    }

    await page.reload({ waitUntil: "load" });
    await page.locator(".quest-detail-title").waitFor({ state: "visible" });
    if ((await page.locator(".quest-detail-title").textContent()).trim() !== "Investigate the Undead") {
      throw new Error("Quest deep link did not survive reload");
    }

    await page.locator('[data-quest-id="deadly-kobold-spears"]').click();
    await page.waitForFunction(
      () => new URL(window.location.href).searchParams.get("quest") === "deadly-kobold-spears"
    );
    if ((await page.locator(".quest-detail-title").textContent()).trim() !== "Deadly Kobold Spears") {
      throw new Error("Quest prerequisite link did not open Deadly Kobold Spears");
    }

    await page.goBack({ waitUntil: "load" });
    await page.locator(".quest-detail-title").waitFor({ state: "visible" });
    if ((await page.locator(".quest-detail-title").textContent()).trim() !== "Investigate the Undead") {
      throw new Error("Quest browser back did not restore Investigate the Undead");
    }

    await page.locator("#site-search-input").waitFor({ state: "visible" });
    await page.locator("#site-search-input").fill("Tomard");
    await page
      .locator('.nav-search-result[href*="pages/General/quests.html?quest=investigate-the-undead"]')
      .waitFor({ state: "visible" });
    await page.locator("#site-search-input").fill("");

    await page.locator("#quest-search").fill("Guild Master");
    await page.waitForFunction(() => {
      const rows = document.querySelectorAll("[data-entry-id]");
      return rows.length === 1 && rows[0].getAttribute("data-entry-id") === "create-a-guild";
    });
    await page.locator('[data-entry-id="create-a-guild"]').click();
    await page.waitForFunction(
      () => new URL(window.location.href).searchParams.get("quest") === "create-a-guild"
    );
    const serviceText = (await page.locator("#quest-detail").textContent()).trim();
    for (const expected of ["Create a Guild", "Guild Master", "Gold", "x50", "Guild System"]) {
      if (!serviceText.includes(expected)) {
        throw new Error(`Guild service detail missing "${expected}": "${serviceText}"`);
      }
    }
    const goldLinkCount = await page.locator(
      '#quest-detail a[href="pages/items/collectables.html?collectable=0"]'
    ).count();
    if (goldLinkCount !== 1) {
      throw new Error(`Guild service expected one Gold collectable link, found ${goldLinkCount}`);
    }
    await page.locator('#quest-detail img[src*="Gold.png"]').waitFor({ state: "visible" });
    const guildMapLink = page.locator(
      '#quest-detail a.quest-map-link[href="https://traecneh.github.io/Project-Rogue-Map/?x=3404&y=3720&label=Guild+Master"]'
    );
    if ((await guildMapLink.count()) !== 1) {
      throw new Error("Guild service is missing its labeled Project Rogue Map coordinate link");
    }
    if ((await page.locator("#quest-detail a.quest-map-preview").count()) !== 0) {
      throw new Error("Guild service should retain its coordinate link instead of a quest map preview");
    }
    if (
      (await guildMapLink.getAttribute("target")) !== "_blank" ||
      !(await guildMapLink.getAttribute("rel"))?.includes("noopener")
    ) {
      throw new Error("Quest map links must open safely in a new tab");
    }

    await page.goto(joinUrl(baseUrl, QUESTS_GRAVE_CONSEQUENCES_PATH), { waitUntil: "load" });
    await page.locator(".quest-detail-title").waitFor({ state: "visible" });
    const graveTitle = (await page.locator(".quest-detail-title").textContent()).trim();
    if (graveTitle !== "Grave Consequences") {
      throw new Error(`Quest deep link opened "${graveTitle}" instead of "Grave Consequences"`);
    }
    const graveText = (await page.locator("#quest-detail").textContent()).trim();
    for (const expected of [
      "Jeel",
      "Mayor of Jeel",
      "Kill Skeletons",
      "25 required",
      "Kill Skeleton Warriors",
      "15 required",
      "Kill Undead Warriors",
      "10 required",
      "4,250 Experience",
    ]) {
      if (!graveText.includes(expected)) {
        throw new Error(`Grave Consequences detail missing "${expected}": "${graveText}"`);
      }
    }
    for (const href of [
      "pages/enemies/monsters.html?monster=46",
      "pages/enemies/monsters.html?monster=120",
      "pages/enemies/monsters.html?monster=96",
    ]) {
      const count = await page.locator(`#quest-detail a[href="${href}"]`).count();
      if (count !== 1) {
        throw new Error(`Grave Consequences expected one "${href}", found ${count}`);
      }
    }
    const mayorMapPreviews = page.locator(
      '#quest-detail a.quest-map-preview[href="https://traecneh.github.io/Project-Rogue-Map/?x=3766&y=3232&label=Mayor+of+Jeel"]'
    );
    if ((await mayorMapPreviews.count()) !== 2) {
      throw new Error("Grave Consequences should preview both giver and turn-in coordinates");
    }

    const regionalQuests = [
      {
        path: "/pages/General/quests.html?quest=the-backroom",
        title: "The Backroom",
        expected: [
          "Hothbra",
          "Lyrael",
          "Scared Thief",
          "Kill Zombies",
          "5 required",
          "Kill Hell Hounds",
          "20 required",
          "Guard Captain of Hothbra",
          "15,000 Experience",
        ],
      },
      {
        path: "/pages/General/quests.html?quest=the-highwaymans-due",
        title: "The Highwayman's Due",
        expected: ["Town Crier", "Kill Thieves", "15 required", "Kill Fighters", "3,250 Experience"],
      },
      {
        path: "/pages/General/quests.html?quest=scurvy-dogs",
        title: "Scurvy Dogs",
        expected: [
          "Jack Sparrow",
          "Kill Pirates",
          "Kill Swashbucklers",
          "Kill Pirate Captains",
          "17,500 Experience",
        ],
      },
      {
        path: "/pages/General/quests.html?quest=lotors-ettin-slayer",
        title: "Lotor's Ettin Slayer",
        expected: [
          "King Lotor",
          "Kill Ettins",
          "50 required",
          "Uncooked Ribs",
          "10 required",
          "27,500 Experience",
        ],
      },
      {
        path: "/pages/General/quests.html?quest=wailing-souls",
        title: "Wailing Souls",
        expected: ["New Korelth", "Guard Captain", "Kill Ghosts", "Kill Wraiths", "10,000 Experience"],
      },
      {
        path: "/pages/General/quests.html?quest=the-scared-guard",
        title: "The Scared Guard",
        expected: [
          "Scared Guard",
          "Kill Undead Warriors",
          "29 required",
          "Kill Zombies",
          "15 required",
          "3,250 Experience",
        ],
      },
      {
        path: "/pages/General/quests.html?quest=the-approaching-orcs",
        title: "The Approaching Orcs",
        expected: ["Vrethpool", "Maribell", "Kill Orcs", "Kill Goblins", "1,750 Experience"],
      },
      {
        path: "/pages/General/quests.html?quest=where-theres-smoke",
        title: "Where There's Smoke",
        expected: [
          "Mayor of Vrethpool",
          "Kill Hell Hounds",
          "30 required",
          "Kill Imps",
          "17,500 Experience",
        ],
      },
      {
        path: "/pages/General/quests.html?quest=a-headless-problem",
        title: "A Headless Problem",
        expected: ["Lazy Guard", "Kill Headless", "Kill Lizardmen", "1,250 Experience"],
      },
      {
        path: "/pages/General/quests.html?quest=banished-no-more",
        title: "Banished No More",
        expected: [
          "Garnea",
          "Jimothy",
          "Kill Banished Spirits",
          "Kill Banished Soldiers",
          "75,000 Experience",
        ],
      },
      {
        path: "/pages/General/quests.html?quest=the-fallen-order",
        title: "The Fallen Order",
        expected: [
          "Banished No More",
          "Kill Banished Knights",
          "Kill Blue Wisps",
          "55,000 Experience",
        ],
      },
      {
        path: "/pages/General/quests.html?quest=feathers-and-fury",
        title: "Feathers and Fury",
        expected: [
          "Parian",
          "Preston the Archer",
          "Kill Harpies",
          "Kill Minotaurs",
          "Kill Evil Eyes",
          "12,500 Experience",
        ],
      },
    ];
    for (const quest of regionalQuests) {
      await page.goto(joinUrl(baseUrl, quest.path), { waitUntil: "load" });
      await page.locator(".quest-detail-title").waitFor({ state: "visible" });
      const regionalTitle = (await page.locator(".quest-detail-title").textContent()).trim();
      if (regionalTitle !== quest.title) {
        throw new Error(`Quest deep link opened "${regionalTitle}" instead of "${quest.title}"`);
      }
      const regionalText = (await page.locator("#quest-detail").textContent()).trim();
      for (const expected of quest.expected) {
        if (!regionalText.includes(expected)) {
          throw new Error(`${quest.title} detail missing "${expected}": "${regionalText}"`);
        }
      }
    }

    for (const quest of questData.quests || []) {
      const coordinateOccurrences = [];
      const addCoordinates = (coordinates) => {
        if (Array.isArray(coordinates) && coordinates.length === 2) {
          coordinateOccurrences.push(coordinates);
        }
      };
      addCoordinates(quest.giver?.coordinates);
      for (const stage of quest.stages || []) {
        for (const objective of stage.objectives || []) {
          addCoordinates(objective.target?.coordinates);
          addCoordinates(objective.target?.destination_coordinates);
        }
      }
      addCoordinates(quest.turn_in?.coordinates);

      await page.goto(
        joinUrl(
          baseUrl,
          `/pages/General/quests.html?quest=${encodeURIComponent(quest.id)}`
        ),
        { waitUntil: "load" }
      );
      await page.locator(".quest-detail-title").waitFor({ state: "visible" });
      const previewCount = await page.locator("#quest-detail a.quest-map-preview").count();
      if (previewCount !== coordinateOccurrences.length) {
        throw new Error(
          `${quest.name} expected ${coordinateOccurrences.length} contextual map previews, found ${previewCount}`
        );
      }
      if ((await page.locator("#quest-detail a.quest-map-link").count()) !== 0) {
        throw new Error(`${quest.name} still renders numeric coordinate links`);
      }
      if ((await page.locator("#quest-detail .quest-map-preview-section").count()) !== 0) {
        throw new Error(`${quest.name} still renders a standalone Locations section`);
      }

      const expectedCoordinateCounts = new Map();
      coordinateOccurrences.forEach(([x, y]) => {
        const key = `${x},${y}`;
        expectedCoordinateCounts.set(key, (expectedCoordinateCounts.get(key) || 0) + 1);
      });
      for (const [coordinate, expectedCount] of expectedCoordinateCounts) {
        const actualCount = await page
          .locator(`#quest-detail a.quest-map-preview[data-map-coordinate="${coordinate}"]`)
          .count();
        if (actualCount !== expectedCount) {
          throw new Error(
            `${quest.name} expected ${expectedCount} preview(s) for ${coordinate}, found ${actualCount}`
          );
        }
      }

      const previewState = await page.locator("#quest-detail a.quest-map-preview").evaluateAll(
        (previews) =>
          previews.map((preview) => {
            const url = new URL(preview.href);
            const [x, y] = preview.dataset.mapCoordinate.split(",");
            return {
              contextual: Boolean(
                preview.closest(".quest-fact-value, .quest-target-line, .quest-turn-in")
              ),
              safeTarget:
                preview.target === "_blank" && preview.rel.split(/\s+/).includes("noopener"),
              coordinatesMatch:
                url.searchParams.get("x") === x && url.searchParams.get("y") === y,
            };
          })
      );
      if (
        previewState.some(
          (preview) =>
            !preview.contextual || !preview.safeTarget || !preview.coordinatesMatch
        )
      ) {
        throw new Error(`${quest.name} has an invalid contextual Project Rogue Map link`);
      }

      if (coordinateOccurrences.length) {
        await page.waitForFunction((expectedCount) => {
          const images = Array.from(document.querySelectorAll(".quest-map-preview-image"));
          return (
            images.length === expectedCount &&
            images.every((image) => image.complete && image.naturalWidth === 4096)
          );
        }, coordinateOccurrences.length);
      }
      const floorLabels = await page.locator(".quest-map-preview-floor").allTextContents();
      const expectedUnderground = coordinateOccurrences.filter(([x]) => x >= 4096).length;
      if (
        floorLabels.filter((label) => label === "UG").length !== expectedUnderground ||
        floorLabels.filter((label) => label === "OW").length !==
          coordinateOccurrences.length - expectedUnderground
      ) {
        throw new Error(`${quest.name} has incorrect overworld/underground map badges`);
      }
    }

    await page.goto(joinUrl(baseUrl, "/pages/General/quests.html?quest=the-backroom"), {
      waitUntil: "load",
    });
    for (const coordinate of ["3576,3031", "7695,3018", "7687,2961"]) {
      const count = await page
        .locator(`#quest-detail a.quest-map-preview[data-map-coordinate="${coordinate}"]`)
        .count();
      if (count !== 1) {
        throw new Error(`The Backroom expected one map preview for ${coordinate}, found ${count}`);
      }
    }
    const guardCoordinateCount = await page
      .locator('#quest-detail a.quest-map-preview[data-map-coordinate="3576,3015"]')
      .count();
    if (guardCoordinateCount !== 2) {
      throw new Error(`The Backroom expected contextual Guard Captain previews, found ${guardCoordinateCount}`);
    }
    const backroomPreviewCount = await page.locator("#quest-detail a.quest-map-preview").count();
    if (backroomPreviewCount !== 6) {
      throw new Error(`The Backroom expected six contextual map previews, found ${backroomPreviewCount}`);
    }
    if ((await page.locator("#quest-detail a.quest-map-link").count()) !== 0) {
      throw new Error("The Backroom should replace visible coordinate links with map previews");
    }
    if ((await page.locator("#quest-detail .quest-map-preview-section").count()) !== 0) {
      throw new Error("The Backroom should not collect map previews in a Locations section");
    }
    const backroomPreviewsAreContextual = await page
      .locator("#quest-detail a.quest-map-preview")
      .evaluateAll((previews) =>
        previews.every((preview) =>
          Boolean(preview.closest(".quest-fact-value, .quest-target-line, .quest-turn-in"))
        )
      );
    if (!backroomPreviewsAreContextual) {
      throw new Error("The Backroom map previews are not attached to their quest context");
    }
    const backroomDetailText = (await page.locator("#quest-detail").textContent()).trim();
    if (!backroomDetailText.includes("3,576, 3,031")) {
      throw new Error("The Backroom is missing its compact map coordinates");
    }
    await page.waitForFunction(() => {
      const previews = Array.from(document.querySelectorAll(".quest-map-preview-image"));
      return (
        previews.length === 6 &&
        previews.every((image) => image.complete && image.naturalWidth === 4096)
      );
    });
    const floorLabels = await page.locator(".quest-map-preview-floor").allTextContents();
    if (floorLabels.filter((label) => label === "OW").length !== 4 ||
        floorLabels.filter((label) => label === "UG").length !== 2) {
      throw new Error(`The Backroom floor badges are incorrect: ${floorLabels.join(", ")}`);
    }
    for (const href of [
      "pages/enemies/monsters.html?monster=94",
      "pages/enemies/monsters.html?monster=96",
      "pages/enemies/monsters.html?monster=99",
      "pages/enemies/monsters.html?monster=103",
    ]) {
      const count = await page.locator(`#quest-detail a[href="${href}"]`).count();
      if (count !== 1) {
        throw new Error(`The Backroom expected one "${href}", found ${count}`);
      }
    }

    await page.goto(joinUrl(baseUrl, "/pages/General/quests.html?quest=welcome-to-silvest"), {
      waitUntil: "load",
    });
    const welcomePreviewCount = await page.locator("#quest-detail a.quest-map-preview").count();
    if (welcomePreviewCount !== 8) {
      throw new Error(`Welcome to Silvest expected eight contextual map previews, found ${welcomePreviewCount}`);
    }
    if ((await page.locator("#quest-detail a.quest-map-link").count()) !== 0) {
      throw new Error("Welcome to Silvest should replace visible coordinate links with map previews");
    }
    const townGuidePreviewCount = await page
      .locator('#quest-detail a.quest-map-preview[data-map-coordinate="3415,3722"]')
      .count();
    if (townGuidePreviewCount !== 3) {
      throw new Error(`Welcome to Silvest expected contextual Town Guide previews, found ${townGuidePreviewCount}`);
    }
    const welcomeFloorLabels = await page.locator(".quest-map-preview-floor").allTextContents();
    if (welcomeFloorLabels.length !== 8 || welcomeFloorLabels.some((label) => label !== "OW")) {
      throw new Error(`Welcome to Silvest floor badges are incorrect: ${welcomeFloorLabels.join(", ")}`);
    }

    await page.goto(joinUrl(baseUrl, "/pages/General/quests.html?quest=lotors-ettin-slayer"), {
      waitUntil: "load",
    });
    const ribsLinkCount = await page
      .locator('#quest-detail a[href="pages/items/collectables.html?collectable=96"]')
      .count();
    if (ribsLinkCount !== 1) {
      throw new Error(`Lotor's Ettin Slayer expected one Uncooked Ribs link, found ${ribsLinkCount}`);
    }
    const factLayoutIsContained = await page.locator(".quest-facts").evaluate((facts) =>
      Array.from(facts.querySelectorAll(".quest-fact")).every((fact) => {
        const preview = fact.querySelector(".quest-map-preview");
        return !preview || preview.getBoundingClientRect().right <= fact.getBoundingClientRect().right + 1;
      })
    );
    if (!factLayoutIsContained) {
      throw new Error("Quest map preview overflows its fact cell");
    }
    await page.locator("#site-search-input").fill("Jimothy");
    await page
      .locator('.nav-search-result[href*="pages/General/quests.html?quest=the-fallen-order"]')
      .waitFor({ state: "visible" });
    await page.locator("#site-search-input").fill("");

    const fallbackPage = await browser.newPage();
    try {
      fallbackPage.setDefaultTimeout(timeoutMs);
      await fallbackPage.route("**/Map_Combined-preview.webp", (route) => route.abort());
      await fallbackPage.goto(joinUrl(baseUrl, "/pages/General/quests.html?quest=the-backroom"), {
        waitUntil: "load",
      });
      await fallbackPage
        .locator(".quest-map-preview.is-unavailable")
        .first()
        .waitFor({ state: "visible" });
      const unavailableCount = await fallbackPage.locator(".quest-map-preview.is-unavailable").count();
      if (unavailableCount !== 6) {
        throw new Error(`Map preview fallback expected six unavailable tiles, found ${unavailableCount}`);
      }
      await fallbackPage
        .locator(".quest-map-preview").first().hover();
      await fallbackPage
        .locator(".quest-map-preview-fallback")
        .first()
        .waitFor({ state: "visible" });
    } finally {
      await fallbackPage.close();
    }

    const mobileQuestPage = await browser.newPage();
    try {
      mobileQuestPage.setDefaultTimeout(timeoutMs);
      await mobileQuestPage.setViewportSize({ width: 390, height: 844 });
      await mobileQuestPage.goto(joinUrl(baseUrl, "/pages/General/quests.html?quest=the-backroom"), {
        waitUntil: "load",
      });
      await mobileQuestPage.locator(".quest-map-preview").first().waitFor({ state: "visible" });
      const mobileLayout = await mobileQuestPage.evaluate(() => {
        const cards = Array.from(document.querySelectorAll(".quest-map-preview"));
        return {
          cardCount: cards.length,
          minCardWidth: Math.min(...cards.map((card) => card.getBoundingClientRect().width)),
          overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        };
      });
      if (mobileLayout.cardCount !== 6 || mobileLayout.minCardWidth < 48 || mobileLayout.overflow) {
        throw new Error(`Quest map previews do not fit mobile: ${JSON.stringify(mobileLayout)}`);
      }
      const previewLink = mobileQuestPage.locator('.quest-map-preview').first();
      await previewLink.focus();
      await previewLink.locator('[role="tooltip"]').waitFor({ state: 'visible' });
      if (await previewLink.locator('[role="tooltip"]').evaluate(node => {
        const rect = node.getBoundingClientRect();
        return rect.left < 0 || rect.right > innerWidth || rect.top < 0 || rect.bottom > innerHeight;
      })) throw new Error('Quest map tooltip falls outside the viewport');
      await mobileQuestPage.keyboard.press('Escape');
      await previewLink.locator('[role="tooltip"]').waitFor({ state: 'hidden' });
    } finally {
      await mobileQuestPage.close();
    }

    await page.locator("[data-close-detail]").click();
    await page.waitForFunction(() => !new URL(window.location.href).searchParams.has("quest"));
    await page.locator(".quest-detail-empty").waitFor({ state: "visible" });

    await assertMobilePageFirstNavigation(page, baseUrl, "/pages/General/quests.html");

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
    await assertPerkTatterSources(page);
    await assertPerkMathTooltip(page);
    await assertMobilePerkTatterLayout(browser, baseUrl);

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
    await page.waitForFunction(() => document.querySelector("[data-rarity-result]")?.textContent?.includes("Rare"));
    const upgradedText = (await page.locator("[data-rarity-result]").textContent()).trim();
    for (const expected of ["Rarity", "Rare", "Max Rarity", "Ascendant", "Item Power", "x4"]) {
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

async function assertAscendancyReference(page) {
  const help = page.locator('.main-content .system-help').first();
  await help.hover();
  await page.locator('#system-tooltip').waitFor({ state: 'visible' });
  if (!(await page.locator('#system-tooltip').innerText()).trim()) throw new Error('Empty Ascendancy tooltip');
  await page.keyboard.press('Escape');
  await page.locator('#system-tooltip').waitFor({ state: 'hidden' });
  await help.focus();
  await page.locator('#system-tooltip').waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  await help.click();
  await page.locator('#system-tooltip').waitFor({ state: 'visible' });
  const bounds = await page.locator('#system-tooltip').boundingBox();
  if (bounds.x < 0 || bounds.x + bounds.width > 390 || bounds.y < 0 || bounds.y + bounds.height > 844) throw new Error('Ascendancy tooltip exceeds viewport');
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Ascendancy horizontal overflow');
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
      "Rarity Shards",
      "Tinker Tools",
      "Current Rarity",
      "Max Rarity",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Reforge page missing "${expected}": "${pageText}"`);
      }
    }



    await assertAscendancyReference(page);

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
    await page.locator(".deconstruct-summary-grid").waitFor({ state: "visible" });
    const pageText = (await page.locator("#deconstruct-basics").textContent()).trim();
    for (const expected of [
      "How to Deconstruct",
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



    await assertAscendancyReference(page);

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
      "What Changes",
      "What Stays Fixed",
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



    await assertAscendancyReference(page);

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
      "Ethereal Shard Purchases",
      "Scrolls of Imbuement",
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



    const raceHelp = page.getByRole('button', { name: 'Race Change Scroll details', exact: true });
    await raceHelp.hover();
    const requirements = await page.locator('#system-tooltip').innerText();
    for (const expected of ['safe zone', 'criminal', '30+ seconds', 'Jeel']) {
      if (!requirements.includes(expected)) throw new Error(`Missing race-change requirement: ${expected}`);
    }
    for (const [name, cost] of [['Augment Orb', '100,000'], ['Scroll of Regret', '25,000'], ['Race Change Scroll', '250,000'], ["Collector's Pouch", '100,000'], ['Berserker Potion', '10,000'], ['Berserker Potion Bundle', '40,000']]) {
      const card = page.locator('.craft-shop-card').filter({ has: page.getByRole('button', { name: `${name} details`, exact: true }) });
      if (!(await card.locator('.ascendancy-price').innerText()).includes(cost)) throw new Error(`Incorrect cost for ${name}`);
    }
    await assertAscendancyReference(page);

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
      "Tatter Drops",
      "Tier Roll Odds",
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



    await assertAscendancyReference(page);

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
      "Purge or Cleanse",
      "Recovery Rules",
      "Special Effect",
      "Corrupted Innate",
      "25 Tattered Imbuements",
      "No Tier Refund",

      "Epic+ Item",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Purge page missing "${expected}": "${pageText}"`);
      }
    }



    await assertAscendancyReference(page);

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
    const pageText = await page.locator(".main-content").evaluate(main => main.textContent + [...main.querySelectorAll("[data-system-help]")].map(node => node.dataset.systemHelp).join(" "));
    for (const expected of [
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
    const pageText = await page.locator(".main-content").evaluate(main => main.textContent + [...main.querySelectorAll("[data-system-help]")].map(node => node.dataset.systemHelp).join(" "));
    for (const expected of [
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
    const pageText = await page.locator(".main-content").evaluate(main => main.textContent + [...main.querySelectorAll("[data-system-help]")].map(node => node.dataset.systemHelp).join(" "));
    for (const expected of [
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
    const pageText = await page.locator(".main-content").evaluate(main => main.textContent + [...main.querySelectorAll("[data-system-help]")].map(node => node.dataset.systemHelp).join(" "));
    for (const expected of [
      "Damage Reduction Calculator",
      "Threshold Reference",
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
    await page.locator(".experience-build-grid").waitFor({ state: "visible" });
    const pageText = await page.locator(".main-content").evaluate(main => main.textContent + [...main.querySelectorAll("[data-system-help]")].map(node => node.dataset.systemHelp).join(" "));
    for (const expected of [
      "Daily Pool Build",
      "Levels 1-89",
      "+3.0 levels per 24 hours",
      "Levels 90+",
      "+1.0 level per 24 hours",
      "3.0 levels",
      "Double XP",
      "1% of a level",
      "0.01 pool",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Experience page missing "${expected}": "${pageText}"`);
      }
    }



    if (await page.locator("[data-experience-widget], [data-xp-run-tick]").count()) throw new Error("Experience simulator should be removed");
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
    await page.locator(".level-chart-card").waitFor({ state: "visible" });
    const pageText = (await page.locator(".main-content").textContent()).trim();
    for (const expected of [
      "Level XP Curve",
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

    for (const removed of ["Level at a Glance", "Related Pages"]) {
      if (pageText.includes(removed)) {
        throw new Error(`Level page should not include removed section "${removed}".`);
      }
    }
    const linkGridCount = await page.locator(".level-link-grid").count();
    if (linkGridCount !== 0) {
      throw new Error(`Level page expected no related link grid, found ${linkGridCount}.`);
    }

    await assertLevelCurve(page);
    await assertMobilePageFirstNavigation(page, baseUrl, "/pages/stats/level.html");

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function assertLevelCurve(page) {
  const milestoneCount = await page.locator(".level-milestone-card").count();
  if (milestoneCount !== 0) {
    throw new Error(`Level page expected no milestone cards, found ${milestoneCount}`);
  }

  const rowCount = await page.locator("#level-xp-chart .weight-row").count();
  if (rowCount !== 0) {
    throw new Error(`Level XP page expected no long-form rows, found ${rowCount}`);
  }

  await page.locator("#level-xp-curve").waitFor({ state: "visible" });
  let curveState = await readLevelCurveState(page);
  for (const [key, expected] of Object.entries({
    level: "Level 100",
    total: "242,900,000",
    nextTotal: "250,000,000",
    delta: "(+7,100,000)",
    deltaLabel: "Next Level At",
    ariaLevel: "100",
  })) {
    if (curveState[key] !== expected) {
      throw new Error(`Level curve expected ${key}="${expected}", got "${curveState[key]}"`);
    }
  }

  await page.locator("#level-xp-curve").focus();
  await page.locator("#level-xp-curve").press("End");
  await page.waitForFunction(
    () => document.querySelector("[data-level-curve-level]")?.textContent?.trim() === "Level 105",
    undefined,
    { timeout: timeoutMs }
  );
  curveState = await readLevelCurveState(page);
  if (
    curveState.total !== "2,500,000,000" ||
    curveState.nextTotal !== "5,000,000,000" ||
    curveState.delta !== "(+2,500,000,000)" ||
    curveState.deltaLabel !== "Maximum XP"
  ) {
    throw new Error(`Level 105 curve values are incorrect: ${JSON.stringify(curveState)}`);
  }

  await page.locator("#level-xp-curve").press("Home");
  await page.waitForFunction(
    () => document.querySelector("[data-level-curve-level]")?.textContent?.trim() === "Level 1",
    undefined,
    { timeout: timeoutMs }
  );
  curveState = await readLevelCurveState(page);
  if (
    curveState.total !== "0" ||
    curveState.nextTotal !== "2,000" ||
    curveState.delta !== "(+2,000)" ||
    curveState.deltaLabel !== "Next Level At"
  ) {
    throw new Error(`Level 1 curve values are incorrect: ${JSON.stringify(curveState)}`);
  }

  for (let step = 0; step < 4; step += 1) {
    await page.locator("#level-xp-curve").press("ArrowRight");
  }
  curveState = await readLevelCurveState(page);
  if (
    curveState.level !== "Level 5" ||
    curveState.total !== "8,000" ||
    curveState.nextTotal !== "10,000" ||
    curveState.delta !== "(+2,000)"
  ) {
    throw new Error(`Level 5 cumulative next-level preview is incorrect: ${JSON.stringify(curveState)}`);
  }

  await page.locator("#level-xp-curve").evaluate((canvas) => {
    const rect = canvas.getBoundingClientRect();
    const internalX = 58 + ((canvas.width - 58 - 14) * (75 - 1)) / (105 - 1);
    const clientX = rect.left + (internalX / canvas.width) * rect.width;
    canvas.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX, clientY: rect.top + rect.height / 2 }));
  });
  await page.waitForFunction(
    () => document.querySelector("[data-level-curve-level]")?.textContent?.trim() === "Level 75",
    undefined,
    { timeout: timeoutMs }
  );
  curveState = await readLevelCurveState(page);
  if (
    curveState.total !== "95,510,000" ||
    curveState.nextTotal !== "99,810,000" ||
    curveState.delta !== "(+4,300,000)" ||
    !curveState.tooltipVisible
  ) {
    throw new Error(`Level 75 pointer inspection failed: ${JSON.stringify(curveState)}`);
  }
}

async function readLevelCurveState(page) {
  return await page.evaluate(() => {
    const tooltip = document.querySelector("[data-level-curve-tooltip]");
    return {
      ariaLevel: document.querySelector("#level-xp-curve")?.getAttribute("aria-valuenow") || "",
      delta: document.querySelector("[data-level-curve-delta]")?.textContent?.trim() || "",
      deltaLabel: document.querySelector("[data-level-curve-delta-label]")?.textContent?.trim() || "",
      level: document.querySelector("[data-level-curve-level]")?.textContent?.trim() || "",
      nextTotal: document.querySelector("[data-level-curve-next-total]")?.textContent?.trim() || "",
      tooltipVisible: Boolean(tooltip && !tooltip.hidden),
      total: document.querySelector("[data-level-curve-total]")?.textContent?.trim() || "",
    };
  });
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
    await page.locator(".skills-chart-card").waitFor({ state: "visible" });
    const pageText = (await page.locator(".main-content").textContent()).trim();
    for (const expected of [
      "Skill XP Curve",
      "Five Melee Skills",
      "Base Max",
      "+10 Above Cap",
      "Race bonuses do not count toward equipment requirements",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Skills page missing "${expected}": "${pageText}"`);
      }
    }

    for (const removed of ["Skills at a Glance", "Melee Skill Set", "Requirement Preview", "Related Pages"]) {
      if (pageText.includes(removed)) {
        throw new Error(`Skills page should not include removed section "${removed}".`);
      }
    }

    const oldRowCount = await page.locator("#skill-xp-chart .weight-row").count();
    if (oldRowCount !== 0) {
      throw new Error(`Skills page expected no long-form XP rows, found ${oldRowCount}.`);
    }

    await assertSkillCurve(page);
    await assertMobilePageFirstNavigation(page, baseUrl, "/pages/stats/skills.html");

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function assertSkillCurve(page) {
  await page.locator("#skill-xp-curve").waitFor({ state: "visible" });
  let state = await readSkillCurveState(page);
  for (const [key, expected] of Object.entries({
    level: "Level 100",
    total: "25,000,000",
    nextTotal: "26,500,000",
    nextIncrement: "(+1,500,000)",
    nextLabel: "Next Level At",
    ariaLevel: "100",
  })) {
    if (state[key] !== expected) {
      throw new Error(`Skill curve expected ${key}="${expected}", got "${state[key]}"`);
    }
  }

  await page.locator("#skill-xp-curve").focus();
  await page.locator("#skill-xp-curve").press("Home");
  await page.waitForFunction(
    () => document.querySelector("[data-skill-curve-level]")?.textContent?.trim() === "Level 0",
    undefined,
    { timeout: timeoutMs }
  );
  state = await readSkillCurveState(page);
  if (
    state.total !== "0" ||
    state.nextTotal !== "75" ||
    state.nextIncrement !== "(+75)" ||
    state.nextLabel !== "Next Level At"
  ) {
    throw new Error(`Skill Level 0 curve values are incorrect: ${JSON.stringify(state)}`);
  }

  for (let step = 0; step < 5; step += 1) {
    await page.locator("#skill-xp-curve").press("ArrowRight");
  }
  state = await readSkillCurveState(page);
  if (
    state.level !== "Level 5" ||
    state.total !== "375" ||
    state.nextTotal !== "500" ||
    state.nextIncrement !== "(+125)"
  ) {
    throw new Error(`Skill Level 5 curve values are incorrect: ${JSON.stringify(state)}`);
  }

  await page.locator("#skill-xp-curve").press("End");
  await page.waitForFunction(
    () => document.querySelector("[data-skill-curve-level]")?.textContent?.trim() === "Level 110",
    undefined,
    { timeout: timeoutMs }
  );
  state = await readSkillCurveState(page);
  if (
    state.total !== "75,000,000" ||
    state.nextTotal !== "75,000,000" ||
    state.nextIncrement !== "" ||
    state.nextLabel !== "Maximum XP"
  ) {
    throw new Error(`Skill Level 110 curve values are incorrect: ${JSON.stringify(state)}`);
  }
}

async function readSkillCurveState(page) {
  return await page.evaluate(() => {
    const tooltip = document.querySelector("[data-skill-curve-tooltip]");
    return {
      ariaLevel: document.querySelector("#skill-xp-curve")?.getAttribute("aria-valuenow") || "",
      level: document.querySelector("[data-skill-curve-level]")?.textContent?.trim() || "",
      nextIncrement: document.querySelector("[data-skill-curve-next-increment]")?.textContent?.trim() || "",
      nextLabel: document.querySelector("[data-skill-curve-next-label]")?.textContent?.trim() || "",
      nextTotal: document.querySelector("[data-skill-curve-next-total]")?.textContent?.trim() || "",
      tooltipVisible: Boolean(tooltip && !tooltip.hidden),
      total: document.querySelector("[data-skill-curve-total]")?.textContent?.trim() || "",
    };
  });
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
    await page.locator(".races-card-grid").waitFor({ state: "visible" });
    const pageText = await page.locator(".main-content").evaluate(main => main.textContent + [...main.querySelectorAll("[data-character-help]")].map(node => node.dataset.characterHelp).join("\n"));
    for (const expected of [
      "Race Bonuses",
      "Human",
      "Tundrian",
      "Brimlock",
      "Komodan",
      "Elf",
      "Orc",
      "Gnoll",
      "Dark Elf",
      "Equipment requirements use trained base values, before race bonuses.",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Races page missing "${expected}": "${pageText}"`);
      }
    }



    if (await page.locator('.races-card').count() !== 8) throw new Error('Expected eight race bonus cards');
    if (await page.locator('#race-preview, .races-select-button, [data-race-option]').count()) throw new Error('Races should not contain preview controls');
    await assertCharacterTooltip(page, '[data-character-perk="Desperation"] .character-help', 'Desperation');
    await assertMobilePageFirstNavigation(page, baseUrl, "/pages/stats/races.html");

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
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
    const pageText = await page.locator(".main-content").evaluate(main => main.textContent + [...main.querySelectorAll("[data-character-help]")].map(node => node.dataset.characterHelp).join("\n"));
    for (const expected of [
      "Calculator",
      "Weight Benchmarks",
      "Perks",
      "Equipment",
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



    await assertStrengthCalculator(page);
    await assertCharacterTooltip(page, '.perk-grid .character-help', 'Garrote');
    await assertCharacterTooltip(page, '[data-weapon-specialty] .character-help', 'DPS:');
    await assertMobilePageFirstNavigation(page, baseUrl, "/pages/stats/strength.html");

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
}

async function assertCharacterTooltip(page, selector, expected) {
  const trigger = page.locator(selector).first();
  const tooltip = page.locator('#character-tooltip');
  await trigger.hover();
  await tooltip.waitFor({state: 'visible'});
  if (!(await tooltip.textContent()).includes(expected)) throw new Error(`Character tooltip missing ${expected}`);
  await page.keyboard.press('Escape');
  await tooltip.waitFor({state: 'hidden'});
  await page.mouse.move(0, 0);
  await trigger.focus();
  await tooltip.waitFor({state: 'visible'});
  if (await trigger.getAttribute('aria-describedby') !== 'character-tooltip') throw new Error('Character tooltip lacks accessible description');
  await page.keyboard.press('Escape');
  await tooltip.waitFor({state: 'hidden'});
  const viewport = page.viewportSize();
  await page.setViewportSize({width: 390, height: 844});
  await trigger.click();
  await tooltip.waitFor({state: 'visible'});
  const bounds = await tooltip.boundingBox();
  if (!bounds || bounds.x < 0 || bounds.y < 0 || bounds.x + bounds.width > 390 || bounds.y + bounds.height > 844) {
    throw new Error('Character tooltip extends beyond the mobile viewport');
  }
  // A delayed event from the click's automatic scroll must not dismiss the new tooltip.
  await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
  if (!(await tooltip.isVisible())) throw new Error('Queued scroll dismissed the Character tooltip');
  await page.evaluate(() => window.scrollBy(0, window.scrollY > 0 ? -80 : 80));
  await tooltip.waitFor({state: 'hidden'});
  await page.locator('.content-title').click();
  await page.setViewportSize(viewport);
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
    const pageText = await page.locator(".main-content").evaluate(main => main.textContent + [...main.querySelectorAll("[data-character-help]")].map(node => node.dataset.characterHelp).join("\n"));
    for (const expected of [
      "Calculator",
      "Regeneration Benchmarks",
      "Race Bonuses",
      "Perks",
      "Equipment",
      "Max Health",
      "Baseline Regen",
      "Con / 3",
      "HP every 2 seconds",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Constitution page missing "${expected}": "${pageText}"`);
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
    const pageText = await page.locator(".main-content").evaluate(main => main.textContent + [...main.querySelectorAll("[data-character-help]")].map(node => node.dataset.characterHelp).join("\n"));
    for (const expected of [
      "Calculator",
      "Damage Reduction Benchmarks",
      "Race Bonuses",
      "Perks",
      "Equipment",
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
    const pageText = await page.locator(".main-content").evaluate(main => main.textContent + [...main.querySelectorAll("[data-character-help]")].map(node => node.dataset.characterHelp).join("\n"));
    for (const expected of [
      "Player Damage Preview",
      "Monster Type Matchups",
      "Perks",
      "60%",
      "Applied after armor",
      "Weak To",
      "Resistant To",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Resistances page missing "${expected}": "${pageText}"`);
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
  for (const expected of ["Humanoid", "Poison", "Disease", "Acid", "Dark", "Cold"]) {
    if (!humanoidText.includes(expected)) {
      throw new Error(`Humanoid resistance card missing "${expected}": "${humanoidText}"`);
    }
  }
  const resistanceGroupElements = async (type, group) =>
    page
      .locator(`[data-resistance-type-card="${type}"] [data-resistance-group="${group}"] .resistance-element`)
      .evaluateAll((elements) => elements.map((element) => element.textContent.trim()));
  const expectedGroupOrders = [
    ["humanoid", "weakness", ["Dark", "Poison", "Disease", "Acid"]],
    ["undead", "weakness", ["Holy", "Fire", "Electric"]],
    ["demon", "weakness", ["Cold", "Holy", "Electric"]],
    ["demon", "resistance", ["Fire", "Dark"]],
  ];
  for (const [type, group, expectedOrder] of expectedGroupOrders) {
    const actualOrder = await resistanceGroupElements(type, group);
    if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder)) {
      throw new Error(
        `Expected ${type} ${group} order ${expectedOrder.join(", ")}, got ${actualOrder.join(", ")}`
      );
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




async function assertSystemsTooltip(page) {
  const trigger = page.locator('.system-help').first();
  const tooltip = page.locator('#system-tooltip');
  await trigger.hover();
  await tooltip.waitFor({state: 'visible'});
  if (!(await tooltip.textContent()).includes('guild')) throw new Error('Guild summary tooltip lost its explanation');
  await page.keyboard.press('Escape');
  await tooltip.waitFor({state: 'hidden'});
  await page.mouse.move(0, 0);
  await trigger.focus();
  await tooltip.waitFor({state: 'visible'});
  await page.keyboard.press('Escape');
  await tooltip.waitFor({state: 'hidden'});
  const viewport = page.viewportSize();
  await page.setViewportSize({width: 390, height: 844});
  await trigger.click();
  await tooltip.waitFor({state: 'visible'});
  const rect = await tooltip.boundingBox();
  if (!rect || rect.x < 0 || rect.y < 0 || rect.x + rect.width > 390 || rect.y + rect.height > 844) throw new Error('Systems tooltip overflows mobile viewport');
  await page.keyboard.press('Escape');
  await tooltip.waitFor({state: 'hidden'});
  await page.setViewportSize(viewport);
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
    await page.locator(".guild-action-grid").waitFor({ state: "visible" });
    const pageText = await page.locator(".main-content").evaluate(main => main.textContent + [...main.querySelectorAll("[data-system-help]")].map(node => node.dataset.systemHelp).join(" "));
    for (const expected of [
      "Identity and Roster",
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



    await assertSystemsTooltip(page);
    await assertMobilePageFirstNavigation(page, baseUrl, "/pages/systems/guild.html");

    if (runtimeErrors.length) {
      throw new Error(`browser errors: ${runtimeErrors.join("; ")}`);
    }
  } finally {
    await page.close();
  }
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
    const pageText = await page.locator(".main-content").evaluate(main => main.textContent + [...main.querySelectorAll("[data-system-help]")].map(node => node.dataset.systemHelp).join(" "));
    for (const expected of [
      "Viewing Channels",
      "Send Mode Preview",
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
      "visible area",


      "global-chat",
      "Discord",
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Chat page missing "${expected}": "${pageText}"`);
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
    const pageText = await page.locator(".main-content").evaluate(main => main.textContent + [...main.querySelectorAll("[data-system-help]")].map(node => node.dataset.systemHelp).join(" "));
    for (const expected of [
      "Sweep Timing Preview",
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
    const pageText = await page.locator(".main-content").evaluate(main => main.textContent + [...main.querySelectorAll("[data-system-help]")].map(node => node.dataset.systemHelp).join(" "));
    for (const expected of [
      "Corrupted Innate",
      "Hard Bosses",
      "What Corruption Changes",

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
    await page.locator(".crafting-calculator-widget").waitFor({ state: "visible" });
    const pageText = await page.locator(".main-content").evaluate(main => main.textContent + [...main.querySelectorAll("[data-system-help]")].map(node => node.dataset.systemHelp).join(" "));
    for (const expected of [
      "Crafting Flow",
      "Materials Calculator",
      "Set Preview",
      "Ice Crystals",
      "Dragon Scales",
      "Hammer & Anvil",
      "100% Success",
      "Random Rarity",
      "full suit",
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
  await assertPlannerReferenceNewTab(page, suggestionLink, true);
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
  await assertPlannerReferenceNewTab(page, link);
  const statReference = page.locator('.char-section a.stat-keyword-link').first();
  await assertPlannerReferenceNewTab(page, statReference);
}

async function assertPlannerReferenceNewTab(page, link, keyboard = false) {
  const target = await link.getAttribute('target');
  const rel = (await link.getAttribute('rel') || '').split(/\s+/);
  if (target !== '_blank' || !rel.includes('noopener')) throw new Error('Planner reference must open a separate tab');
  const readBuild = () => page.evaluate(() => JSON.stringify({
    slots: [...document.querySelectorAll('.slot-card')].map(card => card.textContent),
    inputs: [...document.querySelectorAll('.char-section input, .char-section select')].map(input => input.value),
  }));
  const before = await readBuild();
  const expectedUrl = await link.evaluate(node => node.href);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    keyboard ? link.press('Enter') : link.click(),
  ]);
  try {
    await popup.waitForURL(expectedUrl);
    if (!new URL(page.url()).pathname.endsWith('/pages/General/build-planner.html') || await readBuild() !== before) {
      throw new Error('Opening a planner reference navigated away or changed the build');
    }
  } finally { await popup.close(); }
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
    node.closest(".quick-summary-card")?.dataset.tooltip || ""
  );
  if (!armorTitle.includes("Base armor") || !armorTitle.includes("Rarity bonus")) {
    throw new Error(`Build Planner quick Armor tooltip missing breakdown: "${armorTitle}"`);
  }
  const regenTitle = await page.locator("#calc-regen").evaluate((node) =>
    node.closest(".summary-card")?.dataset.tooltip || ""
  );
  if (!regenTitle.includes("Total Constitution")) {
    throw new Error(`Build Planner Health Regen tooltip missing breakdown: "${regenTitle}"`);
  }
  await assertPlannerPerkTooltip(page, 'Runic (Tier 3)', ['15% of your damage in PvE', '30% of your damage in PvP'], 'hover');
}

async function assertPlannerPerkTooltip(page, perk, expected, interaction) {
  const chip = page.locator('#sum-perks button').filter({ hasText: perk });
  if (interaction === 'hover') await chip.hover();
  else if (interaction === 'focus') await chip.focus();
  else await chip.click();
  const tip = page.locator('#planner-tooltip');
  await tip.waitFor({ state: 'visible' });
  await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
  if (!(await tip.isVisible())) throw new Error('Queued scroll dismissed the planner perk tooltip');
  const text = await tip.textContent();
  if (!expected.every(value => text.includes(value))) throw new Error(`Incorrect perk tooltip: ${text}`);
  if (await tip.evaluate(node => {
    const rect = node.getBoundingClientRect();
    return rect.left < 0 || rect.right > innerWidth || rect.top < 0 || rect.bottom > innerHeight;
  })) throw new Error('Perk tooltip is outside the viewport');
  await page.keyboard.press('Escape');
  await tip.waitFor({ state: 'hidden' });
}

async function assertBuildPlannerCorrections(page, baseUrl) {
  // Weapon weight must count even with no armor equipped.
  await selectBuildPlannerItem(page, "Rune Sword");
  const expectedWeight = await page.evaluate(async () => {
    const records = await (await fetch(new URL("pages/items/weapons_data05.json", document.baseURI))).json();
    return Number(records.find((item) => item.id === 227).fields.weight);
  });
  if (Number(await page.locator('[data-quick-stat="weight"]').textContent()) !== expectedWeight) {
    throw new Error("Equipped weight omitted the weapon");
  }

  // Replace an item after binding its perk controls; edits must target its replacement.
  const weapon = page.locator('[data-slot="Weapon"]');
  await weapon.locator('[data-rarity-inc]').click({ clickCount: 2 });
  await weapon.locator('[data-perk-select]').selectOption({ label: "Tenacity" });
  await selectBuildPlannerItem(page, "Famine Bringer");
  await weapon.locator('[data-rarity-inc]').click({ clickCount: 2 });
  await weapon.locator('[data-perk-select]').selectOption({ label: "Tenacity" });
  await weapon.locator('[data-perk-tier]').selectOption("2");
  await page.waitForFunction(() => document.querySelector('#sum-perks').textContent.includes('Tenacity (T2)'));
  await page.locator('#share-build').click();
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#sum-perks').textContent.includes('Tenacity (T2)'));
  await assertPlannerPerkTooltip(page, 'Tenacity (T2)', ['(2/3/3/4)%', '30 bonus seconds'], 'focus');

  // Character fields are base stats; race bonuses change totals, not point spending or base-only crit.
  await page.locator('#reset-build').click();
  const pointsBeforeRace = await page.locator('#planner-status').textContent();
  const critBeforeRace = await page.locator('#calc-crit').textContent();
  await page.locator('#char-race').selectOption('elf');
  if ((await page.locator('[data-quick-stat="dex"]').textContent()) !== '15' ||
      (await page.locator('#calc-crit').textContent()) !== critBeforeRace ||
      (await page.locator('#planner-status').textContent()) !== pointsBeforeRace) {
    throw new Error('Race bonus affected base stat spending/crit, or was missing from totals');
  }

  const help = page.locator('[data-quick-stat="dex"]').locator('..').locator('button');
  await help.focus();
  await page.locator('#planner-tooltip').waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await page.locator('#planner-tooltip').waitFor({ state: 'hidden' });
  await page.setViewportSize({ width: 390, height: 844 });
  await help.click();
  await page.locator('#planner-tooltip').waitFor({ state: 'visible' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (overflow) throw new Error('Build Planner overflows on mobile');
  await assertPlannerPerkTooltip(page, 'Parry (T1)', ['(6/7/9/10)%', '70%'], 'tap');

  // Duplicate-name fixture tests identity independently of mutable production names/allowlists.
  await page.route('**/weapons_data05.json*', async (route) => {
    const response = await route.fetch();
    const records = await response.json();
    const source = records.find((item) => item.id === 227);
    records.push({ ...source, id: 990001, name: 'Planner identity fixture' });
    records.push({ ...source, id: 990002, name: 'Planner identity fixture', fields: { ...source.fields, weight: 42 } });
    records.push({ ...source, id: 990003, name: 'Planner identity fixture', codex_hidden: true });
    await route.fulfill({ response, json: records });
  });
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(joinUrl(baseUrl, '/pages/General/build-planner.html'), { waitUntil: 'networkidle' });
  await page.locator('#gear-search').fill('Planner identity fixture');
  if (await page.locator('#gear-suggestions .suggestion').count() !== 2) {
    throw new Error('Planner search did not honor the hidden-item flag');
  }
  await page.locator('#gear-suggestions .suggestion').nth(1).locator('.suggestion-meta').click();
  await page.locator('#share-build').click();
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('[data-quick-stat="weight"]').textContent === '42');
  const href = await weapon.locator('[data-slot-item]').getAttribute('href');
  if (!href.includes('weapon=990002')) throw new Error('Shared build restored the wrong duplicate-name item');

  // Older name-only links remain valid.
  const legacy = { v: 2, c: [1, 5, 5, 5, 0, ''], s: [['Weapon', 1, 'Rune Sword']] };
  await page.goto(joinUrl(baseUrl, `/pages/General/build-planner.html?build=${encodeURIComponent(JSON.stringify(legacy))}`), { waitUntil: 'load' });
  await assertBuildPlannerWeapon(page, 'Rune Sword');

  const savedUrl = page.url();
  await page.route('**/armors_data06.json*', route => route.abort());
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(savedUrl, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#planner-status').textContent.includes('Equipment could not load'));
  if (page.url() !== savedUrl || !(await page.locator('#gear-search').isDisabled())) {
    throw new Error('A data load failure discarded the incoming build or enabled an unusable search');
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

    if (!overlappingTriggers.length) return { leaks: [], overlapCount: 0 };

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
  await assertSuperDuperBowHidden(page);

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

async function assertPerkTatterSources(page) {
  const parry = page.locator('[data-perk-name="Parry"]');
  const chips = parry.locator(".perk-tatter-chip");
  if ((await chips.count()) !== 5) {
    throw new Error(`Parry expected five visible tatter sources, found ${await chips.count()}`);
  }
  const uncommonNames = await parry
    .locator('.perk-tatter-chip[data-tatter-type="uncommon"] .perk-tatter-monster')
    .allTextContents();
  const rareNames = await parry
    .locator('.perk-tatter-chip[data-tatter-type="rare"] .perk-tatter-monster')
    .allTextContents();
  if (uncommonNames.join(",") !== "Balron,Anubis") {
    throw new Error(`Parry uncommon tatter sources are out of order: ${uncommonNames.join(", ")}`);
  }
  if (rareNames.join(",") !== "Werewolf,Juggernaut,Orcus") {
    throw new Error(`Parry rare tatter sources are out of order: ${rareNames.join(", ")}`);
  }
  const balronHref = await parry
    .locator('.perk-tatter-chip[data-tatter-type="uncommon"][href*="monsters.html?monster=93"]')
    .getAttribute("href");
  if (!balronHref) {
    throw new Error("Parry tatter sources missing Balron monster detail link");
  }
  const balronTitle = (await parry
    .locator('.perk-tatter-chip[href*="monsters.html?monster=93"]')
    .getAttribute("title")) || "";
  if (!balronTitle.includes("Level 95") || !balronTitle.includes("roughly 1 in 10")) {
    throw new Error(`Balron tatter tooltip missing level/drop context: "${balronTitle}"`);
  }
  if ((await page.locator('[data-perk-name="Runic"] .perk-tatter-list').count()) !== 0) {
    throw new Error("Unique Runic perk should not display an empty tatter source section");
  }

  await page.locator("#perk-search").fill("balron");
  await page.waitForFunction(() => {
    const parry = document.querySelector('[data-perk-name="Parry"]');
    const runic = document.querySelector('[data-perk-name="Runic"]');
    return parry && !parry.classList.contains("perk-card-hidden") && runic?.classList.contains("perk-card-hidden");
  });
  await page.locator("#perk-search").fill("");
  await page.waitForFunction(
    () => !document.querySelector('[data-perk-name="Runic"]')?.classList.contains("perk-card-hidden")
  );
}

async function assertMobilePerkTatterLayout(browser, baseUrl) {
  const mobilePage = await browser.newPage();
  try {
    mobilePage.setDefaultTimeout(timeoutMs);
    await mobilePage.setViewportSize({ width: 390, height: 844 });
    await mobilePage.goto(joinUrl(baseUrl, "/pages/systems/perks.html?perk=Parry"), { waitUntil: "load" });
    await mobilePage.locator('[data-perk-name="Parry"] .perk-tatter-chip').first().waitFor({ state: "visible" });
    const layout = await mobilePage.evaluate(() => ({
      chipCount: document.querySelectorAll('[data-perk-name="Parry"] .perk-tatter-chip').length,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    }));
    if (layout.chipCount < 1 || layout.chipCount > 8 || layout.overflow) {
      throw new Error(`Perk tatter sources do not fit mobile: ${JSON.stringify(layout)}`);
    }
  } finally {
    await mobilePage.close();
  }
}

async function assertSuperDuperBowHidden(page) {
  const originalUrl = page.url();
  const url = new URL(originalUrl);
  url.searchParams.set("weapon", "1037");
  await page.goto(url.toString(), { waitUntil: "load" });
  await page.locator("#items-body tr[data-id]").first().waitFor({ state: "attached" });
  const tableText = (await page.locator("#items-body").textContent()).trim();
  if (tableText.includes("Super Duper Bow")) {
    throw new Error("Super Duper Bow should be hidden from the weapons table");
  }
  if (await page.locator("#item-details.show").count()) {
    throw new Error("Super Duper Bow direct route should not open a detail panel");
  }
  url.searchParams.set("weapon", "1000");
  await page.goto(url.toString(), { waitUntil: "load" });
  await page.locator("#items-body tr[data-id]").first().waitFor({ state: "attached" });
  if ((await page.locator("#items-body").textContent()).includes("Wooden Bow")) {
    throw new Error("Wooden Bow should be hidden from the weapons table");
  }
  if (await page.locator("#item-details.show").count()) {
    throw new Error("Wooden Bow direct route should not open a detail panel");
  }
  await page.goto(originalUrl, { waitUntil: "load" });
  await page.locator("#item-details.show").waitFor({ state: "visible" });
}

async function assertWeaponTableScanMetrics(page) {
  const tableText = (await page.locator("#items-body").textContent()).trim();
  if (!tableText.includes("Rune Sword") || !tableText.includes("1,000 ms")) {
    throw new Error(`Rune Sword table row missing compact speed column: "${tableText}"`);
  }

  const runeSwordRow = page.locator("#items-body tr").filter({ hasText: "Rune Sword" }).first();
  const dpsTooltip = (await runeSwordRow.locator(".dps-breakdown-tooltip").textContent()).trim();
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
  try {
    await page.locator(spec.rowSelector).first().waitFor({ state: "attached" });
  } catch (error) {
    throw new Error(
      `${spec.label} rows unavailable at ${page.url()}: ${formatError(error)}`
    );
  }
}

async function assertDetailState(page, spec, action) {
  await assertDetailVisible(page, spec);
  const detailName = await getDetailName(page);
  if (detailName !== spec.detailName) {
    throw new Error(`${action} selected "${detailName}" instead of "${spec.detailName}"`);
  }
  await assertUrlHasQuery(page, spec.queryKey);
}

async function assertDetailRouteDoesNotFilterList(page, spec, action) {
  const searchInput = page.locator("#item-search");
  if (!(await searchInput.count())) return;
  const searchValue = await searchInput.inputValue();
  if (searchValue) {
    throw new Error(`${spec.label} ${action} copied detail route "${searchValue}" into table search`);
  }
  const visibleRows = await page.locator(spec.rowSelector).count();
  if (!visibleRows) {
    throw new Error(`${spec.label} ${action} hid the item table while opening a detail route`);
  }
}

async function assertDetailVisible(page, spec) {
  await page.locator(`${spec.detailSelector}.show`).waitFor({ state: "visible" });
}

async function assertUrlHasQuery(page, queryKey) {
  const hasQuery = await page.evaluate((key) => new URL(window.location.href).searchParams.has(key), queryKey);
  if (!hasQuery) throw new Error(`URL is missing ${queryKey} query state`);
}

async function assertUrlParamEquals(page, queryKey, expectedValue) {
  const actual = await page.evaluate((key) => new URL(window.location.href).searchParams.get(key), queryKey);
  if (actual !== expectedValue) {
    throw new Error(`URL expected ${queryKey}=${expectedValue}, got "${actual}"`);
  }
}

async function assertDetailLinks(page, spec) {
  if (!spec.detailLinkSelector) return;
  await page.locator(spec.detailLinkSelector).first().waitFor({ state: "attached" });
  const linkCount = await page.locator(spec.detailLinkSelector).count();
  if (!linkCount) throw new Error("detail panel did not render expected cross-page links");
}

async function assertDetailTextIncludes(page, spec) {
  if (!Array.isArray(spec.detailTextIncludes) || !spec.detailTextIncludes.length) return;
  const detailText = (await page.locator("#details-properties").textContent()).trim();
  for (const expected of spec.detailTextIncludes) {
    if (!detailText.includes(expected)) {
      throw new Error(`${spec.label} detail missing "${expected}": "${detailText}"`);
    }
  }
}

async function assertDetailHrefIncludes(page, spec) {
  if (!Array.isArray(spec.detailHrefIncludes) || !spec.detailHrefIncludes.length) return;
  const hrefs = await page.locator("#details-properties a.relationship-pill").evaluateAll((links) =>
    links.map((link) => link.getAttribute("href") || "")
  );
  for (const expected of spec.detailHrefIncludes) {
    if (!hrefs.some((href) => href.includes(expected))) {
      throw new Error(`${spec.label} detail missing relationship href "${expected}": ${hrefs.join(", ")}`);
    }
  }
}

async function assertDuplicateRouteStability(page, baseUrl, spec) {
  if (!spec.duplicateRoute) return;
  const { id, detailName } = spec.duplicateRoute;
  const row = page.locator(`${spec.rowSelector}[data-id="${id}"]`);

  await page.goto(joinUrl(baseUrl, spec.listPath), { waitUntil: "load" });
  await waitForRows(page, spec);
  await row.waitFor({ state: "attached" });
  await row.click();
  await page.waitForURL((url) => url.searchParams.get(spec.queryKey) === id, { timeout: timeoutMs });
  await assertDetailVisible(page, spec);
  const clickedName = await getDetailName(page);
  if (clickedName !== detailName) {
    throw new Error(`${spec.label} duplicate route selected "${clickedName}" instead of "${detailName}"`);
  }

  await page.reload({ waitUntil: "load" });
  await waitForRows(page, spec);
  await assertDetailVisible(page, spec);
  await assertUrlParamEquals(page, spec.queryKey, id);
  const reloadedName = await getDetailName(page);
  if (reloadedName !== detailName) {
    throw new Error(`${spec.label} duplicate route reload selected "${reloadedName}" instead of "${detailName}"`);
  }
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
    } else if (arg === "--impact-plan") {
      parsed.impactPlan = rawArgs[index + 1];
      index += 1;
    } else if (arg === "--results-path") {
      parsed.resultsPath = rawArgs[index + 1];
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
