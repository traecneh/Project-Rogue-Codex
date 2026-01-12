(() => {
  const DEFAULT_JSON_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
  const PERKS_INDEX_SCHEMA_VERSION = 3;
  const ALLOWLISTS_SCHEMA_VERSION = 1;
  const FORCE_JSON_REFRESH = true;
  const jsonMemoryCache = new Map();
  let perkIndexPromise = null;
  let perkIndexMap = null;
  let allowlistsPromise = null;
  let allowlistsCache = null;

  function getAbsoluteUrl(url) {
    if (!url) return "";
    try {
      const base = typeof document !== "undefined" && document.baseURI ? document.baseURI : window.location.href;
      return new URL(url, base).toString();
    } catch (error) {
      return String(url);
    }
  }

  function getPerksIndexUrl() {
    try {
      const base = typeof document !== "undefined" && document.baseURI ? document.baseURI : window.location.href;
      const resolved = new URL("pages/systems/perks.json", base);
      if (resolved.protocol === "http:" || resolved.protocol === "https:") {
        resolved.searchParams.set("v", String(PERKS_INDEX_SCHEMA_VERSION));
      }
      return resolved.toString();
    } catch (error) {
      return "pages/systems/perks.json";
    }
  }

  function getAllowlistsUrl() {
    try {
      const base = typeof document !== "undefined" && document.baseURI ? document.baseURI : window.location.href;
      const resolved = new URL("data/allowlists.json", base);
      if (resolved.protocol === "http:" || resolved.protocol === "https:") {
        resolved.searchParams.set("v", String(ALLOWLISTS_SCHEMA_VERSION));
      }
      return resolved.toString();
    } catch (error) {
      return "data/allowlists.json";
    }
  }

  function extractPerkBaseName(value) {
    const raw = (value || "").toString().trim();
    if (!raw || raw === "-" || raw.toLowerCase() === "none") return "";
    return raw
      .replace(/\s*\(\s*tier\s*\d+\s*\)\s*$/i, "")
      .replace(/\s*\(\s*t\s*\d+\s*\)\s*$/i, "")
      .replace(/\s*tier\s*\d+\s*$/i, "")
      .replace(/\s*t\s*\d+\s*$/i, "")
      .trim();
  }

  function safeReadSession(key) {
    if (!key) return null;
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function safeWriteSession(key, value) {
    if (!key) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      /* noop: storage full/unavailable */
    }
  }

  function fetchJsonCached(url, options = {}) {
    const absoluteUrl = getAbsoluteUrl(url);
    if (!absoluteUrl) return Promise.resolve(null);

    const cacheKey = options.cacheKey || absoluteUrl;
    const storageKey = options.storageKey || `json-cache:${cacheKey}`;
    const ttlMs = Number.isFinite(options.ttlMs) ? options.ttlMs : DEFAULT_JSON_TTL_MS;
    const now = Date.now();
    const forceFresh = options.forceFresh || FORCE_JSON_REFRESH;

    const withCacheBust = (targetUrl) => {
      try {
        const resolved = new URL(targetUrl);
        resolved.searchParams.set("_", String(Date.now()));
        return resolved.toString();
      } catch (error) {
        const separator = targetUrl.includes("?") ? "&" : "?";
        return `${targetUrl}${separator}_=${Date.now()}`;
      }
    };

    if (forceFresh) {
      const requestUrl = withCacheBust(absoluteUrl);
      return fetch(requestUrl, { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error(`Failed to fetch ${absoluteUrl}`);
          return response.json();
        })
        .catch((error) => {
          console.warn(error.message || error);
          return null;
        });
    }

    const existing = jsonMemoryCache.get(cacheKey);
    if (existing) {
      if (existing.data && (!ttlMs || now < existing.expiresAt)) {
        return Promise.resolve(existing.data);
      }
      if (existing.promise) return existing.promise;
    }

    const stored = safeReadSession(storageKey);
    if (stored && stored.value !== undefined && stored.timestamp) {
      if (!ttlMs || now - stored.timestamp < ttlMs) {
        jsonMemoryCache.set(cacheKey, {
          data: stored.value,
          expiresAt: ttlMs ? stored.timestamp + ttlMs : Infinity,
          promise: null,
        });
        return Promise.resolve(stored.value);
      }
    }

    const promise = fetch(absoluteUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to fetch ${absoluteUrl}`);
        return response.json();
      })
      .then((data) => {
        const expiresAt = ttlMs ? now + ttlMs : Infinity;
        jsonMemoryCache.set(cacheKey, { data, expiresAt, promise: null });
        safeWriteSession(storageKey, { timestamp: now, value: data });
        return data;
      })
      .catch((error) => {
        console.warn(error.message || error);
        jsonMemoryCache.delete(cacheKey);
        return null;
      })
      .finally(() => {
        const current = jsonMemoryCache.get(cacheKey);
      if (current && current.promise) {
        current.promise = null;
      }
    });

    jsonMemoryCache.set(cacheKey, { data: null, expiresAt: 0, promise });
    return promise;
  }

  function normalizeNameList(list) {
    if (!Array.isArray(list)) return [];
    return list
      .map((value) => (value === null || value === undefined ? "" : String(value)).trim())
      .filter(Boolean);
  }

  function buildNameSet(list) {
    return new Set(normalizeNameList(list).map((value) => value.toLowerCase()));
  }

  function loadAllowlists() {
    if (allowlistsCache) return Promise.resolve(allowlistsCache);
    if (allowlistsPromise) return allowlistsPromise;

    const url = getAllowlistsUrl();
    allowlistsPromise = fetchJsonCached(url, {
      cacheKey: `allowlists-v${ALLOWLISTS_SCHEMA_VERSION}`,
      ttlMs: DEFAULT_JSON_TTL_MS,
    })
      .then((data) => {
        const safe = data && typeof data === "object" ? data : {};
        allowlistsCache = {
          monsters: {
            allow: normalizeNameList(safe.monsters?.allow),
            block: normalizeNameList(safe.monsters?.block),
          },
          weapons: {
            block: normalizeNameList(safe.weapons?.block),
          },
          armors: {
            block: normalizeNameList(safe.armors?.block),
          },
        };
        return allowlistsCache;
      })
      .catch(() => {
        allowlistsCache = {
          monsters: { allow: [], block: [] },
          weapons: { block: [] },
          armors: { block: [] },
        };
        return allowlistsCache;
      })
      .finally(() => {
        allowlistsPromise = null;
      });

    return allowlistsPromise;
  }

  function loadPerkIndexMap() {
    if (perkIndexMap) return Promise.resolve(perkIndexMap);
    if (perkIndexPromise) return perkIndexPromise;

    const url = getPerksIndexUrl();
    perkIndexPromise = fetchJsonCached(url, {
      cacheKey: `perks-index-v${PERKS_INDEX_SCHEMA_VERSION}`,
      ttlMs: DEFAULT_JSON_TTL_MS,
    })
      .then((data) => {
        const entries = Array.isArray(data?.perks) ? data.perks : null;
        if (!entries || !entries.length) {
          throw new Error("Perks index unavailable");
        }
        const map = new Map();
        entries.forEach((entry) => {
          const name = entry && typeof entry.name === "string" ? entry.name.trim() : "";
          if (!name) return;
          map.set(name.toLowerCase(), entry);
        });
        if (!map.size) {
          throw new Error("Perks index empty");
        }
        perkIndexMap = map;
        return map;
      })
      .catch((error) => {
        console.warn(error?.message || error);
        return new Map();
      })
      .finally(() => {
        perkIndexPromise = null;
      });

    return perkIndexPromise;
  }

  function formatPerkTooltip(entry, fallbackName) {
    const name = (entry && typeof entry.name === "string" && entry.name.trim()) || fallbackName || "";
    const details = Array.isArray(entry?.details) ? entry.details : [];
    const cleanDetails = details.map((line) => (line || "").toString().trim()).filter(Boolean);
    if (!name) return cleanDetails.join("\n");
    if (!cleanDetails.length) return name;

    const [firstDetail, ...rest] = cleanDetails;
    const firstLine = `${name} — ${firstDetail}`.trim();
    if (!rest.length) return firstLine;
    return [firstLine, ...rest].join("\n");
  }

  const ELEMENT_COLORS = {
    fire: "#ff5a5a",
    electric: "#b86bff",
    poison: "#2f7a2f",
    cold: "#7cc9ff",
    acid: "#b38b00",
    disease: "#ff9c42",
  };

  const RESIST_COLORS = { ...ELEMENT_COLORS };

  const PERK_TIER_COLORS = {
    1: "rgb(6, 177, 66)",
    2: "rgb(223, 0, 220)",
    3: "rgb(208, 103, 0)",
  };

  function normalizeFilterValue(value) {
    return (value || "").toString().trim().toLowerCase();
  }

  function toNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function titleCaseWords(text) {
    return String(text || "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function getElementColor(value) {
    return ELEMENT_COLORS[normalizeFilterValue(value)] || "";
  }

  function getResistanceColor(key) {
    return RESIST_COLORS[normalizeFilterValue(key)] || "";
  }

  function getPerkTierColor(value) {
    if (!value) return "";
    const text = String(value);
    const match = text.match(/tier\s*([123])/i) || text.match(/\bT([123])\b/i);
    if (!match) return "";
    const tier = Number(match[1]);
    return PERK_TIER_COLORS[tier] || "";
  }

  function formatValue(value) {
    if (value === null || value === undefined || value === "") return "-";
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") return JSON.stringify(value);
    return value;
  }

  function createPerkBadge(value) {
    const span = document.createElement("span");
    span.textContent = formatValue(value);
    const color = getPerkTierColor(value);
    if (color) span.style.color = color;

    const perkName = extractPerkBaseName(value);
    if (!perkName) return span;
    span.title = perkName;

    loadPerkIndexMap().then((map) => {
      const entry = map.get(perkName.toLowerCase());
      if (!entry) return;
      const tooltip = formatPerkTooltip(entry, perkName);
      if (tooltip) span.title = tooltip;
    });

    return span;
  }

  function createElementBadge(value) {
    const span = document.createElement("span");
    span.textContent = formatValue(value);
    const color = getElementColor(value);
    if (color) span.style.color = color;
    return span;
  }

  window.RogueCodexUtils = Object.assign(window.RogueCodexUtils || {}, {
    DEFAULT_JSON_TTL_MS,
    ALLOWLISTS_SCHEMA_VERSION,
    FORCE_JSON_REFRESH,
    getAbsoluteUrl,
    fetchJsonCached,
    ELEMENT_COLORS,
    RESIST_COLORS,
    PERK_TIER_COLORS,
    normalizeFilterValue,
    normalizeNameList,
    buildNameSet,
    loadAllowlists,
    toNumber,
    titleCaseWords,
    getElementColor,
    getResistanceColor,
    getPerkTierColor,
    createPerkBadge,
    createElementBadge,
  });
})();
