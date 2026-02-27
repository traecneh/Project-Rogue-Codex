const SITE_SEARCH_INDEX = [
  {
    title: "Home / Timeline",
    url: "index.html",
    category: "Overview",
    description: "Project Rogue history and milestones in one scroll.",
    keywords: ["home", "timeline", "history", "overview"],
    featured: true,
  },
  {
    title: "Interactive Map",
    url: "https://traecneh.github.io/Project-Rogue-Map/",
    category: "Tools",
    description: "Browser map for Project Rogue zones and points of interest.",
    keywords: ["map", "world", "navigation", "tools"],
  },
  {
    title: "Play the Game",
    url: "pages/General/play-the-game.html",
    category: "General",
    description: "How to download the client, connect, and start playing.",
    keywords: ["download", "install", "client", "setup", "login"],
    featured: true,
  },
  {
    title: "Build Planner",
    url: "pages/General/build-planner.html",
    category: "General",
    description: "Plan stats and builds before you respec or wipe.",
    keywords: ["planner", "builds", "stats", "theorycraft"],
  },
  {
    title: "Weapons",
    url: "pages/items/weapons.html",
    category: "Items",
    description: "Full weapon list with DPS, speed, and requirements.",
    keywords: ["items", "damage", "dps", "gear", "weapon"],
    featured: true,
  },
  {
    title: "Armors",
    url: "pages/items/armors.html",
    category: "Items",
    description: "Armor stats, resistances, and slots overview.",
    keywords: ["armor", "defense", "gear", "resist"],
  },
  {
    title: "Monsters",
    url: "pages/enemies/monsters.html",
    category: "Enemies",
    description: "Enemy list with stats, drops, and quick tips.",
    keywords: ["monsters", "enemies", "bestiary", "drops"],
  },
  {
    title: "Strength",
    url: "pages/stats/strength.html",
    category: "Stats",
    description: "Strength scaling and melee benefits.",
    keywords: ["stat", "melee", "carry", "damage"],
  },
  {
    title: "Dexterity",
    url: "pages/stats/dexterity.html",
    category: "Stats",
    description: "Dexterity, crit, dodge, and damage bonuses.",
    keywords: ["stat", "dex", "ranged", "crit"],
  },
  {
    title: "Constitution",
    url: "pages/stats/constitution.html",
    category: "Stats",
    description: "Health, regen, and mitigation from Constitution.",
    keywords: ["stat", "health", "regen", "defense"],
  },
  {
    title: "Level",
    url: "pages/stats/level.html",
    category: "Stats",
    description: "Level curve, XP gains, and milestones.",
    keywords: ["leveling", "xp", "progression"],
  },
  {
    title: "Races",
    url: "pages/stats/races.html",
    category: "Stats",
    description: "Playable races and their passive bonuses.",
    keywords: ["races", "bonuses", "traits"],
  },
  {
    title: "Resistances",
    url: "pages/stats/resistances.html",
    category: "Stats",
    description: "Damage types, resist caps, and mitigation.",
    keywords: ["resist", "defense", "damage types"],
  },
  {
    title: "Skills",
    url: "pages/stats/skills.html",
    category: "Stats",
    description: "Skill system overview and training tips.",
    keywords: ["skills", "progression", "practice"],
  },
  {
    title: "Floor Cleanup",
    url: "pages/systems/floor-cleanup.html",
    category: "Systems",
    description: "Loot cleanup and anti-clutter rules.",
    keywords: ["cleanup", "loot", "corpses"],
  },
  {
    title: "Encounter",
    url: "pages/systems/encounter.html",
    category: "Systems",
    description: "Encounter flow, spawns, and tuning knobs.",
    keywords: ["encounter", "spawn", "combat"],
  },
  {
    title: "Corruption System",
    url: "pages/systems/corruption.html",
    category: "Systems",
    description: "How corruption overrides innates, drop sources, and cleansing.",
    keywords: ["corruption", "innate", "purge", "loot"],
  },
  {
    title: "Rarity",
    url: "pages/systems/rarity.html",
    category: "Systems",
    description: "Rarity tiers, stats, and perk chances.",
    keywords: ["rarity", "tiers", "loot", "gear"],
  },
  {
    title: "Anti-Zerg",
    url: "pages/systems/anti-zerg.html",
    category: "Systems",
    description: "Anti-zerg mechanics and scaling.",
    keywords: ["anti zerg", "group", "balance", "debuff"],
  },
  {
    title: "Monster Damage Reduction",
    url: "pages/systems/monster-damage-reduction.html",
    category: "Systems",
    description: "How monster damage reduction scales and affects combat.",
    keywords: ["monster", "damage reduction", "mitigation", "combat", "scaling"],
  },
  {
    title: "Crafting",
    url: "pages/systems/crafting.html",
    category: "Systems",
    description: "Crafting process, recipes, and materials.",
    keywords: ["crafting", "recipes", "materials"],
  },
  {
    title: "Chat",
    url: "pages/systems/chat.html",
    category: "Systems",
    description: "Chat commands and communication features.",
    keywords: ["chat", "commands", "comms"],
  },
  {
    title: "PVP System",
    url: "pages/systems/pvp-system.html",
    category: "Systems",
    description: "PvP rules, timers, and flagging.",
    keywords: ["pvp", "combat", "rules"],
  },
  {
    title: "Guild",
    url: "pages/systems/guild.html",
    category: "Systems",
    description: "Guild creation, ranks, and permissions.",
    keywords: ["guild", "clan", "ranks", "permissions"],
  },
  {
    title: "Perks",
    url: "pages/systems/perks.html",
    category: "Systems",
    description: "Perk list, tiers, and unique effects.",
    keywords: ["perks", "bonuses", "effects"],
    featured: true,
  },
  {
    title: "Experience Pool",
    url: "pages/systems/experience.html",
    category: "Systems",
    description: "Experience pool behavior and XP flow.",
    keywords: ["experience", "xp", "pool", "progression"],
  },
  {
    title: "Deconstruct",
    url: "pages/systems/deconstruct.html",
    category: "Ascendancy",
    description: "Deconstruction steps and shard returns.",
    keywords: ["deconstruct", "shards", "salvage"],
  },
  {
    title: "Ascend",
    url: "pages/systems/ascend.html",
    category: "Ascendancy",
    description: "Ascend process and ascendant gear basics.",
    keywords: ["ascend", "upgrade", "ascendant"],
  },
  {
    title: "Imbuements",
    url: "pages/systems/imbuements.html",
    category: "Ascendancy",
    description: "Imbuement tiers, effects, and costs.",
    keywords: ["imbuements", "enchant", "upgrade"],
  },
  {
    title: "Re-Roll",
    url: "pages/systems/re-roll.html",
    category: "Ascendancy",
    description: "Re-rolling stats and perks workflow.",
    keywords: ["reroll", "stats", "perks"],
  },
  {
    title: "Craft (Ascendancy)",
    url: "pages/systems/craft.html",
    category: "Ascendancy",
    description: "Ascendancy shard shop, race scrolls, and imbuement crafting.",
    keywords: ["craft", "ethereal shards", "ascendancy", "race change"],
  },
  {
    title: "Purge",
    url: "pages/systems/purge.html",
    category: "Ascendancy",
    description: "Purge or cleanse items and recover Tattered Imbuements.",
    keywords: ["purge", "cleanse", "corruption", "imbuement"],
  },
];

