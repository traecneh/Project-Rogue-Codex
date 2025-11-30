function setRandomLogo() {
  const logo = document.querySelector(".site-logo-image");
  if (!logo) return;
  const logos = ["images/logo-1.png", "images/logo-2.png"];
  const pick = Math.random() < 0.5 ? logos[0] : logos[1];
  logo.src = pick;
}

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
  if (!monster) return null;
  const slug = normalizeSlug(monster.id || monster.name);
  if (!slug) return null;
  const type = monster.monsterType || "";
  const element = monster.elementalAttack || "";
  const level = Number(monster.level);
  const parts = [];
  if (type) parts.push(type.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " "));
  if (element) parts.push(`Element: ${element}`);
  if (Number.isFinite(level)) parts.push(`Lvl ${Math.round(level)}`);

  const keywords = [slug, monster.id, monster.name, type, element].filter(Boolean);

  return normalizeSearchEntry({
    title: monster.name || slug,
    url: `pages/enemies/monsters.html?monster=${encodeURIComponent(slug)}`,
    category: "Monsters",
    description: parts.join(" • ") || "Monster stats, damage, and loot.",
    keywords,
    isMonster: true,
    monsterId: slug,
  });
}

function loadMonsterSearchIndex() {
  if (MONSTER_INDEX_PROMISE) return MONSTER_INDEX_PROMISE;
  const absoluteUrl = getAbsoluteUrl("pages/enemies/monsters.json");
  MONSTER_INDEX_PROMISE = fetch(absoluteUrl)
    .then((response) => {
      if (!response.ok) throw new Error("Failed to fetch monsters.json");
      return response.json();
    })
    .then((data) => {
      const list = Array.isArray(data) ? data : [];
      MONSTER_SEARCH_INDEX = list.map((monster) => buildMonsterSearchEntry(monster)).filter(Boolean);
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
  if (!weapon) return null;
  const name = weapon.name || weapon.Name || weapon.id;
  const slug = normalizeSlug(name || weapon.id);
  if (!slug) return null;
  const element = weapon.elementalDamageType || weapon.ElementalDamageType || "";
  const skill = weapon.skillType || weapon.SkillType || weapon.type || "";
  const level = Number(weapon.level || weapon.Level);
  const dps = weapon.dps || weapon.DPS;
  const parts = [];
  if (Number.isFinite(level)) parts.push(`Lvl ${Math.round(level)}`);
  if (dps !== undefined && dps !== null && dps !== "") parts.push(`DPS ${dps}`);
  if (skill) parts.push(titleCaseWords(String(skill)));
  if (element) parts.push(`Element: ${element}`);

  const keywords = [name, slug, element, skill, weapon.specialEffect || weapon.SpecialEffect].filter(Boolean);

  return normalizeSearchEntry({
    title: name || slug,
    url: `pages/items/weapons.html?weapon=${encodeURIComponent(slug)}`,
    category: "Weapons",
    description: parts.join(" • ") || "Weapon stats, DPS, speed, and perks.",
    keywords,
    isWeapon: true,
    weaponId: slug,
  });
}

function loadWeaponSearchIndex() {
  if (WEAPON_INDEX_PROMISE) return WEAPON_INDEX_PROMISE;
  const absoluteUrl = getAbsoluteUrl("pages/items/weapons.json");
  WEAPON_INDEX_PROMISE = fetch(absoluteUrl)
    .then((response) => {
      if (!response.ok) throw new Error("Failed to fetch weapons.json");
      return response.json();
    })
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

function warmWeaponIndex() {
  return loadWeaponSearchIndex().catch(() => {});
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

function initializeLastUpdated() {
  const target = document.getElementById("site-last-updated");
  if (!target) return;

  const endpoint = "https://api.github.com/repos/traecneh/Project-Rogue-Codex/commits?per_page=1";
  const formatDate = (iso) => {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  fetch(endpoint)
    .then((response) => {
      if (!response.ok) throw new Error("Failed to load commit data");
      return response.json();
    })
    .then((commits) => {
      if (!Array.isArray(commits) || !commits.length) throw new Error("No commits found");
      const commit = commits[0];
      const iso = commit?.commit?.committer?.date || commit?.commit?.author?.date;
      const formatted = formatDate(iso);
      target.textContent = formatted || "Unavailable";
    })
    .catch(() => {
      target.textContent = "Unavailable";
    });
}

document.addEventListener("DOMContentLoaded", () => {
  const sidebarRoot = document.getElementById("sidebar-root");
  const navPromise = fetch("nav.html")
    .then((response) => {
      if (!response.ok) throw new Error("Failed to load navigation");
      return response.text();
    })
    .then((html) => {
      if (sidebarRoot) {
        sidebarRoot.outerHTML = html;
        setRandomLogo();
        initializeSidebar();
        initializeSiteSearch();
        initializeLastUpdated();
      }
    })
    .catch((error) => console.error(error));

  navPromise.finally(() => {
    initializeWeightSlider();
    initializeMultiplierWidget();
    initializeHealthWidget();
    initializeRegenWidget();
    initializeBleedWidget();
    initializeDexCritWidget();
    initializeDexDrWidget();
    initializeKeywordLinks();
    initializePerkAnchors();
    initializePerkEmbeds();
    initializeCursorToggle();
    initializeRarityRoller();
  });
});

function initializeSidebar() {
  const NAV_STATE_STORAGE_KEY = "nav-expanded-state";

  const loadNavState = () => {
    try {
      const raw = localStorage.getItem(NAV_STATE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  };

  const saveNavState = (state) => {
    try {
      localStorage.setItem(NAV_STATE_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      /* noop: storage may be unavailable */
    }
  };

  const sections = document.querySelectorAll("[data-section]");
  const navState = loadNavState();

  const updateIcon = (headerBtn, expanded) => {
    const icon = headerBtn.querySelector(".nav-header-icon");
    if (!icon) return;
    icon.textContent = expanded ? "-" : "+";
  };

  sections.forEach((section) => {
    const headerBtn = section.querySelector(".nav-header");
    if (!headerBtn) return;

    const controlId = headerBtn.getAttribute("aria-controls") || section.id || "";
    const defaultExpanded = headerBtn.getAttribute("aria-expanded") === "true";
    const savedExpanded =
      controlId && Object.prototype.hasOwnProperty.call(navState, controlId) ? navState[controlId] : undefined;
    const initiallyExpanded = typeof savedExpanded === "boolean" ? savedExpanded : defaultExpanded;

    headerBtn.setAttribute("aria-expanded", String(initiallyExpanded));
    section.classList.toggle("collapsed", !initiallyExpanded);
    updateIcon(headerBtn, initiallyExpanded);

    headerBtn.addEventListener("click", () => {
      const isExpanded = headerBtn.getAttribute("aria-expanded") === "true";
      const nextExpanded = !isExpanded;
      headerBtn.setAttribute("aria-expanded", String(nextExpanded));
      section.classList.toggle("collapsed", !nextExpanded);
      updateIcon(headerBtn, nextExpanded);

      if (controlId) {
        navState[controlId] = nextExpanded;
        saveNavState(navState);
      }
    });
  });

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetId = link.getAttribute("href").slice(1);
      const target = document.getElementById(targetId);
      if (!target) return;

      event.preventDefault();
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  });
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

function initializeWeightSlider() {
  const slider = document.getElementById("custom-weight-slider");
  const valueLabel = document.getElementById("custom-weight-value");
  const strengthLabel = document.getElementById("custom-strength-label");
  const liveBar = document.querySelector(".weight-bar-live");
  if (!slider || !valueLabel || !liveBar || !strengthLabel) return;

  const updateValues = () => {
    const strength = Number(slider.value);
    const weight = 150 + strength * 3;
    strengthLabel.textContent = `${strength} STR`;
    valueLabel.textContent = `${weight} weight`;
    const maxStrength = Number(slider.max) || 500;
    const percent = Math.min(100, (weight / (150 + maxStrength * 3)) * 100);
    liveBar.style.setProperty("--fill", `${percent}%`);
  };

  slider.addEventListener("input", updateValues);
  const min = Number(slider.min) || 0;
  const max = Number(slider.max) || 500;
  slider.value = Math.floor(Math.random() * (max - min + 1) + min).toString();
  updateValues();
}

function initializeMultiplierWidget() {
  const skill = document.getElementById("skill-slider");
  const strength = document.getElementById("strength-slider");
  const dexterity = document.getElementById("dexterity-slider");
  const skillLabel = document.getElementById("skill-value");
  const strengthLabel = document.getElementById("strength-value");
  const dexterityLabel = document.getElementById("dexterity-value");
  const multiplierValue = document.getElementById("multiplier-value");
  if (!skill || !strength || !dexterity || !skillLabel || !strengthLabel || !dexterityLabel || !multiplierValue) {
    return;
  }

  const update = () => {
    const skillVal = Number(skill.value);
    const strengthVal = Number(strength.value);
    const dexVal = Number(dexterity.value);
    skillLabel.textContent = skillVal;
    strengthLabel.textContent = strengthVal;
    dexterityLabel.textContent = dexVal;
    const multiplier = 1 + skillVal / 50 + strengthVal / 100 + dexVal / 200;
    multiplierValue.textContent = `${multiplier.toFixed(2)}x`;
  };

  [skill, strength, dexterity].forEach((slider) => slider.addEventListener("input", update));

  const randomize = (input) => {
    const min = Number(input.min) || 0;
    const max = Number(input.max) || 100;
    input.value = Math.floor(Math.random() * (max - min + 1) + min).toString();
  };

  [skill, strength, dexterity].forEach(randomize);
  update();
}

function initializeHealthWidget() {
  const level = document.getElementById("health-level-slider");
  const con = document.getElementById("health-con-slider");
  const str = document.getElementById("health-str-slider");
  const levelLabel = document.getElementById("health-level-value");
  const conLabel = document.getElementById("health-con-value");
  const strLabel = document.getElementById("health-str-value");
  const healthValue = document.getElementById("health-value");
  if (!level || !con || !str || !levelLabel || !conLabel || !strLabel || !healthValue) return;

  const update = () => {
    const lvl = Number(level.value);
    const constitution = Number(con.value);
    const strength = Number(str.value);
    levelLabel.textContent = lvl;
    conLabel.textContent = constitution;
    strLabel.textContent = strength;
    const health = 20 + lvl * 15 + constitution * 10 + strength * 2;
    healthValue.textContent = health.toString();
  };

  [level, con, str].forEach((slider) => slider.addEventListener("input", update));

  const randomize = (input) => {
    const min = Number(input.min) || 0;
    const max = Number(input.max) || 100;
    input.value = Math.floor(Math.random() * (max - min + 1) + min).toString();
  };

  [level, con, str].forEach(randomize);
  update();
}

function initializeBleedWidget() {
  const slider = document.getElementById("bleed-str-slider");
  const strengthLabel = document.getElementById("bleed-str-value");
  const chanceLabel = document.getElementById("bleed-chance-value");
  if (!slider || !strengthLabel || !chanceLabel) return;

  const update = () => {
    const strength = Number(slider.value);
    strengthLabel.textContent = `${strength}`;
    const chance = strength >= 100 ? strength / 10 : 0;
    chanceLabel.textContent = `${chance.toFixed(1)}%`;
  };

  slider.addEventListener("input", update);
  const min = Number(slider.min) || 0;
  const max = Number(slider.max) || 100;
  slider.value = Math.floor(Math.random() * (max - min + 1) + min).toString();
  slider.dispatchEvent(new Event("input"));
  update();
}

function initializeDexCritWidget() {
  const slider = document.getElementById("dex-crit-slider");
  const dexLabel = document.getElementById("dex-crit-value");
  const chanceLabel = document.getElementById("dex-crit-chance-value");
  if (!slider || !dexLabel || !chanceLabel) return;

  const update = () => {
    const dexterity = Number(slider.value);
    dexLabel.textContent = `${dexterity}`;
    const chance = dexterity / 2.5;
    chanceLabel.textContent = `${chance.toFixed(1)}% @ 1.35x`;
  };

  slider.addEventListener("input", update);
  const min = Number(slider.min) || 0;
  const max = Number(slider.max) || 500;
  slider.value = Math.floor(Math.random() * (max - min + 1) + min).toString();
  update();
}

function initializeDexDrWidget() {
  const slider = document.getElementById("dex-dr-slider");
  const label = document.getElementById("dex-dr-label");
  const valueLabel = document.getElementById("dex-dr-value");
  const liveBar = document.getElementById("dex-dr-live-bar");
  if (!slider || !label || !valueLabel || !liveBar) return;

  const computeReduction = (dex) => {
    const ratio = dex * 0.00125;
    return (ratio / (1 + ratio)) * 100;
  };

  const update = () => {
    const dex = Number(slider.value);
    label.textContent = `${dex} Total DEX`;
    const reduction = computeReduction(dex);
    valueLabel.textContent = `${reduction.toFixed(2)}% DR`;
    const maxDex = Number(slider.max) || 500;
    const percent = Math.min(100, (dex / maxDex) * 100);
    liveBar.style.setProperty("--fill", `${percent}%`);
  };

  slider.addEventListener("input", update);
  const min = Number(slider.min) || 0;
  const max = Number(slider.max) || 500;
  slider.value = Math.floor(Math.random() * (max - min + 1) + min).toString();
  update();
}

function initializeRegenWidget() {
  const slider = document.getElementById("regen-con-slider");
  const conLabel = document.getElementById("regen-con-value");
  const regenValue = document.getElementById("regen-value");
  if (!slider || !conLabel || !regenValue) return;

  const update = () => {
    const con = Number(slider.value);
    conLabel.textContent = `${con}`;
    const regen = con / 3;
    regenValue.textContent = `${regen.toFixed(1)} HP / 2s`;
  };

  slider.addEventListener("input", update);
  const min = Number(slider.min) || 0;
  const max = Number(slider.max) || 500;
  slider.value = Math.floor(Math.random() * (max - min + 1) + min).toString();
  update();
}

function initializeKeywordLinks() {
  if (!document.body) return;

  const keywordRules = [
    {
      keyword: "Strength",
      href: "pages/stats/strength.html",
      excludedPaths: ["pages/stats/strength.html"],
    },
    {
      keyword: "Dexterity",
      href: "pages/stats/dexterity.html",
      excludedPaths: ["pages/stats/dexterity.html"],
    },
    {
      keyword: "Constitution",
      href: "pages/stats/constitution.html",
      excludedPaths: ["pages/stats/constitution.html"],
    },
    {
      keyword: "Floor Cleanup",
      href: "pages/systems/floor-cleanup.html",
      excludedPaths: ["pages/systems/floor-cleanup.html"],
    },
    {
      keyword: "Creeper",
      href: "pages/systems/floor-cleanup.html",
      excludedPaths: ["pages/systems/floor-cleanup.html"],
    },
    {
      keyword: "Perks",
      href: "pages/systems/perks.html",
      excludedPaths: ["pages/systems/perks.html"],
    },
  ];

  const normalizedRules = keywordRules
    .filter((rule) => rule.keyword)
    .map((rule) => ({
      ...rule,
      keywordPattern: new RegExp(`\\b${escapeRegExp(String(rule.keyword))}\\b`, "gi"),
      excludedPathsLower: (rule.excludedPaths || []).map((excluded) => excluded.toLowerCase()),
    }));

  const currentPath = window.location.pathname.toLowerCase();
  const activeRules = normalizedRules.filter(
    (rule) => !rule.excludedPathsLower.some((excluded) => currentPath.includes(excluded))
  );
  if (!activeRules.length) return;

  const skipTags = new Set([
    "A",
    "SCRIPT",
    "STYLE",
    "CODE",
    "PRE",
    "NOSCRIPT",
    "TEXTAREA",
    "INPUT",
    "BUTTON",
    "SELECT",
    "OPTION",
    "HEAD",
    "TITLE",
  ]);

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  const shouldSkipNode = (node) => {
    let parent = node.parentNode;
    while (parent) {
      if (parent.nodeType === Node.ELEMENT_NODE && skipTags.has(parent.tagName)) {
        return true;
      }
      parent = parent.parentNode;
    }
    return false;
  };

  const linkifyRule = (rule) => {
    const pattern = rule.keywordPattern;
    if (!pattern) return;
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node || !node.nodeValue || !node.nodeValue.trim()) {
            return NodeFilter.FILTER_REJECT;
          }
          if (shouldSkipNode(node)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      },
      false
    );

    const textNodes = [];
    let currentNode = walker.nextNode();
    while (currentNode) {
      textNodes.push(currentNode);
      currentNode = walker.nextNode();
    }

    textNodes.forEach((node) => {
      const text = node.nodeValue;
      if (!text || !node.parentNode) return;
      const regex = pattern;
      regex.lastIndex = 0;
      let match;
      let lastIndex = 0;
      let replaced = false;
      const fragment = document.createDocumentFragment();

      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }
        const anchor = document.createElement("a");
        anchor.href = rule.href;
        anchor.classList.add("stat-keyword-link");
        anchor.setAttribute("data-auto-link", "stat-keyword");
        anchor.textContent = match[0];
        fragment.appendChild(anchor);
        lastIndex = match.index + match[0].length;
        replaced = true;
      }

      if (!replaced) return;
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }
      node.parentNode.replaceChild(fragment, node);
    });
  };

  activeRules.forEach(linkifyRule);
}

function initializeCursorToggle() {
  const body = document.body;
  if (!body || body.dataset.cursorToggleInit === "true") return;

  body.dataset.cursorToggleInit = "true";

  window.addEventListener("keydown", (event) => {
    const key = event.key || event.keyCode;
    if (!key) return;
    const isQ = typeof key === "string" ? key.toLowerCase() === "q" : key === 81;
    if (!isQ) return;
    body.classList.toggle("cursor-attack");
  });
}

let perkCardCachePromise = null;

function initializePerkAnchors() {
  const cards = document.querySelectorAll("#perk-list .stat-card, #unique-effects .stat-card");
  if (!cards.length) return;
  cards.forEach((card) => {
    const title = card.querySelector("h3");
    if (!title) return;
    const name = title.textContent.trim();
    if (!name) return;
    const slug = getPerkSlug(name);
    if (!slug) return;
    card.id = slug;
    card.setAttribute("data-perk-name", name);
  });

  const hash = window.location.hash ? window.location.hash.slice(1) : "";
  if (hash) {
    const target = document.getElementById(hash);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}

function initializePerkEmbeds() {
  const containers = document.querySelectorAll("[data-perk-list], [data-perk-stats]");
  if (!containers.length) return;

  loadPerkCardData()
    .then(({ map }) => {
      containers.forEach((container) => {
        const listAttr = container.getAttribute("data-perk-list");
        const statsAttr = container.getAttribute("data-perk-stats");
        const fragment = document.createDocumentFragment();

        if (listAttr) {
          const names = parsePerkList(listAttr);
          names.forEach((name) => {
            const key = name.trim().toLowerCase();
            const perkEntry = map.get(key);
            if (!perkEntry) return;
            const { card } = perkEntry;
            const clone = card.cloneNode(true);
            clone.removeAttribute("id");
            fragment.appendChild(clone);
          });
        } else if (statsAttr) {
          const stats = parsePerkList(statsAttr)
            .map((stat) => stat.toLowerCase())
            .filter(Boolean);
          if (stats.length) {
            const statSet = new Set(stats);
            map.forEach((value) => {
              if (!value.stats.length) return;
              const hasMatch = value.stats.some((stat) => statSet.has(stat));
              if (!hasMatch) return;
              const clone = value.card.cloneNode(true);
              clone.removeAttribute("id");
              fragment.appendChild(clone);
            });
          }
        }

        container.innerHTML = "";
        if (fragment.childNodes.length) {
          container.appendChild(fragment);
        } else {
          const fallback = document.createElement("p");
          fallback.textContent = "Perk info unavailable.";
          container.appendChild(fallback);
        }
      });
    })
    .catch((error) => {
      console.error("Failed to embed perks", error);
    });
}

function loadPerkCardData() {
  if (perkCardCachePromise) return perkCardCachePromise;

  perkCardCachePromise = fetch("pages/systems/perks.html")
    .then((response) => {
      if (!response.ok) throw new Error("Failed to load perks reference");
      return response.text();
    })
    .then((html) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const cards = Array.from(doc.querySelectorAll("#perk-list .stat-card, #unique-effects .stat-card"));
      const map = new Map();
      cards.forEach((card) => {
        const heading = card.querySelector("h3");
        if (!heading) return;
        const name = heading.textContent.trim();
        if (!name) return;
        const slug = getPerkSlug(name);
        if (!slug) return;
        card.id = slug;
        card.setAttribute("data-perk-name", name);
        const isUnique = Boolean(card.closest("#unique-effects"));
        const stats = detectPerkStats(card);
        map.set(name.toLowerCase(), { card, slug, stats, isUnique });
      });
      return { map };
    })
    .catch((error) => {
      perkCardCachePromise = null;
      throw error;
    });

  return perkCardCachePromise;
}

function parsePerkList(value) {
  if (!value) return [];
  let parsed = [];
  try {
    const json = JSON.parse(value);
    if (Array.isArray(json)) {
      parsed = json;
    }
  } catch (error) {
    parsed = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return parsed;
}

function getPerkSlug(name) {
  if (!name) return "";
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `perk-${slug}` : "";
}

// Rarity Roller
const rarityDefinitions = [
  { name: "Normal", color: "#ffffff", min: 0, max: 0, perkChance: 0, ac: 0 },
  { name: "Uncommon", color: "#ffd966", min: 2, max: 5, perkChance: 0, ac: 0 },
  { name: "Rare", color: "#0000ff", min: 6, max: 10, perkChance: 0, ac: 0 },
  { name: "Epic", color: "#741b47", min: 11, max: 15, perkChance: 0.4, ac: 2 },
  { name: "Legendary", color: "#ff9900", min: 16, max: 20, perkChance: 0.6, ac: 3 },
  { name: "Mythical", color: "#6aa84f", min: 21, max: 25, perkChance: 0.8, ac: 4 },
  { name: "Ascendant", color: "#ff0000", min: 26, max: 30, perkChance: 1, ac: 5 },
];

let perksCacheForRoller = null;

function initializeRarityRoller() {
  const container = document.getElementById("rarity-roller");
  if (!container) return;

  const rollButton = container.querySelector("[data-rarity-roll]");
  const upgradeButton = container.querySelector("[data-rarity-upgrade]");
  const resultContainer = container.querySelector("[data-rarity-result]");
  if (!rollButton || !resultContainer) return;

  let currentIndex = 0;
  let currentMaxIndex = rarityDefinitions.length - 1;
  let currentPerkOutcome = null;
  let currentPerkMeta = null;
  let perkMapPromise = null;

  const lastIndex = rarityDefinitions.length - 1;

  const getPerkMap = () => {
    if (!perkMapPromise) {
      perkMapPromise = loadPerkCardData().then((data) => data.map);
    }
    return perkMapPromise;
  };

  const computeMaxIndex = (baseIndex) => {
    if (baseIndex >= lastIndex) return lastIndex;
    return randomInt(baseIndex + 1, lastIndex);
  };

  const updateUpgradeAvailability = () => {
    if (!upgradeButton) return;
    const atMax = currentIndex >= currentMaxIndex;
    upgradeButton.disabled = atMax;
  };

  const setLoadingState = (isLoading, activeButton) => {
    const buttons = [rollButton, upgradeButton].filter(Boolean);
    buttons.forEach((btn) => {
      btn.disabled = isLoading;
      if (!activeButton || btn !== activeButton) return;
      if (isLoading) {
        btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
        btn.textContent = btn === rollButton ? "Rolling..." : "Upgrading...";
      } else if (btn.dataset.originalText) {
        btn.textContent = btn.dataset.originalText;
        delete btn.dataset.originalText;
      }
    });
  };

  const renderOutcome = (rarity, perkMap, perkOutcome, perkMeta, maxIndex) => {
    const stats = rarity.max > rarity.min ? randomInt(rarity.min, rarity.max) : rarity.min;
    const statSplit = distributeStats(stats);

    const fragments = [];
    fragments.push(createResultLine("Rarity", rarity.name, rarity.color));
    const maxDef = rarityDefinitions[Math.min(maxIndex, lastIndex)];
    if (maxDef) {
      fragments.push(createResultLine("Max Rarity", maxDef.name, maxDef.color));
    }
    fragments.push(
      createResultLine(
        "Bonus stats",
        rarity.min === rarity.max ? `${stats}` : `${stats} (rolled within ${rarity.min}-${rarity.max})`
      )
    );
    const acValue = typeof rarity.ac === "number" ? rarity.ac : 0;
    fragments.push(createResultLine("Bonus AC", `${acValue}`));
    fragments.push(createResultLine("Split", `STR ${statSplit.str}, DEX ${statSplit.dex}, CON ${statSplit.con}`));

    const perkLabel = perkMeta && perkMeta.source ? `Perk (from ${perkMeta.source} roll)` : "Perk Roll";
    if (!perkMeta || perkMeta.rolled === false) {
      fragments.push(createResultLine(perkLabel, "Not rolled (use Random Rarity)"));
    } else if (!perkMeta.eligible) {
      fragments.push(createResultLine(perkLabel, "Not eligible"));
    } else {
      const chancePercent = `${Math.round((perkMeta.chance || 0) * 100)}%`;
      if (perkOutcome) {
        const perkName = perkOutcome.card.querySelector("h3")
          ? perkOutcome.card.querySelector("h3").textContent.trim()
          : "Perk";
        fragments.push(createResultLine(perkLabel, `Success (${chancePercent}) - ${perkOutcome.tier} ${perkName}`));
      } else {
        fragments.push(createResultLine(perkLabel, `Failed (${chancePercent})`));
      }
    }

    resultContainer.innerHTML = "";
    fragments.forEach((fragment) => resultContainer.appendChild(fragment));
  };

  const renderFromIndex = (index, activeButton, { rerollPerk, setMax } = {}) => {
    const clampedIndex = Math.max(0, Math.min(index, rarityDefinitions.length - 1));
    currentIndex = clampedIndex;
    if (setMax) {
      currentMaxIndex = computeMaxIndex(clampedIndex);
    }
    const rarity = rarityDefinitions[clampedIndex];
    if (!rarity) return;
    setLoadingState(true, activeButton);
    getPerkMap()
      .then((perkMap) => {
        if (rerollPerk) {
          currentPerkOutcome = rollPerk(rarity, perkMap);
          currentPerkMeta = {
            source: rarity.name,
            chance: rarity.perkChance,
            eligible: rarity.perkChance > 0,
            rolled: true,
          };
        }
        renderOutcome(rarity, perkMap, currentPerkOutcome, currentPerkMeta, currentMaxIndex);
      })
      .catch((error) => {
        console.error("Rarity roll failed", error);
        resultContainer.textContent = "Unable to roll rarity.";
      })
      .finally(() => {
        setLoadingState(false, activeButton);
        updateUpgradeAvailability();
      });
  };

  rollButton.addEventListener("click", () => {
    const index = Math.floor(Math.random() * rarityDefinitions.length);
    renderFromIndex(index, rollButton, { rerollPerk: true, setMax: true });
  });

  if (upgradeButton) {
    upgradeButton.addEventListener("click", () => {
      if (currentIndex >= currentMaxIndex) {
        updateUpgradeAvailability();
        return;
      }
      const nextIndex = Math.min(currentIndex + 1, rarityDefinitions.length - 1);
      const boundedNext = Math.min(nextIndex, currentMaxIndex);
      renderFromIndex(boundedNext, upgradeButton, { rerollPerk: false, setMax: false });
    });

    updateUpgradeAvailability();
  }
}

function rollRandomRarity() {
  const index = Math.floor(Math.random() * rarityDefinitions.length);
  return rarityDefinitions[index];
}

function rollPerk(rarity, perkMap) {
  if (!rarity || rarity.perkChance <= 0 || !perkMap) return null;
  const roll = Math.random();
  if (roll > rarity.perkChance) return null;

  const eligiblePerks = [];
  perkMap.forEach((value, key) => {
    if (value.isUnique) return;
    eligiblePerks.push(value);
  });
  if (!eligiblePerks.length) return null;

  const perk = eligiblePerks[Math.floor(Math.random() * eligiblePerks.length)];
  const tierRoll = randomInt(1, 3);
  return {
    card: perk.card,
    tier: `T${tierRoll}`,
  };
}

function randomInt(min, max) {
  if (min === max) return min;
  const low = Math.ceil(min);
  const high = Math.floor(max);
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function createResultLine(label, value, color) {
  const wrapper = document.createElement("div");
  wrapper.className = "rarity-result-line";

  const labelEl = document.createElement("span");
  labelEl.className = "rarity-result-label";
  labelEl.textContent = label;

  const valueEl = document.createElement("span");
  valueEl.className = "rarity-result-value";
  valueEl.textContent = value;
  if (color) {
    valueEl.style.color = color;
  }

  wrapper.appendChild(labelEl);
  wrapper.appendChild(valueEl);
  return wrapper;
}

function distributeStats(total) {
  if (!total) return { str: 0, dex: 0, con: 0 };
  let remaining = total;
  const weights = [Math.random(), Math.random(), Math.random()];
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  const allocations = weights.map((w) => Math.floor((w / weightSum) * total));
  let [str, dex, con] = allocations;
  const assigned = str + dex + con;
  remaining -= assigned;
  const buckets = ["str", "dex", "con"];
  while (remaining > 0) {
    const bucket = buckets[Math.floor(Math.random() * buckets.length)];
    if (bucket === "str") str += 1;
    else if (bucket === "dex") dex += 1;
    else con += 1;
    remaining -= 1;
  }
  return { str, dex, con };
}

const STAT_MATCHERS = [
  { name: "strength", regex: /\bstrength\b/i },
  { name: "dexterity", regex: /\bdexterity\b/i },
  { name: "constitution", regex: /\bconstitution\b/i },
];

function detectPerkStats(card) {
  if (!card || !card.textContent) return [];
  const text = card.textContent;
  const results = [];
  STAT_MATCHERS.forEach(({ name, regex }) => {
    if (regex.test(text)) {
      results.push(name);
    }
  });
  return results;
}
