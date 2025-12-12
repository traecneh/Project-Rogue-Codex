(() => {
  const DEFAULT_JSON_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
  const jsonMemoryCache = new Map();

  function getAbsoluteUrl(url) {
    if (!url) return "";
    try {
      return new URL(url, window.location.href).toString();
    } catch (error) {
      return String(url);
    }
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
    getAbsoluteUrl,
    fetchJsonCached,
    ELEMENT_COLORS,
    RESIST_COLORS,
    PERK_TIER_COLORS,
    normalizeFilterValue,
    toNumber,
    titleCaseWords,
    getElementColor,
    getResistanceColor,
    getPerkTierColor,
    createPerkBadge,
    createElementBadge,
  });
})();