const MAX_SEARCH_RESULTS = 8;
const WEAPONS_SCHEMA_VERSION = 5;
const PERKS_PAGE_URL = "pages/systems/perks.html";
const PERKS_INDEX_URL = "pages/systems/perks.json";
const MONSTERS_PAGE_URL = "pages/enemies/monsters.html";
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
  monsters: { allow: [], block: [] },
  weapons: { block: [] },
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
let hiddenWeaponNames = new Set();
let hiddenArmorNames = new Set();

const applyAllowlists = (allowlists) => {
  const safe = allowlists && typeof allowlists === "object" ? allowlists : EMPTY_ALLOWLISTS;
  allowedMonsterNames = buildNameSet(safe.monsters?.allow);
  blockedMonsterNames = buildNameSet(safe.monsters?.block);
  hiddenWeaponNames = buildNameSet(safe.weapons?.block);
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

const normalizeMonsterName = (monster) => normalizePerkName(monster && (monster.name || monster.Name));

const isMonsterAllowed = (monster) => {
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

  return {
    id: weapon.id ?? weapon.ID ?? slug,
    name: name || slug,
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
  };

  return {
    id: armor.id ?? armor.ID ?? slug,
    name: name || slug,
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
  const { slug, name, element, type, level, dps, specialty, perk } = normalized;
  const parts = [];
  if (Number.isFinite(level)) parts.push(`Lvl ${Math.round(level)}`);
  if (Number.isFinite(dps)) parts.push(`DPS ${dps}`);
  if (type) parts.push(titleCaseWords(String(type)));
  if (element && String(element).toLowerCase() !== "none") parts.push(`Element: ${element}`);

  const keywords = [name, slug, element, type, specialty, perk].filter(Boolean);

  return normalizeSearchEntry({
    title: name || slug,
    url: `pages/items/weapons.html?weapon=${encodeURIComponent(slug)}`,
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
    url: `pages/items/armors.html?armor=${encodeURIComponent(name || slug)}`,
    category: "Armors",
    description: parts.join(" | ") || "Armor stats, resistances, slots, and perks.",
    keywords,
    isArmor: true,
    armorId: slug,
  });
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
        (armor) => !hiddenArmorNames.has(String(armor.name || armor.Name || "").toLowerCase())
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
        (weapon) => !hiddenWeaponNames.has(String(weapon.name || weapon.Name || "").toLowerCase())
      );
      return filtered.map((weapon) => normalizeNavWeapon(weapon)).filter(Boolean);
    })
    .catch(() => []);
  return WEAPON_DATA_PROMISE;
}

