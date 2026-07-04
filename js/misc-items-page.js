(() => {
  const pageRoot = document.querySelector(".misc-items-page");
  if (!pageRoot) return;

  const page = {
    title: pageRoot.dataset.pageTitle || "Items",
    dataFile: pageRoot.dataset.dataFile || "",
    imageFolder: pageRoot.dataset.imageFolder || "items",
    queryKey: pageRoot.dataset.queryKey || "item",
    countLabel: pageRoot.dataset.countLabel || "items",
    searchPlaceholder: pageRoot.dataset.searchPlaceholder || "Search items by any field...",
  };

  const dataUrl = new URL(page.dataFile, window.location.href);
  const RELATIONSHIP_DATA_URL = "data/codex-overrides/item_relationships.json";
  const relationshipDataUrl = new URL(RELATIONSHIP_DATA_URL, document.baseURI || window.location.href);
  const searchInput = document.getElementById("item-search");
  const useTypeFilter = document.getElementById("filter-use-type");
  const traitFilter = document.getElementById("filter-trait");
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
  const normalizeItemId = itemUtils.normalizeItemId || normalizeFilterValue;
  const normalizeSortValue = itemUtils.normalizeSortValue || ((value) => String(value ?? "").toLowerCase());
  const formatValue =
    itemUtils.formatValue ||
    ((value) => {
      if (value === null || value === undefined || value === "") return "-";
      if (Array.isArray(value)) return value.join(", ");
      if (typeof value === "object") return JSON.stringify(value);
      return value;
    });
  const formatNumber =
    itemUtils.formatNumber ||
    ((value) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric.toLocaleString("en-US") : formatValue(value);
    });
  const toNumber =
    itemUtils.toNumber ||
    ((value) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    });
  const setOptions = itemUtils.setOptions || (() => {});
  const enableToggleSelect = itemUtils.enableToggleSelect || (() => {});
  const stopTooltipLinkPropagation =
    itemUtils.stopTooltipLinkPropagation ||
    ((event) => {
      event.stopPropagation();
    });
  const createCell = itemUtils.createCell;
  const addDivider = itemUtils.addDivider;
  const addRow = itemUtils.addRow;
  const tooltipPinning =
    typeof itemUtils.createTooltipPinningController === "function"
      ? itemUtils.createTooltipPinningController()
      : { attachTooltipPinning: () => {}, unpinPinnedTooltip: () => {} };
  const imageLoader =
    typeof itemUtils.createImageLoader === "function"
      ? itemUtils.createImageLoader(page.imageFolder)
      : null;
  const ensureImage = imageLoader?.ensureImage || itemUtils.ensureImage || (() => {});

  const TRAIT_DEFINITIONS = [
    { key: "emits-light", label: "Emits Light", className: "emits-light" },
    { key: "animated", label: "Animated", className: "animated" },
    { key: "crafting-data", label: "Crafting Data", className: "crafting-data" },
  ];

  const CRAFTING_FIELD_NAMES = [
    "crafting_material_type",
    "crafting_material_amount",
    "crafting_difficulty",
    "crafting_requirement",
  ];

  const RELATIONSHIP_GROUPS = [
    { type: "used_in", label: "Used In" },
    { type: "found_from", label: "Found From" },
    { type: "related_system", label: "Related Systems" },
  ];

  const RELATIONSHIP_TARGET_LINKS = {
    "Ascend System": "pages/systems/ascend.html",
    "Deconstruct System": "pages/systems/deconstruct.html",
    "Re-Roll System": "pages/systems/re-roll.html",
    "Imbuements System": "pages/systems/imbuements.html",
    "Purge System": "pages/systems/purge.html",
    "Craft System": "pages/systems/craft.html",
    "Crafting System": "pages/systems/crafting.html",
    "Carpentry": "pages/stats/skills.html",
    "Fishing": "pages/stats/skills.html",
    "Tinkering": "pages/stats/skills.html",
    "Mining": "pages/stats/skills.html",
    "Woodcutting": "pages/stats/skills.html",
    "Blacksmithing": "pages/stats/skills.html",
    "Milling": "pages/stats/skills.html",
  };

  const COLUMNS = [
    { key: "image", label: "Image", sortable: false },
    { key: "name", label: "Name" },
    { key: "useTypeLabel", label: "Use Type" },
    { key: "value", label: "Value", format: (value) => formatNumber(value) },
    { key: "traits", label: "Traits", render: (_, item) => createTraitList(item.traits), sortable: false },
  ];

  let items = [];
  let sortKey = "name";
  let sortDir = "asc";
  let searchTerm = "";
  let selectedUseTypes = new Set();
  let selectedTraits = new Set();
  let relationshipDataByKey = new Map();

  const urlParams = new URLSearchParams(window.location.search);
  const initialItemQuery = (urlParams.get(page.queryKey) || urlParams.get(`${page.queryKey}Name`) || "").trim();
  const initialItemId = normalizeItemId(initialItemQuery);
  const initialItemSearchTerm = initialItemQuery.replace(/-/g, " ").trim();
  let pendingItemId = initialItemId;
  let pendingItemName = initialItemQuery.toLowerCase();

  const getItemId = (item) => normalizeItemId(item && (item.id ?? item.name));
  const routeHelpers = itemUtils.createRouteHelpers({
    fallbackPath: `pages/items/${page.countLabel}.html`,
    getItemId,
    getItemName: (item) => (item && item.name ? item.name : ""),
    normalizeId: normalizeItemId,
    queryKeys: [page.queryKey, `${page.queryKey}Name`],
    stateKey: `${page.queryKey}Id`,
  });
  const updateDetailUrl = routeHelpers.updateDetailUrl;
  const updateListUrl = routeHelpers.updateListUrl;
  const buildDetailUrl = routeHelpers.buildDetailStateUrl;
  const getRouteFromLocation = routeHelpers.getRouteFromLocation;
  const findByRoute = routeHelpers.findByRoute;
  const getSelectedFromLocation = (list = items) => routeHelpers.getSelectedFromLocation(list);

  const hasCraftingData = (fields) =>
    CRAFTING_FIELD_NAMES.some((fieldName) => Number(fields[fieldName] || 0) !== 0);

  const titleCase = (text) =>
    String(text || "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const formatUseType = (value) => {
    if (value === null || value === undefined || value === "") return "None";
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric === 0 ? "None" : `Use Type ${formatNumber(numeric)}`;
    }
    return titleCase(value);
  };

  const normalizeRelationshipName = (value) => normalizeFilterValue(value);

  const relationshipKey = (kind, matchType, value) =>
    `${normalizeFilterValue(kind)}:${matchType}:${matchType === "name" ? normalizeRelationshipName(value) : String(value ?? "").trim()}`;

  const addRelationship = (map, key, relationship) => {
    if (!key || !relationship) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(relationship);
  };

  const createRelationshipDataByKey = (rawData) => {
    const rows = rawData && Array.isArray(rawData.relationships) ? rawData.relationships : [];
    const map = new Map();

    rows.forEach((row) => {
      if (!row || typeof row !== "object") return;
      const kind = normalizeFilterValue(row.kind);
      if (kind !== "collectable" && kind !== "useable") return;
      const name = String(row.name || "").trim();
      const rawRelationships = Array.isArray(row.relationships) ? row.relationships : [];
      const relationships = rawRelationships
        .map((relationship) => ({
          type: String(relationship?.type || "").trim(),
          target: String(relationship?.target || "").trim(),
          evidence: String(relationship?.evidence || "manual review").trim(),
        }))
        .filter((relationship) => relationship.type && relationship.target);
      if (!relationships.length) return;

      const id = row.id === null || row.id === undefined ? "" : String(row.id).trim();
      const key = id ? relationshipKey(kind, "id", id) : relationshipKey(kind, "name", name);
      relationships.forEach((relationship) => addRelationship(map, key, relationship));
    });

    return map;
  };

  const getRelationshipsForItem = (item) => {
    if (!item || !relationshipDataByKey.size) return [];
    const kind = normalizeFilterValue(page.queryKey);
    const keys = [
      relationshipKey(kind, "id", item.id),
      relationshipKey(kind, "name", item.name),
    ];
    const seen = new Set();
    const relationships = [];
    keys.forEach((key) => {
      const matches = relationshipDataByKey.get(key) || [];
      matches.forEach((relationship) => {
        const uniqueKey = `${relationship.type}|${relationship.target}|${relationship.evidence}`;
        if (seen.has(uniqueKey)) return;
        seen.add(uniqueKey);
        relationships.push(relationship);
      });
    });
    return relationships;
  };

  const formatRelationshipType = (type) =>
    RELATIONSHIP_GROUPS.find((group) => group.type === type)?.label || titleCase(type);

  const getRelationshipHref = (relationship) => RELATIONSHIP_TARGET_LINKS[relationship?.target] || "";

  const normalizeItem = (raw) => {
    if (!raw || typeof raw !== "object") return null;
    const fields = raw.fields && typeof raw.fields === "object" ? raw.fields : {};
    const name = raw.name || raw.Name || fields.name_label || "Unknown Item";
    const id = raw.id ?? raw.itemId ?? name;
    const value = toNumber(fields.value ?? raw.value);
    const useType = fields.use_type ?? raw.use_type ?? raw.useType ?? "";
    const emitsLight = Number(fields.emits_light || 0) === 1;
    const animated = Number(fields.animated || 0) === 1;
    const craftingData = hasCraftingData(fields);
    const traits = TRAIT_DEFINITIONS.filter(
      (trait) =>
        (trait.key === "emits-light" && emitsLight) ||
        (trait.key === "animated" && animated) ||
        (trait.key === "crafting-data" && craftingData)
    );

    return {
      id,
      name: String(name),
      fields,
      value,
      useType,
      useTypeLabel: formatUseType(useType),
      emitsLight,
      animated,
      craftingData,
      traits,
    };
  };

  const renderEmpty = (message) => {
    if (!tableHeadRow.children.length) buildHead();
    tableBody.innerHTML = `<tr><td class="table-empty" colspan="${COLUMNS.length || 1}">${message}</td></tr>`;
    if (countLabel) countLabel.textContent = `0 ${page.countLabel}`;
  };

  const updateSortIndicators = () => {
    document.querySelectorAll(".items-table th[data-sort-key]").forEach((th) => {
      const key = th.getAttribute("data-sort-key");
      const indicator = th.querySelector(".sort-indicator");
      const isActive = key === sortKey;
      th.setAttribute("aria-sort", isActive ? (sortDir === "asc" ? "ascending" : "descending") : "none");
      if (indicator) indicator.textContent = isActive ? (sortDir === "asc" ? "\u25B2" : "\u25BC") : "\u2195";
    });
  };

  const buildHead = () => {
    tableHeadRow.innerHTML = "";
    COLUMNS.forEach((col) => {
      const th = document.createElement("th");
      th.setAttribute("scope", "col");
      th.textContent = col.label;
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

  const createTraitPill = (trait) => {
    const span = document.createElement("span");
    span.className = `trait-pill ${trait.className}`;
    span.textContent = trait.label;
    return span;
  };

  const createTraitList = (traits) => {
    if (!Array.isArray(traits) || !traits.length) return "-";
    const wrapper = document.createElement("span");
    wrapper.className = "trait-list";
    traits.forEach((trait) => wrapper.appendChild(createTraitPill(trait)));
    return wrapper;
  };

  const createImageThumb = (item) => {
    const wrapper = document.createDocumentFragment();
    const img = document.createElement("img");
    img.className = "item-thumb";
    img.alt = `${item.name || "Item"} image`;
    const fallback = document.createElement("span");
    fallback.className = "no-image";
    fallback.textContent = "No Image";
    ensureImage(img, fallback, item, page.imageFolder);
    wrapper.appendChild(img);
    wrapper.appendChild(fallback);
    return wrapper;
  };

  const getItemSearchText = (item) =>
    [
      item.id,
      item.name,
      item.value,
      item.useType,
      item.useTypeLabel,
      item.emitsLight ? "Emits Light" : "",
      item.animated ? "Animated" : "",
      item.craftingData ? "Crafting Data" : "",
      ...item.traits.map((trait) => trait.label),
      ...getRelationshipsForItem(item).flatMap((relationship) => [
        formatRelationshipType(relationship.type),
        relationship.target,
        relationship.evidence,
      ]),
      JSON.stringify(item.fields || {}),
    ]
      .join(" ")
      .toLowerCase();

  const populateFilters = (data) => {
    const useTypeOptions = new Map();
    const traitOptions = new Map();

    data.forEach((item) => {
      const useTypeValue = normalizeFilterValue(item.useTypeLabel);
      if (useTypeValue && !useTypeOptions.has(useTypeValue)) {
        useTypeOptions.set(useTypeValue, item.useTypeLabel);
      }
      item.traits.forEach((trait) => {
        if (!traitOptions.has(trait.key)) traitOptions.set(trait.key, trait.label);
      });
    });

    setOptions(
      useTypeFilter,
      Array.from(useTypeOptions.entries())
        .sort((a, b) => String(a[1]).localeCompare(String(b[1])))
        .map(([value, label]) => ({ value, label }))
    );
    setOptions(
      traitFilter,
      Array.from(traitOptions.entries())
        .sort((a, b) => String(a[1]).localeCompare(String(b[1])))
        .map(([value, label]) => ({ value, label }))
    );
  };

  const appendRow = (container, entries, cols) => {
    if (typeof addRow === "function") {
      addRow(container, entries, cols);
      return;
    }
    const row = document.createElement("div");
    row.className = `detail-row detail-row-cols-${cols || 2}`;
    entries.forEach(([label, value]) => {
      if (typeof createCell === "function") {
        row.appendChild(createCell(label, value));
        return;
      }
      const cell = document.createElement("div");
      cell.className = "detail-cell";
      const labelEl = document.createElement("span");
      labelEl.className = "detail-label";
      labelEl.textContent = label;
      const valueEl = document.createElement("div");
      valueEl.className = "detail-value";
      if (value instanceof Node) valueEl.appendChild(value);
      else valueEl.textContent = value;
      cell.appendChild(labelEl);
      cell.appendChild(valueEl);
      row.appendChild(cell);
    });
    container.appendChild(row);
  };

  const appendDivider = (container) => {
    if (typeof addDivider === "function") {
      addDivider(container);
      return;
    }
    container.appendChild(Object.assign(document.createElement("div"), { className: "detail-divider" }));
  };

  const createCraftingSummary = (item) => {
    if (!item.craftingData) return "None";
    return [
      ["Material Type", item.fields.crafting_material_type],
      ["Material Amount", item.fields.crafting_material_amount],
      ["Difficulty", item.fields.crafting_difficulty],
      ["Requirement", item.fields.crafting_requirement],
    ]
      .filter(([, value]) => Number(value || 0) !== 0)
      .map(([label, value]) => `${label}: ${formatNumber(value)}`)
      .join("; ");
  };

  const createRelationshipPill = (relationship) => {
    const href = getRelationshipHref(relationship);
    const pill = document.createElement(href ? "a" : "span");
    pill.className = "detail-pill relationship-pill";
    pill.textContent = relationship.target;
    if (href) {
      pill.href = href;
      pill.setAttribute("aria-label", `Open ${relationship.target}`);
      pill.addEventListener("click", stopTooltipLinkPropagation);
    }
    if (relationship.evidence) {
      pill.tabIndex = 0;
      const tooltip = document.createElement("span");
      tooltip.className = "detail-tooltip relationship-tooltip";
      tooltip.role = "tooltip";
      tooltip.textContent = relationship.evidence;
      tooltip.addEventListener("click", stopTooltipLinkPropagation);
      pill.appendChild(tooltip);
    }
    return pill;
  };

  const createRelationshipSections = (item) => {
    const relationships = getRelationshipsForItem(item);
    if (!relationships.length) return null;

    const wrapper = document.createElement("div");
    wrapper.className = "relationship-sections";

    RELATIONSHIP_GROUPS.forEach((group) => {
      const matches = relationships.filter((relationship) => relationship.type === group.type);
      if (!matches.length) return;

      const section = document.createElement("div");
      section.className = "relationship-section";
      const label = document.createElement("span");
      label.className = "relationship-heading";
      label.textContent = group.label;
      const list = document.createElement("div");
      list.className = "relationship-pill-list";
      matches.forEach((relationship) => list.appendChild(createRelationshipPill(relationship)));
      section.appendChild(label);
      section.appendChild(list);
      wrapper.appendChild(section);
    });

    const groupedTypes = new Set(RELATIONSHIP_GROUPS.map((group) => group.type));
    const otherRelationships = relationships.filter((relationship) => !groupedTypes.has(relationship.type));
    if (otherRelationships.length) {
      const section = document.createElement("div");
      section.className = "relationship-section";
      const label = document.createElement("span");
      label.className = "relationship-heading";
      label.textContent = "Related";
      const list = document.createElement("div");
      list.className = "relationship-pill-list";
      otherRelationships.forEach((relationship) => list.appendChild(createRelationshipPill(relationship)));
      section.appendChild(label);
      section.appendChild(list);
      wrapper.appendChild(section);
    }

    return wrapper.children.length ? wrapper : null;
  };

  const setDetails = (item, options = {}) => {
    if (!item) return;
    detailFields.name.textContent = item.name || "Unknown";
    ensureImage(detailFields.image, detailFields.imageFallback, item, page.imageFolder);
    tooltipPinning.unpinPinnedTooltip();

    const container = detailFields.properties;
    container.innerHTML = "";
    appendRow(
      container,
      [
        ["ID", formatValue(item.id)],
        ["Use Type", item.useTypeLabel],
        ["Value", formatNumber(item.value)],
      ],
      3
    );
    appendRow(container, [["Traits", createTraitList(item.traits)]], 1);
    appendDivider(container);
    appendRow(container, [["Crafting Data", createCraftingSummary(item)]], 1);
    appendDivider(container);
    const relationshipSections = createRelationshipSections(item);
    if (relationshipSections) {
      appendRow(container, [["Relationships", relationshipSections]], 1);
      appendDivider(container);
    }
    appendRow(
      container,
      [
        ["Animated", item.animated ? "Yes" : "No"],
        ["Emits Light", item.emitsLight ? "Yes" : "No"],
        ["Animation Frames", formatNumber(item.fields.animation_frame_count)],
      ],
      3
    );

    tooltipPinning.attachTooltipPinning(details);
    details.classList.add("show");
    if (options.scroll !== false) details.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const clearDetails = (options = {}) => {
    details.classList.remove("show");
    tooltipPinning.unpinPinnedTooltip();
    if (options.updateUrl) updateListUrl({ replace: options.replaceUrl });
  };

  const selectItem = (item, options = {}) => {
    if (!item) return;
    if (options.updateUrl) updateDetailUrl(item, { replace: options.replaceUrl });
    setDetails(item, { scroll: options.scroll });
  };

  const maybeSelectPendingItem = (list) => {
    if (!pendingItemId && !pendingItemName) return;
    const match =
      findByRoute(list || items, pendingItemId, pendingItemName) ||
      findByRoute(items, pendingItemId, pendingItemName);
    if (!match) return;
    pendingItemId = "";
    pendingItemName = "";
    selectItem(match, { updateUrl: false });
  };

  const renderTable = (rows) => {
    if (!rows.length) {
      renderEmpty(`No ${page.countLabel} match your filters.`);
      return;
    }

    const fragment = document.createDocumentFragment();
    rows.forEach((item) => {
      const tr = document.createElement("tr");
      tr.dataset.id = getItemId(item);
      COLUMNS.forEach((col) => {
        const td = document.createElement("td");
        const value = item[col.key];
        if (col.key === "image") {
          td.appendChild(createImageThumb(item));
        } else if (col.key === "name") {
          const link = document.createElement("a");
          link.href = buildDetailUrl(item);
          link.className = "misc-item-link";
          link.textContent = formatValue(value);
          link.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            selectItem(item, { updateUrl: true });
          });
          td.appendChild(link);
        } else if (col.render) {
          const rendered = col.render(value, item);
          if (rendered instanceof Node) td.appendChild(rendered);
          else td.textContent = formatValue(rendered);
        } else if (col.format) {
          td.textContent = col.format(value);
        } else {
          td.textContent = formatValue(value);
        }
        tr.appendChild(td);
      });
      tr.addEventListener("click", () => selectItem(item, { updateUrl: true }));
      fragment.appendChild(tr);
    });

    tableBody.innerHTML = "";
    tableBody.appendChild(fragment);
    maybeSelectPendingItem(rows);
  };

  const applyFilterAndSort = () => {
    if (!Array.isArray(items) || !items.length) {
      renderEmpty(`No ${page.countLabel} found in ${page.dataFile}.`);
      return;
    }

    const filtered = items.filter((item) => {
      const matchesUseType =
        selectedUseTypes.size === 0 || selectedUseTypes.has(normalizeFilterValue(item.useTypeLabel));
      const itemTraitKeys = new Set(item.traits.map((trait) => trait.key));
      const matchesTraits =
        selectedTraits.size === 0 || Array.from(selectedTraits).every((trait) => itemTraitKeys.has(trait));
      if (!matchesUseType || !matchesTraits) return false;
      if (!searchTerm) return true;
      return getItemSearchText(item).includes(searchTerm.toLowerCase());
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
      countLabel.textContent = `${count} ${count === 1 ? page.queryKey : page.countLabel}`;
    }
    renderTable(sorted);
  };

  window.addEventListener("popstate", () => {
    const route = getRouteFromLocation();
    pendingItemId = route.id;
    pendingItemName = route.name;
    if (!pendingItemId && !pendingItemName) {
      clearDetails({ updateUrl: false });
      return;
    }
    if (!items.length) return;
    const selected = getSelectedFromLocation(items);
    pendingItemId = "";
    pendingItemName = "";
    if (selected) selectItem(selected, { updateUrl: false, scroll: false });
    else clearDetails({ updateUrl: false });
  });

  const init = () => {
    Promise.all([fetchJsonCached(dataUrl.toString()), fetchJsonCached(relationshipDataUrl.toString())])
      .then(([data, relationshipData]) => {
        relationshipDataByKey = createRelationshipDataByKey(relationshipData);
        items = (Array.isArray(data) ? data : []).map((row) => normalizeItem(row)).filter(Boolean);
        if (!items.length) {
          renderEmpty(`Add ${page.dataFile} beside this page to see ${page.countLabel}.`);
          return;
        }
        buildHead();
        populateFilters(items);
        if (initialItemSearchTerm) {
          searchTerm = initialItemSearchTerm;
          if (searchInput) searchInput.value = initialItemSearchTerm;
        }
        applyFilterAndSort();
      })
      .catch(() => {
        renderEmpty(`Unable to load ${page.countLabel}. Add ${page.dataFile} beside this page.`);
      });
  };

  if (searchInput) {
    searchInput.placeholder = page.searchPlaceholder;
    searchInput.addEventListener("input", (event) => {
      searchTerm = event.target.value || "";
      applyFilterAndSort();
    });
  }

  if (useTypeFilter) {
    enableToggleSelect(useTypeFilter);
    useTypeFilter.addEventListener("change", () => {
      selectedUseTypes = new Set(Array.from(useTypeFilter.selectedOptions).map((option) => option.value));
      applyFilterAndSort();
    });
  }

  if (traitFilter) {
    enableToggleSelect(traitFilter);
    traitFilter.addEventListener("change", () => {
      selectedTraits = new Set(Array.from(traitFilter.selectedOptions).map((option) => option.value));
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
