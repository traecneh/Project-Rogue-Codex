(() => {
  const PAGE = {
    title: "Weapons",
    dataFile: "weapons_data05.json",
  };

  const WEAPONS_SCHEMA_VERSION = 5;
  const dataUrl = (() => {
    const resolved = new URL(PAGE.dataFile, window.location.href);
    if (resolved.protocol === "http:" || resolved.protocol === "https:") {
      resolved.searchParams.set("v", String(WEAPONS_SCHEMA_VERSION));
    }
    return resolved;
  })();
  const searchInput = document.getElementById("item-search");
  const typeFilter = document.getElementById("filter-type");
  const elementFilter = document.getElementById("filter-element");
  const attackSpeedFilter = document.getElementById("filter-attack-speed");
  const tableHeadRow = document.getElementById("items-head-row");
  const tableBody = document.getElementById("items-body");
  const countLabel = document.getElementById("item-count");
  const details = document.getElementById("item-details");
  const closeBtn = document.getElementById("details-close");

  const detailFields = {
    name: document.getElementById("details-name"),
    image: document.getElementById("details-image"),
    imageFallback: document.getElementById("details-image-fallback"),
    properties: document.getElementById("details-properties"),
  };

  const utils = window.RogueCodexUtils || {};
  const itemUtils = window.RogueCodexItemPageUtils || {};
  const fetchJsonCached =
    utils.fetchJsonCached ||
    ((targetUrl) =>
      fetch(targetUrl)
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null));
  const normalizeFilterValue =
    utils.normalizeFilterValue || ((value) => (value || "").toString().trim().toLowerCase());
  const ELEMENT_COLORS = utils.ELEMENT_COLORS || {};
  const getElementColor =
    utils.getElementColor || ((value) => ELEMENT_COLORS[normalizeFilterValue(value)] || "");
  const createElementBadge =
    utils.createElementBadge ||
    ((value) => {
      const span = document.createElement("span");
      span.textContent = formatValue(value);
      const color = getElementColor(value);
      if (color) span.style.color = color;
      return span;
    });
  const createPerkBadge =
    utils.createPerkBadge ||
    ((value) => {
      const span = document.createElement("span");
      span.textContent = formatValue(value);
      return span;
    });
  const getPerkTierColor = utils.getPerkTierColor || (() => "");

  const RESISTANCE_LABELS = {
    fire: "Fire Resistance",
    cold: "Cold Resistance",
    electric: "Electric Resistance",
    acid: "Acid Resistance",
    poison: "Poison Resistance",
    disease: "Disease Resistance",
    holy: "Holy Resistance",
    dark: "Dark Resistance",
  };

  const STAT_LABELS = {
    strength: "Strength",
    dexterity: "Dexterity",
    constitution: "Constitution",
  };

  const RARITY_MULTIPLIERS = [
    { key: "normal", label: "Normal", multiplier: 1 },
    { key: "uncommon", label: "Uncommon", multiplier: 2 },
    { key: "rare", label: "Rare", multiplier: 4 },
    { key: "epic", label: "Epic", multiplier: 6 },
    { key: "legendary", label: "Legendary", multiplier: 8 },
    { key: "mythical", label: "Mythical", multiplier: 10 },
    { key: "ascendant", label: "Ascendant", multiplier: 12 },
  ];
  const RARITY_KEY_INDEX = new Map(
    RARITY_MULTIPLIERS.map((rarity, index) => [rarity.key, index])
  );

  const getMaxRarityIndex = (maxRarity) => {
    if (maxRarity === null || maxRarity === undefined || maxRarity === "") return null;
    const numeric = Number(maxRarity);
    if (Number.isFinite(numeric)) {
      if (numeric < 0) return null;
      return Math.min(Math.floor(numeric), RARITY_MULTIPLIERS.length - 1);
    }
    let label = normalizeFilterValue(maxRarity);
    if (!label) return null;
    if (label.includes("regular")) {
      const parts = label.split("-").map((part) => part.trim());
      label = parts.length > 1 ? parts[1] : label.replace("regular", "").trim();
    }
    const labelNumber = Number(label);
    if (Number.isFinite(labelNumber)) {
      if (labelNumber < 0) return null;
      return Math.min(Math.floor(labelNumber), RARITY_MULTIPLIERS.length - 1);
    }
    if (label === "common") label = "normal";
    return RARITY_KEY_INDEX.has(label) ? RARITY_KEY_INDEX.get(label) : null;
  };

  const RESISTANCES_SCHEMA_VERSION = 2;
  const MONSTER_TYPE_ORDER = [
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
  ];
  let typeResistances = {};
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

  const PERKS_SCHEMA_VERSION = 3;
  let perkIndexByName = new Map();
  const perksUrl = (() => {
    try {
      const resolved = new URL("../systems/perks.json", window.location.href);
      if (resolved.protocol === "http:" || resolved.protocol === "https:") {
        resolved.searchParams.set("v", String(PERKS_SCHEMA_VERSION));
      }
      return resolved.toString();
    } catch (error) {
      return "../systems/perks.json";
    }
  })();

  const MONSTERS_SCHEMA_VERSION = 3;
  const monstersUrl = (() => {
    try {
      const resolved = new URL("../enemies/monsters_data03.json", window.location.href);
      if (resolved.protocol === "http:" || resolved.protocol === "https:") {
        resolved.searchParams.set("v", String(MONSTERS_SCHEMA_VERSION));
      }
      return resolved.toString();
    } catch (error) {
      return "../enemies/monsters_data03.json";
    }
  })();

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
  const buildMonsterDetailUrl =
    typeof utils.buildMonsterDetailUrl === "function"
      ? (monster) => utils.buildMonsterDetailUrl(monster)
      : (monster) => {
          const slug = normalizeMonsterId(monster);
          return slug
            ? `pages/enemies/monsters.html?monster=${encodeURIComponent(slug)}`
            : "pages/enemies/monsters.html";
        };
  let hiddenWeaponNames = new Set();
  let allowedMonsterNames = new Set();
  let dropSources =
    typeof utils.createEmptyDropSources === "function"
      ? utils.createEmptyDropSources()
      : { armors: {}, weapons: {}, reverse: { armors: {}, weapons: {} } };

  const applyAllowlists = (allowlists) => {
    hiddenWeaponNames = buildNameSet(allowlists?.weapons?.block);
    allowedMonsterNames = buildNameSet(allowlists?.monsters?.allow);
  };

  const isMonsterAllowed = (monster) => {
    if (!allowedMonsterNames.size) return true;
    return allowedMonsterNames.has((monster.name || "").toLowerCase());
  };

  const COLUMNS = [
    { key: "image", label: "Image", render: (_, item) => createImageThumb(item), sortable: false },
    { key: "name", label: "Name" },
    { key: "type", label: "Type" },
    { key: "level", label: "Level", format: (value) => formatNumber(value) },
    { key: "dps", label: "DPS", render: (_, item) => createDpsBreakdownPill(item) },
    { key: "attackSpeed", label: "Speed", render: (value) => createTableSpeedPill(value), className: "speed-column" },
    { key: "perk", label: "Perk", render: (value) => createPerkLinkBadge(value) },
    { key: "element", label: "Element", render: (value) => createElementBadge(value) },
  ];

  let items = [];
  let monsters = [];
  let selectedTypes = new Set();
  let selectedElements = new Set();
  let selectedAttackSpeeds = new Set();
  let sortKey = "dps";
  let sortDir = "desc";
  let searchTerm = "";
  const urlParams = new URLSearchParams(window.location.search);
  const normalizeWeaponId = itemUtils.normalizeItemId;
  const normalizeMonsterId = itemUtils.normalizeItemId;
  const rawWeaponQuery = (urlParams.get("weapon") || urlParams.get("weaponName") || "").trim();
  const initialWeaponId = normalizeWeaponId(rawWeaponQuery);
  const initialWeaponSearchTerm = rawWeaponQuery.replace(/-/g, " ").trim();
  let pendingWeaponId = initialWeaponId;
  let pendingWeaponName = rawWeaponQuery.toLowerCase();

  const renderEmpty = (message) => {
    if (!tableHeadRow.children.length) {
      buildHead();
    }
    tableBody.innerHTML = `<tr><td class="table-empty" colspan="${COLUMNS.length || 1}">${message}</td></tr>`;
    if (countLabel) {
      countLabel.textContent = "0 results";
    }
  };

  const normalizeSortValue = itemUtils.normalizeSortValue;
  const formatValue = (value) => itemUtils.formatValue(value, { emptyStringAsDash: true });
  const formatNumber = itemUtils.formatNumber;
  const formatRange = itemUtils.formatRange;

  const ELEMENT_KEYS_WITH_MULTIPLIERS = new Set([
    "fire",
    "cold",
    "electric",
    "poison",
    "disease",
    "acid",
    "holy",
    "dark",
  ]);

  const formatMonsterTypeLabel = (value) => {
    if (!value) return "-";
    return String(value)
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatMultiplierValue = (value) => {
    if (typeof value !== "number" || Number.isNaN(value)) return "-";
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

  const getMultiplierColor = (value) => {
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

  const extractPerkBaseName = (value) => {
    const raw = (value || "").toString().trim();
    if (!raw || raw === "-" || raw.toLowerCase() === "none") return "";
    return raw
      .replace(/\s*\(\s*tier\s*\d+\s*\)\s*$/i, "")
      .replace(/\s*\(\s*t\s*\d+\s*\)\s*$/i, "")
      .replace(/\s*tier\s*\d+\s*$/i, "")
      .replace(/\s*t\s*\d+\s*$/i, "")
      .trim();
  };

  const isPerkValueSet = (value) => {
    const text = (value ?? "").toString().trim();
    if (!text || text === "-" || text.toLowerCase() === "none") return false;
    return true;
  };

  const buildPerkDetailUrl = (baseName) => {
    if (!baseName) return "pages/systems/perks.html";
    try {
      const resolved = new URL(window.location.href);
      resolved.pathname = "/pages/systems/perks.html";
      resolved.search = "";
      resolved.hash = "";
      resolved.searchParams.set("perk", baseName);
      return `${resolved.pathname.replace(/^\/+/, "")}${resolved.search}`;
    } catch (error) {
      return `pages/systems/perks.html?perk=${encodeURIComponent(baseName)}`;
    }
  };

  const stopPerkLinkClickPropagation = (event) => {
    event.stopPropagation();
  };

  const createPerkLinkBadge = (value) => {
    const baseName = extractPerkBaseName(value);
    if (!baseName) return createPerkBadge(value);

    const link = document.createElement("a");
    link.className = "perk-link perk-table-link";
    link.href = buildPerkDetailUrl(baseName);
    link.setAttribute("aria-label", `View ${baseName} perk details`);
    link.addEventListener("click", stopPerkLinkClickPropagation);

    const badge = createPerkBadge(value);
    if (badge instanceof Node) {
      link.appendChild(badge);
    } else {
      link.textContent = formatValue(value);
    }
    return link;
  };

  const createPerkDetailPill = (value) => {
    const labelText = formatValue(value);
    const baseName = extractPerkBaseName(value);
    if (!labelText || labelText === "-" || !baseName) {
      return createPerkBadge(value);
    }

    const pill = document.createElement("a");
    pill.className = "detail-pill perk-link";
    pill.href = buildPerkDetailUrl(baseName);
    pill.setAttribute("aria-label", `View ${labelText} perk details`);
    pill.addEventListener("click", stopPerkLinkClickPropagation);

    const labelSpan = document.createElement("span");
    labelSpan.textContent = labelText;
    const color = getPerkTierColor(value);
    if (color) labelSpan.style.color = color;
    pill.appendChild(labelSpan);

    const tooltip = document.createElement("span");
    tooltip.className = "detail-tooltip perk-tooltip";
    tooltip.role = "tooltip";

    const entry = perkIndexByName.get(baseName.toLowerCase());
    const detailsLines = Array.isArray(entry?.details)
      ? entry.details.map((line) => String(line || "").trim()).filter(Boolean)
      : [];

    const title = document.createElement("div");
    title.className = "perk-tooltip-title";
    title.textContent = labelText;
    tooltip.appendChild(title);

    if (detailsLines.length) {
      const divider = document.createElement("div");
      divider.className = "detail-tooltip-divider";
      tooltip.appendChild(divider);

      detailsLines.forEach((line) => {
        const div = document.createElement("div");
        div.className = "perk-tooltip-line";
        div.textContent = line;
        tooltip.appendChild(div);
      });
    } else {
      const line = document.createElement("div");
      line.className = "perk-tooltip-line";
      line.textContent = "Perk info unavailable.";
      tooltip.appendChild(line);
    }

    pill.appendChild(tooltip);
    return pill;
  };

  const createWeaponSpeedPill = (value) => {
    const speed = Number(value);
    const labelText = formatNumber(value);
    if (!Number.isFinite(speed) || speed <= 0) return labelText;

    const pill = document.createElement("span");
    pill.className = "detail-pill weapon-speed-pill";
    pill.tabIndex = 0;
    pill.setAttribute("aria-label", `${labelText} millisecond base weapon speed`);

    const labelSpan = document.createElement("span");
    labelSpan.textContent = `${labelText} ms`;
    pill.appendChild(labelSpan);

    const tooltip = document.createElement("span");
    tooltip.className = "detail-tooltip weapon-speed-tooltip";
    tooltip.role = "tooltip";

    const title = document.createElement("div");
    title.className = "perk-tooltip-title";
    title.textContent = "Base weapon speed";
    tooltip.appendChild(title);

    const divider = document.createElement("div");
    divider.className = "detail-tooltip-divider";
    tooltip.appendChild(divider);

    const attacksLine = document.createElement("div");
    attacksLine.className = "perk-tooltip-line";
    attacksLine.textContent = `${(1000 / speed).toFixed(2)} attacks/sec`;
    tooltip.appendChild(attacksLine);

    const contextLine = document.createElement("div");
    contextLine.className = "perk-tooltip-line";
    contextLine.textContent = "Used for DPS and Perks weapon-speed context.";
    tooltip.appendChild(contextLine);

    pill.appendChild(tooltip);
    return pill;
  };

  const formatSpeedLabel = (value) => {
    const speed = Number(value);
    if (!Number.isFinite(speed) || speed <= 0) return formatNumber(value);
    return `${formatNumber(speed)} ms`;
  };

  const appendTooltipRow = (tooltip, labelText, valueText) => {
    const row = document.createElement("div");
    row.className = "detail-tooltip-row";
    const label = document.createElement("span");
    label.className = "detail-tooltip-label";
    label.textContent = labelText;
    const value = document.createElement("span");
    value.textContent = valueText;
    row.appendChild(label);
    row.appendChild(value);
    tooltip.appendChild(row);
  };

  const createTableSpeedPill = (value) => {
    const span = document.createElement("span");
    span.className = "table-metric-pill table-speed-pill";
    span.textContent = formatSpeedLabel(value);
    return span;
  };

  const createDpsBreakdownPill = (item) => {
    const dps = Number(item?.dps);
    const dpsLabel = formatNumber(item?.dps, { maximumFractionDigits: 2 });
    if (!Number.isFinite(dps)) return dpsLabel;

    const min = Number(item?.minDamage);
    const max = Number(item?.maxDamage);
    const speed = Number(item?.attackSpeed);
    const hasDamageRange = Number.isFinite(min) && Number.isFinite(max);
    const hasSpeed = Number.isFinite(speed) && speed > 0;

    const pill = document.createElement("span");
    pill.className = "detail-pill table-metric-pill dps-breakdown-pill";
    pill.tabIndex = 0;
    pill.setAttribute("aria-label", `${dpsLabel} DPS breakdown`);

    const label = document.createElement("span");
    label.textContent = dpsLabel;
    pill.appendChild(label);

    const tooltip = document.createElement("span");
    tooltip.className = "detail-tooltip dps-breakdown-tooltip";
    tooltip.role = "tooltip";

    const title = document.createElement("div");
    title.className = "perk-tooltip-title";
    title.textContent = "DPS Breakdown";
    tooltip.appendChild(title);

    const divider = document.createElement("div");
    divider.className = "detail-tooltip-divider";
    tooltip.appendChild(divider);

    appendTooltipRow(tooltip, "Damage Range", hasDamageRange ? formatRange(min, max) : "-");
    appendTooltipRow(
      tooltip,
      "Average Hit",
      hasDamageRange ? formatNumber((min + max) / 2, { maximumFractionDigits: 2 }) : "-"
    );
    appendTooltipRow(tooltip, "Weapon Speed", hasSpeed ? formatSpeedLabel(speed) : "-");
    appendTooltipRow(tooltip, "Attacks/Sec", hasSpeed ? `${(1000 / speed).toFixed(2)} attacks/sec` : "-");

    pill.appendChild(tooltip);
    return pill;
  };

  const getElementMultiplierForType = (monsterTypeKey, elementKey) => {
    const list = typeResistances && typeof typeResistances === "object" ? typeResistances[monsterTypeKey] : null;
    if (!Array.isArray(list) || !list.length) return 1;
    const match = list.find((entry) => normalizeFilterValue(entry?.element) === elementKey);
    return typeof match?.value === "number" ? match.value : 1;
  };

  const createElementEffectivenessPill = (value) => {
    const labelText = formatValue(value);
    const elementKey = normalizeFilterValue(value);
    if (!labelText || labelText === "-" || elementKey === "none" || elementKey === "magic") {
      return createElementBadge(value);
    }
    if (!ELEMENT_KEYS_WITH_MULTIPLIERS.has(elementKey)) {
      return createElementBadge(value);
    }

    const pill = document.createElement("span");
    pill.className = "detail-pill";
    pill.tabIndex = 0;
    pill.setAttribute("aria-label", `${labelText} effectiveness by monster type`);

    const labelSpan = document.createElement("span");
    labelSpan.textContent = labelText;
    const color = getElementColor(value);
    if (color) labelSpan.style.color = color;
    pill.appendChild(labelSpan);

    const tooltip = document.createElement("span");
    tooltip.className = "detail-tooltip";
    tooltip.role = "tooltip";

    const hasData =
      typeResistances && typeof typeResistances === "object" && Object.keys(typeResistances).length > 0;
    if (!hasData) {
      tooltip.textContent = "No modifier data";
    } else {
      const headerRow = document.createElement("div");
      headerRow.className = "detail-tooltip-row";
      const headerLeft = document.createElement("span");
      headerLeft.className = "detail-tooltip-label";
      headerLeft.textContent = "Monster Type";
      const headerRight = document.createElement("span");
      headerRight.className = "detail-tooltip-label";
      headerRight.textContent = "Damage";
      headerRow.appendChild(headerLeft);
      headerRow.appendChild(headerRight);
      tooltip.appendChild(headerRow);

      const divider = document.createElement("div");
      divider.className = "detail-tooltip-divider";
      tooltip.appendChild(divider);

      const rows = MONSTER_TYPE_ORDER.map((monsterTypeKey, idx) => ({
        monsterTypeKey,
        multiplier: getElementMultiplierForType(monsterTypeKey, elementKey),
        idx,
      })).sort((a, b) => {
        if (b.multiplier !== a.multiplier) return b.multiplier - a.multiplier;
        return a.idx - b.idx;
      });

      const firstNeutral = rows.findIndex((row) => row.multiplier === 1 || row.multiplier === 1.0);
      const lastNeutral = (() => {
        let idx = -1;
        rows.forEach((row, i) => {
          if (row.multiplier === 1 || row.multiplier === 1.0) idx = i;
        });
        return idx;
      })();

      rows.forEach(({ monsterTypeKey, multiplier }, index) => {
        if (index === firstNeutral && index !== 0) {
          const groupDivider = document.createElement("div");
          groupDivider.className = "detail-tooltip-divider";
          tooltip.appendChild(groupDivider);
        }

        const row = document.createElement("div");
        row.className = "detail-tooltip-row";
        const typeLabel = document.createElement("span");
        typeLabel.className = "detail-tooltip-type";
        typeLabel.textContent = formatMonsterTypeLabel(monsterTypeKey);
        const valueSpan = document.createElement("span");
        valueSpan.textContent = formatMultiplierValue(multiplier);
        if (typeof multiplier === "number") {
          const valColor = getMultiplierColor(multiplier);
          if (valColor) valueSpan.style.color = valColor;
        }
        row.appendChild(typeLabel);
        row.appendChild(valueSpan);
        tooltip.appendChild(row);

        if (index === lastNeutral && index !== rows.length - 1) {
          const groupDivider = document.createElement("div");
          groupDivider.className = "detail-tooltip-divider";
          tooltip.appendChild(groupDivider);
        }
      });
    }

      pill.appendChild(tooltip);
      return pill;
    };

  const createRarityValuePill = (baseValue, labelText, maxRarity) => {
    const numericBase = Number(baseValue);
    const formattedBase = formatNumber(baseValue);
    if (formattedBase === "-" || !Number.isFinite(numericBase)) {
      return formattedBase;
    }

    const pill = document.createElement("span");
    pill.className = "detail-pill";
    pill.tabIndex = 0;
    pill.setAttribute("aria-label", `${labelText} values by rarity`);

    const labelSpan = document.createElement("span");
    labelSpan.textContent = formattedBase;
    pill.appendChild(labelSpan);

    const tooltip = document.createElement("span");
    tooltip.className = "detail-tooltip";
    tooltip.role = "tooltip";

    const headerRow = document.createElement("div");
    headerRow.className = "detail-tooltip-row";
    const headerLeft = document.createElement("span");
    headerLeft.className = "detail-tooltip-label";
    headerLeft.textContent = "Rarity";
    const headerRight = document.createElement("span");
    headerRight.className = "detail-tooltip-label";
    headerRight.textContent = labelText;
    headerRow.appendChild(headerLeft);
    headerRow.appendChild(headerRight);
    tooltip.appendChild(headerRow);

    const divider = document.createElement("div");
    divider.className = "detail-tooltip-divider";
    tooltip.appendChild(divider);

    const maxIndex = getMaxRarityIndex(maxRarity);
    const list =
      maxIndex === null ? RARITY_MULTIPLIERS : RARITY_MULTIPLIERS.slice(0, maxIndex + 1);
    list.forEach((rarity) => {
      const row = document.createElement("div");
      row.className = "detail-tooltip-row";
      const raritySpan = document.createElement("span");
      raritySpan.textContent = rarity.label;
      const valueSpan = document.createElement("span");
      valueSpan.textContent = formatNumber(numericBase * rarity.multiplier);
      row.appendChild(raritySpan);
      row.appendChild(valueSpan);
      tooltip.appendChild(row);
    });

    pill.appendChild(tooltip);
    return pill;
  };

  const createDropsFromPill = (item) =>
    itemUtils.createDropsFromPill({
      buildMonsterDetailUrl,
      dropSources,
      formatMonsterTypeLabel,
      item,
      itemKind: "weapons",
      monsters,
      normalizeFilterValue,
      normalizeMonsterId,
      utils,
    });

  const setOptions = itemUtils.setOptions;
  const enableToggleSelect = itemUtils.enableToggleSelect;
  const weaponImageLoader = itemUtils.createImageLoader("weapons", ["weapons"]);
  const ensureImage = weaponImageLoader.ensureImage || itemUtils.ensureImage;
  const createCell = itemUtils.createCell;

  const createPill = (items) => {
    const pill = document.createElement("span");
    pill.className = "flag-pill";
    pill.textContent = items.length ? items.join(", ") : "None";
    return pill;
  };

  const createImageThumb = (item) => {
    const wrapper = document.createElement("div");
    wrapper.style.display = "inline-flex";
    wrapper.style.alignItems = "center";
    const img = document.createElement("img");
    img.className = "item-thumb";
    img.alt = `${item.name || "Item"} image`;
    const fallback = document.createElement("span");
    fallback.className = "no-image";
    fallback.textContent = "No Image";
    ensureImage(img, fallback, item);
    wrapper.appendChild(img);
    wrapper.appendChild(fallback);
    return wrapper;
  };

  const populateFilters = (data) => {
    const typeOptions = new Map();
    const elementOptions = new Set();
    const attackSpeedOptions = new Map();

    data.forEach((w) => {
      const typeValue = normalizeFilterValue(w.type);
      if (typeValue) {
        if (!typeOptions.has(typeValue)) {
          typeOptions.set(typeValue, String(w.type));
        }
      }
      const elementValue = normalizeFilterValue(w.element);
      if (elementValue && elementValue !== "none" && elementValue !== "magic") {
        elementOptions.add(String(w.element));
      }
      if (w.attackSpeed !== null && w.attackSpeed !== undefined && w.attackSpeed !== "") {
        const speedValue = normalizeFilterValue(w.attackSpeed);
        if (speedValue && !attackSpeedOptions.has(speedValue)) {
          attackSpeedOptions.set(speedValue, w.attackSpeed);
        }
      }
    });

    const typeList = Array.from(typeOptions.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }));
    const elementList = Array.from(elementOptions)
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ value: normalizeFilterValue(value), label: value }));
    const attackSpeedList = Array.from(attackSpeedOptions.entries())
      .sort((a, b) => {
        const aNum = Number(a[1]);
        const bNum = Number(b[1]);
        if (Number.isNaN(aNum) && Number.isNaN(bNum)) {
          return String(a[1]).localeCompare(String(b[1]));
        }
        if (Number.isNaN(aNum)) return 1;
        if (Number.isNaN(bNum)) return -1;
        return aNum - bNum;
      })
      .map(([value, label]) => ({ value, label: `${formatNumber(label)} ms` }));

    setOptions(typeFilter, typeList);
    setOptions(elementFilter, elementList);
    setOptions(attackSpeedFilter, attackSpeedList);
    if (elementFilter) {
      Array.from(elementFilter.options).forEach((opt) => {
        const color = getElementColor(opt.value);
        if (color) {
          opt.style.color = color;
        }
      });
    }
  };

  const computeDps = (minDamage, maxDamage, attackSpeed) => {
    const min = Number(minDamage);
    const max = Number(maxDamage);
    const speed = Number(attackSpeed);
    if (Number.isNaN(min) || Number.isNaN(max) || Number.isNaN(speed) || speed === 0) return null;
    const avgDamage = (min + max) / 2;
    return Number((avgDamage * (1000 / speed)).toFixed(2));
  };

  const buildRarity = (fields) => {
    const max = fields.max_rarity_label || fields.max_rarity;
    const maxLabel = max === null || max === undefined || max === "" ? "-" : max;
    return `Regular - ${maxLabel}`;
  };

  const normalizeWeapon = (raw) => {
    const fields = (raw && typeof raw.fields === "object" && raw.fields) || {};
    const value = fields.value;
    const sellValue =
      value === null || value === undefined || value === ""
        ? null
        : Number.isNaN(Number(value))
          ? null
          : Number(value) / 2;

    return {
      id: raw && (raw.id ?? raw.ID) ? raw.id ?? raw.ID : normalizeWeaponId(raw && (raw.name || raw.Name)),
      name: (raw && (raw.name || raw.Name)) || "Unknown",
      image: raw && (raw.image || raw.icon || raw.thumbnail) ? raw.image || raw.icon || raw.thumbnail : "",
      level: fields.level_requirement,
      minDamage: fields.min_damage,
      maxDamage: fields.max_damage,
      attackSpeed: fields.attack_speed,
      dps: computeDps(fields.min_damage, fields.max_damage, fields.attack_speed),
      type: fields.subtype_label || fields.subtype,
      perk: fields.perk ? fields.perk_label || fields.perk : "None",
      corruptedPerk: fields.corrupted_perk ? fields.corrupted_perk_label || fields.corrupted_perk : "None",
      element: fields.element_label || (fields.element ? fields.element : "None"),
      procChance: fields.proc_chance,
      skillRequirement: fields.skill_requirement,
      weight: fields.weight,
      specialty: fields.specialty ? fields.specialty_label || fields.specialty : "None",
      specialtyAmount: fields.specialty_amount,
      rarity: buildRarity(fields),
      maxRarityLabel: fields.max_rarity_label || fields.max_rarity,
      toHit: fields.to_hit,
      value,
      sellValue,
      shardDecompositionAmount: fields.shard_decomposition_amount,
      shardPromotionAmount: fields.shard_promotion_amount,
      resistances: {
        fire: fields.fire_resistance,
        cold: fields.cold_resistance,
        electric: fields.electric_resistance,
        acid: fields.acid_resistance,
        poison: fields.poison_resistance,
        disease: fields.disease_resistance,
        holy: fields.holy_resistance,
        dark: fields.dark_resistance,
      },
      stats: {
        strength: fields.strength,
        dexterity: fields.dexterity,
        constitution: fields.constitution,
        },
      };
  };

  const normalizeMonster = (raw) => {
    if (!raw || typeof raw !== "object") return null;
    const fields = (raw && typeof raw.fields === "object" && raw.fields) || {};
    const nameRaw = raw.name || raw.Name || fields.name_label || "Unknown Monster";
    const monsterTypeRaw = fields.type_label || raw.monsterType || raw.type || raw.type_label || "";
    const level = Number(fields.level ?? raw.level ?? raw.Level);
    const idRaw = raw.id ?? raw.monsterId ?? raw.name ?? raw.Name ?? fields.name_label ?? "";
    const id = normalizeMonsterId(idRaw || nameRaw);
    return {
      id,
      name: nameRaw ? String(nameRaw) : "Unknown Monster",
      monsterType: monsterTypeRaw === null || monsterTypeRaw === undefined ? "" : String(monsterTypeRaw),
      level: Number.isFinite(level) ? level : null,
    };
  };

  const normalizeMonsters = (list) => {
    if (!Array.isArray(list)) return [];
    return list
      .map((entry) => normalizeMonster(entry))
      .filter(Boolean)
      .filter((monster) => isMonsterAllowed(monster));
  };

  const getWeaponId = (item) => normalizeWeaponId(item && (item.id || item.name));
  const weaponRouteHelpers = itemUtils.createRouteHelpers({
    fallbackPath: "pages/items/weapons.html",
    getItemId: getWeaponId,
    getItemName: (item) => (item && item.name ? item.name : ""),
    normalizeId: normalizeWeaponId,
    queryKeys: ["weapon", "weaponName"],
    stateKey: "weaponId",
  });
  const updateWeaponDetailUrl = weaponRouteHelpers.updateDetailUrl;
  const updateWeaponListUrl = weaponRouteHelpers.updateListUrl;
  const buildWeaponDetailUrl = weaponRouteHelpers.buildDetailStateUrl;
  const getWeaponRouteFromLocation = weaponRouteHelpers.getRouteFromLocation;
  const findWeaponByRoute = weaponRouteHelpers.findByRoute;
  const getSelectedWeaponFromLocation = (list = items) => weaponRouteHelpers.getSelectedFromLocation(list);

  const selectWeapon = (item, options = {}) => {
    if (!item) return;
    if (options.updateUrl) updateWeaponDetailUrl(item, { replace: options.replaceUrl });
    setDetails(item, { scroll: options.scroll });
  };

  const maybeSelectPendingWeapon = (list) => {
    if (!pendingWeaponId && !pendingWeaponName) return;
    const match =
      findWeaponByRoute(list || items, pendingWeaponId, pendingWeaponName) ||
      findWeaponByRoute(items, pendingWeaponId, pendingWeaponName);
    if (!match) return;
    pendingWeaponId = "";
    pendingWeaponName = "";
    selectWeapon(match, { updateUrl: false });
  };

  const updateSortIndicators = () => {
    document.querySelectorAll(".items-table th[data-sort-key]").forEach((th) => {
      const key = th.getAttribute("data-sort-key");
      const indicator = th.querySelector(".sort-indicator");
      const isActive = key === sortKey;
      const ariaSort = isActive ? (sortDir === "asc" ? "ascending" : "descending") : "none";
      th.setAttribute("aria-sort", ariaSort);
      if (indicator) {
        indicator.textContent = isActive ? (sortDir === "asc" ? "\u25B2" : "\u25BC") : "\u2195";
      }
    });
  };

  const buildHead = () => {
    tableHeadRow.innerHTML = "";
    COLUMNS.forEach((col) => {
      const th = document.createElement("th");
      th.setAttribute("scope", "col");
      if (col.className) th.className = col.className;

      const labelSpan = document.createElement("span");
      labelSpan.textContent = col.label;
      th.appendChild(labelSpan);

      if (col.sortable !== false) {
        th.dataset.sortKey = col.key;
        const indicator = document.createElement("span");
        indicator.className = "sort-indicator";
        indicator.setAttribute("aria-hidden", "true");
        indicator.textContent = "\u2195";
        th.appendChild(indicator);

        th.addEventListener("click", () => {
          if (sortKey === col.key) {
            sortDir = sortDir === "asc" ? "desc" : "asc";
          } else {
            sortKey = col.key;
            sortDir = "asc";
          }
          applyFilterAndSort();
        });
      } else {
        th.style.cursor = "default";
      }

      tableHeadRow.appendChild(th);
    });
    updateSortIndicators();
  };

  const formatRequirement = (requirement) => {
    if (requirement === null || requirement === undefined || requirement === "") return "None";
    const numeric = Number(requirement);
    if (numeric === 0) return "None";
    return `Skill Level ${formatNumber(requirement)}`;
  };

  const getWeaponDropSourceNames = (item) => {
    const uniqueMonsterIds =
      typeof utils.getDropSourceMonsterIdsByItem === "function"
        ? utils.getDropSourceMonsterIdsByItem(dropSources, "weapons", item.name)
        : [];
    if (!Array.isArray(uniqueMonsterIds) || !uniqueMonsterIds.length) return [];
    const uniqueSet = new Set(uniqueMonsterIds.map((id) => normalizeMonsterId(id)));
    return monsters
      .filter(
        (monster) =>
          uniqueSet.has(normalizeMonsterId(monster.id)) ||
          uniqueSet.has(normalizeMonsterId(monster.name))
      )
      .map((monster) => monster.name || monster.id)
      .filter(Boolean);
  };

  const getWeaponSearchText = (item) => {
    const res = item.resistances || {};
    const stats = item.stats || {};
    return [
      ...COLUMNS.map((col) => formatValue(item[col.key])),
      formatRange(item.minDamage, item.maxDamage),
      formatNumber(item.attackSpeed),
      formatNumber(item.procChance, { maximumFractionDigits: 2 }),
      formatRequirement(item.skillRequirement),
      formatValue(item.specialty),
      formatNumber(item.specialtyAmount),
      formatValue(item.rarity),
      formatValue(item.maxRarityLabel),
      formatNumber(item.weight),
      formatNumber(item.toHit),
      formatNumber(item.shardDecompositionAmount),
      formatNumber(item.shardPromotionAmount),
      formatNumber(item.sellValue, { maximumFractionDigits: 2 }),
      formatNumber(item.value),
      ...Object.values(STAT_LABELS),
      formatNumber(stats.strength ?? 0),
      formatNumber(stats.constitution ?? 0),
      formatNumber(stats.dexterity ?? 0),
      ...Object.values(RESISTANCE_LABELS),
      formatNumber(res.fire ?? 0),
      formatNumber(res.poison ?? 0),
      formatNumber(res.cold ?? 0),
      formatNumber(res.disease ?? 0),
      formatNumber(res.acid ?? 0),
      formatNumber(res.electric ?? 0),
      formatNumber(res.holy ?? 0),
      formatNumber(res.dark ?? 0),
      ...getWeaponDropSourceNames(item),
    ]
      .join(" ")
      .toLowerCase();
  };

  const tooltipPinning = itemUtils.createTooltipPinningController();
  const attachTooltipPinning = tooltipPinning.attachTooltipPinning;
  const unpinPinnedTooltip = tooltipPinning.unpinPinnedTooltip;

  const setDetails = (item, options = {}) => {
    if (!item) return;
    detailFields.name.textContent = item.name || "Unknown";
    ensureImage(detailFields.image, detailFields.imageFallback, item);
    unpinPinnedTooltip();

    const container = detailFields.properties;
    container.innerHTML = "";

    const addDivider = () =>
      container.appendChild(Object.assign(document.createElement("div"), { className: "detail-divider" }));
    const addRow = (entries, cols) => {
      const row = document.createElement("div");
      row.className = `detail-row detail-row-cols-${cols || 2}`;
      entries.forEach(([label, value]) => row.appendChild(createCell(label, value)));
      container.appendChild(row);
    };

    addRow(
      [
        ["Type", formatValue(item.type)],
        ["Level", formatNumber(item.level)],
        ["DPS", formatNumber(item.dps, { maximumFractionDigits: 2 })],
        ["Weight", formatNumber(item.weight)],
        ["To Hit", formatNumber(item.toHit)],
      ],
      5
    );
    addRow(
      [
        ["Element", createElementEffectivenessPill(item.element)],
        [
          "Proc",
          item.procChance === null || item.procChance === undefined || item.procChance === ""
            ? "-"
            : `${formatNumber(item.procChance, { maximumFractionDigits: 2 })}%`,
        ],
        ["Damage", formatRange(item.minDamage, item.maxDamage)],
        ["Weapon Speed", createWeaponSpeedPill(item.attackSpeed)],
      ],
      4
    );

    addDivider();

    addRow(
      [
        ["Strength", formatNumber((item.stats && item.stats.strength) ?? 0)],
        ["Constitution", formatNumber((item.stats && item.stats.constitution) ?? 0)],
        ["Dexterity", formatNumber((item.stats && item.stats.dexterity) ?? 0)],
      ],
      3
    );

    addDivider();

    const res = item.resistances || {};
    const makeResistEntry = (key, labelText, rawValue) => {
      const color = ELEMENT_COLORS[key];
      const labelSpan = document.createElement("span");
      labelSpan.textContent = labelText;
      if (color) labelSpan.style.color = color;
      const valueSpan = document.createElement("span");
      valueSpan.textContent = formatNumber(rawValue ?? 0);
      if (color) valueSpan.style.color = color;
      return [labelSpan, valueSpan];
    };
    addRow(
      [
        makeResistEntry("fire", "Fire", res.fire),
        makeResistEntry("poison", "Poison", res.poison),
        makeResistEntry("cold", "Cold", res.cold),
        makeResistEntry("holy", "Holy", res.holy),
      ],
      4
    );
    addRow(
      [
        makeResistEntry("disease", "Disease", res.disease),
        makeResistEntry("acid", "Acid", res.acid),
        makeResistEntry("electric", "Electric", res.electric),
        makeResistEntry("dark", "Dark", res.dark),
      ],
      4
    );

    addDivider();

    if (isPerkValueSet(item.corruptedPerk)) {
      addRow(
        [
          ["Innate Perk", createPerkDetailPill(item.perk)],
          ["Corrupted Perk", createPerkDetailPill(item.corruptedPerk)],
        ],
        2
      );
    } else {
      addRow([["Innate Perk", createPerkDetailPill(item.perk)]], 1);
    }

    addDivider();

    addRow(
      [
        ["Max Rarity", formatValue(item.maxRarityLabel || item.rarity)],
        [
          "Deconstruction",
          createRarityValuePill(
            item.shardDecompositionAmount,
            "Deconstruction",
            item.maxRarityLabel || item.rarity
          ),
        ],
        [
          "Promotion",
          createRarityValuePill(
            item.shardPromotionAmount,
            "Promotion",
            item.maxRarityLabel || item.rarity
          ),
        ],
      ],
      3
    );

    addDivider();

    addRow([["Requirement", formatRequirement(item.skillRequirement)]], 1);

    addDivider();

    addRow([["Drops From", createDropsFromPill(item)]], 1);

    addDivider();

    addRow(
      [
        ["Sell Value", formatNumber(item.sellValue, { maximumFractionDigits: 2 })],
        ["Buy Value", formatNumber(item.value)],
      ],
      2
    );

    attachTooltipPinning(details);
    details.classList.add("show");
    if (options.scroll !== false) {
      details.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const clearDetails = (options = {}) => {
    details.classList.remove("show");
    unpinPinnedTooltip();
    if (options.updateUrl) updateWeaponListUrl({ replace: options.replaceUrl });
  };

  window.addEventListener("popstate", () => {
    const route = getWeaponRouteFromLocation();
    pendingWeaponId = route.id;
    pendingWeaponName = route.name;
    if (!pendingWeaponId && !pendingWeaponName) {
      clearDetails({ updateUrl: false });
      return;
    }
    if (!items.length) return;
    const selected = getSelectedWeaponFromLocation(items);
    pendingWeaponId = "";
    pendingWeaponName = "";
    if (selected) {
      selectWeapon(selected, { updateUrl: false, scroll: false });
    } else {
      clearDetails({ updateUrl: false });
    }
  });

  const renderTable = (rows) => {
    if (!rows.length) {
      renderEmpty("No weapons match your filters.");
      return;
    }

    const fragment = document.createDocumentFragment();

    rows.forEach((item) => {
      const tr = document.createElement("tr");
      tr.dataset.id = item.id || "";

      COLUMNS.forEach((col) => {
        const td = document.createElement("td");
        if (col.className) td.className = col.className;
        const value = item[col.key];
        if (col.key === "name") {
          const nameLink = document.createElement("a");
          nameLink.href = buildWeaponDetailUrl(item);
          nameLink.className = "weapon-link";
          nameLink.textContent = formatValue(value);
          nameLink.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            selectWeapon(item, { updateUrl: true });
          });
          td.appendChild(nameLink);
        } else if (col.render) {
          const rendered = col.render(value, item);
          if (rendered instanceof Node) {
            td.appendChild(rendered);
          } else {
            td.textContent = formatValue(rendered);
          }
        } else if (col.format) {
          td.textContent = col.format(value);
        } else {
          td.textContent = formatValue(value);
        }
        tr.appendChild(td);
      });

      tr.addEventListener("click", () => {
        selectWeapon(item, { updateUrl: true });
      });
      fragment.appendChild(tr);
    });

    tableBody.innerHTML = "";
    tableBody.appendChild(fragment);
  };

  const applyFilterAndSort = () => {
    if (!Array.isArray(items) || !items.length) {
      renderEmpty("No weapons found in weapons_data05.json.");
      return;
    }

    const filtered = items.filter((item) => {
      const matchesType = selectedTypes.size === 0 || selectedTypes.has(normalizeFilterValue(item.type));
      const matchesElement =
        selectedElements.size === 0 || selectedElements.has(normalizeFilterValue(item.element));
      const matchesAttackSpeed =
        selectedAttackSpeeds.size === 0 ||
        selectedAttackSpeeds.has(normalizeFilterValue(item.attackSpeed));
      if (!matchesType || !matchesElement || !matchesAttackSpeed) return false;
      if (!searchTerm) return true;
      return getWeaponSearchText(item).includes(searchTerm.toLowerCase());
    });

    const sorted = filtered.sort((a, b) => {
      const av = normalizeSortValue(a[sortKey]);
      const bv = normalizeSortValue(b[sortKey]);
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    updateSortIndicators();

    if (countLabel) {
      const count = sorted.length;
      countLabel.textContent = `${count} result${count === 1 ? "" : "s"}`;
    }

    renderTable(sorted);
    maybeSelectPendingWeapon(sorted);
  };

  const init = () => {
    Promise.all([
      fetchJsonCached(dataUrl.toString()),
      fetchJsonCached(resistancesUrl),
      fetchJsonCached(perksUrl),
      fetchJsonCached(monstersUrl),
      loadAllowlists(),
      loadDropSources(),
    ])
      .then(([data, resistancesData, perksData, monstersData, allowlists, loadedDropSources]) => {
        const map = resistancesData && typeof resistancesData === "object" ? resistancesData.typeResistances : null;
        if (map && typeof map === "object") {
          typeResistances = map;
        }
        applyAllowlists(allowlists);
        dropSources =
          loadedDropSources ||
          (typeof utils.createEmptyDropSources === "function" ? utils.createEmptyDropSources() : dropSources);
        const perks = Array.isArray(perksData?.perks) ? perksData.perks : [];
        perkIndexByName = new Map();
        perks.forEach((entry) => {
          const name = entry && typeof entry.name === "string" ? entry.name.trim() : "";
          if (!name) return;
          perkIndexByName.set(name.toLowerCase(), entry);
        });
        monsters = normalizeMonsters(Array.isArray(monstersData) ? monstersData : []);
        items = (Array.isArray(data) ? data : [])
          .map((row) => normalizeWeapon(row))
          .filter((weapon) => {
            const nameLower = (weapon.name || "").toLowerCase();
            const levelNum = Number(weapon.level);
            if (nameLower === "flaming sword" && levelNum === 0) return false;
            return !hiddenWeaponNames.has(nameLower);
          });
        if (!items.length) {
          renderEmpty("Add weapons_data05.json beside this page to see weapons.");
          return;
        }
        sortKey = "dps";
        sortDir = "desc";
        selectedTypes = new Set();
        selectedElements = new Set();
        selectedAttackSpeeds = new Set();
        buildHead();
        populateFilters(items);
        if (initialWeaponSearchTerm) {
          searchTerm = initialWeaponSearchTerm;
          if (searchInput) searchInput.value = initialWeaponSearchTerm;
        }
        applyFilterAndSort();
      })
      .catch(() => {
        renderEmpty("Unable to load weapons. Add weapons_data05.json beside this page.");
      });
  };

  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      searchTerm = event.target.value || "";
      applyFilterAndSort();
    });
  }

  if (typeFilter) {
    enableToggleSelect(typeFilter);
    typeFilter.addEventListener("change", () => {
      selectedTypes = new Set(Array.from(typeFilter.selectedOptions).map((o) => o.value));
      applyFilterAndSort();
    });
  }

  if (elementFilter) {
    enableToggleSelect(elementFilter);
    elementFilter.addEventListener("change", () => {
      selectedElements = new Set(Array.from(elementFilter.selectedOptions).map((o) => o.value));
      applyFilterAndSort();
    });
  }

  if (attackSpeedFilter) {
    enableToggleSelect(attackSpeedFilter);
    attackSpeedFilter.addEventListener("change", () => {
      selectedAttackSpeeds = new Set(Array.from(attackSpeedFilter.selectedOptions).map((o) => o.value));
      applyFilterAndSort();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      clearDetails({ updateUrl: true });
    });
  }

  init();
})();