function toSearchTerms(query) {
  return String(query || "")
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function highlightWithTerms(text, terms) {
  if (!text) return "";
  if (!terms || !terms.length) return escapeHtml(text);
  const uniqueTerms = Array.from(new Set(terms.filter(Boolean)));
  if (!uniqueTerms.length) return escapeHtml(text);
  const pattern = new RegExp(`(${uniqueTerms.map(escapeRegExp).join("|")})`, "gi");
  return escapeHtml(text).replace(pattern, "<mark>$1</mark>");
}

function scoreSearchEntry(entry, terms) {
  if (!entry || !terms.length) return 0;
  let score = 0;
  terms.forEach((term) => {
    if (!term) return;
    if (entry.titleLower.includes(term)) score += 6;
    if (entry.categoryLower.includes(term)) score += 3;
    if (entry.descriptionLower.includes(term)) score += 2;
    if (entry.keywordsLower && entry.keywordsLower.some((kw) => kw.includes(term))) score += 5;
  });
  return score;
}

function scoreFullText(fullText, terms) {
  if (!fullText || !terms.length) return 0;
  let hits = 0;
  terms.forEach((term) => {
    if (term && fullText.includes(term)) hits += 1;
  });
  if (!hits) return 0;
  return hits * 2;
}

function buildPerkSearchEntry(entry) {
  if (!entry || !entry.slug || !entry.name) return null;
  const details = Array.isArray(entry.details) ? entry.details : [];
  const firstDetail = details.length ? String(details[0]).trim() : "";
  const description = firstDetail || "Jump to perk details.";
  const category = entry.isUnique ? "Unique Perks" : "Perks";
  return normalizeSearchEntry({
    title: `Perk: ${entry.name}`,
    url: `${PERKS_PAGE_URL}#${entry.slug}`,
    category,
    description,
    keywords: [entry.name, "perk"],
    isPerk: true,
    perkName: entry.name,
  });
}

function getPerkEntriesForQuery(query) {
  const normalizedQuery = normalizePerkName(query);
  if (!normalizedQuery || !PERK_NAME_INDEX.size) return [];
  const terms = toSearchTerms(normalizedQuery).filter((term) => term.length >= MIN_PERK_TERM_LENGTH);
  if (!terms.length) return [];
  const matches = [];
  PERK_NAME_INDEX.forEach((entry, nameKey) => {
    if (!terms.every((term) => nameKey.includes(term))) return;
    let score = 0;
    if (nameKey === normalizedQuery) score += 3;
    if (nameKey.startsWith(normalizedQuery)) score += 2;
    matches.push({ entry, score });
  });
  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.entry.name.localeCompare(b.entry.name);
  });
  return matches.map((match) => match.entry);
}

