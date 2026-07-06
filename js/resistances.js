(() => {
  const RESISTANCE_CAP = 60;
  const RESISTANCES_SCHEMA_VERSION = 1;
  const MONSTERS_SCHEMA_VERSION = 3;
  const MONSTER_TYPE_ORDER = Object.freeze([
    "humanoid",
    "giant",
    "animal",
    "beast",
    "undead",
    "demon",
    "fire beast",
    "ice beast",
    "electric beast",
    "poison beast",
    "disease beast",
  ]);
  const TYPE_ALIASES = Object.freeze({
    electricalbeast: "electric beast",
    "electrical beast": "electric beast",
    firebeast: "fire beast",
    human: "humanoid",
    humanoid: "humanoid",
    icebeast: "ice beast",
    poisonbeast: "poison beast",
    diseasebeast: "disease beast",
  });
  const STATE_ORDER = Object.freeze([
    { key: "weakness", label: "Weak To" },
    { key: "neutral", label: "Neutral" },
    { key: "resistance", label: "Resistant To" },
  ]);

  const utils = window.RogueCodexUtils || {};
  const fetchJsonCached =
    utils.fetchJsonCached ||
    ((targetUrl) =>
      fetch(targetUrl)
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null));
  const titleCaseWords =
    utils.titleCaseWords ||
    ((value) =>
      String(value || "")
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()));
  const buildMonsterDetailUrl =
    typeof utils.buildMonsterDetailUrl === "function"
      ? utils.buildMonsterDetailUrl
      : (monster) => {
          const raw = monster && typeof monster === "object" ? monster.name || monster.id : monster;
          const slug = String(raw || "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
          return slug ? `pages/enemies/monsters.html?monster=${encodeURIComponent(slug)}` : "pages/enemies/monsters.html";
        };

  let showNeutral = false;

  function getVersionedUrl(path, schemaVersion) {
    try {
      const resolved = new URL(path, document.baseURI || window.location.href);
      if (resolved.protocol === "http:" || resolved.protocol === "https:") {
        resolved.searchParams.set("v", String(schemaVersion));
      }
      return resolved.toString();
    } catch (error) {
      return path;
    }
  }

  function formatNumber(value) {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded)
      ? rounded.toLocaleString()
      : rounded.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }

  function formatPercent(value) {
    return `${value.toFixed(1)}%`;
  }

  function formatMultiplier(value) {
    const rounded = Math.round(value * 100) / 100;
    const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
    return `${text}x`;
  }

  function readNumericValue(root, selector) {
    const input = root.querySelector(selector);
    return Number(input?.value) || 0;
  }

  function setText(root, selector, value) {
    const element = root.querySelector(selector);
    if (element) element.textContent = value;
  }

  function calculateResistanceDamage(rawResistance, incomingDamage) {
    const effectiveResistance = Math.min(Math.max(rawResistance, 0), RESISTANCE_CAP);
    const finalDamage = incomingDamage * (1 - effectiveResistance / 100);
    return {
      effectiveResistance,
      finalDamage,
      reducedDamage: incomingDamage - finalDamage,
      overCap: Math.max(0, rawResistance - RESISTANCE_CAP),
      toCap: Math.max(0, RESISTANCE_CAP - rawResistance),
    };
  }

  function updateResistanceCalculator(root = document) {
    const resistance = readNumericValue(root, "[data-resistance-value-slider]");
    const incomingDamage = readNumericValue(root, "[data-resistance-incoming-slider]");
    const result = calculateResistanceDamage(resistance, incomingDamage);

    setText(root, "[data-resistance-value]", String(resistance));
    setText(root, "[data-resistance-incoming]", formatNumber(incomingDamage));
    setText(root, "[data-resistance-effective]", formatPercent(result.effectiveResistance));
    setText(
      root,
      "[data-resistance-final-damage]",
      `${formatNumber(result.finalDamage)} / ${formatNumber(incomingDamage)}`
    );
    setText(root, "[data-resistance-reduced-damage]", formatNumber(result.reducedDamage));
    setText(root, "[data-resistance-cap-warning]", formatCapStatus(result));
  }

  function formatCapStatus(result) {
    if (result.overCap > 0) {
      return `Capped at ${RESISTANCE_CAP}%; ${formatNumber(result.overCap)}% over cap ignored.`;
    }
    if (result.toCap === 0) {
      return `Exactly at the ${RESISTANCE_CAP}% cap.`;
    }
    return `${formatNumber(result.toCap)}% before the ${RESISTANCE_CAP}% cap.`;
  }

  function initResistanceCalculator(root = document) {
    const widget = root.querySelector(".resistance-calculator-widget");
    if (!widget) return;
    widget.querySelectorAll("[data-resistance-value-slider], [data-resistance-incoming-slider]").forEach((input) => {
      input.addEventListener("input", () => updateResistanceCalculator(root));
    });
    updateResistanceCalculator(root);
  }

  function normalizeType(value) {
    if (!value) return "";
    const spaced = String(value)
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_]+/g, " ")
      .trim()
      .toLowerCase();
    return TYPE_ALIASES[spaced] || spaced;
  }

  function getResistanceState(value) {
    if (value > 1) return "weakness";
    if (value < 1) return "resistance";
    return "neutral";
  }

  function getElementClass(element) {
    return String(element || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
  }

  function renderMonsterTypeResistances(data, root = document) {
    const grid = root.querySelector("[data-resistance-type-grid]");
    if (!grid) return;

    const typeResistances = data && typeof data === "object" ? data.typeResistances : null;
    if (!typeResistances || typeof typeResistances !== "object") {
      grid.innerHTML = '<p class="resistance-empty">Monster resistance data unavailable.</p>';
      return;
    }

    const orderedTypes = [
      ...MONSTER_TYPE_ORDER.filter((type) => Array.isArray(typeResistances[type])),
      ...Object.keys(typeResistances)
        .filter((type) => !MONSTER_TYPE_ORDER.includes(type))
        .sort(),
    ];

    grid.textContent = "";
    orderedTypes.forEach((typeKey) => {
      const entries = Array.isArray(typeResistances[typeKey]) ? typeResistances[typeKey] : [];
      grid.appendChild(createTypeCard(typeKey, entries));
    });
    updateNeutralVisibility(root);
  }

  function createTypeCard(typeKey, entries) {
    const card = document.createElement("section");
    card.className = "resistance-type-card";
    card.setAttribute("data-resistance-type-card", typeKey);

    const heading = document.createElement("h3");
    heading.textContent = titleCaseWords(typeKey);

    const icons = document.createElement("div");
    icons.className = "resistance-example-icons";
    icons.setAttribute("data-resistance-examples", typeKey);
    icons.appendChild(Object.assign(document.createElement("span"), { textContent: "..." }));

    card.append(heading, icons);
    STATE_ORDER.forEach((group) => {
      const groupEntries = entries.filter((entry) => getResistanceState(Number(entry.value)) === group.key);
      if (!groupEntries.length) return;
      card.appendChild(createResistanceGroup(group, groupEntries));
    });
    return card;
  }

  function createResistanceGroup(group, entries) {
    const section = document.createElement("div");
    section.className = "resistance-group";
    section.setAttribute("data-resistance-group", group.key);

    const title = document.createElement("div");
    title.className = "resistance-group-title";
    title.textContent = group.label;

    const list = document.createElement("ul");
    list.className = "resistance-list";

    entries.forEach((entry) => {
      const value = Number(entry.value);
      const state = getResistanceState(value);
      const elementKey = getElementClass(entry.element);
      const row = document.createElement("li");
      row.className = `resistance-row resistance-row-${state}`;
      row.setAttribute("data-resistance-state", state);
      row.setAttribute("data-resistance-value", String(value));

      const element = document.createElement("span");
      element.className = `resistance-element resistance-element-${elementKey}`;
      element.textContent = entry.element || "Unknown";

      const multiplier = document.createElement("strong");
      multiplier.textContent = formatMultiplier(value);

      row.append(element, multiplier);
      list.appendChild(row);
    });

    section.append(title, list);
    return section;
  }

  function updateNeutralVisibility(root = document) {
    root.querySelectorAll('[data-resistance-group="neutral"]').forEach((group) => {
      group.hidden = !showNeutral;
    });

    const toggle = root.querySelector("[data-neutral-toggle]");
    if (!toggle) return;
    toggle.setAttribute("aria-pressed", String(showNeutral));
    toggle.setAttribute("data-show-neutral", String(showNeutral));
    toggle.textContent = showNeutral ? "Hide Neutral Matchups" : "Show Neutral Matchups";
  }

  function initNeutralToggle(root = document) {
    const toggle = root.querySelector("[data-neutral-toggle]");
    if (!toggle) return;
    toggle.addEventListener("click", () => {
      showNeutral = !showNeutral;
      updateNeutralVisibility(root);
    });
    updateNeutralVisibility(root);
  }

  function hydrateMonsterExamples(monsters, root = document) {
    if (!Array.isArray(monsters)) return;
    const byType = monsters.reduce((acc, monster) => {
      const fields = monster && typeof monster.fields === "object" && monster.fields ? monster.fields : {};
      const rawType = monster?.monsterType || monster?.type || fields.type_label || fields.type || "";
      const key = normalizeType(rawType);
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push(monster);
      return acc;
    }, {});

    root.querySelectorAll("[data-resistance-examples]").forEach((container) => {
      const typeKey = normalizeType(container.getAttribute("data-resistance-examples"));
      const picks = (byType[typeKey] || []).slice(0, 3);
      container.textContent = "";
      if (!picks.length) {
        container.appendChild(Object.assign(document.createElement("span"), { textContent: "-" }));
        return;
      }
      picks.forEach((monster) => container.appendChild(createMonsterExampleLink(monster)));
    });
  }

  function createMonsterExampleLink(monster) {
    const link = document.createElement("a");
    const name = monster?.name || "Monster";
    link.href = buildMonsterDetailUrl(monster);
    link.title = name;

    const image = document.createElement("img");
    image.alt = `${name} example`;
    setImageSource(image, monster, () => {
      link.textContent = name.slice(0, 2).toUpperCase();
    });
    link.appendChild(image);
    return link;
  }

  function setImageSource(image, monster, onFail) {
    const sources = deriveImageCandidates(monster);
    if (!sources.length) {
      onFail();
      return;
    }
    let index = 0;
    const trySet = () => {
      image.onerror = () => {
        index += 1;
        if (index < sources.length) {
          trySet();
          return;
        }
        image.onerror = null;
        onFail();
      };
      image.onload = () => {
        image.onload = null;
      };
      image.src = sources[index];
    };
    trySet();
  }

  function deriveImageCandidates(monster) {
    const candidates = [];
    const rawName = (monster?.name || "").replace(/\s+/g, " ").trim();
    const safeName = rawName.replace(/[\\/:*?"<>|]/g, "");
    if (monster?.image) candidates.push(monster.image);
    if (safeName) {
      const encoded = encodeURI(`images/monsters/${safeName}`);
      candidates.push(`${encoded}.gif`, `${encoded}.GIF`, `${encoded}.png`, `${encoded}.PNG`);
    }
    return Array.from(new Set(candidates.filter(Boolean)));
  }

  function initMonsterTypeResistances(root = document) {
    const resistancesUrl = getVersionedUrl("pages/systems/resistances.json", RESISTANCES_SCHEMA_VERSION);
    const monstersUrl = getVersionedUrl("pages/enemies/monsters_data03.json", MONSTERS_SCHEMA_VERSION);

    Promise.all([
      fetchJsonCached(resistancesUrl, { cacheKey: `resistances-v${RESISTANCES_SCHEMA_VERSION}` }),
      fetchJsonCached(monstersUrl, { cacheKey: `monsters-data-v${MONSTERS_SCHEMA_VERSION}` }),
    ]).then(([resistanceData, monsterData]) => {
      renderMonsterTypeResistances(resistanceData, root);
      hydrateMonsterExamples(monsterData, root);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initResistanceCalculator();
    initNeutralToggle();
    initMonsterTypeResistances();
  });
})();
