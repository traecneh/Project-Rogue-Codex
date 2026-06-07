(() => {
  const PAGE = {
    title: "Armors",
    dataFile: "armors_data06.json",
  };

  const dataUrl = new URL(PAGE.dataFile, window.location.href);
  const searchInput = document.getElementById("item-search");
  const slotFilter = document.getElementById("filter-slot");
  const resistFilter = document.getElementById("filter-resist");
  const itemUtils = window.RogueCodexItemPageUtils || {};
  const urlParams = new URLSearchParams(window.location.search);
  const normalizeArmorId = itemUtils.normalizeItemId;
  const initialArmorQuery = (urlParams.get("armor") || urlParams.get("armorName") || "").trim();
  const initialArmorId = normalizeArmorId(initialArmorQuery);
  const initialArmorSearchTerm = initialArmorQuery.replace(/-/g, " ").trim();
  let pendingArmorId = initialArmorId;
  let pendingArmorName = initialArmorQuery.toLowerCase();
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
  const fetchJsonCached =
    utils.fetchJsonCached ||
    ((targetUrl) =>
      fetch(targetUrl)
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null));
  const normalizeFilterValue =
    utils.normalizeFilterValue || ((value) => (value || "").toString().trim().toLowerCase());
  const RESIST_COLORS = utils.RESIST_COLORS || {};
  const createPerkBadge =
    utils.createPerkBadge ||
    ((value) => {
      const span = document.createElement("span");
      span.textContent = formatValue(value);
      return span;
    });
  const getPerkTierColor = utils.getPerkTierColor || (() => "");

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

  const COLUMNS = [
    { key: "image", label: "Image", sortable: false },
    { key: "name", label: "Name" },
    { key: "level", label: "Level" },
    { key: "armor", label: "Armor" },
    { key: "fireResist", label: "Fire", format: (v) => formatNumber(v) },
    { key: "poisonResist", label: "Poison", format: (v) => formatNumber(v) },
    { key: "coldResist", label: "Cold", format: (v) => formatNumber(v) },
    { key: "diseaseResist", label: "Disease", format: (v) => formatNumber(v) },
    { key: "acidResist", label: "Acid", format: (v) => formatNumber(v) },
    { key: "electricResist", label: "Electric", format: (v) => formatNumber(v) },
  ];

  let items = [];
  let monsters = [];
  let sortKey = "level";
  let sortDir = "desc";
  let searchTerm = "";
  let selectedSlots = new Set();
  let selectedResists = new Set();
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
  let dropSources =
    typeof utils.createEmptyDropSources === "function"
      ? utils.createEmptyDropSources()
      : { armors: {}, weapons: {}, reverse: { armors: {}, weapons: {} } };
  let hiddenArmorNames = new Set();
  let allowedMonsterNames = new Set();

  const applyAllowlists = (allowlists) => {
    hiddenArmorNames = buildNameSet(allowlists?.armors?.block);
    allowedMonsterNames = buildNameSet(allowlists?.monsters?.allow);
  };

  const isMonsterAllowed = (monster) => {
    if (!allowedMonsterNames.size) return true;
    return allowedMonsterNames.has((monster.name || "").toLowerCase());
  };

  const titleCase = (text) =>
    text
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const formatMonsterTypeLabel = (value) => {
    if (!value) return "-";
    return titleCase(String(value));
  };

  const normalizeMonsterId = itemUtils.normalizeItemId;

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
  const formatValue = itemUtils.formatValue;
  const formatNumber = itemUtils.formatNumber;
  const toNumber = itemUtils.toNumber;
  const setOptions = itemUtils.setOptions;
  const enableToggleSelect = itemUtils.enableToggleSelect;

  const getArmorId = (item) => normalizeArmorId(item && (item.id || item.name));
  const armorRouteHelpers = itemUtils.createRouteHelpers({
    fallbackPath: "pages/items/armors.html",
    getItemId: getArmorId,
    getItemName: (item) => (item && item.name ? item.name : ""),
    normalizeId: normalizeArmorId,
    queryKeys: ["armor", "armorName"],
    stateKey: "armorId",
  });
  const updateArmorDetailUrl = armorRouteHelpers.updateDetailUrl;
  const updateArmorListUrl = armorRouteHelpers.updateListUrl;
  const getArmorRouteFromLocation = armorRouteHelpers.getRouteFromLocation;
  const findArmorByRoute = armorRouteHelpers.findByRoute;
  const getSelectedArmorFromLocation = (list = items) => armorRouteHelpers.getSelectedFromLocation(list);

  const selectArmor = (item, options = {}) => {
    if (!item) return;
    if (options.updateUrl) updateArmorDetailUrl(item, { replace: options.replaceUrl });
    setDetails(item, { scroll: options.scroll });
  };

  const createCell = itemUtils.createCell;
  const addDivider = itemUtils.addDivider;
  const addRow = itemUtils.addRow;

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

  const isSlotZero = (slotValue) =>
    slotValue === 0 || (typeof slotValue === "string" && slotValue.trim() === "0");

  const normalizeArmor = (raw) => {
    const fields = (raw && raw.fields) || {};
    const valueNum = toNumber(fields.value);
    return {
      id: raw && raw.id ? raw.id : (raw.name || "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-"),
      name: raw.name || "Unknown",
      slot: fields.slot_label || fields.slot,
      level: fields.level,
      armor: fields.armor,
      weight: fields.weight,
      maxRarity: fields.max_rarity_label || fields.max_rarity,
      perk: fields.perk_label || (fields.perk ? fields.perk : "None"),
      corruptedPerk:
        fields.corrupted_perk_label || (fields.corrupted_perk ? fields.corrupted_perk : "None"),
      value: valueNum,
      sellValue: valueNum !== null ? valueNum / 2 : null,
      promotion: fields.promotion,
      deconstruction: fields.deconstruction,
      toHit: fields.to_hit,
      playerLevelRequirement: toNumber(fields.player_level_requirement),
      resistances: {
        fire: fields.fire_resistance,
        cold: fields.cold_resistance,
        lightning: fields.lightning_resistance,
        acid: fields.acid_resistance,
        poison: fields.poison_resistance,
        disease: fields.disease_resistance,
      },
      fireResist: fields.fire_resistance,
      poisonResist: fields.poison_resistance,
      coldResist: fields.cold_resistance,
      diseaseResist: fields.disease_resistance,
      acidResist: fields.acid_resistance,
      electricResist: fields.lightning_resistance,
      stats: {
        strength: fields.strength,
        constitution: fields.constitution,
        dexterity: fields.dexterity,
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

  const populateFilters = (data) => {
    const slotOptions = new Map();
    const resistOptions = new Set();

    data.forEach((item) => {
      const slotValue = normalizeFilterValue(item.slot);
      if (slotValue) {
        if (!slotOptions.has(slotValue)) slotOptions.set(slotValue, item.slot);
      }
      const res = item.resistances || {};
      [
        ["fire", res.fire],
        ["poison", res.poison],
        ["cold", res.cold],
        ["disease", res.disease],
        ["acid", res.acid],
        ["electric", res.electric || res.lightning],
      ].forEach(([key, val]) => {
        if (val !== null && val !== undefined && Number(val) !== 0) {
          resistOptions.add(key);
        }
      });
    });

    const slotList = Array.from(slotOptions.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }));
    const resistLabels = {
      fire: "Fire",
      poison: "Poison",
      cold: "Cold",
      disease: "Disease",
      acid: "Acid",
      electric: "Electric",
    };
    const resistList = Array.from(resistOptions)
      .sort((a, b) => resistLabels[a].localeCompare(resistLabels[b]))
      .map((value) => ({ value, label: resistLabels[value] || value }));

    setOptions(slotFilter, slotList);
    setOptions(resistFilter, resistList);
    if (resistFilter) {
      Array.from(resistFilter.options).forEach((opt) => {
        const color = RESIST_COLORS[opt.value];
        if (color) {
          opt.style.color = color;
        }
      });
    }
  };

  const armorImageLoader = itemUtils.createImageLoader("armors", ["armors", "weapons"]);
  const ensureImage = armorImageLoader.ensureImage || itemUtils.ensureImage;

  const buildHead = () => {
    tableHeadRow.innerHTML = "";
    COLUMNS.forEach((col) => {
      const th = document.createElement("th");
      th.setAttribute("scope", "col");

      const labelSpan = document.createElement("span");
      labelSpan.textContent = col.label;
      const resistKey = col.key.replace(/Resist$/, "").toLowerCase();
      const resistColor = RESIST_COLORS[resistKey];
      if (resistColor) {
        labelSpan.style.color = resistColor;
      }
      th.appendChild(labelSpan);

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
      tableHeadRow.appendChild(th);
    });
    updateSortIndicators();
  };

  const formatRequirement = (requirement) => {
    if (requirement === 2) return "Evil Reputation";
    if (requirement === 6) return "Good Reputation";
    return `Player Level ${formatNumber(requirement)}`;
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

  const createPerkDetailPill = (value) => {
    const labelText = formatValue(value);
    const baseName = extractPerkBaseName(value);
    if (!labelText || labelText === "-" || !baseName) {
      return createPerkBadge(value);
    }

    const pill = document.createElement("span");
    pill.className = "detail-pill";
    pill.tabIndex = 0;
    pill.setAttribute("aria-label", `${labelText} perk details`);

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
      itemKind: "armors",
      monsters,
      normalizeFilterValue,
      normalizeMonsterId,
      utils,
    });

  const tooltipPinning = itemUtils.createTooltipPinningController();
  const attachTooltipPinning = tooltipPinning.attachTooltipPinning;
  const unpinPinnedTooltip = tooltipPinning.unpinPinnedTooltip;

  const setDetails = (item, options = {}) => {
    if (!item) return;
    detailFields.name.textContent = item.name || "Unknown";
    ensureImage(detailFields.image, detailFields.imageFallback, item, "armors");
    unpinPinnedTooltip();

    const container = detailFields.properties;
    container.innerHTML = "";

    addRow(
      container,
      [
        ["Slot", formatValue(item.slot)],
        ["Level", formatNumber(item.level)],
        ["Armor", formatNumber(item.armor)],
        ["Weight", formatNumber(item.weight)],
        ["To Hit", formatNumber(item.toHit)],
      ],
      5
    );

    addDivider(container);

    addRow(
      container,
      [
        ["Strength", formatNumber((item.stats && item.stats.strength) ?? 0)],
        ["Constitution", formatNumber((item.stats && item.stats.constitution) ?? 0)],
        ["Dexterity", formatNumber((item.stats && item.stats.dexterity) ?? 0)],
      ],
      3
    );

    addDivider(container);

    const res = item.resistances || {};
    const makeResistEntry = (key, labelText, rawValue) => {
      const color = RESIST_COLORS[key];
      const labelSpan = document.createElement("span");
      labelSpan.textContent = labelText;
      if (color) labelSpan.style.color = color;
      const valueSpan = document.createElement("span");
      valueSpan.textContent = formatNumber(rawValue ?? 0);
      if (color) valueSpan.style.color = color;
      return [labelSpan, valueSpan];
    };
    addRow(
      container,
      [
        makeResistEntry("fire", "Fire", res.fire),
        makeResistEntry("poison", "Poison", res.poison),
        makeResistEntry("cold", "Cold", res.cold),
      ],
      3
    );
    addRow(
      container,
      [
        makeResistEntry("disease", "Disease", res.disease),
        makeResistEntry("acid", "Acid", res.acid),
        makeResistEntry("electric", "Electric", res.lightning ?? res.electric),
      ],
      3
    );

    addDivider(container);

    addRow(
      container,
      [
        ["Innate Perk", createPerkDetailPill(item.perk)],
        ["Corrupted Perk", createPerkDetailPill(item.corruptedPerk)],
      ],
      2
    );

    addDivider(container);

    addRow(
      container,
      [
        ["Max Rarity", formatValue(item.maxRarity)],
        [
          "Deconstruction",
          createRarityValuePill(item.deconstruction, "Deconstruction", item.maxRarity),
        ],
        ["Promotion", createRarityValuePill(item.promotion, "Promotion", item.maxRarity)],
      ],
      3
    );

    addDivider(container);

      addRow(
        container,
        [["Requirement", formatRequirement(item.playerLevelRequirement)]],
        1
      );

      addDivider(container);

      addRow(container, [["Drops From", createDropsFromPill(item)]], 1);

      addDivider(container);

      addRow(
        container,
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
    if (options.updateUrl) updateArmorListUrl({ replace: options.replaceUrl });
  };

  window.addEventListener("popstate", () => {
    const route = getArmorRouteFromLocation();
    pendingArmorId = route.id;
    pendingArmorName = route.name;
    if (!pendingArmorId && !pendingArmorName) {
      clearDetails({ updateUrl: false });
      return;
    }
    if (!items.length) return;
    const selected = getSelectedArmorFromLocation(items);
    pendingArmorId = "";
    pendingArmorName = "";
    if (selected) {
      selectArmor(selected, { updateUrl: false, scroll: false });
    } else {
      clearDetails({ updateUrl: false });
    }
  });

  const renderTable = (rows) => {
    if (!rows.length) {
      renderEmpty("No armors match your filters.");
      return;
    }

    const fragment = document.createDocumentFragment();

    rows.forEach((item) => {
      const tr = document.createElement("tr");
      tr.dataset.id = item.id || "";

      COLUMNS.forEach((col) => {
        const td = document.createElement("td");
        const value = item[col.key];
        if (col.key === "image") {
          const img = document.createElement("img");
          img.className = "item-thumb";
          img.alt = `${item.name || "Item"} image`;
          const fallback = document.createElement("span");
          fallback.className = "no-image";
          fallback.textContent = "No Image";
          ensureImage(img, fallback, item, "armors");
          td.appendChild(img);
          td.appendChild(fallback);
        } else if (col.format) {
          td.textContent = col.format(value);
        } else {
          td.textContent = formatValue(value);
        }
        const resistKey = col.key.replace(/Resist$/, "").toLowerCase();
        const resistColor = RESIST_COLORS[resistKey];
        if (resistColor) {
          td.style.color = resistColor;
        }
        tr.appendChild(td);
      });

      tr.addEventListener("click", () => {
        selectArmor(item, { updateUrl: true });
      });
      fragment.appendChild(tr);
    });

    tableBody.innerHTML = "";
    tableBody.appendChild(fragment);
    maybeSelectPendingArmor(rows);
  };

  const maybeSelectPendingArmor = (list) => {
    if (!pendingArmorId && !pendingArmorName) return;
    const match =
      findArmorByRoute(list || items, pendingArmorId, pendingArmorName) ||
      findArmorByRoute(items, pendingArmorId, pendingArmorName);
    if (!match) return;
    pendingArmorId = "";
    pendingArmorName = "";
    selectArmor(match, { updateUrl: false });
  };

  const applyFilterAndSort = () => {
    if (!Array.isArray(items) || !items.length) {
      renderEmpty("No armors found in armors_data06.json.");
      return;
    }

    const filtered = items.filter((item) => {
      const matchesSlot = selectedSlots.size === 0 || selectedSlots.has(normalizeFilterValue(item.slot));
      if (!matchesSlot) return false;

      if (selectedResists.size) {
        const res = item.resistances || {};
        const resMap = {
          fire: res.fire,
          poison: res.poison,
          cold: res.cold,
          disease: res.disease,
          acid: res.acid,
          electric: res.electric || res.lightning,
        };
        const hasAll = Array.from(selectedResists).every(
          (key) => resMap[key] !== null && resMap[key] !== undefined && Number(resMap[key]) !== 0
        );
        if (!hasAll) return false;
      }

      if (!searchTerm) return true;
      const text = [
        ...COLUMNS.map((col) => formatValue(item[col.key])),
        formatValue(item.perk),
        formatValue(item.corruptedPerk),
      ]
        .join(" ")
        .toLowerCase();
      return text.includes(searchTerm.toLowerCase());
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
  };

    const init = () => {
      Promise.all([
        fetchJsonCached(dataUrl.toString()),
        fetchJsonCached(perksUrl),
        fetchJsonCached(monstersUrl),
        loadAllowlists(),
        loadDropSources(),
      ])
        .then(([data, perksData, monstersData, allowlists, loadedDropSources]) => {
          const perks = Array.isArray(perksData?.perks) ? perksData.perks : [];
          perkIndexByName = new Map();
          perks.forEach((entry) => {
            const name = entry && typeof entry.name === "string" ? entry.name.trim() : "";
            if (!name) return;
            perkIndexByName.set(name.toLowerCase(), entry);
          });
          applyAllowlists(allowlists);
          dropSources =
            loadedDropSources ||
            (typeof utils.createEmptyDropSources === "function" ? utils.createEmptyDropSources() : dropSources);
          monsters = normalizeMonsters(Array.isArray(monstersData) ? monstersData : []);
          items = (Array.isArray(data) ? data : [])
            .map((row) => normalizeArmor(row))
            .filter(
              (row) => row && !hiddenArmorNames.has((row.name || "").toLowerCase()) && !isSlotZero(row.slot)
            );
        if (!items.length) {
          renderEmpty("Add armors_data06.json beside this page to see armors.");
          return;
        }
        sortKey = "level";
        sortDir = "desc";
        buildHead();
        populateFilters(items);
        if (initialArmorSearchTerm) {
          searchTerm = initialArmorSearchTerm;
          if (searchInput) searchInput.value = initialArmorSearchTerm;
        }
        applyFilterAndSort();
      })
      .catch(() => {
        renderEmpty("Unable to load armors. Add armors_data06.json beside this page.");
      });
  };

  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      searchTerm = event.target.value || "";
      applyFilterAndSort();
    });
  }

  if (slotFilter) {
    enableToggleSelect(slotFilter);
    slotFilter.addEventListener("change", () => {
      selectedSlots = new Set(Array.from(slotFilter.selectedOptions).map((o) => o.value));
      applyFilterAndSort();
    });
  }

  if (resistFilter) {
    enableToggleSelect(resistFilter);
    resistFilter.addEventListener("change", () => {
      selectedResists = new Set(Array.from(resistFilter.selectedOptions).map((o) => o.value));
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