function buildTatterMonsterSearchEntry(monsterEntry, perkName) {
  if (!monsterEntry || !monsterEntry.monster) return null;
  const monster = monsterEntry.monster;
  const tatterName = monsterEntry.tatterName || perkName || "";
  const typeLabel = monsterEntry.tatterType ? `${monsterEntry.tatterType} Tatter` : "Tattered Imbuement";
  const description = tatterName ? `${typeLabel}: ${tatterName}` : "Tattered Imbuement source.";
  const searchValue = perkName || tatterName || "";
  const monsterId = monster.slug || normalizeSlug(monster.name || "");
  if (!monsterId) return null;
  const params = new URLSearchParams();
  params.set("monster", monsterId);
  if (searchValue) {
    params.set("search", searchValue);
  }

  return normalizeSearchEntry({
    title: `Monster: ${monster.name || monsterId}`,
    url: `${MONSTERS_PAGE_URL}?${params.toString()}`,
    category: "Monsters",
    description,
    keywords: [monster.name, tatterName, "tatter", "tattered"].filter(Boolean),
    isMonster: true,
    isTatterMonster: true,
    monsterId,
  });
}

function buildTatterMonsterResults(perkEntries) {
  if (!perkEntries.length || !MONSTER_TATTER_INDEX.size) return [];
  const buckets = perkEntries
    .map((perk) => {
      const key = normalizePerkName(perk.name);
      const entries = MONSTER_TATTER_INDEX.get(key) || [];
      const sorted = entries.slice().sort((a, b) => {
        const nameA = a.monster?.name || "";
        const nameB = b.monster?.name || "";
        return nameA.localeCompare(nameB);
      });
      return { perkName: perk.name, monsters: sorted };
    })
    .filter((bucket) => bucket.monsters.length);
  if (!buckets.length) return [];

  const results = [];
  const usedUrls = new Set();
  let added = true;
  while (results.length < MAX_TATTER_MONSTER_RESULTS && added) {
    added = false;
    for (const bucket of buckets) {
      if (results.length >= MAX_TATTER_MONSTER_RESULTS) break;
      const next = bucket.monsters.shift();
      if (!next) continue;
      const entry = buildTatterMonsterSearchEntry(next, bucket.perkName);
      if (!entry || usedUrls.has(entry.url)) continue;
      usedUrls.add(entry.url);
      results.push(entry);
      added = true;
    }
  }
  return results;
}

function injectPerkResults(results, query) {
  const perkEntries = getPerkEntriesForQuery(query).slice(0, MAX_PERK_RESULTS);
  if (!perkEntries.length) return results;
  const perkResults = perkEntries.map((entry) => buildPerkSearchEntry(entry)).filter(Boolean);
  const tatterResults = buildTatterMonsterResults(perkEntries);
  const promotedResults = perkResults.concat(tatterResults);
  if (!promotedResults.length) return results;
  const promotedUrls = new Set(promotedResults.map((entry) => entry.url));
  const filtered = results.filter((entry) => entry && !promotedUrls.has(entry.url));
  return promotedResults.concat(filtered).slice(0, MAX_SEARCH_RESULTS);
}

