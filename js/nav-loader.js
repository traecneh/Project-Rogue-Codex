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
        initializeSidebar();
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
  const sections = document.querySelectorAll("[data-section]");

  const updateIcon = (headerBtn, expanded) => {
    const icon = headerBtn.querySelector(".nav-header-icon");
    if (!icon) return;
    icon.textContent = expanded ? "-" : "+";
  };

  sections.forEach((section) => {
    const headerBtn = section.querySelector(".nav-header");
    if (!headerBtn) return;

    const initiallyExpanded = headerBtn.getAttribute("aria-expanded") === "true";
    section.classList.toggle("collapsed", !initiallyExpanded);
    updateIcon(headerBtn, initiallyExpanded);

    headerBtn.addEventListener("click", () => {
      const isExpanded = headerBtn.getAttribute("aria-expanded") === "true";
      const nextExpanded = !isExpanded;
      headerBtn.setAttribute("aria-expanded", String(nextExpanded));
      section.classList.toggle("collapsed", !nextExpanded);
      updateIcon(headerBtn, nextExpanded);
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
    const chance = dexterity / 3;
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
    label.textContent = `${dex} DEX`;
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
      href: "pages/General/floor-cleanup.html",
      excludedPaths: ["pages/general/floor-cleanup.html"],
    },
    {
      keyword: "Creeper",
      href: "pages/General/floor-cleanup.html",
      excludedPaths: ["pages/general/floor-cleanup.html"],
    },
  ];

  const currentPath = window.location.pathname.toLowerCase();
  const activeRules = keywordRules.filter(
    (rule) => !rule.excludedPaths.some((excluded) => currentPath.includes(excluded.toLowerCase()))
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

  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
    const pattern = `\\b${escapeRegExp(rule.keyword)}\\b`;
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
      const regex = new RegExp(pattern, "gi");
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

  perkCardCachePromise = fetch("pages/items/perks.html")
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
  { name: "Normal", color: "#ffffff", min: 0, max: 0, perkChance: 0 },
  { name: "Uncommon", color: "#ffd966", min: 2, max: 4, perkChance: 0 },
  { name: "Rare", color: "#0000ff", min: 5, max: 8, perkChance: 0 },
  { name: "Epic", color: "#741b47", min: 9, max: 12, perkChance: 0.4 },
  { name: "Legendary", color: "#ff9900", min: 13, max: 15, perkChance: 0.6 },
  { name: "Mythical", color: "#6aa84f", min: 16, max: 22, perkChance: 0.8 },
  { name: "Ascendant", color: "#ff0000", min: 23, max: 30, perkChance: 1 },
];

let perksCacheForRoller = null;

function initializeRarityRoller() {
  const container = document.getElementById("rarity-roller");
  if (!container) return;

  const rollButton = container.querySelector("[data-rarity-roll]");
  const resultContainer = container.querySelector("[data-rarity-result]");
  if (!rollButton || !resultContainer) return;

  rollButton.addEventListener("click", () => {
    rollButton.disabled = true;
    rollButton.textContent = "Rolling...";
    Promise.all([rollRandomRarity(), loadPerkCardData()])
      .then(([rarity, perkData]) => {
        const stats = rarity.max > rarity.min ? randomInt(rarity.min, rarity.max) : rarity.min;
        const statSplit = distributeStats(stats);
        const perkOutcome = rollPerk(rarity, perkData.map);

        const fragments = [];
        fragments.push(createResultLine("Rarity", rarity.name, rarity.color));
        fragments.push(createResultLine("Bonus stats", rarity.min === rarity.max ? `${stats}` : `${stats} (rolled within ${rarity.min}-${rarity.max})`));
        fragments.push(createResultLine("Split", `STR ${statSplit.str}, DEX ${statSplit.dex}, CON ${statSplit.con}`));

        if (rarity.perkChance > 0) {
          const chancePercent = `${Math.round(rarity.perkChance * 100)}%`;
          if (perkOutcome) {
            const perkName = perkOutcome.card.querySelector("h3")
              ? perkOutcome.card.querySelector("h3").textContent.trim()
              : "Perk";
            fragments.push(createResultLine("Perk Roll", `Success (${chancePercent}) — ${perkOutcome.tier} ${perkName}`));
          } else {
            fragments.push(createResultLine("Perk Roll", `Failed (${chancePercent})`));
          }
        } else {
          fragments.push(createResultLine("Perk Roll", "Not eligible"));
        }

        resultContainer.innerHTML = "";
        fragments.forEach((fragment) => resultContainer.appendChild(fragment));
      })
      .catch((error) => {
        console.error("Rarity roll failed", error);
        resultContainer.textContent = "Unable to roll rarity.";
      })
      .finally(() => {
        rollButton.disabled = false;
        rollButton.textContent = "Roll Random Rarity";
      });
  });
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
