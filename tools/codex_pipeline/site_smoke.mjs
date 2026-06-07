import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root || path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".."));
const timeoutMs = Number(args.timeoutMs || 20000);
const configuredBaseUrl = args.baseUrl ? normalizeBaseUrl(args.baseUrl) : null;

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
  } finally {
    await browser.close();
    if (server) await server.close();
  }

  if (failures.length) {
    failures.forEach((failure) => console.error(failure));
    process.exit(1);
  }
  console.log(`SMOKE OK site: ${smokeSpecs.length} page(s) checked at ${baseUrl}`);
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