function runSiteSearch(query) {
  const trimmedQuery = String(query || "").trim();
  const terms = toSearchTerms(trimmedQuery);
  loadMonsterSearchIndex();
  loadWeaponSearchIndex();
  loadArmorSearchIndex();
  if (!terms.length) {
    return [];
  }
  if (trimmedQuery.length >= 3) {
    warmFullTextCache();
  }

  const matches = [];
  const corpus = NORMALIZED_SEARCH_INDEX.concat(MONSTER_SEARCH_INDEX, WEAPON_SEARCH_INDEX, ARMOR_SEARCH_INDEX);
  corpus.forEach((entry) => {
    const baseScore = scoreSearchEntry(entry, terms);
    const canUseFullText =
      entry.url &&
      !entry.isMonster &&
      !entry.isWeapon &&
      !entry.isArmor &&
      !isExternalUrl(entry.url);
    if (canUseFullText && baseScore > 0 && !FULL_TEXT_CACHE.has(entry.url) && !FULL_TEXT_PROMISES.has(entry.url)) {
      fetchAndCachePageText(entry.url);
    }
    const fullTextScore = canUseFullText ? scoreFullText(FULL_TEXT_CACHE.get(entry.url), terms) : 0;
    const score = baseScore + fullTextScore;
    if (score <= 0) return;
    const titleHits = terms.filter((term) => entry.titleLower.includes(term)).length;
    matches.push({ entry, score: score + titleHits });
  });

  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.entry.title.localeCompare(b.entry.title);
  });
  return matches.slice(0, MAX_SEARCH_RESULTS).map((item) => item.entry);
}

