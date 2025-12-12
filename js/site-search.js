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
    title: "Trading Post",
    url: "pages/General/trading-post.html",
    category: "General",
    description: "Trading guidance, price info, and marketplace notes.",
    keywords: ["trade", "market", "prices", "economy"],
    featured: true,
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
const DEFAULT_SEARCH_RESULTS = NORMALIZED_SEARCH_INDEX.filter((entry) => entry.featured).slice(0, MAX_SEARCH_RESULTS);
const FULL_TEXT_CACHE = new Map();
const FULL_TEXT_PROMISES = new Map();
const INTERNAL_SEARCH_PAGES = NORMALIZED_SEARCH_INDEX.filter((entry) => entry.url && !/^https?:\/\//i.test(entry.url));
let SEARCH_CORPUS_WARM_PROMISE = null;
let MONSTER_SEARCH_INDEX = [];
let MONSTER_INDEX_PROMISE = null;
let WEAPON_SEARCH_INDEX = [];
let WEAPON_INDEX_PROMISE = null;
let WEAPON_DATA_PROMISE = null;

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

const HIDDEN_MONSTER_NAMES = new Set(
  [
    "Fire Wisp",
    "Fire Bat",
    "Lava Bat",
    "Shade",
    "Dretch Brigand",
    "Dretch Thug",
    "Dretch Executioner",
    "Dretch Warrior",
    "Dretch Rogue",
    "Dretch Occulist",
    "Abyssal Disciple",
    "Durg",
    "Frigit",
    "Bramble",
  ].map((name) => name.toLowerCase())
);

const HIDDEN_WEAPON_NAMES = new Set(
  [
    "Super Super Blunt",
    "Super Duper Pole",
    "Super Duper",
    "Super Duper Blunt",
    "Super Duper Axe",
    "GM Deathbringer",
    "Ghostblade",
    "Wand of the Winds",
    "Wand of the Flames",
    "Tooth Staff",
    "Krythan Staff",
    "Bone Staff",
    "Staff of Might",
    "Cursed Staff",
    "Vengeance Sword",
    "Staff of Partiality",
  ].map((name) => name.toLowerCase())
);

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
  const specialty = fields.specialty ? fields.specialty_label || String(fields.specialty) : null;
  const perk = fields.perk ? fields.perk_label || fields.perk : null;

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

function warmSearchCorpus() {
  if (SEARCH_CORPUS_WARM_PROMISE) return SEARCH_CORPUS_WARM_PROMISE;
  SEARCH_CORPUS_WARM_PROMISE = Promise.all(INTERNAL_SEARCH_PAGES.map((entry) => fetchAndCachePageText(entry.url))).catch(
    () => {}
  );
  return SEARCH_CORPUS_WARM_PROMISE;
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
    description: parts.join("  ") || "Monster stats, damage, and loot.",
    keywords,
    isMonster: true,
    monsterId: slug,
  });
}

function loadMonsterSearchIndex() {
  if (MONSTER_INDEX_PROMISE) return MONSTER_INDEX_PROMISE;
  const absoluteUrl = getAbsoluteUrl("pages/enemies/monsters_data03.json");
  MONSTER_INDEX_PROMISE = fetch(absoluteUrl)
    .then((response) => {
      if (!response.ok) throw new Error("Failed to fetch monsters_data03.json");
      return response.json();
    })
    .then((data) => {
      const list = Array.isArray(data) ? data : [];
      const filtered = list.filter(
        (monster) => !HIDDEN_MONSTER_NAMES.has(String(monster.name || monster.Name || "").toLowerCase())
      );
      MONSTER_SEARCH_INDEX = filtered.map((monster) => buildMonsterSearchEntry(monster)).filter(Boolean);
      return MONSTER_SEARCH_INDEX;
    })
    .catch(() => {
      MONSTER_SEARCH_INDEX = [];
      return MONSTER_SEARCH_INDEX;
    });
  return MONSTER_INDEX_PROMISE;
}

