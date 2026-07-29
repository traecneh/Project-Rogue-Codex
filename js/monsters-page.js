(() => {
  const MONSTERS_SCHEMA_VERSION = 1;
  const dataUrl = (() => {
    try {
      const resolved = new URL("monsters_data03.json", window.location.href);
      if (resolved.protocol === "http:" || resolved.protocol === "https:") {
        resolved.searchParams.set("v", String(MONSTERS_SCHEMA_VERSION));
      }
      return resolved.toString();
    } catch (error) {
      return "monsters_data03.json";
    }
  })();
  const weaponsUrl = new URL("../items/weapons_data05.json", window.location.href);
  const perksUrl = new URL("../systems/perks.json", window.location.href);
  const searchInput = document.getElementById("monster-search");
  const typeFilter = document.getElementById("filter-type");
  const elementFilter = document.getElementById("filter-element");
  const flagFilter = document.getElementById("filter-flags");
  const tableBody = document.getElementById("monsters-body");
  const countLabel = document.getElementById("monster-count");
  const details = document.getElementById("monster-details");
  const closeBtn = document.getElementById("details-close");
  const MAP_SEARCH_BASE = "https://traecneh.github.io/Project-Rogue-Map/?search=";
  const utils = window.RogueCodexUtils || {};
  const fetchJsonCached =
    utils.fetchJsonCached ||
    ((targetUrl) =>
      fetch(targetUrl)
        .then((res) => (res.ok ? res.json() : []))
        .catch(() => []));
  const buildWeaponDetailUrl =
    typeof utils.buildWeaponDetailUrl === "function"
      ? (weapon) => utils.buildWeaponDetailUrl(weapon)
      : (weapon) => {
          const name = (weapon && typeof weapon === "object" ? weapon.name || weapon.id : weapon || "")
            .toString()
            .trim();
          return name ? `pages/items/weapons.html?weapon=${encodeURIComponent(name)}` : "pages/items/weapons.html";
        };
  const buildArmorDetailUrl =
    typeof utils.buildArmorDetailUrl === "function"
      ? (armor) => utils.buildArmorDetailUrl(armor)
      : (armor) => {
          const name = (armor && typeof armor === "object" ? armor.name || armor.id : armor || "")
            .toString()
            .trim();
          return name ? `pages/items/armors.html?armor=${encodeURIComponent(name)}` : "pages/items/armors.html";
        };
  const stopTooltipLinkPropagation = (event) => {
    event.stopPropagation();
  };
  const ELEMENT_COLORS = utils.ELEMENT_COLORS || {
    fire: "#ff5a5a",
    electric: "#b86bff",
    poison: "#2f7a2f",
    cold: "#7cc9ff",
    acid: "#b38b00",
    disease: "#ff9c42",
  };

  const normalizeMonsterId = (value) => {
    return (value || "")
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const getInitialMonsterId = () => {
    const params = new URLSearchParams(window.location.search || "");
    const fromQuery = params.get("monster");
    if (fromQuery) return normalizeMonsterId(fromQuery);
    const hash = window.location.hash ? window.location.hash.slice(1) : "";
    if (hash) {
      const hashValue = hash.startsWith("monster=") ? hash.slice("monster=".length) : hash;
      return normalizeMonsterId(hashValue);
    }
    return "";
  };

  const getMonsterDetailSlug = (monster) => {
    if (!monster) return "";
    return normalizeMonsterId(monster.name) || normalizeMonsterId(monster.id);
  };

  const buildMonsterDetailUrl = (monster) => {
    const slug = getMonsterDetailSlug(monster);
    if (!slug) return window.location.pathname || "monsters.html";
    try {
      const url = new URL(window.location.href);
      url.search = "";
      url.hash = "";
      url.searchParams.set("monster", slug);
      return `${url.pathname}${url.search}`;
    } catch (error) {
      return `?monster=${encodeURIComponent(slug)}`;
    }
  };

  const buildMonsterListUrl = () => {
    try {
      const url = new URL(window.location.href);
      url.search = "";
      url.hash = "";
      return url.pathname;
    } catch (error) {
      return window.location.pathname || "monsters.html";
    }
  };

  const updateMonsterDetailUrl = (monster, options = {}) => {
    const monsterId = getMonsterDetailSlug(monster);
    if (!monsterId || !window.history) return;
    const targetUrl = buildMonsterDetailUrl(monster);
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl === targetUrl) return;
    if (options.replace) {
      history.replaceState({ monsterId }, "", targetUrl);
    } else {
      history.pushState({ monsterId }, "", targetUrl);
    }
  };

  const updateMonsterListUrl = (options = {}) => {
    if (!window.history) return;
    const targetUrl = buildMonsterListUrl();
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl === targetUrl) return;
    if (options.replace) {
      history.replaceState({}, "", targetUrl);
    } else {
      history.pushState({}, "", targetUrl);
    }
  };

  const getInitialSearchTerm = () => {
    const params = new URLSearchParams(window.location.search || "");
    const fromQuery = params.get("search") || params.get("q") || params.get("perk") || "";
    return String(fromQuery || "").trim();
  };

  const FLAG_DETAILS = {
    flying: {
      label: "Flying",
      description: "Able to fly over mountains, water, and other objects.",
    },
    ethereal: {
      label: "Ethereal",
      description: "Able pass through walls and fly over mountains, water, and other objects.",
    },
    boss: {
      label: "Boss",
      description:
        "These are the most powerful enemies you can fight. They can pass through non-Boss monsters and are leashed to their spawn area; pulling them out causes a teleport and full heal.",
    },
    berserker: { label: "Berserker", description: "Can attack all players adjacent to them." },
    target_when_hit_ranged_trapped: {
      label: "Target when Attacked/Ranged/Trapped",
      description: "Targets when attacked, ranged, or trapped.",
    },
    target_when_blocked: {
      label: "Target when Blocked",
      description: "Targets when blocked.",
    },
    immobile: { label: "Immobile", description: "Does not move from its spawn point." },
    thorns: { label: "Thorns", description: "Reflects damage when hit." },
  };

  const formatFlagLabel = (flag) => {
    if (!flag) return "";
    const meta = FLAG_DETAILS[flag];
    if (meta && meta.label) return meta.label;
    return flag
      .toString()
      .replace(/[_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const normalizeFlagKey = (key) => {
    if (!key) return "";
    return key
      .toString()
      .replace(/^(is_|has_)/, "")
      .replace(/[^a-z0-9_]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();
  };

  const extractFlags = (raw) => {
    const fields = (raw && raw.fields) || {};
    const fromKnown = {
      flying: fields.is_flying ?? raw.flying,
      ethereal: fields.is_ethereal ?? raw.ethereal,
      boss: fields.is_boss ?? raw.boss,
      berserker: fields.is_berserker ?? raw.berserker,
      target_when_hit_ranged_trapped: fields.is_target_when_hit_ranged_trapped ?? raw.is_target_when_hit_ranged_trapped,
      target_when_blocked: fields.is_target_when_blocked ?? raw.is_target_when_blocked,
      immobile: fields.is_immobile ?? raw.is_immobile,
      thorns: fields.has_thorns ?? raw.has_thorns,
    };

    const flags = new Set();
    Object.entries(fromKnown).forEach(([key, value]) => {
      if (value) flags.add(key);
    });

    if (Array.isArray(raw.flags)) {
      raw.flags.forEach((flag) => {
        const normalized = normalizeFlagKey(flag) || flag;
        if (normalized) flags.add(normalized);
      });
    }

    Object.entries(fields).forEach(([key, value]) => {
      if ((key.startsWith("is_") || key.startsWith("has_")) && value) {
        const normalized = normalizeFlagKey(key);
        if (normalized) flags.add(normalized);
      }
    });

    return Array.from(flags);
  };

  const toNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const computeDps = (minDamage, maxDamage, attackSpeed) => {
    const speed = toNumber(attackSpeed);
    const damages = [toNumber(minDamage), toNumber(maxDamage)].filter((v) => v !== null);
    if (!damages.length || speed === null || speed <= 0) return null;
    const avgDamage = damages.reduce((sum, val) => sum + val, 0) / damages.length;
    return avgDamage * (1000 / speed);
  };

  const normalizeMonster = (raw) => {
    if (!raw || typeof raw !== "object") return null;
    const fields = raw.fields || {};
    const minDamage = toNumber(fields.min_damage ?? raw.minDamage);
    const maxDamage = toNumber(fields.max_damage ?? raw.maxDamage);
    const attackSpeedRaw = toNumber(fields.attack_speed ?? raw.attackSpeed);
    const attackSpeed = attackSpeedRaw && attackSpeedRaw > 0 ? attackSpeedRaw : null;
    const movingSpeed = toNumber(fields.movement_speed ?? raw.movingSpeed);
    const hpMax = toNumber(fields.health ?? raw.hpMax);
    const level = toNumber(fields.level ?? raw.level);
    const dps = toNumber(raw.dps) ?? computeDps(minDamage, maxDamage, attackSpeed);
    const elementalAttackRaw =
      fields.elemental_attack_label ?? raw.elementalAttack ?? fields.elemental_attack ?? "";
    const elementalAttack =
      elementalAttackRaw === 0
        ? "0"
        : elementalAttackRaw === null || elementalAttackRaw === undefined
           ? ""
           : elementalAttackRaw.toString();
    const statusEffectRaw = fields.status_effect ?? raw.status_effect ?? raw.statusEffect ?? null;
    const statusEffect = toNumber(statusEffectRaw);
    const statusEffectLabelRaw =
      fields.status_effect_label ?? raw.status_effect_label ?? raw.statusEffectLabel ?? "";
    const statusEffectLabel =
      statusEffectLabelRaw === null || statusEffectLabelRaw === undefined
        ? ""
        : statusEffectLabelRaw.toString();
    const monsterTypeRaw = fields.type_label ?? raw.monsterType ?? fields.type ?? "";
    const monsterType =
      monsterTypeRaw === null || monsterTypeRaw === undefined ? "" : monsterTypeRaw.toString();
    const uncommonTatter = fields.uncommon_tatter_label ?? "None";
    const rareTatter = fields.rare_tatter_label ?? "None";
    const flags = extractFlags(raw);
    const baseId = raw.id ?? raw.monsterId ?? raw.name ?? "";
    const normalizedId = normalizeMonsterId(baseId);

    return {
      id: normalizedId || normalizeMonsterId(raw.name || ""),
      name: raw.name || fields.name_label || "Unknown Monster",
      minDamage,
      maxDamage,
      movingSpeed,
      flying: flags.includes("flying"),
      ethereal: flags.includes("ethereal"),
      boss: flags.includes("boss"),
      attackSpeed,
      dps,
      level,
      elementalAttack,
      statusEffect,
      statusEffectLabel,
      monsterType,
      hpMax,
      uncommonTatter,
      rareTatter,
      flags,
    };
  };

  const buildNameSet =
    utils.buildNameSet ||
    ((list) =>
      new Set(
        (Array.isArray(list) ? list : [])
          .map((value) => (value === null || value === undefined ? "" : String(value)).trim().toLowerCase())
          .filter(Boolean)
      ));
  const loadAllowlists =
    typeof utils.loadAllowlists === "function" ? () => utils.loadAllowlists() : () => Promise.resolve(null);
  const loadDropSources =
    typeof utils.loadDropSources === "function" ? () => utils.loadDropSources() : () => Promise.resolve(null);
  let dropSources =
    typeof utils.createEmptyDropSources === "function"
      ? utils.createEmptyDropSources()
      : { armors: {}, weapons: {}, reverse: { armors: {}, weapons: {} } };
  let allowedMonsterNames = new Set();
  let blockedMonsterIds = new Set();
  let hiddenWeaponNames = new Set();
  let hiddenArmorNames = new Set();

  const applyAllowlists = (allowlists) => {
    allowedMonsterNames = buildNameSet(allowlists?.monsters?.allow);
    blockedMonsterIds = new Set(
      (Array.isArray(allowlists?.monsters?.blockIds) ? allowlists.monsters.blockIds : []).map((id) =>
        String(id).trim()
      )
    );
    hiddenWeaponNames = buildNameSet(allowlists?.weapons?.block);
    hiddenArmorNames = buildNameSet(allowlists?.armors?.block);
  };

  const isMonsterAllowed = (monster) => {
    if (blockedMonsterIds.has(String(monster?.id ?? "").trim())) return false;
    if (!allowedMonsterNames.size) return true;
    return allowedMonsterNames.has((monster.name || "").toLowerCase());
  };

  const normalizeMonsters = (list) => {
    if (!Array.isArray(list)) return [];
    return list
      .map((entry) => normalizeMonster(entry))
      .filter(Boolean)
      .filter((monster) => isMonsterAllowed(monster));
  };

  let pendingMonsterId = getInitialMonsterId();

  const monsterImageManifest = new Map();
  let monsterImageManifestPromise = null;
  const loadMonsterImageManifest = () => {
    if (monsterImageManifest.size) return Promise.resolve(monsterImageManifest);
    if (monsterImageManifestPromise) return monsterImageManifestPromise;
    const manifestUrl = new URL("../../images/monsters/manifest.json", window.location.href).toString();
    monsterImageManifestPromise = fetch(manifestUrl)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((list) => {
        const entries = Array.isArray(list) ? list : [];
        entries.forEach((path) => {
          const file = String(path || "").split("/").pop() || "";
          const base = file.replace(/\.[^.]+$/, "").toLowerCase();
          if (base) monsterImageManifest.set(base, path);
        });
        return monsterImageManifest;
      })
      .catch(() => monsterImageManifest)
      .finally(() => {
        monsterImageManifestPromise = null;
      });
    return monsterImageManifestPromise;
  };

  const deriveImageCandidates = (monster) => {
    const candidates = [];
    const rawName = (monster && monster.name ? String(monster.name) : "").trim();
    const lowerName = rawName.toLowerCase();
    const rawId = monster?.id === null || monster?.id === undefined ? "" : String(monster.id).trim();
    const pngExceptions = new Set(["demon spire", "dragon spire", "master spire", "winter spire"]);

    if (monster && monster.image) {
      candidates.push(monster.image);
    }

    const idSpecificKey = lowerName && rawId ? `${lowerName}-${rawId.toLowerCase()}` : "";
    if (idSpecificKey && monsterImageManifest.has(idSpecificKey)) {
      candidates.push(monsterImageManifest.get(idSpecificKey));
    } else if (lowerName && monsterImageManifest.has(lowerName)) {
      candidates.push(monsterImageManifest.get(lowerName));
    }

    if (rawName) {
      const encodedName = encodeURIComponent(rawName);
      const ext = pngExceptions.has(lowerName) ? "png" : "gif";
      candidates.push(`images/monsters/${encodedName}.${ext}`);
    }

    return Array.from(new Set(candidates.filter(Boolean)));
  };

  const RESISTANCES_SCHEMA_VERSION = 2;
  const resistancesUrl = (() => {
    try {
      const resolved = new URL("../systems/resistances.json", window.location.href);
      if (resolved.protocol === "http:" || resolved.protocol === "https:") {
        resolved.searchParams.set("v", String(RESISTANCES_SCHEMA_VERSION));
      }
      return resolved.toString();
    } catch (error) {
      return "../systems/resistances.json";
    }
  })();

  let TYPE_RESISTANCES = {
    humanoid: [
      { element: "Poison", value: 1.25 },
      { element: "Disease", value: 1.25 },
      { element: "Acid", value: 1.15 },
      { element: "Fire", value: 1.0 },
      { element: "Electric", value: 1.0 },
      { element: "Cold", value: 0.9 },
      { element: "Holy", value: 1.0 },
      { element: "Dark", value: 1.3 },
    ],
    giant: [
      { element: "Electric", value: 1.25 },
      { element: "Cold", value: 1.15 },
      { element: "Disease", value: 1.0 },
      { element: "Fire", value: 0.8 },
      { element: "Acid", value: 0.8 },
      { element: "Poison", value: 0.8 },
      { element: "Holy", value: 1.0 },
      { element: "Dark", value: 1.15 },
    ],
    animal: [
      { element: "Poison", value: 1.25 },
      { element: "Disease", value: 1.25 },
      { element: "Fire", value: 1.1 },
      { element: "Cold", value: 1.0 },
      { element: "Electric", value: 1.0 },
      { element: "Acid", value: 1.0 },
      { element: "Holy", value: 1.0 },
      { element: "Dark", value: 1.15 },
    ],
    beast: [
      { element: "Cold", value: 1.1 },
      { element: "Acid", value: 1.1 },
      { element: "Disease", value: 1.1 },
      { element: "Poison", value: 1.0 },
      { element: "Fire", value: 0.9 },
      { element: "Electric", value: 0.8 },
      { element: "Holy", value: 1.0 },
      { element: "Dark", value: 1.25 },
    ],
    undead: [
      { element: "Fire", value: 1.25 },
      { element: "Electric", value: 1.15 },
      { element: "Cold", value: 1.0 },
      { element: "Disease", value: 1.0 },
      { element: "Acid", value: 0.8 },
      { element: "Poison", value: 0.8 },
      { element: "Holy", value: 1.3 },
      { element: "Dark", value: 0.8 },
    ],
    demon: [
      { element: "Cold", value: 1.3 },
      { element: "Electric", value: 1.15 },
      { element: "Acid", value: 1.0 },
      { element: "Poison", value: 1.0 },
      { element: "Disease", value: 1.0 },
      { element: "Fire", value: 0.7 },
      { element: "Holy", value: 1.25 },
      { element: "Dark", value: 0.8 },
    ],
    "fire beast": [
      { element: "Cold", value: 1.3 },
      { element: "Electric", value: 1.0 },
      { element: "Acid", value: 1.0 },
      { element: "Poison", value: 1.0 },
      { element: "Disease", value: 1.0 },
      { element: "Fire", value: 0.7 },
      { element: "Holy", value: 1.0 },
      { element: "Dark", value: 1.0 },
    ],
    "ice beast": [
      { element: "Fire", value: 1.3 },
      { element: "Acid", value: 1.2 },
      { element: "Electric", value: 1.0 },
      { element: "Poison", value: 1.0 },
      { element: "Disease", value: 1.0 },
      { element: "Cold", value: 0.7 },
      { element: "Holy", value: 1.0 },
      { element: "Dark", value: 1.15 },
    ],
    "electric beast": [
      { element: "Acid", value: 1.3 },
      { element: "Cold", value: 1.15 },
      { element: "Fire", value: 1.0 },
      { element: "Poison", value: 1.0 },
      { element: "Disease", value: 1.0 },
      { element: "Electric", value: 0.7 },
      { element: "Holy", value: 1.0 },
      { element: "Dark", value: 1.15 },
    ],
    "poison beast": [
      { element: "Acid", value: 1.25 },
      { element: "Fire", value: 1.2 },
      { element: "Cold", value: 1.0 },
      { element: "Electric", value: 1.0 },
      { element: "Disease", value: 1.0 },
      { element: "Poison", value: 0.8 },
      { element: "Holy", value: 1.1 },
      { element: "Dark", value: 1.0 },
    ],
    "disease beast": [
      { element: "Fire", value: 1.25 },
      { element: "Electric", value: 1.1 },
      { element: "Cold", value: 1.0 },
      { element: "Acid", value: 1.0 },
      { element: "Poison", value: 1.0 },
      { element: "Disease", value: 0.8 },
      { element: "Holy", value: 1.15 },
      { element: "Dark", value: 1.0 },
    ],
  };

  const setImageSource = (imgEl, monster, onFail, onSuccess) => {
    const sources = deriveImageCandidates(monster);
    if (!sources.length) {
      if (onFail) onFail();
      return;
    }
    let index = 0;
    const trySet = () => {
      imgEl.onerror = () => {
        index += 1;
        if (index < sources.length) {
          trySet();
        } else {
          imgEl.onerror = null;
          if (onFail) onFail();
        }
      };
      imgEl.onload = () => {
        imgEl.onload = null;
        if (onSuccess) onSuccess();
      };
      imgEl.src = sources[index];
    };
    trySet();
  };

  const detailFields = {
    name: document.getElementById("details-name"),
    image: document.getElementById("details-image"),
    mapLink: document.getElementById("details-map-link"),
    level: document.getElementById("details-level"),
  hp: document.getElementById("details-hp"),
  dmgRange: document.getElementById("details-dmg-range"),
  dps: document.getElementById("details-dps"),
  attackSpeed: document.getElementById("details-attack-speed"),
  speed: document.getElementById("details-speed"),
  type: document.getElementById("details-type"),
  typeTooltip: document.getElementById("details-type-tooltip"),
  element: document.getElementById("details-element"),
  eliteSummary: document.getElementById("details-elite-summary"),
  corruptedSummary: document.getElementById("details-corrupted-summary"),
    elitePlusSummary: document.getElementById("details-elite-plus-summary"),
    imageFallback: document.getElementById("details-image-fallback"),
    flags: document.getElementById("details-flags"),
    targetFlags: document.getElementById("details-target-flags"),
    statusEffect: document.getElementById("details-status-effect"),
    lootTable: document.getElementById("loot-table"),
    recommendedWeapons: document.getElementById("recommended-weapons"),
    recommendedArmors: document.getElementById("recommended-armors"),
  };

const tooltipFields = {
  elite: {
    hp: document.getElementById("tooltip-elite-hp"),
    dmg: document.getElementById("tooltip-elite-dmg"),
    dps: document.getElementById("tooltip-elite-dps"),
  },
  corrupted: {
    hp: document.getElementById("tooltip-corrupted-hp"),
    dmg: document.getElementById("tooltip-corrupted-dmg"),
    dps: document.getElementById("tooltip-corrupted-dps"),
  },
  elitePlus: {
    hp: document.getElementById("tooltip-elite-plus-hp"),
    dmg: document.getElementById("tooltip-elite-plus-dmg"),
    dps: document.getElementById("tooltip-elite-plus-dps"),
  },
};
let pinnedTooltip = null;
let pinDocumentListenerAttached = false;
const WEAPON_RANKING_STORAGE_KEY = "project-rogue-codex:monster-weapon-ranking";
const ARMOR_RANKING_STORAGE_KEY = "project-rogue-codex:monster-armor-ranking-v3";
const ARMOR_SET_SLOTS = ["helmet", "chest", "gauntlets", "leggings", "shield"];
const ARMOR_RESISTANCE_CAP = 60;
const ARMOR_SET_RESULT_LIMIT = 8;
const ARMOR_COMBAT_PERK_GROUPS = new Set([
  "Slayer & Bane",
  "General Offense",
  "Mitigation & Shields",
  "Resistances",
]);
const ARMOR_SLAYER_MATCHUPS = new Map([
  ["beastslayer", new Set(["animal", "beast"])],
  ["consecration", new Set(["undead", "disease beast"])],
  ["demonsbane", new Set(["demon", "fire beast"])],
  ["executioner", new Set(["humanoid", "giant"])],
  ["iceshatter", new Set(["ice beast"])],
  ["slayer", new Set(["*"])],
  ["venomshock", new Set(["electric beast", "poison beast"])],
]);
const ARMOR_RESISTANCE_PERK_MATCHUPS = new Map([
  ["antacid", "acid"],
  ["demonblood", "fire"],
  ["frozenheart", "cold"],
  ["hazmat", "disease"],
  ["lightningfield", "electric"],
  ["magicshield", "*"],
  ["tourniquet", "poison"],
]);
const CRAFTED_ARMOR_RECOMMENDATION_LEVELS = new Map(
  [
    "Frost Platemail",
    "Frost Helmet",
    "Frost Gauntlets",
    "Frost Leggings",
    "Frost Shield",
    "Dragon Scale Platemail",
    "Dragon Scale Helmet",
    "Dragon Scale Gauntlets",
    "Dragon Scale Leggings",
    "Dragon Scale Shield",
    "Red Dragon Scale Plate",
    "Red Dragon Scale Helm",
    "Red Dragon Scale Gloves",
    "Red Dragon Scale Boots",
    "Red Dragon Scale Shield",
    "Black Dragon Armor",
    "Black Dragon Helmet",
    "Black Dragon Gauntlets",
    "Black Dragon Leggings",
    "Black Dragon Shield",
  ].map((name) => [name, 65])
);

  let monsters = [];
  let sortKey = "dps";
  let sortDir = "desc";
  let searchTerm = getInitialSearchTerm();
  let selectedTypes = new Set();
  let selectedElements = new Set();
  let selectedFlags = new Set();
  let weapons = [];
  let armors = [];
  let perkDefinitions = new Map();
  let weaponRankingSearch = "";
  let weaponRankingOpen = false;
  let armorRankingSearch = "";
  let armorRankingOpen = false;

  const loadWeaponRankingPreferences = () => {
    const defaults = { maxLevel: null, type: "all", includeUnleveled: true };
    try {
      const saved = JSON.parse(localStorage.getItem(WEAPON_RANKING_STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return defaults;
      const savedMaxLevel = Number(saved.maxLevel);
      return {
        maxLevel: Number.isFinite(savedMaxLevel) && savedMaxLevel > 0 ? Math.round(savedMaxLevel) : null,
        type: typeof saved.type === "string" && saved.type.trim() ? saved.type : "all",
        includeUnleveled: saved.includeUnleveled !== false,
      };
    } catch {
      return defaults;
    }
  };

  let weaponRankingPreferences = loadWeaponRankingPreferences();

  const saveWeaponRankingPreferences = () => {
    try {
      localStorage.setItem(WEAPON_RANKING_STORAGE_KEY, JSON.stringify(weaponRankingPreferences));
    } catch {
      // Storage is optional; the ranking controls still work for the current page.
    }
  };

  const loadArmorRankingPreferences = () => {
    const defaults = {
      maxItemLevel: null,
      includeUnleveled: false,
      includePerks: true,
      view: "sets",
      slot: "helmet",
    };
    try {
      const saved = JSON.parse(localStorage.getItem(ARMOR_RANKING_STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return defaults;
      const savedMaxItemLevel = Number(saved.maxItemLevel ?? saved.maxLevel);
      return {
        maxItemLevel:
          Number.isFinite(savedMaxItemLevel) && savedMaxItemLevel > 0
            ? Math.round(savedMaxItemLevel)
            : null,
        includeUnleveled: saved.includeUnleveled === true,
        includePerks: saved.includePerks !== false,
        view: saved.view === "slot" ? "slot" : "sets",
        slot: ARMOR_SET_SLOTS.includes(saved.slot) ? saved.slot : "helmet",
      };
    } catch {
      return defaults;
    }
  };

  let armorRankingPreferences = loadArmorRankingPreferences();

  const saveArmorRankingPreferences = () => {
    try {
      localStorage.setItem(ARMOR_RANKING_STORAGE_KEY, JSON.stringify(armorRankingPreferences));
    } catch {
      // Storage is optional; the ranking controls still work for the current page.
    }
  };

  if (searchInput && searchTerm) {
    searchInput.value = searchTerm;
  }

const renderEmpty = (message) => {
  tableBody.innerHTML = `<tr><td class="table-empty" colspan="8">${message}</td></tr>`;
  if (countLabel) {
    countLabel.textContent = "0 results";
  }
  };

  const populateFilters = (data) => {
    const typeOptions = new Map();
    const elementOptions = new Set();
    const flagOptions = new Set();
    const statusEffectOptions = new Map();

    data.forEach((m) => {
      const normalizedType = normalizeType(m.monsterType);
      if (normalizedType) {
        const label = formatTypeLabel(m.monsterType);
        if (!typeOptions.has(normalizedType)) {
          typeOptions.set(normalizedType, label);
        }
      }
      const element = (m.elementalAttack || "").trim().toLowerCase();
      if (element) {
        elementOptions.add(element);
      }

      (Array.isArray(m.flags) ? m.flags : []).forEach((flag) => {
        if (flag) flagOptions.add(flag);
      });

      const effectValue = m.statusEffect;
      const effectLabel = (m.statusEffectLabel || "").toString().trim();
      if (effectLabel && effectValue !== null && effectValue !== undefined && Number(effectValue) !== 0) {
        const key = effectLabel.toLowerCase();
        if (!statusEffectOptions.has(key)) {
          statusEffectOptions.set(key, effectLabel);
        }
      }
    });

    if (typeFilter) {
      typeFilter.innerHTML = "";
      Array.from(typeOptions.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .forEach(([value, label]) => {
          const opt = document.createElement("option");
          opt.value = value;
          opt.textContent = label;
          opt.selected = selectedTypes.has(value);
          typeFilter.appendChild(opt);
        });
    }

    if (elementFilter) {
      elementFilter.innerHTML = "";
      Array.from(elementOptions)
        .sort((a, b) => a.localeCompare(b))
        .forEach((value) => {
          const opt = document.createElement("option");
          opt.value = value;
          opt.textContent = value.charAt(0).toUpperCase() + value.slice(1);
          opt.selected = selectedElements.has(value);
          const color = ELEMENT_COLORS[value];
          if (color && value !== "none") {
            opt.style.color = color;
          }
          elementFilter.appendChild(opt);
        });
    }

    if (flagFilter) {
      flagFilter.innerHTML = "";
      const options = [];
      Array.from(flagOptions).forEach((value) => {
        const label = formatFlagLabel(value);
        options.push({ value, label });
      });
      Array.from(statusEffectOptions.entries()).forEach(([value, label]) => {
        options.push({ value: `status:${value}`, label });
      });
      options
        .sort((a, b) => a.label.localeCompare(b.label))
        .forEach((entry) => {
          const opt = document.createElement("option");
          opt.value = entry.value;
          opt.textContent = entry.label;
          opt.selected = selectedFlags.has(entry.value);
          flagFilter.appendChild(opt);
        });
    }
  };

  const getSortValue = (monster, key) => {
    const value = monster[key];
    return typeof value === "string" ? value.toLowerCase() : value;
  };

  const formatBool = (value) => (value ? "Yes" : "No");

  const formatNumber = (value) => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "number" && !Number.isNaN(value)) return value.toLocaleString("en-US");
    const num = Number(value);
    if (!Number.isNaN(num)) return num.toLocaleString("en-US");
    return value;
  };

  const formatDps = (value) => {
    if (value === null || value === undefined) return "-";
    const num = Number(value);
    if (Number.isNaN(num)) return "-";
    const rounded = Math.round(num);
    return rounded.toLocaleString("en-US");
  };

  const setVariantValues = (value, mult, el, formatter = formatNumber) => {
    const isNumber = typeof value === "number" && !Number.isNaN(value);
    const scaled = isNumber ? value * mult : null;
    if (el) el.textContent = formatter(scaled);
  };

  const applyElementColor = (elementValue, target) => {
    if (!target) return;
    const text = elementValue || "-";
    const color = ELEMENT_COLORS[(elementValue || "").toLowerCase()];
    target.textContent = text;
    target.style.color = color || "";
  };

  const formatDamageRange = (min, max) => {
    const hasMin = typeof min === "number" && !Number.isNaN(min);
    const hasMax = typeof max === "number" && !Number.isNaN(max);
    if (hasMin && hasMax) return `${formatNumber(min)} - ${formatNumber(max)}`;
    if (hasMin) return `${formatNumber(min)}`;
    if (hasMax) return `${formatNumber(max)}`;
    return "-";
  };

  const formatScaledDamageRange = (min, max, mult) => {
    const hasMin = typeof min === "number" && !Number.isNaN(min);
    const hasMax = typeof max === "number" && !Number.isNaN(max);
    const scaledMin = hasMin ? min * mult : null;
    const scaledMax = hasMax ? max * mult : null;
    if (scaledMin !== null && scaledMax !== null) return `${formatNumber(scaledMin)} - ${formatNumber(scaledMax)}`;
    if (scaledMin !== null) return `${formatNumber(scaledMin)}`;
    if (scaledMax !== null) return `${formatNumber(scaledMax)}`;
    return "-";
  };

  const normalizeWeapon = (raw) => {
    if (!raw || typeof raw !== "object") return null;
    const fields = raw.fields || {};

    const min = toNumber(fields.min_damage);
    const max = toNumber(fields.max_damage);
    const speed = toNumber(fields.attack_speed);
    const dps = computeDps(min, max, speed);

    return {
      name: raw.name || fields.name_label || "Unknown Weapon",
      dps,
      level: toNumber(fields.level_requirement ?? raw.level),
      skillRequirement: toNumber(fields.skill_requirement ?? raw.skillRequirement),
      elementalDamageType: fields.element_label || fields.element || raw.elementalDamageType || raw.element,
      type: fields.subtype_label || fields.subtype || raw.type || raw.Type,
    };
  };

  const isSlotZero = (slotValue) =>
    slotValue === 0 || (typeof slotValue === "string" && slotValue.trim() === "0");

  const normalizeArmor = (raw) => {
    if (!raw || typeof raw !== "object") return null;
    const fields = raw.fields || {};
    const value = toNumber(fields.value);
    const slotRaw = fields.slot_label ?? fields.slot;
    if (isSlotZero(slotRaw)) return null;
    const slot = slotRaw || "";
    const normalizeSlot = (s) => (s || "").toString().trim().toLowerCase();
    return {
      id: raw.id || raw.name || "",
      name: raw.name || "Unknown Armor",
      slot,
      slotNorm: normalizeSlot(slot),
      level: toNumber(fields.level),
      playerLevelRequirement: toNumber(fields.player_level_requirement ?? raw.playerLevelRequirement),
      armor: toNumber(fields.armor),
      weight: toNumber(fields.weight),
      maxRarity: fields.max_rarity_label || fields.max_rarity,
      value,
      sellValue: value !== null ? value / 2 : null,
      deconstruction: toNumber(fields.deconstruction),
      perk: fields.perk_label || fields.perk || "None",
      resistances: {
        fire: toNumber(fields.fire_resistance),
        cold: toNumber(fields.cold_resistance),
        poison: toNumber(fields.poison_resistance),
        disease: toNumber(fields.disease_resistance),
        acid: toNumber(fields.acid_resistance),
        electric: toNumber(fields.lightning_resistance),
        holy: toNumber(fields.holy_resistance),
        dark: toNumber(fields.dark_resistance),
      },
    };
  };

  const COMBAT_ELEMENT_KEYS = ["fire", "cold", "poison", "disease", "acid", "electric", "holy", "dark"];

  const normalizeElementKey = (value) => {
    const normalized = (value || "").toString().trim().toLowerCase();
    if (!normalized || normalized === "none") return null;
    if (normalized.includes("lightning") || normalized.includes("electrical")) return "electric";
    return COMBAT_ELEMENT_KEYS.find((element) => normalized.includes(element)) || null;
  };

  const normalizePerkNameKey = (value) =>
    (value || "")
      .toString()
      .replace(/\s*\(tier\s+\d+\)\s*$/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");

  const getArmorPerkProfile = (perkLabel, monsterType, elementKey) => {
    const label = (perkLabel || "").toString().trim();
    const perkKey = normalizePerkNameKey(label);
    if (!perkKey || perkKey === "none" || perkKey === "unknown") return null;

    const definition = perkDefinitions.get(perkKey);
    if (!definition || !ARMOR_COMBAT_PERK_GROUPS.has(definition.group)) return null;

    const tierMatch = label.match(/\(tier\s+(\d+)\)/i);
    const tier = tierMatch ? Number(tierMatch[1]) : 1;
    const typeKey = normalizeType(monsterType);

    if (definition.group === "Slayer & Bane") {
      const matchups = ARMOR_SLAYER_MATCHUPS.get(perkKey);
      if (!matchups || (!matchups.has("*") && !matchups.has(typeKey))) return null;
      return {
        category: "matchup",
        group: definition.group,
        label,
        tier,
        reason: matchups.has("*")
          ? "Effective against all monster types"
          : `Effective against ${formatTypeLabel(typeKey)}`,
      };
    }

    if (definition.group === "Resistances") {
      const matchup = ARMOR_RESISTANCE_PERK_MATCHUPS.get(perkKey);
      if (!elementKey || !matchup || (matchup !== "*" && matchup !== elementKey)) return null;
      return {
        category: "matchup",
        group: definition.group,
        label,
        tier,
        reason:
          matchup === "*"
            ? `Increases resistance against ${elementKey}`
            : `Matches ${elementKey} damage`,
      };
    }

    return {
      category: "combat",
      group: definition.group,
      label,
      tier,
      reason: definition.group,
    };
  };

  const getElementMultiplier = (monsterType, weaponElement) => {
    const list = TYPE_RESISTANCES[normalizeType(monsterType)];
    if (!list || !list.length) return 1;
    const target = normalizeElementKey(weaponElement);
    if (!target) return 1;
    const match = list.find((entry) => normalizeElementKey(entry.element) === target);
    return match && typeof match.value === "number" ? match.value : 1;
  };

  const buildWeaponLinkRow = (entry) => {
    const row = document.createElement("div");
    row.className = "detail-tooltip-row weapon-row";
    if (entry.element) row.dataset.element = entry.element;
    if (Number.isFinite(entry.multiplier)) row.dataset.multiplier = String(entry.multiplier);
    if (Number.isFinite(entry.base)) row.dataset.baseDps = String(entry.base);
    if (Number.isFinite(entry.effective)) row.dataset.effectiveDps = String(entry.effective);
    const label = document.createElement("a");
    label.className = "detail-tooltip-label";
    label.textContent = entry.name;
    label.href = buildWeaponDetailUrl(entry.name);
    label.addEventListener("click", stopTooltipLinkPropagation);
    label.style.color = "inherit";
    const metaSpan = document.createElement("span");
    metaSpan.textContent = entry.meta || "-";
    metaSpan.className = "weapon-col-meta";
    const typeSpan = document.createElement("span");
    typeSpan.textContent = entry.context || entry.type || "-";
    typeSpan.className = "weapon-col-type";
    const color = ELEMENT_COLORS[(entry.element || "").toLowerCase()];
    if (color) {
      metaSpan.style.color = color;
      if (entry.context) typeSpan.style.color = color;
    }
    row.appendChild(label);
    row.appendChild(metaSpan);
    row.appendChild(typeSpan);
    return row;
  };

  const buildArmorLinkRow = (entry) => {
    const row = document.createElement("div");
    row.className = "detail-tooltip-row weapon-row";
    const label = document.createElement("a");
    label.className = "detail-tooltip-label";
    label.textContent = entry.name;
    label.href = buildArmorDetailUrl(entry.name);
    label.addEventListener("click", stopTooltipLinkPropagation);
    label.style.color = "inherit";
    const armorSpan = document.createElement("span");
    armorSpan.textContent = entry.meta || "-";
    armorSpan.className = "weapon-col-meta";
    const slotSpan = document.createElement("span");
    slotSpan.textContent = entry.slot || "-";
    slotSpan.className = "weapon-col-type";
    row.appendChild(label);
    row.appendChild(armorSpan);
    row.appendChild(slotSpan);
    return row;
  };

  const renderRecommendedWeapons = (monster) => {
    const container = detailFields.recommendedWeapons;
    if (!container) return;
    container.innerHTML = "";

    if (!Array.isArray(weapons) || !weapons.length) {
      const pill = document.createElement("span");
      pill.className = "detail-pill";
      pill.textContent = "No weapons data loaded";
      container.appendChild(pill);
      return;
    }

    const level = Number(monster.level);
    if (!Number.isFinite(level)) {
      const pill = document.createElement("span");
      pill.className = "detail-pill";
      pill.textContent = "No level data";
      container.appendChild(pill);
      return;
    }

    const defaultMaxLevel = Math.max(1, Math.round(level + 5));
    const weaponTypes = Array.from(
      new Set(weapons.map((weapon) => (weapon.type || "").toString().trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    if (weaponRankingPreferences.type !== "all" && !weaponTypes.includes(weaponRankingPreferences.type)) {
      weaponRankingPreferences.type = "all";
      saveWeaponRankingPreferences();
    }

    const rankedWeapons = weapons
      .map((weapon) => {
        const base = Number(weapon.dps);
        if (!Number.isFinite(base)) return null;
        const itemLevel = Number(weapon.level);
        const skillRequirement = Number(weapon.skillRequirement);
        const isUnleveled = !Number.isFinite(itemLevel) || itemLevel <= 0;
        const effectiveRequirement =
          Number.isFinite(skillRequirement) && skillRequirement >= 0
            ? skillRequirement
            : Number.isFinite(itemLevel) && itemLevel > 0
              ? itemLevel
              : 0;
        const multiplier = getElementMultiplier(monster.monsterType, weapon.elementalDamageType);
        return {
          name: weapon.name || "Unknown Weapon",
          element: weapon.elementalDamageType || "None",
          type: (weapon.type || "Unknown").toString(),
          level: effectiveRequirement,
          itemLevel: Number.isFinite(itemLevel) ? itemLevel : 0,
          isUnleveled,
          base,
          multiplier,
          effective: base * multiplier,
        };
      })
      .filter(Boolean);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "detail-pill weapon-ranking-toggle";
    toggle.setAttribute("aria-expanded", String(weaponRankingOpen));
    toggle.setAttribute("aria-controls", "weapon-ranking-panel");

    const toggleLabel = document.createElement("span");
    const toggleLimit = document.createElement("span");
    toggleLimit.className = "weapon-ranking-toggle-limit";
    const toggleIcon = document.createElement("span");
    toggleIcon.className = "weapon-ranking-toggle-icon";
    toggleIcon.setAttribute("aria-hidden", "true");
    toggleIcon.textContent = "\u25be";
    toggle.appendChild(toggleLabel);
    toggle.appendChild(toggleLimit);
    toggle.appendChild(toggleIcon);

    const panel = document.createElement("section");
    panel.id = "weapon-ranking-panel";
    panel.className = "weapon-ranking-panel";
    panel.hidden = !weaponRankingOpen;
    panel.setAttribute("aria-label", "Weapon rankings");

    const controls = document.createElement("div");
    controls.className = "weapon-ranking-controls";

    const createControl = (labelText, control, className = "") => {
      const label = document.createElement("label");
      label.className = `weapon-ranking-control ${className}`.trim();
      const text = document.createElement("span");
      text.className = "weapon-ranking-control-label";
      text.textContent = labelText;
      label.appendChild(text);
      label.appendChild(control);
      return label;
    };

    const rankingSearch = document.createElement("input");
    rankingSearch.type = "search";
    rankingSearch.className = "weapon-ranking-input";
    rankingSearch.placeholder = "Search weapons";
    rankingSearch.value = weaponRankingSearch;
    rankingSearch.autocomplete = "off";
    controls.appendChild(createControl("Search", rankingSearch, "weapon-ranking-search-control"));

    const maxLevelInput = document.createElement("input");
    maxLevelInput.type = "number";
    maxLevelInput.className = "weapon-ranking-input weapon-ranking-level-input";
    maxLevelInput.min = "1";
    maxLevelInput.max = "999";
    maxLevelInput.step = "5";
    maxLevelInput.value = String(weaponRankingPreferences.maxLevel || defaultMaxLevel);
    controls.appendChild(createControl("Max Skill Req.", maxLevelInput));

    const typeSelect = document.createElement("select");
    typeSelect.className = "weapon-ranking-input weapon-ranking-type-select";
    const allTypesOption = document.createElement("option");
    allTypesOption.value = "all";
    allTypesOption.textContent = "All types";
    typeSelect.appendChild(allTypesOption);
    weaponTypes.forEach((type) => {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = type;
      typeSelect.appendChild(option);
    });
    typeSelect.value = weaponRankingPreferences.type;
    controls.appendChild(createControl("Weapon Type", typeSelect));

    const uniqueControl = document.createElement("label");
    uniqueControl.className = "weapon-ranking-unique";
    const uniqueInput = document.createElement("input");
    uniqueInput.type = "checkbox";
    uniqueInput.checked = weaponRankingPreferences.includeUnleveled;
    const uniqueLabel = document.createElement("span");
    uniqueLabel.textContent = "Unique-tier items";
    uniqueControl.appendChild(uniqueInput);
    uniqueControl.appendChild(uniqueLabel);
    controls.appendChild(uniqueControl);

    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.className = "weapon-ranking-reset";
    resetButton.setAttribute("aria-label", "Reset weapon ranking filters");
    resetButton.title = "Reset weapon ranking filters";
    resetButton.textContent = "\u21bb";
    controls.appendChild(resetButton);

    const summary = document.createElement("div");
    summary.className = "weapon-ranking-summary";
    const summaryLabel = document.createElement("span");
    summaryLabel.textContent = `Effective DPS vs. ${formatTypeLabel(monster.monsterType)}`;
    const resultCount = document.createElement("span");
    resultCount.className = "weapon-ranking-count";
    resultCount.setAttribute("aria-live", "polite");
    summary.appendChild(summaryLabel);
    summary.appendChild(resultCount);

    const results = document.createElement("div");
    results.className = "weapon-ranking-results";
    const resultHeader = document.createElement("div");
    resultHeader.className = "weapon-ranking-row weapon-ranking-header";
    ["#", "Weapon", "Requirement / Type / Matchup", "Effective DPS"].forEach((labelText) => {
      const cell = document.createElement("span");
      cell.textContent = labelText;
      resultHeader.appendChild(cell);
    });
    const resultBody = document.createElement("div");
    resultBody.className = "weapon-ranking-body";
    results.appendChild(resultHeader);
    results.appendChild(resultBody);

    panel.appendChild(controls);
    panel.appendChild(summary);
    panel.appendChild(results);

    const getActiveMaxLevel = () => weaponRankingPreferences.maxLevel || defaultMaxLevel;

    const updateToggle = () => {
      toggleLabel.textContent = weaponRankingOpen ? "Hide rankings" : "View rankings";
      toggleLimit.textContent = `Req <= ${formatNumber(getActiveMaxLevel())}`;
      toggle.classList.toggle("is-open", weaponRankingOpen);
      toggle.setAttribute("aria-expanded", String(weaponRankingOpen));
    };

    const renderRankingResults = () => {
      const search = weaponRankingSearch.trim().toLowerCase();
      const maxLevel = getActiveMaxLevel();
      const selectedType = weaponRankingPreferences.type;
      const filtered = rankedWeapons
        .filter((entry) => {
          if (entry.isUnleveled && !weaponRankingPreferences.includeUnleveled) return false;
          if (entry.level > maxLevel) return false;
          if (selectedType !== "all" && entry.type !== selectedType) return false;
          if (!search) return true;
          return `${entry.name} ${entry.type} ${entry.element} ${entry.level} ${entry.itemLevel}`
            .toLowerCase()
            .includes(search);
        })
        .sort(
          (a, b) =>
            b.effective - a.effective ||
            b.base - a.base ||
            a.level - b.level ||
            a.name.localeCompare(b.name)
        );

      resultCount.textContent = `${formatNumber(filtered.length)} weapon${filtered.length === 1 ? "" : "s"}`;
      resultBody.innerHTML = "";
      if (!filtered.length) {
        const empty = document.createElement("div");
        empty.className = "weapon-ranking-empty";
        empty.textContent = "No weapons match these filters.";
        resultBody.appendChild(empty);
        return;
      }

      const fragment = document.createDocumentFragment();
      filtered.forEach((entry, index) => {
        const row = document.createElement("div");
        row.className = "weapon-ranking-row";
        row.dataset.element = entry.element;
        row.dataset.multiplier = String(entry.multiplier);
        row.dataset.level = String(entry.level);
        row.dataset.itemLevel = String(entry.itemLevel);
        row.dataset.type = entry.type;

        const rank = document.createElement("span");
        rank.className = "weapon-ranking-rank";
        rank.textContent = String(index + 1);

        const name = document.createElement("a");
        name.className = "weapon-ranking-name";
        name.href = buildWeaponDetailUrl(entry.name);
        name.textContent = entry.name;

        const context = document.createElement("span");
        context.className = "weapon-ranking-context";
        const requirementLabel = entry.level > 0 ? `Req ${formatNumber(entry.level)}` : "No req.";
        context.textContent = `${requirementLabel} / ${entry.type} / ${entry.element} ${formatResistanceValue(entry.multiplier)}`;
        context.title = entry.isUnleveled
          ? `Unique item tier; skill requirement ${formatNumber(entry.level)}`
          : `Item level ${formatNumber(entry.itemLevel)}; skill requirement ${formatNumber(entry.level)}`;
        const elementColor = ELEMENT_COLORS[(entry.element || "").toLowerCase()];
        if (elementColor) context.style.color = elementColor;

        const effective = document.createElement("span");
        effective.className = "weapon-ranking-dps";
        effective.textContent = `${formatDps(entry.effective)} DPS`;
        effective.title = `${formatDps(entry.base)} base DPS at ${formatResistanceValue(entry.multiplier)} matchup`;
        if (elementColor) effective.style.color = elementColor;

        row.appendChild(rank);
        row.appendChild(name);
        row.appendChild(context);
        row.appendChild(effective);
        fragment.appendChild(row);
      });
      resultBody.appendChild(fragment);
    };

    toggle.addEventListener("click", () => {
      weaponRankingOpen = !weaponRankingOpen;
      panel.hidden = !weaponRankingOpen;
      updateToggle();
    });

    rankingSearch.addEventListener("input", () => {
      weaponRankingSearch = rankingSearch.value;
      renderRankingResults();
    });

    maxLevelInput.addEventListener("input", () => {
      const value = Number(maxLevelInput.value);
      if (!Number.isFinite(value) || value <= 0) return;
      weaponRankingPreferences.maxLevel = Math.round(value);
      saveWeaponRankingPreferences();
      updateToggle();
      renderRankingResults();
    });

    typeSelect.addEventListener("change", () => {
      weaponRankingPreferences.type = typeSelect.value || "all";
      saveWeaponRankingPreferences();
      renderRankingResults();
    });

    uniqueInput.addEventListener("change", () => {
      weaponRankingPreferences.includeUnleveled = uniqueInput.checked;
      saveWeaponRankingPreferences();
      renderRankingResults();
    });

    resetButton.addEventListener("click", () => {
      weaponRankingPreferences = { maxLevel: null, type: "all", includeUnleveled: true };
      weaponRankingSearch = "";
      maxLevelInput.value = String(defaultMaxLevel);
      typeSelect.value = "all";
      uniqueInput.checked = true;
      rankingSearch.value = "";
      saveWeaponRankingPreferences();
      updateToggle();
      renderRankingResults();
    });

    container.dataset.defaultMaxLevel = String(defaultMaxLevel);
    container.appendChild(toggle);
    container.appendChild(panel);
    updateToggle();
    renderRankingResults();
  };

  const renderRecommendedArmors = (monster) => {
    const container = detailFields.recommendedArmors;
    if (!container) return;
    container.innerHTML = "";

    if (!Array.isArray(armors) || !armors.length) {
      const pill = document.createElement("span");
      pill.className = "detail-pill";
      pill.textContent = "No armors data";
      container.appendChild(pill);
      return;
    }

    const elementKey = normalizeElementKey(monster.elementalAttack);

    const level = Number(monster.level);
    if (!Number.isFinite(level)) {
      const pill = document.createElement("span");
      pill.className = "detail-pill";
      pill.textContent = "No level data";
      container.appendChild(pill);
      return;
    }

    const defaultMaxItemLevel = Math.max(1, Math.round(level + 5));
    const slotLabel = (slot) => slot.charAt(0).toUpperCase() + slot.slice(1);
    const elementLabel = elementKey
      ? elementKey.charAt(0).toUpperCase() + elementKey.slice(1)
      : "Physical";
    const elementColor = elementKey ? ELEMENT_COLORS[elementKey] : null;

    const rankedArmors = armors
      .filter(
        (armor) =>
          armor &&
          armor.slotNorm &&
          ARMOR_SET_SLOTS.includes(armor.slotNorm) &&
          !/cosmetic/i.test(armor.slot || "")
      )
      .map((armor) => {
        const rawItemLevel = Number(armor.level);
        const craftedRecommendationLevel =
          CRAFTED_ARMOR_RECOMMENDATION_LEVELS.get(armor.name) || null;
        const itemLevel =
          craftedRecommendationLevel ||
          (Number.isFinite(rawItemLevel) ? rawItemLevel : 0);
        const hasPlayerRequirement =
          Number.isFinite(armor.playerLevelRequirement) && armor.playerLevelRequirement >= 0;
        const requirement = hasPlayerRequirement
          ? armor.playerLevelRequirement
          : Number.isFinite(itemLevel) && itemLevel > 0
            ? itemLevel
            : 0;
        const perkProfile = getArmorPerkProfile(
          armor.perk,
          monster.monsterType,
          elementKey
        );
        return {
          ...armor,
          rawItemLevel: Number.isFinite(rawItemLevel) ? rawItemLevel : 0,
          itemLevel,
          requirement,
          isCraftedRecommendation: craftedRecommendationLevel !== null,
          isUnleveled: itemLevel <= 0,
          relevantResistance: elementKey ? Number(armor.resistances[elementKey]) || 0 : 0,
          perkProfile,
          matchingPerkCount: perkProfile?.category === "matchup" ? 1 : 0,
          matchingPerkTier: perkProfile?.category === "matchup" ? perkProfile.tier : 0,
          combatPerkCount: perkProfile?.category === "combat" ? 1 : 0,
          combatPerkTier: perkProfile?.category === "combat" ? perkProfile.tier : 0,
        };
      });

    const comparePerkRank = (left, right) => {
      if (!armorRankingPreferences.includePerks) return 0;
      return (
        right.matchingPerkCount - left.matchingPerkCount ||
        right.matchingPerkTier - left.matchingPerkTier ||
        right.combatPerkCount - left.combatPerkCount ||
        right.combatPerkTier - left.combatPerkTier
      );
    };

    const compareSets = (left, right) =>
      right.cappedResist - left.cappedResist ||
      comparePerkRank(left, right) ||
      right.totalArmor - left.totalArmor ||
      left.totalWeight - right.totalWeight ||
      left.key.localeCompare(right.key);

    const getBestSets = (sourceArmors) => {
      const requiredSlots = ARMOR_SET_SLOTS;
      const bySlot = new Map();
      sourceArmors
        .forEach((armor) => {
          const list = bySlot.get(armor.slotNorm) || [];
          list.push(armor);
          bySlot.set(armor.slotNorm, list);
        });

      if (requiredSlots.some((slot) => !bySlot.get(slot) || !bySlot.get(slot).length)) {
        return [];
      }

      let states = [
        {
          set: [],
          totalResist: 0,
          cappedResist: 0,
          totalArmor: 0,
          totalWeight: 0,
          matchingPerkCount: 0,
          matchingPerkTier: 0,
          combatPerkCount: 0,
          combatPerkTier: 0,
          key: "",
        },
      ];

      requiredSlots.forEach((slot) => {
        const buckets = new Map();
        states.forEach((state) => {
          (bySlot.get(slot) || []).forEach((armor) => {
            const set = state.set.concat(armor);
            const totalResist = state.totalResist + armor.relevantResistance;
            const cappedResist = Math.min(totalResist, ARMOR_RESISTANCE_CAP);
            const perkProfile = armor.perkProfile;
            const isMatchingPerk = perkProfile?.category === "matchup";
            const isCombatPerk = perkProfile?.category === "combat";
            const candidate = {
              set,
              totalResist,
              cappedResist,
              totalArmor: state.totalArmor + (Number(armor.armor) || 0),
              totalWeight: state.totalWeight + (Number(armor.weight) || 0),
              matchingPerkCount: state.matchingPerkCount + (isMatchingPerk ? 1 : 0),
              matchingPerkTier:
                state.matchingPerkTier + (isMatchingPerk ? perkProfile.tier : 0),
              combatPerkCount: state.combatPerkCount + (isCombatPerk ? 1 : 0),
              combatPerkTier:
                state.combatPerkTier + (isCombatPerk ? perkProfile.tier : 0),
              key: set.map((item) => item.name).join("|"),
            };
            const bucket = buckets.get(cappedResist) || [];
            bucket.push(candidate);
            buckets.set(cappedResist, bucket);
          });
        });
        states = Array.from(buckets.values()).flatMap((bucket) =>
          bucket.sort(compareSets).slice(0, ARMOR_SET_RESULT_LIMIT)
        );
      });

      return states.sort(compareSets).slice(0, ARMOR_SET_RESULT_LIMIT);
    };

    const getFilteredArmors = () => {
      const maxItemLevel = armorRankingPreferences.maxItemLevel || defaultMaxItemLevel;
      return rankedArmors.filter((armor) => {
        if (armor.isUnleveled) return armorRankingPreferences.includeUnleveled;
        return armor.itemLevel <= maxItemLevel;
      });
    };

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "detail-pill armor-ranking-toggle";
    toggle.setAttribute("aria-expanded", String(armorRankingOpen));
    toggle.setAttribute("aria-controls", "armor-ranking-panel");

    const toggleLabel = document.createElement("span");
    const toggleLimit = document.createElement("span");
    toggleLimit.className = "armor-ranking-toggle-limit";
    const toggleIcon = document.createElement("span");
    toggleIcon.className = "armor-ranking-toggle-icon";
    toggleIcon.setAttribute("aria-hidden", "true");
    toggleIcon.textContent = "\u25be";
    toggle.appendChild(toggleLabel);
    toggle.appendChild(toggleLimit);
    toggle.appendChild(toggleIcon);

    const panel = document.createElement("section");
    panel.id = "armor-ranking-panel";
    panel.className = "armor-ranking-panel";
    panel.hidden = !armorRankingOpen;
    panel.setAttribute("aria-label", "Armor set rankings");

    const controls = document.createElement("div");
    controls.className = "armor-ranking-controls";

    const createControl = (labelText, control, className = "") => {
      const label = document.createElement("label");
      label.className = `armor-ranking-control ${className}`.trim();
      const text = document.createElement("span");
      text.className = "armor-ranking-control-label";
      text.textContent = labelText;
      label.appendChild(text);
      label.appendChild(control);
      return label;
    };

    const maxItemLevelInput = document.createElement("input");
    maxItemLevelInput.type = "number";
    maxItemLevelInput.className = "armor-ranking-input armor-ranking-level-input";
    maxItemLevelInput.min = "1";
    maxItemLevelInput.max = "999";
    maxItemLevelInput.step = "5";
    maxItemLevelInput.value = String(
      armorRankingPreferences.maxItemLevel || defaultMaxItemLevel
    );
    controls.appendChild(createControl("Max Item Level", maxItemLevelInput));

    const uniqueControl = document.createElement("label");
    uniqueControl.className = "armor-ranking-unique";
    const uniqueInput = document.createElement("input");
    uniqueInput.type = "checkbox";
    uniqueInput.checked = armorRankingPreferences.includeUnleveled;
    const uniqueLabel = document.createElement("span");
    uniqueLabel.textContent = "Unique-tier items";
    uniqueControl.appendChild(uniqueInput);
    uniqueControl.appendChild(uniqueLabel);
    controls.appendChild(uniqueControl);

    const perksControl = document.createElement("label");
    perksControl.className = "armor-ranking-perks";
    perksControl.title =
      "Prioritize confirmed innate perks from the combat and resistance groups.";
    const perksInput = document.createElement("input");
    perksInput.type = "checkbox";
    perksInput.checked = armorRankingPreferences.includePerks;
    const perksLabel = document.createElement("span");
    perksLabel.textContent = "Perks";
    perksControl.appendChild(perksInput);
    perksControl.appendChild(perksLabel);
    controls.appendChild(perksControl);

    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.className = "armor-ranking-reset";
    resetButton.setAttribute("aria-label", "Reset armor ranking filters");
    resetButton.title = "Reset armor ranking filters";
    resetButton.textContent = "\u21bb";
    controls.appendChild(resetButton);

    const tabs = document.createElement("div");
    tabs.className = "armor-ranking-tabs";
    tabs.setAttribute("role", "tablist");
    const setsTab = document.createElement("button");
    setsTab.type = "button";
    setsTab.id = "armor-ranking-sets-tab";
    setsTab.setAttribute("role", "tab");
    setsTab.setAttribute("aria-controls", "armor-ranking-sets-view");
    setsTab.textContent = "Best Sets";
    const slotTab = document.createElement("button");
    slotTab.type = "button";
    slotTab.id = "armor-ranking-slot-tab";
    slotTab.setAttribute("role", "tab");
    slotTab.setAttribute("aria-controls", "armor-ranking-slot-view");
    slotTab.textContent = "By Slot";
    tabs.appendChild(setsTab);
    tabs.appendChild(slotTab);

    const setsView = document.createElement("div");
    setsView.id = "armor-ranking-sets-view";
    setsView.className = "armor-ranking-view";
    setsView.setAttribute("role", "tabpanel");
    setsView.setAttribute("aria-labelledby", setsTab.id);
    const setsSummary = document.createElement("div");
    setsSummary.className = "armor-ranking-summary";
    const setsSummaryLabel = document.createElement("span");
    setsSummaryLabel.textContent = elementKey
      ? `Best sets vs. ${elementLabel}`
      : "Best physical-defense sets";
    const setsCount = document.createElement("span");
    setsCount.className = "armor-ranking-count";
    setsCount.setAttribute("aria-live", "polite");
    setsSummary.appendChild(setsSummaryLabel);
    setsSummary.appendChild(setsCount);
    const setsResults = document.createElement("div");
    setsResults.className = "armor-ranking-results armor-set-results";
    setsView.appendChild(setsSummary);
    setsView.appendChild(setsResults);

    const slotView = document.createElement("div");
    slotView.id = "armor-ranking-slot-view";
    slotView.className = "armor-ranking-view";
    slotView.setAttribute("role", "tabpanel");
    slotView.setAttribute("aria-labelledby", slotTab.id);
    const slotTools = document.createElement("div");
    slotTools.className = "armor-slot-tools";
    const slotSelect = document.createElement("select");
    slotSelect.className = "armor-ranking-input armor-slot-select";
    ARMOR_SET_SLOTS.forEach((slot) => {
      const option = document.createElement("option");
      option.value = slot;
      option.textContent = slotLabel(slot);
      slotSelect.appendChild(option);
    });
    slotSelect.value = armorRankingPreferences.slot;
    slotTools.appendChild(createControl("Armor Slot", slotSelect));

    const rankingSearch = document.createElement("input");
    rankingSearch.type = "search";
    rankingSearch.className = "armor-ranking-input";
    rankingSearch.placeholder = "Search this slot";
    rankingSearch.value = armorRankingSearch;
    rankingSearch.autocomplete = "off";
    slotTools.appendChild(createControl("Search", rankingSearch, "armor-ranking-search-control"));

    const slotSummary = document.createElement("div");
    slotSummary.className = "armor-ranking-summary";
    const slotSummaryLabel = document.createElement("span");
    const slotCount = document.createElement("span");
    slotCount.className = "armor-ranking-count";
    slotCount.setAttribute("aria-live", "polite");
    slotSummary.appendChild(slotSummaryLabel);
    slotSummary.appendChild(slotCount);
    const slotResults = document.createElement("div");
    slotResults.className = "armor-ranking-results armor-slot-results";
    slotView.appendChild(slotTools);
    slotView.appendChild(slotSummary);
    slotView.appendChild(slotResults);

    panel.appendChild(controls);
    panel.appendChild(tabs);
    panel.appendChild(setsView);
    panel.appendChild(slotView);

    const getActiveMaxItemLevel = () =>
      armorRankingPreferences.maxItemLevel || defaultMaxItemLevel;

    const updateToggle = () => {
      toggleLabel.textContent = armorRankingOpen ? "Hide sets" : "View sets";
      toggleLimit.textContent = `Item Lv <= ${formatNumber(getActiveMaxItemLevel())}`;
      toggle.classList.toggle("is-open", armorRankingOpen);
      toggle.setAttribute("aria-expanded", String(armorRankingOpen));
    };

    const appendSetHeader = () => {
      const header = document.createElement("div");
      header.className = "armor-set-row armor-set-header";
      ["#", "Defense", "Armor", ""].forEach((labelText) => {
        const cell = document.createElement("span");
        cell.textContent = labelText;
        header.appendChild(cell);
      });
      setsResults.appendChild(header);
    };

    const appendPerkContext = (target, armor) => {
      if (!armorRankingPreferences.includePerks || !armor.perkProfile) return;
      target.appendChild(document.createTextNode(" / "));
      const perk = document.createElement("span");
      perk.className = `armor-ranking-perk is-${armor.perkProfile.category}`;
      perk.textContent = armor.perkProfile.label;
      perk.title = armor.perkProfile.reason;
      target.appendChild(perk);
    };

    const renderSetResults = () => {
      const bestSets = getBestSets(getFilteredArmors());
      setsCount.textContent = `${formatNumber(bestSets.length)} set${bestSets.length === 1 ? "" : "s"}`;
      setsResults.innerHTML = "";
      if (!bestSets.length) {
        const empty = document.createElement("div");
        empty.className = "armor-ranking-empty";
        empty.textContent = "Not enough armor pieces for a complete set.";
        setsResults.appendChild(empty);
        return;
      }

      appendSetHeader();
      bestSets.forEach((bestSet, index) => {
        const card = document.createElement("article");
        card.className = "armor-set-card";
        card.dataset.rank = String(index + 1);
        card.dataset.resistance = String(bestSet.cappedResist);
        card.dataset.totalResistance = String(bestSet.totalResist);
        card.dataset.armor = String(bestSet.totalArmor);
        card.dataset.weight = String(bestSet.totalWeight);
        card.dataset.matchingPerks = String(bestSet.matchingPerkCount);
        card.dataset.combatPerks = String(bestSet.combatPerkCount);

        const summaryButton = document.createElement("button");
        summaryButton.type = "button";
        summaryButton.className = "armor-set-row armor-set-toggle";
        summaryButton.setAttribute("aria-expanded", "false");

        const rank = document.createElement("span");
        rank.className = "armor-ranking-rank";
        rank.textContent = String(index + 1);
        const defense = document.createElement("span");
        defense.className = "armor-set-defense";
        defense.textContent = elementKey
          ? `${elementLabel} ${formatNumber(bestSet.cappedResist)} / ${ARMOR_RESISTANCE_CAP}`
          : "Physical defense";
        if (elementColor) defense.style.color = elementColor;
        if (elementKey) {
          defense.title =
            bestSet.totalResist > ARMOR_RESISTANCE_CAP
              ? `${formatNumber(bestSet.totalResist)} equipped; ${ARMOR_RESISTANCE_CAP} effective`
              : `${formatNumber(bestSet.totalResist)} equipped and effective`;
        }
        const armorValue = document.createElement("span");
        armorValue.className = "armor-set-number";
        armorValue.dataset.label = "Armor";
        armorValue.textContent = formatNumber(bestSet.totalArmor);
        const icon = document.createElement("span");
        icon.className = "armor-set-toggle-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = "\u25be";
        summaryButton.appendChild(rank);
        summaryButton.appendChild(defense);
        summaryButton.appendChild(armorValue);
        summaryButton.appendChild(icon);

        const pieces = document.createElement("div");
        pieces.className = "armor-set-pieces";
        pieces.hidden = true;
        bestSet.set.forEach((armor) => {
          const row = document.createElement("div");
          row.className = "armor-piece-row";
          row.dataset.playerRequirement = String(armor.requirement);
          row.dataset.itemLevel = String(armor.itemLevel);
          row.dataset.rawItemLevel = String(armor.rawItemLevel);
          row.dataset.crafted = String(armor.isCraftedRecommendation);
          row.dataset.slot = armor.slotNorm;
          row.dataset.perkCategory = armor.perkProfile?.category || "none";
          const slot = document.createElement("span");
          slot.className = "armor-piece-slot";
          slot.textContent = slotLabel(armor.slotNorm);
          const name = document.createElement("a");
          name.className = "armor-ranking-name";
          name.href = buildArmorDetailUrl(armor.name);
          name.textContent = armor.name;
          const requirement = document.createElement("span");
          requirement.className = "armor-piece-requirement";
          const playerRequirementLabel =
            armor.requirement > 0 ? `Req ${formatNumber(armor.requirement)}` : "No req.";
          requirement.textContent = armor.isCraftedRecommendation
            ? `Crafted Lv ${formatNumber(armor.itemLevel)} / ${playerRequirementLabel}`
            : armor.isUnleveled
              ? `Unique / ${playerRequirementLabel}`
              : `Item Lv ${formatNumber(armor.itemLevel)} / ${playerRequirementLabel}`;
          requirement.title = armor.isCraftedRecommendation
            ? `Crafted armor evaluated at item level ${formatNumber(armor.itemLevel)}; game data item level ${formatNumber(armor.rawItemLevel)}; player requirement ${formatNumber(armor.requirement)}`
            : armor.isUnleveled
              ? `Unique item tier; player requirement ${formatNumber(armor.requirement)}`
              : `Item level ${formatNumber(armor.itemLevel)}; player requirement ${formatNumber(armor.requirement)}`;
          const stats = document.createElement("span");
          stats.className = "armor-piece-stats";
          stats.textContent = elementKey
            ? `${formatNumber(armor.relevantResistance)} ${elementLabel} / ${formatNumber(armor.armor || 0)} Armor`
            : `${formatNumber(armor.armor || 0)} Armor / ${formatNumber(armor.weight || 0)} Wt`;
          if (elementColor) stats.style.color = elementColor;
          appendPerkContext(stats, armor);
          row.appendChild(slot);
          row.appendChild(name);
          row.appendChild(requirement);
          row.appendChild(stats);
          pieces.appendChild(row);
        });

        summaryButton.addEventListener("click", () => {
          const isOpen = summaryButton.getAttribute("aria-expanded") === "true";
          summaryButton.setAttribute("aria-expanded", String(!isOpen));
          summaryButton.classList.toggle("is-open", !isOpen);
          pieces.hidden = isOpen;
        });

        card.appendChild(summaryButton);
        card.appendChild(pieces);
        setsResults.appendChild(card);
      });
    };

    const renderSlotResults = () => {
      const search = armorRankingSearch.trim().toLowerCase();
      const selectedSlot = armorRankingPreferences.slot;
      const filtered = getFilteredArmors()
        .filter((armor) => {
          if (armor.slotNorm !== selectedSlot) return false;
          if (!search) return true;
          return `${armor.name} ${armor.requirement} ${armor.itemLevel} ${armor.perk}`
            .toLowerCase()
            .includes(search);
        })
        .sort(
          (left, right) =>
            right.relevantResistance - left.relevantResistance ||
            comparePerkRank(left, right) ||
            (Number(right.armor) || 0) - (Number(left.armor) || 0) ||
            (Number(left.weight) || 0) - (Number(right.weight) || 0) ||
            left.requirement - right.requirement ||
            left.name.localeCompare(right.name)
        );

      slotSummaryLabel.textContent = elementKey
        ? `${slotLabel(selectedSlot)} vs. ${elementLabel}`
        : `${slotLabel(selectedSlot)} by armor`;
      slotCount.textContent = `${formatNumber(filtered.length)} item${filtered.length === 1 ? "" : "s"}`;
      slotResults.innerHTML = "";
      if (!filtered.length) {
        const empty = document.createElement("div");
        empty.className = "armor-ranking-empty";
        empty.textContent = "No armor pieces match these filters.";
        slotResults.appendChild(empty);
        return;
      }

      const header = document.createElement("div");
      header.className = "armor-slot-row armor-slot-header";
      ["#", "Armor", "Item Level / Req. / Defense", "Armor"].forEach((labelText) => {
        const cell = document.createElement("span");
        cell.textContent = labelText;
        header.appendChild(cell);
      });
      slotResults.appendChild(header);

      filtered.forEach((armor, index) => {
        const row = document.createElement("div");
        row.className = "armor-slot-row";
        row.dataset.slot = armor.slotNorm;
        row.dataset.playerRequirement = String(armor.requirement);
        row.dataset.itemLevel = String(armor.itemLevel);
        row.dataset.rawItemLevel = String(armor.rawItemLevel);
        row.dataset.crafted = String(armor.isCraftedRecommendation);
        row.dataset.resistance = String(armor.relevantResistance);
        row.dataset.perkCategory = armor.perkProfile?.category || "none";
        const rank = document.createElement("span");
        rank.className = "armor-ranking-rank";
        rank.textContent = String(index + 1);
        const name = document.createElement("a");
        name.className = "armor-ranking-name";
        name.href = buildArmorDetailUrl(armor.name);
        name.textContent = armor.name;
        const context = document.createElement("span");
        context.className = "armor-ranking-context";
        const requirementLabel = armor.requirement > 0
          ? `Req ${formatNumber(armor.requirement)}`
          : "No req.";
        const itemLevelLabel = armor.isCraftedRecommendation
          ? `Crafted Lv ${formatNumber(armor.itemLevel)}`
          : armor.isUnleveled
            ? "Unique tier"
            : `Item Lv ${formatNumber(armor.itemLevel)}`;
        context.textContent = elementKey
          ? `${itemLevelLabel} / ${requirementLabel} / ${elementLabel} ${formatNumber(armor.relevantResistance)} / ${formatNumber(armor.weight || 0)} Wt`
          : `${itemLevelLabel} / ${requirementLabel} / ${formatNumber(armor.weight || 0)} Wt`;
        context.title = armor.isCraftedRecommendation
          ? `Crafted armor evaluated at item level ${formatNumber(armor.itemLevel)}; game data item level ${formatNumber(armor.rawItemLevel)}; player requirement ${formatNumber(armor.requirement)}`
          : armor.isUnleveled
            ? `Unique item tier; player requirement ${formatNumber(armor.requirement)}`
            : `Item level ${formatNumber(armor.itemLevel)}; player requirement ${formatNumber(armor.requirement)}`;
        if (elementColor) context.style.color = elementColor;
        appendPerkContext(context, armor);
        const armorValue = document.createElement("span");
        armorValue.className = "armor-ranking-armor";
        armorValue.textContent = formatNumber(armor.armor || 0);
        row.appendChild(rank);
        row.appendChild(name);
        row.appendChild(context);
        row.appendChild(armorValue);
        slotResults.appendChild(row);
      });
    };

    const renderActiveView = () => {
      const showingSets = armorRankingPreferences.view === "sets";
      setsTab.classList.toggle("is-active", showingSets);
      slotTab.classList.toggle("is-active", !showingSets);
      setsTab.setAttribute("aria-selected", String(showingSets));
      slotTab.setAttribute("aria-selected", String(!showingSets));
      setsTab.tabIndex = showingSets ? 0 : -1;
      slotTab.tabIndex = showingSets ? -1 : 0;
      setsView.hidden = !showingSets;
      slotView.hidden = showingSets;
      if (showingSets) renderSetResults();
      else renderSlotResults();
    };

    toggle.addEventListener("click", () => {
      armorRankingOpen = !armorRankingOpen;
      panel.hidden = !armorRankingOpen;
      updateToggle();
    });

    [setsTab, slotTab].forEach((tab) => {
      tab.addEventListener("click", () => {
        armorRankingPreferences.view = tab === setsTab ? "sets" : "slot";
        saveArmorRankingPreferences();
        renderActiveView();
      });
    });

    maxItemLevelInput.addEventListener("input", () => {
      const value = Number(maxItemLevelInput.value);
      if (!Number.isFinite(value) || value <= 0) return;
      armorRankingPreferences.maxItemLevel = Math.round(value);
      saveArmorRankingPreferences();
      updateToggle();
      renderActiveView();
    });

    uniqueInput.addEventListener("change", () => {
      armorRankingPreferences.includeUnleveled = uniqueInput.checked;
      saveArmorRankingPreferences();
      renderActiveView();
    });

    perksInput.addEventListener("change", () => {
      armorRankingPreferences.includePerks = perksInput.checked;
      saveArmorRankingPreferences();
      renderActiveView();
    });

    slotSelect.addEventListener("change", () => {
      armorRankingPreferences.slot = ARMOR_SET_SLOTS.includes(slotSelect.value)
        ? slotSelect.value
        : "helmet";
      saveArmorRankingPreferences();
      renderSlotResults();
    });

    rankingSearch.addEventListener("input", () => {
      armorRankingSearch = rankingSearch.value;
      renderSlotResults();
    });

    resetButton.addEventListener("click", () => {
      armorRankingPreferences = {
        maxItemLevel: null,
        includeUnleveled: false,
        includePerks: true,
        view: "sets",
        slot: "helmet",
      };
      armorRankingSearch = "";
      maxItemLevelInput.value = String(defaultMaxItemLevel);
      uniqueInput.checked = false;
      perksInput.checked = true;
      slotSelect.value = "helmet";
      rankingSearch.value = "";
      saveArmorRankingPreferences();
      updateToggle();
      renderActiveView();
    });

    container.dataset.defaultMaxItemLevel = String(defaultMaxItemLevel);
    container.dataset.element = elementKey || "none";
    container.appendChild(toggle);
    container.appendChild(panel);
    updateToggle();
    renderActiveView();
  };

  const buildTatteredImbuementsPill = (monster) => {
    const normalizeText = (value) => (value === null || value === undefined ? "" : value.toString().trim());
    const isNone = (value) => {
      const text = normalizeText(value);
      return !text || text.toLowerCase() === "none";
    };
    const uncommon = monster ? monster.uncommonTatter : "";
    const rare = monster ? monster.rareTatter : "";
    if (isNone(uncommon) && isNone(rare)) return null;

    const pill = document.createElement("span");
    pill.className = "detail-pill";
    pill.textContent = "Tatters";

    const tooltip = document.createElement("span");
    tooltip.className = "detail-tooltip";
    tooltip.role = "tooltip";

    const addRow = (labelText, valueText) => {
      const row = document.createElement("div");
      row.className = "detail-tooltip-row";
      const label = document.createElement("span");
      label.className = "detail-tooltip-label";
      label.textContent = labelText;
      const value = document.createElement("span");
      value.textContent = normalizeText(valueText) || "-";
      row.appendChild(label);
      row.appendChild(value);
      tooltip.appendChild(row);
    };

    addRow("Uncommon Tatter", uncommon);
    addRow("Rare Tatter", rare);

    pill.appendChild(tooltip);
    return pill;
  };

  const renderLootTable = (monster) => {
    const container = detailFields.lootTable;
    if (!container) return;
    container.innerHTML = "";

    const tatterPill = buildTatteredImbuementsPill(monster);

    if (!Array.isArray(weapons) || !weapons.length) {
      const pill = document.createElement("span");
      pill.className = "detail-pill";
      pill.textContent = "No weapons data";
      container.appendChild(pill);
      if (tatterPill) container.appendChild(tatterPill);
      return;
    }

    const level = Number(monster.level);
    if (!Number.isFinite(level)) {
      const pill = document.createElement("span");
      pill.className = "detail-pill";
      pill.textContent = "No level data";
      container.appendChild(pill);
      if (tatterPill) container.appendChild(tatterPill);
      return;
    }

      const minLevel = Math.max(0, level - 5);
      const maxLevel = level + 5;

    const list = weapons
      .map((w) => {
        const wLevel = Number(w.level);
        if (!Number.isFinite(wLevel)) return null;
        if (wLevel < minLevel || wLevel > maxLevel) return null;
        return {
          name: w.name || "Unknown Weapon",
          element: w.elementalDamageType || "-",
          meta: `${formatDps(Number(w.dps) || 0)} DPS`,
          type: w.type || "-",
          level: wLevel,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.level - a.level)
      .slice(0, 10);

    const pill = document.createElement("span");
    pill.className = "detail-pill";
    pill.textContent = "Weapons";

      const tooltip = document.createElement("span");
      tooltip.className = "detail-tooltip";
      tooltip.role = "tooltip";

      const uniqueDropNames =
        typeof utils.getDropSourceItemNamesByMonster === "function"
          ? utils.getDropSourceItemNamesByMonster(dropSources, "weapons", monster.name || monster.id)
          : [];
      const uniqueDropList = Array.from(
        new Set(uniqueDropNames.map((name) => String(name || "").trim()).filter(Boolean))
      )
        .map((name) => {
          const match = weapons.find((w) => (w.name || "").toLowerCase() === name.toLowerCase());
          if (!match) {
            return {
              name,
              element: "-",
              meta: "-",
              type: "-",
            };
          }
          return {
            name: match.name || name,
            element: match.elementalDamageType || "-",
            meta: `${formatDps(Number(match.dps) || 0)} DPS`,
            type: match.type || "-",
          };
        })
        .filter(Boolean);

      if (uniqueDropList.length) {
        const uniqueHeader = document.createElement("div");
        uniqueHeader.className = "detail-tooltip-row weapon-row";
        const uniqueLabel = document.createElement("span");
        uniqueLabel.className = "detail-tooltip-label";
        uniqueLabel.textContent = "Unique Drops";
        const uniqueMeta = document.createElement("span");
        uniqueMeta.className = "weapon-col-meta";
        const uniqueType = document.createElement("span");
        uniqueType.className = "weapon-col-type";
        uniqueHeader.appendChild(uniqueLabel);
        uniqueHeader.appendChild(uniqueMeta);
        uniqueHeader.appendChild(uniqueType);
        tooltip.appendChild(uniqueHeader);

        const uniqueHeaderDivider = document.createElement("div");
        uniqueHeaderDivider.className = "detail-tooltip-divider";
        tooltip.appendChild(uniqueHeaderDivider);

        uniqueDropList.forEach((entry) => {
          tooltip.appendChild(buildWeaponLinkRow(entry));
        });

        const uniqueDivider = document.createElement("div");
        uniqueDivider.className = "detail-tooltip-divider";
        tooltip.appendChild(uniqueDivider);
      }

      const rangeRow = document.createElement("div");
      rangeRow.className = "detail-tooltip-row";
      const rangeLabel = document.createElement("span");
      rangeLabel.className = "detail-tooltip-label";
      rangeLabel.textContent = "Levels";
    const rangeVal = document.createElement("span");
    rangeVal.textContent = `${formatNumber(minLevel)} - ${formatNumber(maxLevel)}`;
    rangeRow.appendChild(rangeLabel);
    rangeRow.appendChild(rangeVal);
    tooltip.appendChild(rangeRow);

    const divider = document.createElement("div");
    divider.className = "detail-tooltip-divider";
    tooltip.appendChild(divider);

    if (!list.length) {
      const emptyRow = document.createElement("div");
      emptyRow.className = "detail-tooltip-row";
      const emptyLabel = document.createElement("span");
      emptyLabel.className = "detail-tooltip-label";
      emptyLabel.textContent = "No weapons in range";
      emptyRow.appendChild(emptyLabel);
      tooltip.appendChild(emptyRow);
    } else {
      list.forEach((entry) => {
        tooltip.appendChild(buildWeaponLinkRow(entry));
      });
    }

    pill.appendChild(tooltip);
    container.appendChild(pill);

    const armorList = armors
      .map((a) => {
        const aLevel = Number(a.level);
        if (!Number.isFinite(aLevel)) return null;
        if (aLevel < minLevel || aLevel > maxLevel) return null;
        return {
          name: a.name || "Unknown Armor",
          slot: a.slot || a.slotNorm || "-",
          meta: `Armor ${formatNumber(a.armor)}`,
          level: aLevel,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.level - a.level)
      .slice(0, 10);

      const armorPill = document.createElement("span");
      armorPill.className = "detail-pill";
      armorPill.textContent = "Armors";

      const armorTooltip = document.createElement("span");
      armorTooltip.className = "detail-tooltip";
      armorTooltip.role = "tooltip";

      const uniqueArmorNames =
        typeof utils.getDropSourceItemNamesByMonster === "function"
          ? utils.getDropSourceItemNamesByMonster(dropSources, "armors", monster.name || monster.id)
          : [];
      const uniqueArmorList = Array.from(
        new Set(uniqueArmorNames.map((name) => String(name || "").trim()).filter(Boolean))
      )
        .map((name) => {
          const match = armors.find((a) => (a.name || "").toLowerCase() === name.toLowerCase());
          if (!match) {
            return {
              name,
              slot: "-",
              meta: "-",
            };
          }
          return {
            name: match.name || name,
            slot: match.slot || match.slotNorm || "-",
            meta: `Armor ${formatNumber(match.armor)}`,
          };
        })
        .filter(Boolean);

      if (uniqueArmorList.length) {
        const uniqueArmorHeader = document.createElement("div");
        uniqueArmorHeader.className = "detail-tooltip-row weapon-row";
        const uniqueArmorLabel = document.createElement("span");
        uniqueArmorLabel.className = "detail-tooltip-label";
        uniqueArmorLabel.textContent = "Unique Drops";
        const uniqueArmorMeta = document.createElement("span");
        uniqueArmorMeta.className = "weapon-col-meta";
        const uniqueArmorType = document.createElement("span");
        uniqueArmorType.className = "weapon-col-type";
        uniqueArmorHeader.appendChild(uniqueArmorLabel);
        uniqueArmorHeader.appendChild(uniqueArmorMeta);
        uniqueArmorHeader.appendChild(uniqueArmorType);
        armorTooltip.appendChild(uniqueArmorHeader);

        const uniqueArmorHeaderDivider = document.createElement("div");
        uniqueArmorHeaderDivider.className = "detail-tooltip-divider";
        armorTooltip.appendChild(uniqueArmorHeaderDivider);

        uniqueArmorList.forEach((entry) => {
          armorTooltip.appendChild(buildArmorLinkRow(entry));
        });

        const uniqueArmorDivider = document.createElement("div");
        uniqueArmorDivider.className = "detail-tooltip-divider";
        armorTooltip.appendChild(uniqueArmorDivider);
      }

      const armorRangeRow = document.createElement("div");
      armorRangeRow.className = "detail-tooltip-row";
      const armorRangeLabel = document.createElement("span");
      armorRangeLabel.className = "detail-tooltip-label";
      armorRangeLabel.textContent = "Levels";
    const armorRangeVal = document.createElement("span");
    armorRangeVal.textContent = `${formatNumber(minLevel)} - ${formatNumber(maxLevel)}`;
    armorRangeRow.appendChild(armorRangeLabel);
    armorRangeRow.appendChild(armorRangeVal);
    armorTooltip.appendChild(armorRangeRow);

    const armorDivider = document.createElement("div");
    armorDivider.className = "detail-tooltip-divider";
    armorTooltip.appendChild(armorDivider);

    if (!armorList.length) {
      const emptyRow = document.createElement("div");
      emptyRow.className = "detail-tooltip-row";
      const emptyLabel = document.createElement("span");
      emptyLabel.className = "detail-tooltip-label";
      emptyLabel.textContent = "No armors in range";
      emptyRow.appendChild(emptyLabel);
      armorTooltip.appendChild(emptyRow);
    } else {
      armorList.forEach((entry) => {
        armorTooltip.appendChild(buildArmorLinkRow(entry));
      });
    }

    armorPill.appendChild(armorTooltip);
    container.appendChild(armorPill);

    if (tatterPill) container.appendChild(tatterPill);
  };

  const normalizeType = (value) => {
    if (!value) return "";
    const spaced = value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_]+/g, " ");
    const normalized = spaced.trim().toLowerCase();
    const aliasMap = {
      electricalbeast: "electric beast",
      "electrical beast": "electric beast",
      firebeast: "fire beast",
      icebeast: "ice beast",
      poisonbeast: "poison beast",
      diseasebeast: "disease beast",
      human: "humanoid",
    };
    return aliasMap[normalized] || normalized;
  };

  const formatTypeLabel = (value) => {
    if (!value) return "-";
    return value
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatResistanceValue = (value) => {
    if (Number.isInteger(value)) return `${value}x`;
    let text = value.toString();
    if (text.startsWith("0.")) {
      text = text.replace(/^0+/, "");
    } else if (text.startsWith("-0.")) {
      text = text.replace(/^-0+/, "-.");
    }
    text = text.replace(/(\.\d*?)0+$/, "$1");
    if (text.endsWith(".")) text = text.slice(0, -1);
    return `${text}x`;
  };

  const getResistanceColor = (value) => {
    if (typeof value !== "number" || Number.isNaN(value)) return "";
    if (value > 1) {
      const ratio = Math.min((value - 1) / 0.3, 1);
      const lightness = 50 + 20 * ratio;
      const saturation = 65 + 15 * ratio;
      return `hsl(120, ${saturation}%, ${lightness}%)`;
    }
    if (value < 1) {
      const ratio = Math.min((1 - value) / 0.3, 1);
      const lightness = 55 + 25 * ratio;
      return `hsl(0, 80%, ${lightness}%)`;
    }
    return "#bbbbbb";
  };

  const renderTypeTooltip = (typeValue) => {
    const tooltip = detailFields.typeTooltip;
    if (!tooltip) return;
    const key = normalizeType(typeValue);
    const items = TYPE_RESISTANCES[key];
    tooltip.innerHTML = "";
    if (!items || !items.length) {
      tooltip.textContent = "No resistance data";
      return;
    }
    const firstNeutral = items.findIndex((item) => item.value === 1 || item.value === 1.0);
    const lastNeutral = (() => {
      let idx = -1;
      items.forEach((item, i) => {
        if (item.value === 1 || item.value === 1.0) idx = i;
      });
      return idx;
    })();

    items.forEach(({ element, value }, index) => {
      if (index === firstNeutral && index !== 0) {
        const divider = document.createElement("div");
        divider.className = "detail-tooltip-divider";
        tooltip.appendChild(divider);
      }

      const row = document.createElement("div");
      row.className = "detail-tooltip-row";
      const label = document.createElement("span");
      label.className = "detail-tooltip-label";
      label.textContent = element;
      const color = ELEMENT_COLORS[element.toLowerCase()];
      if (color) label.style.color = color;
      const val = document.createElement("span");
      val.textContent = typeof value === "number" ? formatResistanceValue(value) : value;
      if (typeof value === "number") {
        const valColor = getResistanceColor(value);
        if (valColor) val.style.color = valColor;
      }
      row.appendChild(label);
      row.appendChild(val);
      tooltip.appendChild(row);

      if (index === lastNeutral && index !== items.length - 1) {
        const divider = document.createElement("div");
        divider.className = "detail-tooltip-divider";
        tooltip.appendChild(divider);
      }
    });
  };

  const renderFlags = (monster) => {
    const container = detailFields.flags;
    const targetContainer = detailFields.targetFlags;
    if (container) container.innerHTML = "";
    if (targetContainer) targetContainer.innerHTML = "";
    const flags = Array.isArray(monster.flags) ? monster.flags : [];

    const targetLabels = new Set();

    const pushTargetCombo = (label) => {
      targetLabels.add(label);
    };

    const renderMainFlag = (flag) => {
      const pill = document.createElement("span");
      pill.className = "flag-pill";
      const dot = document.createElement("span");
      dot.className = "flag-dot";
      const label = document.createElement("span");
      const meta = FLAG_DETAILS[flag] || {};
      label.textContent = meta.label || formatFlagLabel(flag);
      const tooltip = document.createElement("span");
      tooltip.className = "flag-tooltip";
      if (meta.description) {
        tooltip.textContent = meta.description;
      }
      pill.appendChild(dot);
      pill.appendChild(label);
      if (tooltip.textContent) {
        pill.appendChild(tooltip);
      }
      container.appendChild(pill);
    };

    if (!flags.length) {
      if (container) {
        const none = document.createElement("span");
        none.className = "detail-value";
        none.textContent = "None";
        container.appendChild(none);
      }
      if (targetContainer) {
        const none = document.createElement("span");
        none.className = "detail-value";
        none.textContent = "None";
        targetContainer.appendChild(none);
      }
      return;
    }

    flags.forEach((flag) => {
      const lower = (flag || "").toString().toLowerCase();
      const normalized = lower.replace(/\s+/g, "_");
      const isTargetCombo =
        lower.includes("target when attacked/ranged/trapped") ||
        lower.includes("target when hit ranged trapped") ||
        normalized.includes("target_when_hit_ranged_trapped");
      const isTargetBlocked = lower.includes("target when blocked") || normalized.includes("target_when_blocked");

      if (isTargetCombo) {
        ["Attacked", "Ranged", "Trapped"].forEach(pushTargetCombo);
        return;
      }
      if (isTargetBlocked) {
        pushTargetCombo("Blocked");
        return;
      }
      if (container) renderMainFlag(flag);
    });

    if (container && !container.children.length) {
      const none = document.createElement("span");
      none.className = "detail-value";
      none.textContent = "None";
      container.appendChild(none);
    }

    if (targetContainer) {
      if (!targetLabels.size) {
        const none = document.createElement("span");
        none.className = "detail-value";
        none.textContent = "None";
        targetContainer.appendChild(none);
      } else {
        targetLabels.forEach((labelText) => {
          const chip = document.createElement("span");
          chip.className = "target-flag";
          chip.textContent = labelText;
          targetContainer.appendChild(chip);
        });
      }
    }
  };

  const renderStatusEffect = (monster) => {
    const container = detailFields.statusEffect;
    if (!container) return;
    const effectValue = monster ? monster.statusEffect : null;
    const hasEffect = effectValue !== null && effectValue !== undefined && Number(effectValue) !== 0;
    if (!hasEffect) {
      container.textContent = "None";
      return;
    }
    const label = (monster?.statusEffectLabel || "").toString().trim();
    container.textContent = label || "Unknown";
  };

  const findMonsterByRouteId = (list, routeId) => {
    const normalized = normalizeMonsterId(routeId);
    if (!normalized) return null;
    return (Array.isArray(list) ? list : []).find((m) => {
      const idNorm = normalizeMonsterId(m.id);
      const nameNorm = normalizeMonsterId(m.name);
      return idNorm === normalized || nameNorm === normalized;
    });
  };

  const getSelectedMonsterFromLocation = (list = monsters) => {
    const routeId = getInitialMonsterId();
    if (!routeId) return null;
    return findMonsterByRouteId(list, routeId);
  };

  const selectMonster = (monster, options = {}) => {
    if (!monster) return;
    if (options.updateUrl) {
      updateMonsterDetailUrl(monster, { replace: options.replaceUrl });
    }
    setDetails(monster, { scroll: options.scroll });
  };

  const maybeSelectPendingMonster = (list) => {
    if (!pendingMonsterId) return;
    const normalized = pendingMonsterId;
    const match = findMonsterByRouteId(list || monsters, normalized) || findMonsterByRouteId(monsters, normalized);
    if (!match) return;
    pendingMonsterId = "";
    selectMonster(match, { updateUrl: false });
  };

  const applyFilterAndSort = () => {
    const term = searchTerm.trim().toLowerCase();
    let list = monsters.slice();

    if (term) {
      list = list.filter((m) => {
        const uncommonTatter = (m.uncommonTatter || "").toString().trim().toLowerCase();
        const rareTatter = (m.rareTatter || "").toString().trim().toLowerCase();
        return (
          (m.name && m.name.toLowerCase().includes(term)) ||
          (m.monsterType && m.monsterType.toLowerCase().includes(term)) ||
          (m.elementalAttack && m.elementalAttack.toLowerCase().includes(term)) ||
          (uncommonTatter && uncommonTatter !== "none" && uncommonTatter.includes(term)) ||
          (rareTatter && rareTatter !== "none" && rareTatter.includes(term))
        );
      });
    }

    if (selectedTypes.size) {
      list = list.filter((m) => selectedTypes.has(normalizeType(m.monsterType)));
    }

    if (selectedElements.size) {
      list = list.filter((m) => selectedElements.has((m.elementalAttack || "").trim().toLowerCase()));
    }

    if (selectedFlags.size) {
      list = list.filter((m) => {
        const flags = Array.isArray(m.flags) ? m.flags : [];
        const effectValue = m.statusEffect;
        const label = (m.statusEffectLabel || "").toString().trim().toLowerCase();
        const hasStatus = effectValue !== null && effectValue !== undefined && Number(effectValue) !== 0;

        for (const selected of selectedFlags) {
          if (selected.startsWith("status:")) {
            const statusKey = selected.slice("status:".length);
            if (!hasStatus || !label || label !== statusKey) return false;
            continue;
          }
          if (!flags.includes(selected)) return false;
        }
        return true;
      });
    }

    list.sort((a, b) => {
      const aVal = getSortValue(a, sortKey);
      const bVal = getSortValue(b, sortKey);
      if (aVal === bVal) return 0;
      const dir = sortDir === "asc" ? 1 : -1;
      return aVal > bVal ? dir : -dir;
    });

    renderTable(list);
    if (countLabel) {
      countLabel.textContent = `${list.length.toLocaleString("en-US")} result${list.length === 1 ? "" : "s"}`;
    }
    maybeSelectPendingMonster(list);
  };

const renderTable = (rows) => {
  if (!rows.length) {
    renderEmpty("No monsters match your filters.");
    return;
  }

    const fragment = document.createDocumentFragment();

    rows.forEach((monster) => {
      const tr = document.createElement("tr");
      tr.dataset.id = monster.id;

      const imgCell = document.createElement("td");
      const img = document.createElement("img");
      const fallback = () => {
        img.remove();
        const noImg = document.createElement("span");
        noImg.className = "no-image";
        noImg.textContent = "No Image";
        imgCell.appendChild(noImg);
      };
      setImageSource(img, monster, fallback, () => {
        img.style.display = "block";
      });
      img.alt = monster.name ? `${monster.name} portrait` : "Monster portrait";
      img.className = "monster-thumb";
      img.loading = "lazy";
      imgCell.appendChild(img);
      tr.appendChild(imgCell);

      const addCell = (value) => {
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
      };

      const nameTd = document.createElement("td");
      const nameLink = document.createElement("a");
      nameLink.href = buildMonsterDetailUrl(monster);
      nameLink.className = "monster-link";
      nameLink.textContent = monster.name || "-";
      nameLink.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectMonster(monster, { updateUrl: true });
      });
      nameTd.appendChild(nameLink);
      tr.appendChild(nameTd);
      addCell(formatNumber(monster.level));
      addCell(formatNumber(monster.hpMax));
      addCell(formatDps(monster.dps));
      addCell(
        monster.movingSpeed === null || monster.movingSpeed === undefined
          ? "-"
          : `${formatNumber(monster.movingSpeed)} ms`
      );
      addCell(monster.monsterType || "-");

      const elementTd = document.createElement("td");
      const elementSpan = document.createElement("span");
      applyElementColor(monster.elementalAttack, elementSpan);
      elementTd.appendChild(elementSpan);
      tr.appendChild(elementTd);

      tr.addEventListener("click", () => {
        selectMonster(monster, { updateUrl: true });
      });

      fragment.appendChild(tr);
    });

    tableBody.innerHTML = "";
    tableBody.appendChild(fragment);
  };

const unpinTooltip = (tooltip) => {
  if (!tooltip) return;
  tooltip.classList.remove("is-pinned");
  if (pinnedTooltip === tooltip) pinnedTooltip = null;
};

  const attachTooltipPinning = () => {
    const tooltips = document.querySelectorAll(
      ".monster-details .detail-tooltip, .monster-details .flag-tooltip"
    );

    tooltips.forEach((tooltip) => {
      if (tooltip.dataset.pinWired === "1") return;
      let activator = tooltip.closest(".flag-pill");
      if (!activator) {
        const stat = tooltip.closest(".detail-stat");
        activator = stat ? stat.querySelector(".detail-pill") : null;
      }
      if (!activator) {
        activator = tooltip.closest(".detail-pill");
      }
      if (!activator) return;

      const togglePin = () => {
        if (pinnedTooltip && pinnedTooltip !== tooltip) {
          unpinTooltip(pinnedTooltip);
        }

        if (tooltip.classList.contains("is-pinned")) {
          unpinTooltip(tooltip);
        } else {
          tooltip.classList.add("is-pinned");
          pinnedTooltip = tooltip;
        }
      };

      activator.addEventListener("click", (event) => {
        event.stopPropagation();
        togglePin();
      });

      tooltip.addEventListener("click", (event) => {
        event.stopPropagation();
        togglePin();
      });

      tooltip.dataset.pinWired = "1";
    });

    if (!pinDocumentListenerAttached) {
      document.addEventListener("click", (event) => {
        if (!pinnedTooltip) return;
        let activator = pinnedTooltip.closest(".flag-pill");
        if (!activator) {
          const stat = pinnedTooltip.closest(".detail-stat");
          activator = stat ? stat.querySelector(".detail-pill") : null;
        }
        if (!activator) {
          activator = pinnedTooltip.closest(".detail-pill");
        }
        if (activator && activator.contains(event.target)) return;
        if (pinnedTooltip.contains(event.target)) return;
        unpinTooltip(pinnedTooltip);
      });
      pinDocumentListenerAttached = true;
    }
  };

  const setDetails = (monster, options = {}) => {
    if (!monster) return;
    if (pinnedTooltip) unpinTooltip(pinnedTooltip);
    if (typeof window !== "undefined") {
      window.RogueCodexDebug = window.RogueCodexDebug || {};
      window.RogueCodexDebug.selectedMonster = monster;
      window.RogueCodexDebug.statusEffect = {
        name: monster.name || "",
        value: monster.statusEffect,
        label: monster.statusEffectLabel,
      };
    }
    detailFields.name.textContent = monster.name || "Unknown Monster";
    if (detailFields.mapLink) {
      const searchName = monster.name || "";
      detailFields.mapLink.href = `${MAP_SEARCH_BASE}${encodeURIComponent(searchName)}`;
      detailFields.mapLink.title = searchName ? `Find ${searchName} on the map` : "Find on the map";
    }
    const fallbackImage = detailFields.imageFallback;
    if (detailFields.image) {
      detailFields.image.style.display = "block";
    }
    if (fallbackImage) {
      fallbackImage.style.display = "none";
    }
    setImageSource(
      detailFields.image,
      monster,
      () => {
        if (detailFields.image) {
          detailFields.image.style.display = "none";
        }
        if (fallbackImage) {
          fallbackImage.style.display = "flex";
        }
      },
      () => {
        if (detailFields.image) {
          detailFields.image.style.display = "block";
        }
        if (fallbackImage) {
          fallbackImage.style.display = "none";
        }
      }
    );
    detailFields.image.alt = monster.name ? `${monster.name} portrait` : "Monster portrait";
    detailFields.level.textContent = formatNumber(monster.level);
    detailFields.hp.textContent = formatNumber(monster.hpMax);
    detailFields.dmgRange.textContent = formatDamageRange(monster.minDamage, monster.maxDamage);
    detailFields.dps.textContent = formatDps(monster.dps);
    if (detailFields.eliteSummary) {
      detailFields.eliteSummary.textContent = "1.5x dmg, 3x HP";
    }
    if (detailFields.corruptedSummary) {
      detailFields.corruptedSummary.textContent = "1.75x dmg, 5x HP";
    }
    if (detailFields.elitePlusSummary) {
      detailFields.elitePlusSummary.textContent = "2.0x dmg, 10x HP";
    }
    setVariantValues(monster.hpMax, 3.0, tooltipFields.elite.hp);
    if (tooltipFields.elite.dmg) {
      tooltipFields.elite.dmg.textContent = formatScaledDamageRange(monster.minDamage, monster.maxDamage, 1.5);
    }
    setVariantValues(monster.dps, 1.5, tooltipFields.elite.dps, formatDps);
    setVariantValues(monster.hpMax, 5.0, tooltipFields.corrupted.hp);
    if (tooltipFields.corrupted.dmg) {
      tooltipFields.corrupted.dmg.textContent = formatScaledDamageRange(
        monster.minDamage,
        monster.maxDamage,
        1.75
      );
    }
    setVariantValues(monster.dps, 1.75, tooltipFields.corrupted.dps, formatDps);
    setVariantValues(monster.hpMax, 10.0, tooltipFields.elitePlus.hp);
    if (tooltipFields.elitePlus.dmg) {
      tooltipFields.elitePlus.dmg.textContent = formatScaledDamageRange(monster.minDamage, monster.maxDamage, 2.0);
    }
    setVariantValues(monster.dps, 2.0, tooltipFields.elitePlus.dps, formatDps);
    detailFields.attackSpeed.textContent =
      monster.attackSpeed === null || monster.attackSpeed === undefined
        ? "-"
        : `${formatNumber(monster.attackSpeed)} ms`;
    detailFields.speed.textContent =
      monster.movingSpeed === null || monster.movingSpeed === undefined
        ? "-"
        : `${formatNumber(monster.movingSpeed)} ms`;
    const formattedType = formatTypeLabel(monster.monsterType);
    detailFields.type.textContent = formattedType;
    renderTypeTooltip(monster.monsterType);
    applyElementColor(monster.elementalAttack, detailFields.element);
    renderFlags(monster);
    renderStatusEffect(monster);
    renderLootTable(monster);
    renderRecommendedWeapons(monster);
    renderRecommendedArmors(monster);
    attachTooltipPinning();

    details.classList.add("show");
    if (options.scroll !== false) {
      details.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const clearDetails = (options = {}) => {
    details.classList.remove("show");
    if (typeof window !== "undefined" && window.RogueCodexDebug) {
      window.RogueCodexDebug.selectedMonster = null;
    }
    if (options.updateUrl) {
      updateMonsterListUrl({ replace: options.replaceUrl });
    }
  };

  window.addEventListener("popstate", () => {
    const routeId = getInitialMonsterId();
    if (!routeId) {
      pendingMonsterId = "";
      clearDetails({ updateUrl: false });
      return;
    }
    if (!monsters.length) {
      pendingMonsterId = routeId;
      return;
    }
    const selected = getSelectedMonsterFromLocation(monsters);
    if (selected) {
      pendingMonsterId = "";
      selectMonster(selected, { updateUrl: false, scroll: false });
    } else {
      pendingMonsterId = "";
      clearDetails({ updateUrl: false });
    }
  });

  const attachSorting = () => {
    document.querySelectorAll(".monsters-table th[data-sort-key]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.getAttribute("data-sort-key");
        if (!key) return;
        if (sortKey === key) {
          sortDir = sortDir === "asc" ? "desc" : "asc";
        } else {
          sortKey = key;
          sortDir = "asc";
        }
        applyFilterAndSort();
      });
    });
  };

  const init = () => {
    Promise.all([
      fetchJsonCached(dataUrl, { cacheKey: `monsters-data-v${MONSTERS_SCHEMA_VERSION}:${dataUrl}` }),
      fetchJsonCached(weaponsUrl.toString()),
      fetchJsonCached(new URL("../items/armors_data06.json", window.location.href).toString()),
      fetchJsonCached(perksUrl.toString()),
      fetchJsonCached(resistancesUrl),
      loadAllowlists(),
      loadDropSources(),
      loadMonsterImageManifest(),
    ]).then(
      ([
        monsterData,
        weaponData,
        armorData,
        perksData,
        resistancesData,
        allowlists,
        loadedDropSources,
      ]) => {
        const map =
          resistancesData && typeof resistancesData === "object" ? resistancesData.typeResistances : null;
        if (map && typeof map === "object") {
          TYPE_RESISTANCES = map;
        }
        perkDefinitions = new Map(
          (Array.isArray(perksData?.perks) ? perksData.perks : [])
            .filter((perk) => perk && ARMOR_COMBAT_PERK_GROUPS.has(perk.group))
            .map((perk) => [normalizePerkNameKey(perk.name), perk])
        );
        applyAllowlists(allowlists);
        dropSources =
          loadedDropSources ||
          (typeof utils.createEmptyDropSources === "function"
            ? utils.createEmptyDropSources()
            : dropSources);
        monsters = normalizeMonsters(Array.isArray(monsterData) ? monsterData : []);
        weapons = Array.isArray(weaponData)
          ? weaponData
              .map((w) => normalizeWeapon(w))
              .filter((w) => {
                if (!w) return false;
                const nameLower = (w.name || "").toLowerCase();
                if (nameLower === "flaming sword" && Number(w.level) === 0) return false;
                return !hiddenWeaponNames.has(nameLower);
              })
          : [];
        armors = Array.isArray(armorData)
          ? armorData
              .map((a) => normalizeArmor(a))
              .filter((a) => a && !hiddenArmorNames.has((a.name || "").toLowerCase()))
          : [];
        if (!monsters.length) {
          renderEmpty("No monsters found in monsters_data03.json.");
          return;
        }
        populateFilters(monsters);
        applyFilterAndSort();
      }
    )
      .catch((error) => {
        console.error("Unable to initialize monster data.", error);
        renderEmpty("Unable to load monsters. Add monsters_data03.json beside this page.");
      });
  };

  searchInput.addEventListener("input", (event) => {
    searchTerm = event.target.value || "";
    applyFilterAndSort();
  });

  const enableToggleSelect = (selectEl) => {
    if (!selectEl) return;
    selectEl.addEventListener("mousedown", (event) => {
      const option = event.target;
      if (option && option.tagName === "OPTION") {
        event.preventDefault();
        option.selected = !option.selected;
        selectEl.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  };

  const collectSelected = (selectEl) => {
    const set = new Set();
    if (!selectEl) return set;
    Array.from(selectEl.selectedOptions || []).forEach((opt) => {
      if (opt && opt.value) set.add(opt.value);
    });
    return set;
  };

  if (typeFilter) {
    enableToggleSelect(typeFilter);
    typeFilter.addEventListener("change", () => {
      selectedTypes = collectSelected(typeFilter);
      applyFilterAndSort();
    });
  }

  if (elementFilter) {
    enableToggleSelect(elementFilter);
    elementFilter.addEventListener("change", () => {
      selectedElements = collectSelected(elementFilter);
      applyFilterAndSort();
    });
  }

  if (flagFilter) {
    enableToggleSelect(flagFilter);
    flagFilter.addEventListener("change", () => {
      selectedFlags = collectSelected(flagFilter);
      applyFilterAndSort();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => clearDetails({ updateUrl: true }));
  }

  attachTooltipPinning();
  attachSorting();
  init();
})();
