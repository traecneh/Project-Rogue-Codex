(() => {
  const normalizeItemId = (value) =>
    (value || "")
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const normalizeSortValue = (value) => {
    if (value === null || value === undefined) return "";
    if (typeof value === "number") return value;
    if (typeof value === "boolean") return value ? 1 : 0;
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value).toLowerCase();
  };

  const formatValue = (value, options = {}) => {
    if (value === null || value === undefined || (options.emptyStringAsDash && value === "")) return "-";
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

  const formatRange = (min, max) => {
    const hasMin = min !== null && min !== undefined && min !== "";
    const hasMax = max !== null && max !== undefined && max !== "";
    if (hasMin && hasMax) return `${formatNumber(min)} - ${formatNumber(max)}`;
    if (hasMin) return `${formatNumber(min)}`;
    if (hasMax) return `${formatNumber(max)}`;
    return "-";
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

  const stopTooltipLinkPropagation = (event) => {
    event.stopPropagation();
  };

  const createTooltipPinningController = () => {
    let pinnedTooltip = null;
    let pinDocumentListenerAttached = false;

    const unpinTooltip = (tooltip) => {
      if (!tooltip) return;
      tooltip.classList.remove("is-pinned");
      if (pinnedTooltip === tooltip) pinnedTooltip = null;
    };

    const unpinPinnedTooltip = () => {
      if (pinnedTooltip) unpinTooltip(pinnedTooltip);
    };

    const attachTooltipPinning = (root) => {
      const scope = root || document;
      const tooltips = scope.querySelectorAll(".detail-pill .detail-tooltip");
      tooltips.forEach((tooltip) => {
        if (!tooltip || tooltip.dataset.pinWired === "1") return;
        const pill = tooltip.closest(".detail-pill");
        if (!pill) return;
        const isNavigationPill = pill.tagName === "A";

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

        if (!isNavigationPill) {
          pill.addEventListener("click", toggle);
          pill.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              toggle(event);
            }
          });
        }
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
    };

    return {
      attachTooltipPinning,
      unpinPinnedTooltip,
      unpinTooltip,
    };
  };

  const createImageLoader = (defaultFolder, preloadedFolders = []) => {
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

    Array.from(new Set([defaultFolder, ...preloadedFolders].filter(Boolean))).forEach((folder) =>
      loadImageManifest(folder)
    );

    const deriveImageCandidates = (item, folder = defaultFolder) => {
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
      const id = item && item.id !== null && item.id !== undefined ? String(item.id).trim() : "";
      if (trimmed && id && id !== trimmed) {
        const nameWithId = `${trimmed}-${id}`;
        const nameWithIdKey = nameWithId.toLowerCase();
        if (manifest && manifest.has(nameWithIdKey)) {
          candidates.push(manifest.get(nameWithIdKey));
        }
        const encodedNameWithId = encodeURIComponent(nameWithId);
        candidates.push(`images/${folder}/${encodedNameWithId}.gif`, `images/${folder}/${encodedNameWithId}.png`);
      }
      return Array.from(new Set(candidates.filter(Boolean)));
    };

    const ensureImage = (img, fallback, item, folder = defaultFolder) => {
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

    return {
      deriveImageCandidates,
      ensureImage,
      loadImageManifest,
    };
  };

  const createRouteHelpers = ({
    fallbackPath,
    getItemId,
    getItemName,
    queryKeys,
    stateKey,
    normalizeId = normalizeItemId,
  }) => {
    const primaryQueryKey = Array.isArray(queryKeys) && queryKeys.length ? queryKeys[0] : "item";
    const allQueryKeys = Array.isArray(queryKeys) && queryKeys.length ? queryKeys : [primaryQueryKey];

    const getDetailName = (item) => {
      const name = getItemName ? getItemName(item) : item && item.name;
      return name ? name.toString().trim() : "";
    };

    const buildDetailStateUrl = (item) => {
      const name = getDetailName(item);
      if (!name) return "";
      const path = window.location.pathname || fallbackPath;
      return `${path}?${primaryQueryKey}=${encodeURIComponent(name)}`;
    };

    const buildListUrl = () => window.location.pathname || fallbackPath;

    const pushHistoryState = (state, targetUrl, replace) => {
      if (!targetUrl || !window.history || !window.history.pushState) return;
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      if (currentUrl === targetUrl) return;
      try {
        if (replace) {
          history.replaceState(state, "", targetUrl);
        } else {
          history.pushState(state, "", targetUrl);
        }
      } catch (error) {
        // Ignore history failures on nonstandard local file URLs.
      }
    };

    const updateDetailUrl = (item, options = {}) => {
      const itemId = getItemId ? getItemId(item) : normalizeId(getDetailName(item));
      const targetUrl = buildDetailStateUrl(item);
      if (!itemId || !targetUrl) return;
      const state = {};
      state[stateKey] = itemId;
      pushHistoryState(state, targetUrl, options.replace);
    };

    const updateListUrl = (options = {}) => {
      pushHistoryState({}, buildListUrl(), options.replace);
    };

    const getRouteFromLocation = () => {
      const params = new URLSearchParams(window.location.search);
      let raw = "";
      for (const key of allQueryKeys) {
        raw = (params.get(key) || "").trim();
        if (raw) break;
      }
      return {
        id: normalizeId(raw),
        name: raw.toLowerCase(),
      };
    };

    const findByRoute = (list, routeId, routeName) =>
      (Array.isArray(list) ? list : []).find((item) => {
        const id = getItemId ? getItemId(item) : normalizeId(getDetailName(item));
        const name = getDetailName(item);
        const nameId = normalizeId(name);
        const nameLower = name.toLowerCase();
        return (routeId && (id === routeId || nameId === routeId)) || (routeName && nameLower === routeName);
      });

    const getSelectedFromLocation = (list) => {
      const route = getRouteFromLocation();
      if (!route.id && !route.name) return null;
      return findByRoute(list, route.id, route.name);
    };

    return {
      buildDetailStateUrl,
      buildListUrl,
      findByRoute,
      getDetailName,
      getRouteFromLocation,
      getSelectedFromLocation,
      updateDetailUrl,
      updateListUrl,
    };
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

  const createDropsFromPill = ({
    buildMonsterDetailUrl,
    dropSources,
    formatMonsterTypeLabel,
    item,
    itemKind,
    monsters,
    normalizeFilterValue,
    normalizeMonsterId,
    utils,
  }) => {
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
          ? utils.getDropSourceMonsterIdsByItem(dropSources, itemKind, item?.name)
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

  window.RogueCodexItemPageUtils = {
    addDivider,
    addRow,
    createCell,
    createDropsFromPill,
    createImageLoader,
    createRouteHelpers,
    createTooltipPinningController,
    enableToggleSelect,
    ensureImage: (img, fallback, item, folder) => createImageLoader(folder || "items").ensureImage(img, fallback, item, folder),
    formatNumber,
    formatRange,
    formatValue,
    getMonsterDropRange,
    normalizeItemId,
    normalizeSortValue,
    setOptions,
    stopTooltipLinkPropagation,
    toNumber,
  };
})();