function warmMonsterIndex() {
  return loadMonsterSearchIndex().catch(() => {});
}

function buildWeaponSearchEntry(weapon) {
  const normalized = normalizeNavWeapon(weapon);
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
    description: parts.join("  ") || "Weapon stats, DPS, speed, and perks.",
    keywords,
    isWeapon: true,
    weaponId: slug,
  });
}

function loadWeaponSearchIndex() {
  if (WEAPON_INDEX_PROMISE) return WEAPON_INDEX_PROMISE;
  const absoluteUrl = getAbsoluteUrl("pages/items/weapons_data05.json");
  WEAPON_INDEX_PROMISE = fetch(absoluteUrl)
    .then((response) => {
      if (!response.ok) throw new Error("Failed to fetch weapons_data05.json");
      return response.json();
    })
    .then((data) => {
      const list = Array.isArray(data) ? data : [];
      const filtered = list.filter(
        (weapon) => !HIDDEN_WEAPON_NAMES.has(String(weapon.name || weapon.Name || "").toLowerCase())
      );
      WEAPON_SEARCH_INDEX = filtered.map((weapon) => buildWeaponSearchEntry(weapon)).filter(Boolean);
      return WEAPON_SEARCH_INDEX;
    })
    .catch(() => {
      WEAPON_SEARCH_INDEX = [];
      return WEAPON_SEARCH_INDEX;
    });
  return WEAPON_INDEX_PROMISE;
}

function warmWeaponIndex() {
  return loadWeaponSearchIndex().catch(() => {});
}

function loadWeaponData() {
  if (WEAPON_DATA_PROMISE) return WEAPON_DATA_PROMISE;
  const absoluteUrl = getAbsoluteUrl("pages/items/weapons_data05.json");
  WEAPON_DATA_PROMISE = fetch(absoluteUrl)
    .then((response) => {
      if (!response.ok) throw new Error("Failed to fetch weapons_data05.json");
      return response.json();
    })
    .then((data) => {
      const list = Array.isArray(data) ? data : [];
      const filtered = list.filter(
        (weapon) => !HIDDEN_WEAPON_NAMES.has(String(weapon.name || weapon.Name || "").toLowerCase())
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

function runSiteSearch(query) {
  const terms = toSearchTerms(query);
  loadMonsterSearchIndex();
  loadWeaponSearchIndex();
  if (!terms.length) {
    const defaults = DEFAULT_SEARCH_RESULTS.length ? DEFAULT_SEARCH_RESULTS : NORMALIZED_SEARCH_INDEX;
    return defaults.slice(0, MAX_SEARCH_RESULTS);
  }

  const matches = [];
  const corpus = NORMALIZED_SEARCH_INDEX.concat(MONSTER_SEARCH_INDEX, WEAPON_SEARCH_INDEX);
  corpus.forEach((entry) => {
    const shouldUseFullText =
      entry.url && !entry.isMonster && !isExternalUrl(entry.url) && !FULL_TEXT_CACHE.has(entry.url) && !FULL_TEXT_PROMISES.has(entry.url);
    if (shouldUseFullText) {
      fetchAndCachePageText(entry.url);
    }
    const baseScore = scoreSearchEntry(entry, terms);
    const fullTextScore = entry.isMonster || entry.isWeapon ? 0 : scoreFullText(FULL_TEXT_CACHE.get(entry.url), terms);
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
    currentResults = runSiteSearch(query);
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
    if (pendingFetches.length && query) {
      Promise.allSettled(pendingFetches).then(() => {
        if (input.value.trim() !== query) return;
        currentResults = runSiteSearch(query);
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

  Promise.allSettled([warmSearchCorpus(), warmMonsterIndex(), warmWeaponIndex()]).then(() => {
    if (input.value.trim()) {
      updateResults({ autoOpen: true });
    }
  });
}
