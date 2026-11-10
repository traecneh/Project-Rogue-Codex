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
    title: "Quests",
    url: "pages/General/quests.html",
    category: "General",
    description: "Quest requirements, staged objectives, NPCs, and rewards.",
    keywords: ["quests", "silvest", "objectives", "rewards", "npc"],
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
    title: "Collectables",
    url: "pages/items/collectables.html",
    category: "Items",
    description: "Collectable items, materials, consumables, values, and traits.",
    keywords: ["collectables", "collectibles", "materials", "potions", "ores", "shards"],
  },
  {
    title: "Useables",
    url: "pages/items/useables.html",
    category: "Items",
    description: "Useable tools, scrolls, shards, and utility items.",
    keywords: ["useables", "usables", "tools", "scrolls", "pickaxe", "fishing"],
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
    title: "Reforge",
    url: "pages/systems/re-roll.html",
    category: "Ascendancy",
    description: "Reforge Epic-or-higher equipment using rarity shards.",
    keywords: ["reforge", "reroll", "rarity shards", "stats", "perks"],
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
const MAX_PERK_RESULTS = 4;
const MIN_PERK_TERM_LENGTH = 2;
const MAX_TATTER_MONSTER_RESULTS = 4;
const PERKS_PAGE_URL = "pages/systems/perks.html";
const MONSTERS_PAGE_URL = "pages/enemies/monsters.html";
let SEARCH_CORPUS = SITE_SEARCH_INDEX.map(normalizeSearchEntry);
let SEARCH_INDEX_PROMISE = null;
let SEARCH_INDEX_READY = false;
let SEARCH_INDEX_ERROR = false;
let PERK_NAME_INDEX = new Map();
let MONSTER_TATTER_INDEX = new Map();

function loadSearchIndex() {
  if (SEARCH_INDEX_READY) return Promise.resolve();
  if (SEARCH_INDEX_PROMISE) return SEARCH_INDEX_PROMISE;
  const fetchJson = window.RogueCodexUtils?.fetchJsonCached;
  const request = typeof fetchJson === "function"
    ? fetchJson(getAbsoluteUrl("data/search-index.json"))
    : fetch(getAbsoluteUrl("data/search-index.json"), {cache:"no-cache"}).then(r => {if (!r.ok) throw new Error("Search index unavailable"); return r.json()});
  SEARCH_INDEX_ERROR = false;
  SEARCH_INDEX_PROMISE = request.then(data => {
    if (data?.schema !== 1 || !Array.isArray(data.entries) || !data.entries.length) throw new Error("Invalid search index");
    SEARCH_CORPUS = data.entries.map(normalizeSearchEntry);
    PERK_NAME_INDEX = new Map(data.perks.map(entry => [normalizePerkName(entry.name), entry]));
    MONSTER_TATTER_INDEX = new Map(data.tatters);
    SEARCH_INDEX_READY = true;
  }).catch(error => {
    SEARCH_INDEX_ERROR = true;
    console.warn(error.message || error);
  }).finally(() => { SEARCH_INDEX_PROMISE = null; });
  return SEARCH_INDEX_PROMISE;
}

function normalizeSearchEntry(entry) {
  return {
    ...entry,
    titleLower: (entry.title || "").toLowerCase(),
    descriptionLower: (entry.description || "").toLowerCase(),
    categoryLower: (entry.category || "").toLowerCase(),
    keywordsLower: (entry.keywords || []).map((kw) => String(kw || "").toLowerCase()),
  };
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
  const terms = toSearchTerms(query);
  if (!terms.length) return [];
  const matches = [];
  SEARCH_CORPUS.forEach(entry => {
    const score = scoreSearchEntry(entry, terms) + scoreFullText(entry.fullText, terms);
    if (score <= 0) return;
    const titleHits = terms.filter(term => entry.titleLower.includes(term)).length;
    matches.push({entry, score:score + titleHits});
  });
  matches.sort((a,b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title));
  return matches.slice(0,MAX_SEARCH_RESULTS).map(item => item.entry);
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
      empty.textContent = !SEARCH_INDEX_READY && terms.length ? (SEARCH_INDEX_ERROR ? "Search unavailable. Try again." : "Loading search…") : terms.length ? "No results found." : "Start typing to search the codex.";
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

    currentResults = injectPerkResults(runSiteSearch(query), query);
    activeIndex = -1;
    renderResults(currentResults, terms);
    const shouldOpen = Boolean(query || (autoOpen && currentResults.length));
    setOpen(shouldOpen);

    const pendingFetches = SEARCH_INDEX_READY ? [] : [loadSearchIndex()];
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
    void loadSearchIndex();
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

  const connection = navigator.connection;
  if (!connection?.saveData && !/2g/.test(connection?.effectiveType || "")) {
    const warm = () => {
      if (typeof requestIdleCallback === "function") requestIdleCallback(() => loadSearchIndex(), {timeout: 3000});
      else setTimeout(() => loadSearchIndex(), 1500);
    };
    if (document.readyState === "complete") warm();
    else window.addEventListener("load", warm, {once:true});
  }
  updateResults({ autoOpen: false });
  setOpen(false);
}