function initializeSiteSearch() {
  const container = document.querySelector(".nav-search");
  const input = document.getElementById("site-search-input");
  const resultsEl = document.getElementById("site-search-results");
  if (!container || !input || !resultsEl) return;

  let currentResults = [];
  let activeIndex = -1;

  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", "site-search-results");
  input.setAttribute("aria-expanded", "false");
  resultsEl.setAttribute("role", "listbox");

  const setOpen = (isOpen) => {
    container.classList.toggle("is-open", isOpen);
    input.setAttribute("aria-expanded", isOpen ? "true" : "false");
  };

  const renderResults = (results, terms) => {
    resultsEl.innerHTML = "";
    if (!results.length) {
      const empty = document.createElement("div");
      empty.className = "nav-search-empty";
      empty.textContent = terms.length ? "No results found." : "Start typing to search the codex.";
      resultsEl.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    results.forEach((entry, index) => {
      const link = document.createElement("a");
      link.className = "nav-search-result";
      link.href = entry.url;
      link.id = `nav-search-result-${index}`;
      link.setAttribute("data-result-index", String(index));
      link.setAttribute("role", "option");

      const title = document.createElement("span");
      title.className = "nav-search-result-title";
      title.innerHTML = highlightWithTerms(entry.title, terms);
      link.appendChild(title);

      const meta = document.createElement("div");
      meta.className = "nav-search-result-meta";
      const tag = document.createElement("span");
      tag.className = "nav-search-tag";
      tag.textContent = entry.category || "Page";
      meta.appendChild(tag);
      link.appendChild(meta);

      if (entry.description) {
        const desc = document.createElement("p");
        desc.className = "nav-search-result-desc";
        desc.innerHTML = highlightWithTerms(entry.description, terms);
        link.appendChild(desc);
      }

      fragment.appendChild(link);
    });
    resultsEl.appendChild(fragment);
  };

  const prefetchOnHover = (linkEl) => {
    const href = linkEl.getAttribute("href") || "";
    if (!href) return;
    if (isExternalUrl(href)) return;
    if (href.includes("?") || href.includes("#")) return;
    fetchAndCachePageText(href);
  };

  resultsEl.addEventListener("mouseover", (event) => {
    const target = event.target instanceof Element ? event.target.closest("a.nav-search-result") : null;
    if (target) prefetchOnHover(target);
  });

  document.addEventListener("mouseover", (event) => {
    const target = event.target instanceof Element ? event.target.closest("a.nav-link[href]") : null;
    if (target) prefetchOnHover(target);
  });

  const setActiveResult = (index) => {
    const links = resultsEl.querySelectorAll(".nav-search-result");
    links.forEach((link) => link.classList.remove("active"));
    if (index < 0 || index >= links.length) {
      activeIndex = -1;
      input.removeAttribute("aria-activedescendant");
      return;
    }
    activeIndex = index;
    const link = links[index];
    link.classList.add("active");
    link.scrollIntoView({ block: "nearest" });
    if (link.id) {
      input.setAttribute("aria-activedescendant", link.id);
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  };

  const updateResults = ({ autoOpen } = {}) => {
    const query = input.value.trim();
    const terms = toSearchTerms(query);
    if (!query) {
      currentResults = [];
      activeIndex = -1;
      resultsEl.innerHTML = "";
      setOpen(false);
      return;
    }
    loadPerkIndex();
    currentResults = injectPerkResults(runSiteSearch(query), query);
    activeIndex = -1;
    renderResults(currentResults, terms);
    const shouldOpen = Boolean(query || (autoOpen && currentResults.length));
    setOpen(shouldOpen);

    const pendingFetches = Array.from(FULL_TEXT_PROMISES.values());
    if (MONSTER_INDEX_PROMISE) {
      pendingFetches.push(MONSTER_INDEX_PROMISE);
    }
    if (WEAPON_INDEX_PROMISE) {
      pendingFetches.push(WEAPON_INDEX_PROMISE);
    }
    if (ARMOR_INDEX_PROMISE) {
      pendingFetches.push(ARMOR_INDEX_PROMISE);
    }
    if (PERK_INDEX_PROMISE) {
      pendingFetches.push(PERK_INDEX_PROMISE);
    }
    if (pendingFetches.length && query) {
      Promise.allSettled(pendingFetches).then(() => {
        if (input.value.trim() !== query) return;
        currentResults = injectPerkResults(runSiteSearch(query), query);
        activeIndex = -1;
        renderResults(currentResults, terms);
        const openAfterFetch = Boolean(query || (autoOpen && currentResults.length));
        setOpen(openAfterFetch);
      });
    }
  };

  input.addEventListener("input", () => updateResults({ autoOpen: true }));
  input.addEventListener("focus", () => {
    updateResults({ autoOpen: true });
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      const nextIndex = Math.min(activeIndex + 1, currentResults.length - 1);
      setActiveResult(nextIndex);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const nextIndex = activeIndex <= 0 ? -1 : activeIndex - 1;
      setActiveResult(nextIndex);
    } else if (event.key === "Enter") {
      if (!currentResults.length) return;
      const target = activeIndex >= 0 ? currentResults[activeIndex] : currentResults[0];
      if (target && target.url) {
        window.location.href = target.url;
        event.preventDefault();
      }
    } else if (event.key === "Escape") {
      setOpen(false);
      setActiveResult(-1);
      resultsEl.innerHTML = "";
    }
  });

  resultsEl.addEventListener("mousemove", (event) => {
    const target = event.target instanceof Element ? event.target.closest(".nav-search-result") : null;
    if (!target || !resultsEl.contains(target)) return;
    const index = Number(target.dataset.resultIndex);
    if (!Number.isNaN(index)) {
      setActiveResult(index);
    }
  });

  resultsEl.addEventListener("mouseleave", () => setActiveResult(-1));

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!container.contains(target)) {
      setOpen(false);
      setActiveResult(-1);
    }
  });

  updateResults({ autoOpen: false });
  setOpen(false);
}
