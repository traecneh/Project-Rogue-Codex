(() => {
  const PAGE = {
    title: "Armors",
    dataFile: "armors_data06.json",
  };

  const dataUrl = new URL(PAGE.dataFile, window.location.href);
  const searchInput = document.getElementById("item-search");
  const slotFilter = document.getElementById("filter-slot");
  const resistFilter = document.getElementById("filter-resist");
  const urlParams = new URLSearchParams(window.location.search);
  const normalizeArmorId = (value) =>
    (value || "")
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
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

  const normalizeMonsterId = (value) =>
    (value || "")
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const renderEmpty = (message) => {
    if (!tableHeadRow.children.length) {
      buildHead();
    }
    tableBody.innerHTML = `<tr><td class="table-empty" colspan="${COLUMNS.length || 1}">${message}</td></tr>`;
    if (countLabel) {
      countLabel.textContent = "0 results";
    }
  };

  const normalizeSortValue = (value) => {
    if (value === null || value === undefined) return "";
    if (typeof value === "number") return value;
    if (typeof value === "boolean") return value ? 1 : 0;
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value).toLowerCase();
  };

  const formatValue = (value) => {
    if (value === null || value === undefined) return "-";
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") return JSON.stringify(value);
    return value;
  };

  const formatNumber = (value, options = {}) => {
    if (value === null || value === undefined || value === "") return "-";
    const num = Number(value);
    if (Number.isNaN(num)) return value;
    return num.toLocaleString("en-US", { maximumFractionDigits: 0, ...options });
  };

  const toNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const setOptions = (select, options) => {
    if (!select) return;
    select.innerHTML = "";
    options.forEach(({ value, label }) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      select.appendChild(opt);
    });
  };

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

  const getArmorId = (item) => normalizeArmorId(item && (item.id || item.name));

  const getArmorDetailName = (item) => (item && item.name ? item.name.toString().trim() : "");

  const buildArmorDetailStateUrl = (item) => {
    const name = getArmorDetailName(item);
    if (!name) return "";
    const path = window.location.pathname || "pages/items/armors.html";
    return `${path}?armor=${encodeURIComponent(name)}`;
  };

  const buildArmorListUrl = () => window.location.pathname || "pages/items/armors.html";

  const updateArmorDetailUrl = (item, options = {}) => {
    const armorId = getArmorId(item);
    const targetUrl = buildArmorDetailStateUrl(item);
    if (!armorId || !targetUrl || !window.history || !window.history.pushState) return;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl === targetUrl) return;
    try {
      if (options.replace) {
        history.replaceState({ armorId }, "", targetUrl);
      } else {
        history.pushState({ armorId }, "", targetUrl);
      }
    } catch (error) {
      // Ignore history failures on nonstandard local file URLs.
    }
  };

  const updateArmorListUrl = (options = {}) => {
    const targetUrl = buildArmorListUrl();
    if (!targetUrl || !window.history || !window.history.pushState) return;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl === targetUrl) return;
    try {
      if (options.replace) {
        history.replaceState({}, "", targetUrl);
      } else {
        history.pushState({}, "", targetUrl);
      }
    } catch (error) {
      // Ignore history failures on nonstandard local file URLs.
    }
  };

  const getArmorRouteFromLocation = () => {
    const params = new URLSearchParams(window.location.search);
    const raw = (params.get("armor") || params.get("armorName") || "").trim();
    return {
      id: normalizeArmorId(raw),
      name: raw.toLowerCase(),
    };
  };

  const findArmorByRoute = (list, routeId, routeName) =>
    (Array.isArray(list) ? list : []).find((armor) => {
      const id = getArmorId(armor);
      const nameId = normalizeArmorId(armor && armor.name);
      const nameLower = (armor.name || "").toLowerCase();
      return (routeId && (id === routeId || nameId === routeId)) || (routeName && nameLower === routeName);
    });

  const getSelectedArmorFromLocation = (list = items) => {
    const route = getArmorRouteFromLocation();
    if (!route.id && !route.name) return null;
    return findArmorByRoute(list, route.id, route.name);
  };

  const selectArmor = (item, options = {}) => {
    if (!item) return;
    if (options.updateUrl) updateArmorDetailUrl(item, { replace: options.replaceUrl });
    setDetails(item, { scroll: options.scroll });
  };

  const createCell = (labelContent, valueContent) => {
    const cell = document.createElement("div");
    cell.className = "detail-cell";
    const label = document.createElement("span");
    label.className = "detail-label";
    if (labelContent instanceof Node) {
      label.appendChild(labelContent);
    } else {
      label.textContent = labelContent;
    }
    const value = document.createElement("div");
    value.className = "detail-value";
    if (valueContent instanceof Node) {
      value.appendChild(valueContent);
    } else {
      value.textContent = valueContent;
    }
    cell.appendChild(label);
    cell.appendChild(value);
    return cell;
  };

  const addDivider = (container) =>
    container.appendChild(Object.assign(document.createElement("div"), { className: "detail-divider" }));

  const addRow = (container, entries, cols) => {
    const row = document.createElement("div");
    row.className = `detail-row detail-row-cols-${cols || 2}`;
    entries.forEach(([label, value]) => row.appendChild(createCell(label, value)));
    container.appendChild(row);
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

  const imageManifestCache = new Map();
  const loadImageManifest = (folder) => {
    if (imageManifestCache.has(folder)) return imageManifestCache.get(folder);
    const map = new Map();
    imageManifestCache.set(folder, map);
    fetch(`images/${folder}/manifest.json`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((list) => {
        const entries = Array.isArray(list) ? list : [];
        entries.forEach((path) => {
          const file = String(path || "").split("/").pop() || "";
          const base = file.replace(/\.[^.]+$/, "").toLowerCase();
          if (base) map.set(base, path);
        });
      })
      .catch(() => {});
    return map;
  };

  loadImageManifest("armors");
  loadImageManifest("weapons");

  const deriveImageCandidates = (item, folder = "armors") => {
    const candidates = [];
    const direct = typeof item === "string" ? item : item && item.image;
    if (direct) candidates.push(direct);
    const name = (item && (item.name || item.Name || item.id)) || "";
    const trimmed = String(name).trim();
    const lower = trimmed.toLowerCase();
    const manifest = imageManifestCache.get(folder);
    if (manifest && lower && manifest.has(lower)) {
      candidates.push(manifest.get(lower));
    }
    if (trimmed) {
      const encoded = encodeURIComponent(trimmed);
      candidates.push(`images/${folder}/${encoded}.gif`, `images/${folder}/${encoded}.png`);
    }
    return Array.from(new Set(candidates.filter(Boolean)));
  };

  const ensureImage = (img, fallback, item, folder = "armors") => {
    if (!img || !fallback) return;
    fallback.style.display = "none";
    const sources = deriveImageCandidates(item, folder);
    if (!sources.length) {
      img.style.display = "none";
      fallback.style.display = "flex";
      return;
    }
    let index = 0;
    const trySet = () => {
      img.onload = () => {
        img.style.display = "block";
        fallback.style.display = "none";
      };
      img.onerror = () => {
        index += 1;
        if (index < sources.length) {
          trySet();
        } else {
          img.style.display = "none";
          fallback.style.display = "flex";
        }
      };
      img.src = sources[index];
    };
    trySet();
  };

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

  const getMonsterDropRange = (monsterLevel) => {
    const level = Number(monsterLevel);
    if (!Number.isFinite(level)) return null;
    return {
      level,
      min: Math.max(0, level - 5),
      max: level + 5,
    };
  };

  const stopTooltipLinkPropagation = (event) => {
    event.stopPropagation();
  };

  const createDropsFromPill = (item) => {
    const pill = document.createElement("span");
    pill.className = "detail-pill";
    pill.textContent = "Monsters";
    pill.tabIndex = 0;
    pill.setAttribute("aria-label", "Monsters that drop this item");

    const tooltip = document.createElement("span");
    tooltip.className = "detail-tooltip";
    tooltip.role = "tooltip";

      if (!Array.isArray(monsters) || !monsters.length) {
        tooltip.textContent = "No monster data loaded";
      } else {
        const itemLevel = Number(item?.level);
        const uniqueMonsterIds =
          typeof utils.getDropSourceMonsterIdsByItem === "function"
            ? utils.getDropSourceMonsterIdsByItem(dropSources, "armors", item?.name)
            : [];
        const useUnique = Array.isArray(uniqueMonsterIds) && uniqueMonsterIds.length > 0;
        if (!useUnique && !Number.isFinite(itemLevel)) {
          tooltip.textContent = "No level data";
        } else {
          const uniqueSet = useUnique ? new Set(uniqueMonsterIds.map((id) => normalizeMonsterId(id))) : null;
          const list = monsters
            .map((monster) => {
              const monsterId = normalizeMonsterId(monster.name || monster.id);
              if (useUnique) {
                if (!uniqueSet.has(monsterId)) return null;
              } else {
                const range = getMonsterDropRange(monster.level);
                if (!range) return null;
                if (itemLevel < range.min || itemLevel > range.max) return null;
              }
              const typeRaw = monster.monsterType || "";
              const levelValue = Number(monster.level);
              return {
                id: monsterId,
                name: monster.name || "Unknown Monster",
                type: typeRaw,
                typeKey: normalizeFilterValue(typeRaw) || "unknown",
                level: Number.isFinite(levelValue) ? levelValue : null,
              };
            })
            .filter(Boolean)
            .sort((a, b) => {
              if (a.typeKey !== b.typeKey) return a.typeKey.localeCompare(b.typeKey);
              const levelA = Number.isFinite(a.level) ? a.level : -Infinity;
              const levelB = Number.isFinite(b.level) ? b.level : -Infinity;
              if (levelB !== levelA) return levelB - levelA;
              return a.name.localeCompare(b.name);
            });

        const headerRow = document.createElement("div");
        headerRow.className = "detail-tooltip-row";
        const nameLabel = document.createElement("span");
        nameLabel.className = "detail-tooltip-label";
        nameLabel.textContent = "Name";
        const typeLabel = document.createElement("span");
        typeLabel.className = "detail-tooltip-label";
        typeLabel.textContent = "Type";
        headerRow.appendChild(nameLabel);
        headerRow.appendChild(typeLabel);
        tooltip.appendChild(headerRow);

        const divider = document.createElement("div");
        divider.className = "detail-tooltip-divider";
        tooltip.appendChild(divider);

          if (!list.length) {
            const emptyRow = document.createElement("div");
            emptyRow.className = "detail-tooltip-row";
            const emptyLabel = document.createElement("span");
            emptyLabel.className = "detail-tooltip-label";
            emptyLabel.textContent = "No monsters in range";
            emptyRow.appendChild(emptyLabel);
            tooltip.appendChild(emptyRow);
          } else {
            let lastTypeKey = null;
            list.forEach((entry) => {
              if (lastTypeKey && entry.typeKey !== lastTypeKey) {
                const groupDivider = document.createElement("div");
                groupDivider.className = "detail-tooltip-divider";
                tooltip.appendChild(groupDivider);
              }
              lastTypeKey = entry.typeKey;

              const row = document.createElement("div");
              row.className = "detail-tooltip-row";
              const nameLink = document.createElement("a");
              nameLink.textContent = entry.name;
              nameLink.href = buildMonsterDetailUrl(entry.id || entry.name);
              nameLink.addEventListener("click", stopTooltipLinkPropagation);
              const typeSpan = document.createElement("span");
              typeSpan.className = "detail-tooltip-type";
              typeSpan.textContent = formatMonsterTypeLabel(entry.type);
              row.appendChild(nameLink);
              row.appendChild(typeSpan);
              tooltip.appendChild(row);
            });
          }
        }
      }

    pill.appendChild(tooltip);
    return pill;
  };

  let pinnedTooltip = null;
  let pinDocumentListenerAttached = false;

  function unpinTooltip(tooltip) {
    if (!tooltip) return;
    tooltip.classList.remove("is-pinned");
    if (pinnedTooltip === tooltip) pinnedTooltip = null;
  }

  function attachTooltipPinning(root) {
    const scope = root || document;
    const tooltips = scope.querySelectorAll(".detail-pill .detail-tooltip");
    tooltips.forEach((tooltip) => {
      if (!tooltip || tooltip.dataset.pinWired === "1") return;
      const pill = tooltip.closest(".detail-pill");
      if (!pill) return;

      const toggle = (event) => {
        event.preventDefault();
        event.stopPropagation();
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

      pill.addEventListener("click", toggle);
      pill.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          toggle(event);
        }
      });
      tooltip.addEventListener("click", (event) => event.stopPropagation());
      tooltip.dataset.pinWired = "1";
    });

    if (!pinDocumentListenerAttached) {
      pinDocumentListenerAttached = true;
      document.addEventListener("click", (event) => {
        if (!pinnedTooltip) return;
        const pill = pinnedTooltip.closest(".detail-pill");
        if (pill && pill.contains(event.target)) return;
        unpinTooltip(pinnedTooltip);
      });
      document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        if (!pinnedTooltip) return;
        unpinTooltip(pinnedTooltip);
      });
    }
  }

  const setDetails = (item, options = {}) => {
    if (!item) return;
    detailFields.name.textContent = item.name || "Unknown";
    ensureImage(detailFields.image, detailFields.imageFallback, item, "armors");
    if (pinnedTooltip) unpinTooltip(pinnedTooltip);

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
    if (pinnedTooltip) unpinTooltip(pinnedTooltip);
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
