// Build-time catalog normalization. Executed only by build_search_index.mjs.
const MAX_SEARCH_RESULTS = 8;
const WEAPONS_SCHEMA_VERSION = 5;
const PERKS_PAGE_URL = "pages/systems/perks.html";
const PERKS_INDEX_URL = "pages/systems/perks.json";
const MONSTERS_PAGE_URL = "pages/enemies/monsters.html";
const QUESTS_PAGE_URL = "pages/General/quests.html";
const QUESTS_INDEX_URL = "pages/General/quests_data.json?v=codex-2026-07-27-six-new-quests";
const MAX_PERK_RESULTS = 4;
const MIN_PERK_TERM_LENGTH = 2;
const MAX_TATTER_MONSTER_RESULTS = 4;

function normalizeSearchEntry(entry) {
  return {
    ...entry,
    titleLower: (entry.title || "").toLowerCase(),
    descriptionLower: (entry.description || "").toLowerCase(),
    categoryLower: (entry.category || "").toLowerCase(),
    keywordsLower: (entry.keywords || []).map((kw) => String(kw || "").toLowerCase()),
  };
}

const NORMALIZED_SEARCH_INDEX = SITE_SEARCH_INDEX.map(normalizeSearchEntry);
const FULL_TEXT_CACHE = new Map();
const FULL_TEXT_PROMISES = new Map();
const INTERNAL_SEARCH_PAGES = NORMALIZED_SEARCH_INDEX.filter((entry) => entry.url && !/^https?:\/\//i.test(entry.url));
let FULL_TEXT_WARMED = false;
let MONSTER_SEARCH_INDEX = [];
let MONSTER_INDEX_PROMISE = null;
let WEAPON_SEARCH_INDEX = [];
let WEAPON_INDEX_PROMISE = null;
let WEAPON_DATA_PROMISE = null;
let ARMOR_SEARCH_INDEX = [];
let ARMOR_INDEX_PROMISE = null;
let QUEST_SEARCH_INDEX = [];
let QUEST_INDEX_PROMISE = null;
const COLLECTABLE_SEARCH_CONFIG = {
  dataFile: "pages/items/collectables_data.json",
  url: "pages/items/collectables.html",
  queryKey: "collectable",
  category: "Collectables",
  description: "Collectable items, materials, consumables, values, and traits.",
  index: [],
  promise: null,
};
const USEABLE_SEARCH_CONFIG = {
  dataFile: "pages/items/useables_data.json",
  url: "pages/items/useables.html",
  queryKey: "useable",
  category: "Useables",
  description: "Useable tools, scrolls, shards, and utility items.",
  index: [],
  promise: null,
};
let PERK_INDEX_PROMISE = null;
let PERK_NAME_INDEX = new Map();
let MONSTER_TATTER_INDEX = new Map();

function fetchJsonMaybeCached(absoluteUrl, errorMessage) {
  const cachedFetch =
    window.RogueCodexUtils && typeof window.RogueCodexUtils.fetchJsonCached === "function"
      ? window.RogueCodexUtils.fetchJsonCached
      : null;
  if (cachedFetch) {
    return cachedFetch(absoluteUrl);
  }
  return fetch(absoluteUrl).then((response) => {
    if (!response.ok) throw new Error(errorMessage || `Failed to fetch ${absoluteUrl}`);
    return response.json();
  });
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizePerkName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getPerkSlug(name) {
  if (!name) return "";
  const slug = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `perk-${slug}` : "";
}

const EMPTY_ALLOWLISTS = {
  monsters: { allow: [], block: [], blockIds: [] },
  weapons: { block: [], blockIds: [] },
  armors: { block: [] },
};
const buildNameSet = (list) => {
  const utils = window.RogueCodexUtils;
  if (utils && typeof utils.buildNameSet === "function") {
    return utils.buildNameSet(list);
  }
  return new Set(
    (Array.isArray(list) ? list : [])
      .map((value) => (value === null || value === undefined ? "" : String(value)).trim().toLowerCase())
      .filter(Boolean)
  );
};
let allowlistsPromise = null;
let allowedMonsterNames = new Set();
let blockedMonsterNames = new Set();
let blockedMonsterIds = new Set();
let hiddenWeaponNames = new Set();
let hiddenWeaponIds = new Set();
let hiddenArmorNames = new Set();

const applyAllowlists = (allowlists) => {
  const safe = allowlists && typeof allowlists === "object" ? allowlists : EMPTY_ALLOWLISTS;
  allowedMonsterNames = buildNameSet(safe.monsters?.allow);
  blockedMonsterNames = buildNameSet(safe.monsters?.block);
  blockedMonsterIds = new Set(
    (Array.isArray(safe.monsters?.blockIds) ? safe.monsters.blockIds : []).map((id) => String(id).trim())
  );
  hiddenWeaponNames = buildNameSet(safe.weapons?.block);
  hiddenWeaponIds = new Set(
    (Array.isArray(safe.weapons?.blockIds) ? safe.weapons.blockIds : []).map((id) => String(id).trim())
  );
  hiddenArmorNames = buildNameSet(safe.armors?.block);
};

const loadAllowlists = () => {
  if (allowlistsPromise) return allowlistsPromise;
  const utils = window.RogueCodexUtils;
  if (utils && typeof utils.loadAllowlists === "function") {
    allowlistsPromise = utils.loadAllowlists().then((data) => {
      applyAllowlists(data || EMPTY_ALLOWLISTS);
      return data;
    });
    return allowlistsPromise;
  }
  applyAllowlists(EMPTY_ALLOWLISTS);
  allowlistsPromise = Promise.resolve(EMPTY_ALLOWLISTS);
  return allowlistsPromise;
};

const isRecordHidden = (record, hiddenNames) => {
  const utils = window.RogueCodexUtils;
  if (utils && typeof utils.isRecordHidden === "function") {
    return utils.isRecordHidden(record, hiddenNames);
  }
  const name = String(record?.name || record?.Name || "").toLowerCase();
  return (
    Boolean(record && (record.codex_hidden === true || record.codexHidden === true)) ||
    Boolean(hiddenNames?.has(name))
  );
};

const normalizeMonsterName = (monster) => normalizePerkName(monster && (monster.name || monster.Name));

const isMonsterAllowed = (monster) => {
  if (isRecordHidden(monster)) return false;
  const id = monster?.id ?? monster?.Id;
  if (id !== null && id !== undefined && blockedMonsterIds.has(String(id).trim())) return false;
  const name = normalizeMonsterName(monster);
  if (!name) return false;
  if (allowedMonsterNames.size) {
    return allowedMonsterNames.has(name);
  }
  if (blockedMonsterNames.size) {
    return !blockedMonsterNames.has(name);
  }
  return true;
};

const computeDps = (minDamage, maxDamage, attackSpeed) => {
  const min = Number(minDamage);
  const max = Number(maxDamage);
  const speed = Number(attackSpeed);
  if (Number.isNaN(min) || Number.isNaN(max) || Number.isNaN(speed) || speed === 0) return null;
  const avgDamage = (min + max) / 2;
  return Number((avgDamage * (1000 / speed)).toFixed(2));
};

const normalizeNavMonster = (monster) => {
  if (!monster) return null;
  const fields = (monster && typeof monster.fields === "object" && monster.fields) || {};
  const name = monster.name || monster.Name;
  const slug = normalizeSlug(name || monster.id);
  if (!slug) return null;
  const toNumberOrNull = (value) => {
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
  };
  const level = toNumberOrNull(fields.level ?? monster.level ?? monster.Level);
  const type = fields.type_label || monster.monsterType || monster.type || monster.type_label;
  const elementRaw =
    fields.elemental_attack_label || monster.element || monster.elementalAttack || monster.elementalDamageType;
  const element = elementRaw === 0 ? "None" : elementRaw;
  const minDamage = toNumberOrNull(fields.min_damage ?? monster.min_damage ?? monster.minDamage);
  const maxDamage = toNumberOrNull(fields.max_damage ?? monster.max_damage ?? monster.maxDamage);
  const attackSpeed = toNumberOrNull(fields.attack_speed ?? monster.attack_speed ?? monster.attackSpeed);
  const hpMax = toNumberOrNull(fields.health ?? monster.hp ?? monster.hpMax ?? monster.health);
  const movingSpeed = toNumberOrNull(fields.movement_speed ?? monster.moving_speed ?? monster.movingSpeed);
  const uncommonTatter =
    fields.uncommon_tatter_label ?? monster.uncommon_tatter_label ?? monster.uncommonTatter ?? null;
  const rareTatter = fields.rare_tatter_label ?? monster.rare_tatter_label ?? monster.rareTatter ?? null;

  return {
    name: name || slug,
    slug,
    level,
    monsterType: type,
    elementalAttack: element,
    minDamage,
    maxDamage,
    attackSpeed,
    dps: computeDps(minDamage, maxDamage, attackSpeed),
    hpMax,
    movingSpeed,
    uncommonTatter,
    rareTatter,
  };
};

const normalizeNavWeapon = (weapon) => {
  if (!weapon) return null;
  const fields = (weapon && typeof weapon.fields === "object" && weapon.fields) || {};
  const name = weapon.name || weapon.Name;
  const slug = normalizeSlug(name || weapon.id);
  if (!slug) return null;
  const toNumberOrNull = (value) => {
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
  };
  const minDamage = toNumberOrNull(fields.min_damage ?? weapon.min_damage ?? weapon.minDamage);
  const maxDamage = toNumberOrNull(fields.max_damage ?? weapon.max_damage ?? weapon.maxDamage);
  const attackSpeed = toNumberOrNull(fields.attack_speed ?? weapon.attack_speed ?? weapon.attackSpeed);
  const level = toNumberOrNull(fields.level_requirement ?? weapon.level ?? weapon.Level);
  const type = fields.subtype_label || fields.subtype || weapon.type;
  const elementRaw = fields.element_label || fields.element || weapon.elementalDamageType || weapon.element;
  const element = elementRaw === 0 ? "None" : elementRaw;
  const specialty = fields.specialty
    ? fields.specialty_label || String(fields.specialty)
    : weapon.specialty || weapon.specialty_label || null;
  const perk = fields.perk ? fields.perk_label || fields.perk : weapon.perk || weapon.perk_label || null;
  const resistances = {
    fire: toNumberOrNull(fields.fire_resistance ?? weapon.fireResist),
    cold: toNumberOrNull(fields.cold_resistance ?? weapon.coldResist),
    electric: toNumberOrNull(fields.electric_resistance ?? weapon.electricResist),
    acid: toNumberOrNull(fields.acid_resistance ?? weapon.acidResist),
    poison: toNumberOrNull(fields.poison_resistance ?? weapon.poisonResist),
    disease: toNumberOrNull(fields.disease_resistance ?? weapon.diseaseResist),
    holy: toNumberOrNull(fields.holy_resistance ?? fields.unknown_88 ?? weapon.holyResist),
    dark: toNumberOrNull(fields.dark_resistance ?? fields.unknown_89 ?? weapon.darkResist),
  };

  return {
    id: weapon.id ?? weapon.ID ?? slug,
    name: name || slug,
    codexHidden: Boolean(weapon.codex_hidden === true || weapon.codexHidden === true),
    slug,
    level,
    attackSpeed,
    minDamage,
    maxDamage,
    dps: computeDps(minDamage, maxDamage, attackSpeed),
    type,
    element,
    specialty,
    perk,
    resistances,
  };
};

const normalizeNavArmor = (armor) => {
  if (!armor) return null;
  const fields = (armor && typeof armor.fields === "object" && armor.fields) || {};
  const name = armor.name || armor.Name;
  const slug = normalizeSlug(name || armor.id);
  if (!slug) return null;
  const toNumberOrNull = (value) => {
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
  };
  const level = toNumberOrNull(fields.level ?? armor.level ?? armor.Level);
  const slot = fields.slot_label || fields.slot || armor.slot;
  const armorValue = toNumberOrNull(fields.armor ?? armor.armor);
  const weight = toNumberOrNull(fields.weight ?? armor.weight);
  const perk = fields.perk ? fields.perk_label || fields.perk : null;
  const corruptedPerk = fields.corrupted_perk ? fields.corrupted_perk_label || fields.corrupted_perk : null;
  const electric = fields.electric_resistance ?? fields.lightning_resistance ?? armor.electricResist;
  const resistances = {
    fire: toNumberOrNull(fields.fire_resistance ?? armor.fireResist),
    cold: toNumberOrNull(fields.cold_resistance ?? armor.coldResist),
    electric: toNumberOrNull(electric),
    acid: toNumberOrNull(fields.acid_resistance ?? armor.acidResist),
    poison: toNumberOrNull(fields.poison_resistance ?? armor.poisonResist),
    disease: toNumberOrNull(fields.disease_resistance ?? armor.diseaseResist),
    holy: toNumberOrNull(fields.holy_resistance ?? armor.holyResist),
    dark: toNumberOrNull(fields.dark_resistance ?? armor.darkResist),
  };

  return {
    id: armor.id ?? armor.ID ?? slug,
    name: name || slug,
    codexHidden: Boolean(armor.codex_hidden === true || armor.codexHidden === true),
    slug,
    level,
    slot,
    armor: armorValue,
    weight,
    perk,
    corruptedPerk,
    resistances,
  };
};

function titleCaseWords(text) {
  return String(text || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isExternalUrl(url) {
  return /^https?:\/\//i.test(url);
}

function getSiteRoot() {
  const { pathname } = window.location;
  const pagesIndex = pathname.toLowerCase().lastIndexOf("/pages/");
  if (pagesIndex !== -1) {
    return pathname.slice(0, pagesIndex + 1);
  }
  const lastSlash = pathname.lastIndexOf("/");
  return lastSlash !== -1 ? pathname.slice(0, lastSlash + 1) : "/";
}

function getAbsoluteUrl(url) {
  if (!url) return url;
  if (isExternalUrl(url)) return url;
  const normalized = url.startsWith("/") ? url.slice(1) : url;
  const root = getSiteRoot();
  try {
    return new URL(normalized, `${window.location.origin}${root}`).toString();
  } catch (error) {
    return normalized;
  }
}

function extractVisibleText(html) {
  if (!html) return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    doc.querySelectorAll("script, style, noscript").forEach((node) => node.remove());
    const body = doc.body;
    const text = body ? body.textContent || "" : "";
    return text.replace(/\s+/g, " ").trim();
  } catch (error) {
    return "";
  }
}

function fetchAndCachePageText(url) {
  if (!url || isExternalUrl(url)) return Promise.resolve("");
  if (FULL_TEXT_CACHE.has(url)) return Promise.resolve(FULL_TEXT_CACHE.get(url));
  if (FULL_TEXT_PROMISES.has(url)) return FULL_TEXT_PROMISES.get(url);

  const absoluteUrl = getAbsoluteUrl(url);
  const promise = fetch(absoluteUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to fetch ${absoluteUrl}`);
      return response.text();
    })
    .then((html) => {
      const text = extractVisibleText(html).toLowerCase();
      FULL_TEXT_CACHE.set(url, text);
      return text;
    })
    .catch(() => {
      FULL_TEXT_CACHE.set(url, "");
      return "";
    })
    .finally(() => {
      FULL_TEXT_PROMISES.delete(url);
    });

  FULL_TEXT_PROMISES.set(url, promise);
  return promise;
}

function warmFullTextCache() {
  if (FULL_TEXT_WARMED) return;
  FULL_TEXT_WARMED = true;
  INTERNAL_SEARCH_PAGES.forEach((entry) => {
    if (!entry.url) return;
    if (FULL_TEXT_CACHE.has(entry.url) || FULL_TEXT_PROMISES.has(entry.url)) return;
    fetchAndCachePageText(entry.url);
  });
}

function buildMonsterSearchEntry(monster) {
  const normalized = normalizeNavMonster(monster);
  if (!normalized) return null;
  const { slug, name, monsterType, elementalAttack, level, dps } = normalized;
  const parts = [];
  if (Number.isFinite(level)) parts.push(`Lvl ${Math.round(level)}`);
  if (Number.isFinite(dps)) parts.push(`DPS ${dps}`);
  if (monsterType) parts.push(titleCaseWords(String(monsterType)));
  if (elementalAttack && String(elementalAttack).toLowerCase() !== "none") parts.push(`Element: ${elementalAttack}`);

  const keywords = [slug, normalized.name, monsterType, elementalAttack].filter(Boolean);

  return normalizeSearchEntry({
    title: name || slug,
    url: `pages/enemies/monsters.html?monster=${encodeURIComponent(slug)}`,
    category: "Monsters",
    description: parts.join(" | ") || "Monster stats, damage, and loot.",
    keywords,
    isMonster: true,
    monsterId: slug,
  });
}

function loadMonsterSearchIndex() {
  if (MONSTER_INDEX_PROMISE) return MONSTER_INDEX_PROMISE;
  const absoluteUrl = getAbsoluteUrl("pages/enemies/monsters_data03.json");
  MONSTER_INDEX_PROMISE = Promise.all([
    loadAllowlists(),
    fetchJsonMaybeCached(absoluteUrl, "Failed to fetch monsters_data03.json"),
  ])
    .then(([, data]) => {
      const list = Array.isArray(data) ? data : [];
      const filtered = list.filter((monster) => isMonsterAllowed(monster));
      const normalized = filtered.map((monster) => normalizeNavMonster(monster)).filter(Boolean);
      MONSTER_SEARCH_INDEX = normalized.map((monster) => buildMonsterSearchEntry(monster)).filter(Boolean);

      const tatterIndex = new Map();
      const addTatterEntry = (monster, label, type) => {
        const name = String(label || "").trim();
        if (!name || name.toLowerCase() === "none") return;
        const key = normalizePerkName(name);
        if (!key) return;
        const list = tatterIndex.get(key) || [];
        list.push({ monster, tatterName: name, tatterType: type });
        tatterIndex.set(key, list);
      };

      normalized.forEach((monster) => {
        addTatterEntry(monster, monster.uncommonTatter, "Uncommon");
        addTatterEntry(monster, monster.rareTatter, "Rare");
      });
      MONSTER_TATTER_INDEX = tatterIndex;
      return MONSTER_SEARCH_INDEX;
    })
    .catch(() => {
      MONSTER_SEARCH_INDEX = [];
      MONSTER_TATTER_INDEX = new Map();
      return MONSTER_SEARCH_INDEX;
    });
  return MONSTER_INDEX_PROMISE;
}

function buildWeaponSearchEntry(weapon) {
  const normalized = weapon && weapon.slug && !weapon.fields ? weapon : normalizeNavWeapon(weapon);
  if (!normalized) return null;
  const { slug, name, element, type, level, dps, specialty, perk, resistances } = normalized;
  const routeKey = normalized.id !== null && normalized.id !== undefined ? normalized.id : slug;
  const parts = [];
  if (Number.isFinite(level)) parts.push(`Lvl ${Math.round(level)}`);
  if (Number.isFinite(dps)) parts.push(`DPS ${dps}`);
  if (type) parts.push(titleCaseWords(String(type)));
  if (element && String(element).toLowerCase() !== "none") parts.push(`Element: ${element}`);

  const resistKeys = resistances
    ? Object.entries(resistances)
        .filter(([, val]) => Number.isFinite(val) && val !== 0)
        .map(([key]) => titleCaseWords(key))
    : [];
  if (resistKeys.length) {
    parts.push(`Resists: ${resistKeys.join(", ")}`);
  }

  const keywords = [name, slug, element, type, specialty, perk, ...resistKeys].filter(Boolean);

  return normalizeSearchEntry({
    title: name || slug,
    url: `pages/items/weapons.html?weapon=${encodeURIComponent(routeKey)}`,
    category: "Weapons",
    description: parts.join(" | ") || "Weapon stats, DPS, speed, and perks.",
    keywords,
    isWeapon: true,
    weaponId: slug,
  });
}

function buildArmorSearchEntry(armor) {
  const normalized = normalizeNavArmor(armor);
  if (!normalized) return null;
  const {
    slug,
    name,
    slot,
    level,
    armor: armorValue,
    weight,
    perk,
    corruptedPerk,
    resistances,
  } = normalized;
  const routeKey = normalized.id !== null && normalized.id !== undefined ? normalized.id : slug;

  const parts = [];
  if (Number.isFinite(level)) parts.push(`Lvl ${Math.round(level)}`);
  if (Number.isFinite(armorValue)) parts.push(`Armor ${armorValue}`);
  if (slot) parts.push(titleCaseWords(String(slot)));
  if (Number.isFinite(weight)) parts.push(`Wt ${weight}`);

  const resistKeys = resistances
    ? Object.entries(resistances)
        .filter(([, val]) => Number.isFinite(val) && val !== 0)
        .map(([key]) => titleCaseWords(key))
    : [];
  if (resistKeys.length) {
    parts.push(`Resists: ${resistKeys.join(", ")}`);
  }

  const keywords = [name, slug, slot, perk, corruptedPerk, ...resistKeys].filter(Boolean);

  return normalizeSearchEntry({
    title: name || slug,
    url: `pages/items/armors.html?armor=${encodeURIComponent(routeKey)}`,
    category: "Armors",
    description: parts.join(" | ") || "Armor stats, resistances, slots, and perks.",
    keywords,
    isArmor: true,
    armorId: slug,
  });
}

function formatMiscItemUseType(value) {
  if (value === null || value === undefined || value === "") return "";
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric === 0 ? "None" : `Use Type ${numeric.toLocaleString("en-US")}`;
  }
  return titleCaseWords(value);
}

function cleanMiscKeyword(value) {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) return value.filter(Boolean).join(" ");
  if (typeof value === "object") return "";
  return String(value);
}

function buildMiscItemSearchEntry(item, config) {
  if (!item || typeof item !== "object" || !config) return null;
  const fields = item.fields && typeof item.fields === "object" ? item.fields : {};
  const name = item.name || item.Name || fields.name_label || "";
  const id = item.id ?? item.ID ?? item.itemId ?? null;
  const title = String(name || id || "").trim();
  const routeKey = id !== null && id !== undefined ? id : title;
  if (!title || routeKey === "") return null;

  const value = fields.value ?? item.value;
  const useType = fields.use_type ?? item.use_type ?? item.useType;
  const useTypeLabel = formatMiscItemUseType(useType);
  const emitsLight = Number(fields.emits_light ?? item.emitsLight ?? 0) === 1;
  const animated = Number(fields.animated ?? item.animated ?? 0) === 1;
  const craftingFields = [
    fields.crafting_material_type,
    fields.crafting_material_amount,
    fields.crafting_difficulty,
    fields.crafting_requirement,
  ];

  const parts = [];
  if (value !== null && value !== undefined && value !== "") parts.push(`Value ${value}`);
  if (useTypeLabel) parts.push(`Use: ${useTypeLabel}`);
  if (emitsLight) parts.push("Emits Light");
  if (animated) parts.push("Animated");

  const keywords = [
    name,
    id,
    useType,
    useTypeLabel,
    value,
    emitsLight ? "emits light" : "",
    animated ? "animated" : "",
    ...craftingFields,
  ]
    .map(cleanMiscKeyword)
    .filter(Boolean);

  return normalizeSearchEntry({
    title,
    url: `${config.url}?${config.queryKey}=${encodeURIComponent(routeKey)}`,
    category: config.category,
    description: parts.join(" | ") || config.description,
    keywords,
    isMiscItem: true,
    itemId: String(routeKey),
  });
}

function loadMiscItemSearchIndex(config) {
  if (!config) return Promise.resolve([]);
  if (config.promise) return config.promise;
  const absoluteUrl = getAbsoluteUrl(config.dataFile);
  config.promise = fetchJsonMaybeCached(absoluteUrl, `Failed to fetch ${config.dataFile}`)
    .then((data) => {
      const list = Array.isArray(data) ? data : [];
      config.index = list.map((item) => buildMiscItemSearchEntry(item, config)).filter(Boolean);
      return config.index;
    })
    .catch(() => {
      config.index = [];
      return config.index;
    });
  return config.promise;
}

function buildQuestSearchEntry(entry, kind) {
  if (!entry || !entry.id || !entry.name) return null;
  const provider = kind === "service" ? entry.provider : entry.giver;
  const objectives =
    kind === "quest"
      ? (entry.stages || []).flatMap((stage) =>
          (stage.objectives || []).flatMap((objective) => [
            objective.text,
            objective.target?.label,
            objective.target?.entity?.name,
          ])
        )
      : [];
  const rewards =
    kind === "quest"
      ? [...(entry.rewards?.guaranteed || []), ...(entry.rewards?.choose_one || [])].map(
          (reward) => reward.label
        )
      : (entry.costs || []).map((cost) => cost.label);
  const typeLabel = kind === "service" ? "Service" : entry.repeatable ? "Repeatable quest" : "Quest";
  return normalizeSearchEntry({
    title: entry.name,
    url: `${QUESTS_PAGE_URL}?quest=${encodeURIComponent(entry.id)}`,
    category: kind === "service" ? "Services" : "Quests",
    description: `Level ${entry.min_level} | ${provider?.name || "Unknown"} | ${entry.area}`,
    keywords: [
      entry.name,
      typeLabel,
      entry.category,
      entry.region,
      entry.area,
      provider?.name,
      ...objectives,
      ...rewards,
    ].filter(Boolean),
    isQuest: kind === "quest",
    questId: entry.id,
  });
}

function loadQuestSearchIndex() {
  if (QUEST_INDEX_PROMISE) return QUEST_INDEX_PROMISE;
  const absoluteUrl = getAbsoluteUrl(QUESTS_INDEX_URL);
  QUEST_INDEX_PROMISE = fetchJsonMaybeCached(absoluteUrl, `Failed to fetch ${QUESTS_INDEX_URL}`)
    .then((data) => {
      const quests = Array.isArray(data?.quests)
        ? data.quests.map((entry) => buildQuestSearchEntry(entry, "quest"))
        : [];
      const services = Array.isArray(data?.services)
        ? data.services.map((entry) => buildQuestSearchEntry(entry, "service"))
        : [];
      QUEST_SEARCH_INDEX = quests.concat(services).filter(Boolean);
      return QUEST_SEARCH_INDEX;
    })
    .catch(() => {
      QUEST_SEARCH_INDEX = [];
      return QUEST_SEARCH_INDEX;
    });
  return QUEST_INDEX_PROMISE;
}

function loadArmorSearchIndex() {
  if (ARMOR_INDEX_PROMISE) return ARMOR_INDEX_PROMISE;
  const absoluteUrl = getAbsoluteUrl("pages/items/armors_data06.json");
  ARMOR_INDEX_PROMISE = Promise.all([
    loadAllowlists(),
    fetchJsonMaybeCached(absoluteUrl, "Failed to fetch armors_data06.json"),
  ])
    .then(([, data]) => {
      const list = Array.isArray(data) ? data : [];
      const filtered = list.filter(
        (armor) => !isRecordHidden(armor, hiddenArmorNames)
      );
      ARMOR_SEARCH_INDEX = filtered.map((armor) => buildArmorSearchEntry(armor)).filter(Boolean);
      return ARMOR_SEARCH_INDEX;
    })
    .catch(() => {
      ARMOR_SEARCH_INDEX = [];
      return ARMOR_SEARCH_INDEX;
    });
  return ARMOR_INDEX_PROMISE;
}

function loadPerkIndex() {
  if (PERK_NAME_INDEX.size) return Promise.resolve(PERK_NAME_INDEX);
  if (PERK_INDEX_PROMISE) return PERK_INDEX_PROMISE;
  const absoluteUrl = getAbsoluteUrl(PERKS_INDEX_URL);
  PERK_INDEX_PROMISE = fetchJsonMaybeCached(absoluteUrl, "Failed to fetch perks.json")
    .then((data) => {
      const list = Array.isArray(data?.perks) ? data.perks : [];
      const map = new Map();
      list.forEach((entry) => {
        const name = entry && typeof entry.name === "string" ? entry.name.trim() : "";
        if (!name) return;
        const slug = entry.slug || getPerkSlug(name);
        if (!slug) return;
        map.set(normalizePerkName(name), {
          name,
          slug: String(slug).replace(/^#/, ""),
          isUnique: Boolean(entry.isUnique),
          details: Array.isArray(entry.details) ? entry.details : [],
        });
      });
      PERK_NAME_INDEX = map;
      return map;
    })
    .catch(() => {
      PERK_NAME_INDEX = new Map();
      return PERK_NAME_INDEX;
    });
  return PERK_INDEX_PROMISE;
}

function loadWeaponSearchIndex() {
  if (WEAPON_INDEX_PROMISE) return WEAPON_INDEX_PROMISE;
  WEAPON_INDEX_PROMISE = loadWeaponData()
    .then((data) => {
      const list = Array.isArray(data) ? data : [];
      WEAPON_SEARCH_INDEX = list.map((weapon) => buildWeaponSearchEntry(weapon)).filter(Boolean);
      return WEAPON_SEARCH_INDEX;
    })
    .catch(() => {
      WEAPON_SEARCH_INDEX = [];
      return WEAPON_SEARCH_INDEX;
    });
  return WEAPON_INDEX_PROMISE;
}

function loadWeaponData() {
  if (WEAPON_DATA_PROMISE) return WEAPON_DATA_PROMISE;
  const absoluteUrl = getAbsoluteUrl("pages/items/weapons_data05.json");
  let requestUrl = absoluteUrl;
  try {
    const resolved = new URL(absoluteUrl, window.location.href);
    if (resolved.protocol === "http:" || resolved.protocol === "https:") {
      resolved.searchParams.set("v", String(WEAPONS_SCHEMA_VERSION));
    }
    requestUrl = resolved.toString();
  } catch (error) {
    requestUrl = absoluteUrl;
  }
  WEAPON_DATA_PROMISE = loadAllowlists()
    .then(() => fetchJsonMaybeCached(requestUrl, "Failed to fetch weapons_data05.json"))
    .then((data) => {
      const list = Array.isArray(data) ? data : [];
      const filtered = list.filter(
        (weapon) =>
          !isRecordHidden(weapon, hiddenWeaponNames) &&
          !hiddenWeaponIds.has(String(weapon.id ?? weapon.ID ?? "").trim())
      );
      return filtered.map((weapon) => normalizeNavWeapon(weapon)).filter(Boolean);
    })
    .catch(() => []);
  return WEAPON_DATA_PROMISE;
}
