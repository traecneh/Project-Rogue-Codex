(() => {
  const PERK_ROUTE_PARAM = "perk";
  const SOURCE_LIMIT = 8;
  const PERK_GROUP_ORDER = [
    "Slayer & Bane",
    "Ailment Offense",
    "General Offense",
    "Proc Buffs",
    "Sustain & Healing",
    "Mitigation & Shields",
    "Resistances",
    "Ailment Avoidance",
    "Utility & Economy",
  ];
  const RACE_PERK_SOURCES = [
    { perk: "Desperation", name: "Human", href: "pages/stats/races.html" },
    { perk: "Frozen Heart", name: "Tundrian", href: "pages/stats/races.html" },
    { perk: "Demon Blood", name: "Brimlock", href: "pages/stats/races.html" },
    { perk: "Magic Shield", name: "Komodan", href: "pages/stats/races.html" },
    { perk: "Parry", name: "Elf", href: "pages/stats/races.html" },
    { perk: "Hazmat", name: "Orc", href: "pages/stats/races.html" },
    { perk: "Rejuvenation", name: "Gnoll", href: "pages/stats/races.html" },
    { perk: "Alchemist", name: "Dark Elf", href: "pages/stats/races.html" },
  ];

  const perkJump = document.getElementById("perk-jump");
  const perkSearch = document.getElementById("perk-search");
  const typeFilter = document.getElementById("perk-type-filter");
  const groupFilter = document.getElementById("perk-group-filter");
  const clearButton = document.getElementById("perk-clear");
  const resultCount = document.getElementById("perk-result-count");
  const emptyState = document.querySelector("[data-perk-empty]");
  const perkList = document.getElementById("perk-list-cards");
  const uniquePerkList = document.getElementById("unique-perk-cards");
  const uniqueSection = document.getElementById("unique-effects");

  const groupOrderMap = new Map(PERK_GROUP_ORDER.map((label, index) => [label.toLowerCase(), index]));
  const state = {
    perks: [],
    records: [],
    selectedCard: null,
    sourcesByPerk: new Map(),
  };

  const getPerkApi = () => window.RogueCodexPerks || {};

  const getPreferredScrollBehavior = () => {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    } catch (error) {
      return "smooth";
    }
  };

  const getPerkSlug = (name) => {
    if (!name) return "";
    const slug = String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug ? `perk-${slug}` : "";
  };

  const normalizePerkName = (value) =>
    String(value || "")
      .trim()
      .replace(/\s*\(\s*tier\s*\d+\s*\)\s*$/i, "")
      .replace(/\s*\(\s*t\s*\d+\s*\)\s*$/i, "")
      .replace(/\s*tier\s*\d+\s*$/i, "")
      .trim()
      .toLowerCase();

  const getPerkName = (entry) => (entry && typeof entry.name === "string" ? entry.name.trim() : "");
  const sortByName = (left, right) => getPerkName(left).localeCompare(getPerkName(right));
  const normalizeGroupLabel = (value) => String(value || "").trim();

  const sortGroupLabels = (left, right) => {
    const leftKey = String(left || "");
    const rightKey = String(right || "");
    const leftIndex = groupOrderMap.has(leftKey.toLowerCase())
      ? groupOrderMap.get(leftKey.toLowerCase())
      : Number.MAX_SAFE_INTEGER;
    const rightIndex = groupOrderMap.has(rightKey.toLowerCase())
      ? groupOrderMap.get(rightKey.toLowerCase())
      : Number.MAX_SAFE_INTEGER;
    if (leftIndex !== rightIndex) return leftIndex - rightIndex;
    return leftKey.localeCompare(rightKey);
  };

  const fetchJson = async (targetUrl) => {
    const fetchJsonCached = window.RogueCodexUtils?.fetchJsonCached;
    if (typeof fetchJsonCached === "function") {
      return fetchJsonCached(targetUrl);
    }
    const response = await fetch(targetUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed to load ${targetUrl}`);
    return response.json();
  };

  const fetchPerksIndex = async () => {
    const api = getPerkApi();
    if (typeof api.fetchPerksIndex === "function") {
      return api.fetchPerksIndex();
    }
    return fetchJson(new URL("pages/systems/perks.json", document.baseURI).toString());
  };

  const loadReferenceData = async () => {
    const [index, weapons, armors] = await Promise.all([
      fetchPerksIndex(),
      fetchJson(new URL("pages/items/weapons_data05.json", document.baseURI).toString()).catch(() => []),
      fetchJson(new URL("pages/items/armors_data06.json", document.baseURI).toString()).catch(() => []),
    ]);
    return {
      perks: Array.isArray(index?.perks) ? index.perks : [],
      weapons: Array.isArray(weapons) ? weapons : [],
      armors: Array.isArray(armors) ? armors : [],
    };
  };

  const addSource = (map, perkName, source) => {
    const key = normalizePerkName(perkName);
    if (!key || !source?.name) return;
    const list = map.get(key) || [];
    const sourceKey = `${source.kind}:${String(source.name).toLowerCase()}`;
    if (!list.some((entry) => entry.sourceKey === sourceKey)) {
      list.push({ ...source, sourceKey });
      map.set(key, list);
    }
  };

  const itemPerkLabels = (fields) =>
    [fields?.perk_label, fields?.corrupted_perk_label, fields?.perk, fields?.corrupted_perk]
      .map((value) => (value === null || value === undefined ? "" : String(value).trim()))
      .filter(Boolean);

  const itemHref = (kind, name) => {
    const encoded = encodeURIComponent(name || "");
    if (kind === "weapon") return `pages/items/weapons.html?weapon=${encoded}`;
    if (kind === "armor") return `pages/items/armors.html?armor=${encoded}`;
    return "";
  };

  const buildPerkSourceIndex = ({ weapons, armors }) => {
    const map = new Map();
    weapons.forEach((row) => {
      const name = String(row?.name || row?.Name || "").trim();
      if (!name) return;
      itemPerkLabels(row?.fields || {}).forEach((perkName) => {
        addSource(map, perkName, { kind: "weapon", label: "Weapon", name, href: itemHref("weapon", name) });
      });
    });
    armors.forEach((row) => {
      const name = String(row?.name || row?.Name || "").trim();
      if (!name) return;
      itemPerkLabels(row?.fields || {}).forEach((perkName) => {
        addSource(map, perkName, { kind: "armor", label: "Armor", name, href: itemHref("armor", name) });
      });
    });
    RACE_PERK_SOURCES.forEach((source) => {
      addSource(map, source.perk, { kind: "race", label: "Race", name: source.name, href: source.href });
    });
    map.forEach((sources) => {
      sources.sort((left, right) => {
        const kindOrder = { weapon: 0, armor: 1, race: 2 };
        const leftKind = kindOrder[left.kind] ?? 99;
        const rightKind = kindOrder[right.kind] ?? 99;
        if (leftKind !== rightKind) return leftKind - rightKind;
        return left.name.localeCompare(right.name);
      });
    });
    return map;
  };

  const buildPerkGroups = (list) => {
    const grouped = new Map();
    const ungrouped = [];
    list.forEach((entry) => {
      const name = getPerkName(entry);
      if (!name) return;
      const group = normalizeGroupLabel(entry.group);
      if (!group) {
        ungrouped.push(entry);
        return;
      }
      const items = grouped.get(group) || [];
      items.push(entry);
      grouped.set(group, items);
    });
    grouped.forEach((items) => items.sort(sortByName));
    ungrouped.sort(sortByName);
    return {
      grouped,
      groupLabels: Array.from(grouped.keys()).sort(sortGroupLabels),
      ungrouped,
    };
  };

  const createGroupSection = (label) => {
    const section = document.createElement("section");
    section.className = "perk-group";
    section.dataset.perkGroupSection = label;
    const header = document.createElement("h3");
    header.className = "perk-group-header";
    header.textContent = label;
    section.appendChild(header);
    const grid = document.createElement("div");
    grid.className = "stat-grid perk-grid";
    section.appendChild(grid);
    return { section, grid };
  };

  const addPerkAbbreviation = (card, entry) => {
    const abbrev = entry?.abbreviation ? String(entry.abbreviation).trim() : "";
    if (!abbrev || card.querySelector(".perk-abbrev")) return;
    const badge = document.createElement("span");
    badge.className = "perk-abbrev";
    badge.textContent = abbrev;
    const heading = card.querySelector("h3");
    if (heading) {
      heading.insertAdjacentElement("afterend", badge);
    } else {
      card.appendChild(badge);
    }
  };

  const renderPerkSources = (card, entry) => {
    const name = getPerkName(entry);
    const sources = state.sourcesByPerk.get(normalizePerkName(name)) || [];
    const wrapper = document.createElement("div");
    wrapper.className = "perk-source-list";
    const label = document.createElement("span");
    label.className = "perk-source-label";
    label.textContent = "Found on";
    wrapper.appendChild(label);

    if (!sources.length) {
      const empty = document.createElement("span");
      empty.className = "perk-source-chip perk-source-more";
      empty.textContent = "No linked item source";
      wrapper.appendChild(empty);
      card.appendChild(wrapper);
      return;
    }

    sources.slice(0, SOURCE_LIMIT).forEach((source) => {
      const chip = document.createElement(source.href ? "a" : "span");
      chip.className = "perk-source-chip";
      chip.dataset.sourceKind = source.kind || "source";
      chip.textContent = `${source.label}: ${source.name}`;
      chip.title = `${source.label}: ${source.name}`;
      if (source.href) chip.href = source.href;
      wrapper.appendChild(chip);
    });
    if (sources.length > SOURCE_LIMIT) {
      const more = document.createElement("span");
      more.className = "perk-source-chip perk-source-more";
      more.textContent = `+${sources.length - SOURCE_LIMIT} more`;
      more.title = sources.slice(SOURCE_LIMIT).map((source) => `${source.label}: ${source.name}`).join("\n");
      wrapper.appendChild(more);
    }
    card.appendChild(wrapper);
  };

  const buildPerkCard = (entry) => {
    const api = getPerkApi();
    const card =
      typeof api.buildPerkCard === "function" ? api.buildPerkCard(entry) : document.createElement("section");
    if (!card.classList.contains("stat-card")) card.classList.add("stat-card");
    const name = getPerkName(entry);
    const slug = entry?.slug || getPerkSlug(name);
    if (slug) card.id = slug;
    if (name) {
      card.dataset.perkName = name;
      card.setAttribute("aria-label", `${name} perk details`);
    }
    card.dataset.perkType = entry?.isUnique === true ? "unique" : "standard";
    card.dataset.perkGroup = entry?.isUnique === true ? "Unique Perks" : normalizeGroupLabel(entry.group || "Perks");
    card.tabIndex = 0;
    addPerkAbbreviation(card, entry);
    renderPerkSources(card, entry);
    return card;
  };

  const serializeSearchText = (entry) => {
    const name = getPerkName(entry);
    const sources = state.sourcesByPerk.get(normalizePerkName(name)) || [];
    return [
      name,
      entry?.abbreviation,
      entry?.group,
      entry?.isUnique === true ? "unique" : "standard",
      ...(Array.isArray(entry?.details) ? entry.details : []),
      ...sources.map((source) => `${source.label} ${source.name}`),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  };

  const registerCard = (card, entry, groupSection) => {
    const name = getPerkName(entry);
    const slug = entry?.slug || getPerkSlug(name);
    const record = {
      card,
      entry,
      groupSection,
      name,
      slug,
      type: entry?.isUnique === true ? "unique" : "standard",
      group: entry?.isUnique === true ? "Unique Perks" : normalizeGroupLabel(entry.group || "Perks"),
      searchText: serializeSearchText(entry),
    };
    state.records.push(record);

    const activate = (event) => {
      if (event?.target?.closest?.("a")) return;
      if (state.selectedCard === card) {
        clearSelectedPerk({ updateUrl: true });
        return;
      }
      selectPerk(name, { updateUrl: true, scroll: false });
    };
    card.addEventListener("click", activate);
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      activate(event);
    });
  };

  const renderPerkCards = (perks) => {
    if (!perkList || !uniquePerkList) return;
    state.records = [];
    perkList.innerHTML = "";
    uniquePerkList.innerHTML = "";

    const validPerks = perks.filter((entry) => getPerkName(entry));
    const normal = validPerks.filter((entry) => entry.isUnique !== true);
    const unique = validPerks.filter((entry) => entry.isUnique === true).sort(sortByName);

    const appendCard = (container, entry, groupSection) => {
      const card = buildPerkCard(entry);
      container.appendChild(card);
      registerCard(card, entry, groupSection);
    };

    const appendGroup = (label, items) => {
      if (!items.length) return;
      const { section, grid } = createGroupSection(label);
      items.forEach((entry) => appendCard(grid, entry, section));
      perkList.appendChild(section);
    };

    if (!normal.length) {
      const empty = document.createElement("p");
      empty.textContent = "Perks unavailable.";
      perkList.appendChild(empty);
    } else {
      const { grouped, groupLabels, ungrouped } = buildPerkGroups(normal);
      appendGroup("Perks", ungrouped);
      groupLabels.forEach((label) => appendGroup(label, grouped.get(label) || []));
    }

    if (!unique.length) {
      const empty = document.createElement("p");
      empty.textContent = "Unique perks unavailable.";
      uniquePerkList.appendChild(empty);
    } else {
      unique.forEach((entry) => appendCard(uniquePerkList, entry, uniqueSection));
    }
  };

  const populatePerkJump = () => {
    if (!perkJump) return;
    const records = [...state.records].sort((left, right) => left.name.localeCompare(right.name));
    perkJump.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Jump to...";
    perkJump.appendChild(placeholder);
    records.forEach((record) => {
      const option = document.createElement("option");
      option.value = record.name;
      option.textContent = record.name;
      perkJump.appendChild(option);
    });
  };

  const populateGroupFilter = () => {
    if (!groupFilter) return;
    const groups = Array.from(new Set(state.records.map((record) => record.group).filter(Boolean))).sort(sortGroupLabels);
    groupFilter.innerHTML = '<option value="">All groups</option>';
    groups.forEach((group) => {
      const option = document.createElement("option");
      option.value = group;
      option.textContent = group;
      groupFilter.appendChild(option);
    });
  };

  const getRouteValue = () => {
    const params = new URLSearchParams(window.location.search || "");
    return params.get(PERK_ROUTE_PARAM) || (window.location.hash ? window.location.hash.slice(1) : "");
  };

  const findRecord = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const normalized = normalizePerkName(raw.replace(/^perk-/, ""));
    return (
      state.records.find((record) => record.name.toLowerCase() === raw.toLowerCase()) ||
      state.records.find((record) => record.slug === raw || record.slug === `perk-${raw}`) ||
      state.records.find((record) => normalizePerkName(record.name) === normalized)
    );
  };

  const updateRoute = (record) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set(PERK_ROUTE_PARAM, record.name);
      url.hash = "";
      history.replaceState({ perk: record.name }, "", url);
    } catch (error) {
      /* noop */
    }
  };

  const clearRoute = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete(PERK_ROUTE_PARAM);
      url.hash = "";
      history.replaceState({ perk: null }, "", url);
    } catch (error) {
      /* noop */
    }
  };

  const clearSelectedPerk = ({ updateUrl = false } = {}) => {
    if (state.selectedCard) {
      state.selectedCard.classList.remove("perk-selected");
      state.selectedCard = null;
    }
    if (perkJump) perkJump.value = "";
    if (updateUrl) clearRoute();
  };

  const selectPerk = (value, { updateUrl = false, scroll = true } = {}) => {
    const record = findRecord(value);
    if (!record) return null;
    if (state.selectedCard && state.selectedCard !== record.card) {
      state.selectedCard.classList.remove("perk-selected");
    }
    state.selectedCard = record.card;
    record.card.classList.add("perk-selected");
    if (perkJump) perkJump.value = record.name;
    if (scroll) {
      record.card.scrollIntoView({ behavior: getPreferredScrollBehavior(), block: "start" });
    }
    if (updateUrl) updateRoute(record);
    return record;
  };

  const updateGroupVisibility = () => {
    const groups = new Set(state.records.map((record) => record.groupSection).filter(Boolean));
    groups.forEach((group) => {
      const hasVisible = state.records.some(
        (record) => record.groupSection === group && !record.card.classList.contains("perk-card-hidden")
      );
      group.classList.toggle("perk-group-hidden", !hasVisible);
    });
  };

  const applyPerkFilters = () => {
    const query = String(perkSearch?.value || "").trim().toLowerCase();
    const type = typeFilter?.value || "";
    const group = groupFilter?.value || "";
    let visibleCount = 0;
    state.records.forEach((record) => {
      const matchesQuery = !query || record.searchText.includes(query);
      const matchesType = !type || record.type === type;
      const matchesGroup = !group || record.group === group;
      const visible = matchesQuery && matchesType && matchesGroup;
      record.card.classList.toggle("perk-card-hidden", !visible);
      if (visible) visibleCount += 1;
    });
    updateGroupVisibility();
    if (resultCount) {
      const total = state.records.length;
      resultCount.textContent = `${visibleCount} of ${total} perks shown`;
    }
    if (emptyState) {
      emptyState.hidden = visibleCount !== 0;
    }
  };

  const clearFilters = () => {
    if (perkSearch) perkSearch.value = "";
    if (typeFilter) typeFilter.value = "";
    if (groupFilter) groupFilter.value = "";
    applyPerkFilters();
  };

  const bindControls = () => {
    if (perkSearch) perkSearch.addEventListener("input", applyPerkFilters);
    if (typeFilter) typeFilter.addEventListener("change", applyPerkFilters);
    if (groupFilter) groupFilter.addEventListener("change", applyPerkFilters);
    if (clearButton) clearButton.addEventListener("click", clearFilters);
    if (perkJump) {
      perkJump.addEventListener("change", () => {
        const value = perkJump.value || "";
        if (!value) return;
        clearFilters();
        selectPerk(value, { updateUrl: true, scroll: true });
      });
    }
    window.addEventListener("popstate", () => {
      const value = getRouteValue();
      if (value) {
        selectPerk(value, { updateUrl: false, scroll: true });
      } else {
        clearSelectedPerk();
      }
    });
    window.addEventListener("hashchange", () => {
      const value = getRouteValue();
      if (value) {
        selectPerk(value, { updateUrl: false, scroll: true });
      } else {
        clearSelectedPerk();
      }
    });
  };

  const initializePerksPage = async () => {
    const data = await loadReferenceData().catch((error) => {
      console.warn(error.message || error);
      return { perks: [], weapons: [], armors: [] };
    });
    state.perks = data.perks;
    state.sourcesByPerk = buildPerkSourceIndex(data);
    renderPerkCards(state.perks);
    populatePerkJump();
    populateGroupFilter();
    bindControls();
    applyPerkFilters();
    const routeValue = getRouteValue();
    if (routeValue) selectPerk(routeValue, { updateUrl: false, scroll: true });
  };

  document.addEventListener("DOMContentLoaded", initializePerksPage);
})();
