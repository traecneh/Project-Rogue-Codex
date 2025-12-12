(() => {
  const DISCORD_CLIENT_ID = "1442870755108065320";
  const DISCORD_REDIRECT_URI = "https://traecneh.github.io/Project-Rogue-Codex/pages/General/trading-post.html";
  const DISCORD_SCOPE = "identify";
  const AUTH_STORAGE_KEY = "trading-post-discord-auth";
  const AUTH_STATE_KEY = "trading-post-discord-state";

  const state = {
    items: [],
    itemLookup: new Map(),
    listings: [],
    rarityDefs: [],
    perks: [],
    itemFilterText: "",
    auth: null,
    filters: {
      text: "",
      listingType: "all",
      category: "all",
    },
  };

  const els = {
    itemSelect: null,
    itemFilter: null,
    itemPreview: null,
    form: null,
    submitButton: null,
    listingTypeGroup: null,
    raritySelect: null,
    rarityNote: null,
    perkSelect: null,
    statStr: null,
    statDex: null,
    statCon: null,
    statStrValue: null,
    statDexValue: null,
    statConValue: null,
    statTotalNote: null,
    price: null,
    priceDisplay: null,
    priceCurrency: null,
    ign: null,
    notes: null,
    formStatus: null,
    filterSearch: null,
    filterType: null,
    filterCategory: null,
    listingFeed: null,
    listingCount: null,
    authStatus: null,
    loginBtn: null,
    logoutBtn: null,
  };

  document.addEventListener("DOMContentLoaded", () => {
    cacheElements();
    initializeAuthFlow();
    wireListingTypeChips();
    wireItemControls();
    wireForm();
    wireFilters();
    syncPriceFields();
    loadItemData();
  });

  function cacheElements() {
    els.itemSelect = document.getElementById("item-select");
    els.itemFilter = document.getElementById("item-filter");
    els.itemPreview = document.getElementById("item-preview");
    els.form = document.getElementById("listing-form");
    els.submitButton = els.form ? els.form.querySelector('button[type="submit"]') : null;
    els.listingTypeGroup = document.getElementById("listing-type");
    els.raritySelect = document.getElementById("rarity-select");
    els.rarityNote = document.getElementById("rarity-note");
    els.perkSelect = document.getElementById("perk-select");
    els.statStr = document.getElementById("stat-str");
    els.statDex = document.getElementById("stat-dex");
    els.statCon = document.getElementById("stat-con");
    els.statStrValue = document.getElementById("stat-str-value");
    els.statDexValue = document.getElementById("stat-dex-value");
    els.statConValue = document.getElementById("stat-con-value");
    els.statTotalNote = document.getElementById("stat-total-note");
    els.price = document.getElementById("price-input");
    els.priceDisplay = document.getElementById("price-value");
    els.priceCurrency = document.getElementById("price-currency");
    els.ign = document.getElementById("ign-input");
    els.notes = document.getElementById("notes-input");
    els.formStatus = document.getElementById("form-status");
    els.filterSearch = document.getElementById("filter-search");
    els.filterType = document.getElementById("filter-type");
    els.filterCategory = document.getElementById("filter-category");
    els.listingFeed = document.getElementById("listing-feed");
    els.listingCount = document.getElementById("listing-count");
    els.authStatus = document.getElementById("auth-status");
    els.loginBtn = document.getElementById("discord-login");
    els.logoutBtn = document.getElementById("discord-logout");
  }

  function wireListingTypeChips() {
    if (!els.listingTypeGroup) return;
    const chips = els.listingTypeGroup.querySelectorAll(".type-chip");
    chips.forEach((chip) => {
      const input = chip.querySelector('input[type="radio"]');
      const sync = () => {
        chips.forEach((node) => {
          const radio = node.querySelector('input[type="radio"]');
          node.dataset.active = radio && radio.checked ? "true" : "false";
        });
      };
      chip.addEventListener("click", () => {
        if (input) {
          input.checked = true;
          sync();
        }
      });
      if (input) {
        input.addEventListener("change", sync);
      }
      sync();
    });
  }

  function wireItemControls() {
    if (els.itemFilter) {
      els.itemFilter.addEventListener("input", (event) => {
        state.itemFilterText = (event.target.value || "").toLowerCase();
        renderItemSelect();
      });
    }
    if (els.itemSelect) {
      els.itemSelect.addEventListener("change", () => {
        const item = state.itemLookup.get(els.itemSelect.value);
        renderSelectedItem(item);
        updateRarityForItem(item);
      });
    }
    if (els.raritySelect) {
      els.raritySelect.addEventListener("change", () => {
        const rarity = getSelectedRarity();
        updateStatSliders(rarity);
        const currentItem = state.itemLookup.get(els.itemSelect?.value);
        const allowed = getAllowedRarities(currentItem);
        const allowedRangeText = allowed.length ? `${allowed[0].name} - ${allowed[allowed.length - 1].name}` : "";
        setRarityNote(
          rarity
            ? `Allowed rarities: ${allowedRangeText || "N/A"}. Bonus stats must total between ${rarity.min} and ${rarity.max}.`
            : ""
        );
      });
    }

    ["statStr", "statDex", "statCon"].forEach((key) => {
      const input = els[key];
      if (input) {
        input.addEventListener("input", () => updateStatLabels());
      }
    });

    if (els.price) {
      els.price.addEventListener("input", () => {
        syncPriceFields();
      });
    }
  }

  function initializeAuthFlow() {
    wireAuthButtons();
    const hashAuth = parseAuthFromHash();
    if (hashAuth) {
      setAuth(hashAuth);
      clearHash();
    } else {
      const stored = loadAuthFromStorage();
      if (stored) {
        setAuth(stored);
      } else {
        updateAuthUI();
        updateFormAvailability();
      }
    }
  }

  function wireAuthButtons() {
    if (els.loginBtn) {
      els.loginBtn.addEventListener("click", startDiscordLogin);
    }
    if (els.logoutBtn) {
      els.logoutBtn.addEventListener("click", () => {
        setAuth(null);
        setFormStatus("Signed out. Sign in with Discord to post.", "");
      });
    }
  }

  function startDiscordLogin() {
    const stateToken = generateStateToken();
    try {
      sessionStorage.setItem(AUTH_STATE_KEY, stateToken);
    } catch (error) {
      console.warn("Unable to persist state token", error);
    }
    const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
    authorizeUrl.searchParams.set("client_id", DISCORD_CLIENT_ID);
    authorizeUrl.searchParams.set("response_type", "token");
    authorizeUrl.searchParams.set("redirect_uri", DISCORD_REDIRECT_URI);
    authorizeUrl.searchParams.set("scope", DISCORD_SCOPE);
    authorizeUrl.searchParams.set("state", stateToken);
    window.location.href = authorizeUrl.toString();
  }

  function parseAuthFromHash() {
    if (!window.location.hash) return null;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get("access_token");
    const tokenType = params.get("token_type");
    const expiresIn = Number(params.get("expires_in") || 0);
    const returnedState = params.get("state");

    if (!accessToken || !tokenType || !expiresIn) return null;
    const storedState = safeReadStorage(AUTH_STATE_KEY);
    if (storedState && returnedState && storedState !== returnedState) {
      console.warn("State token mismatch; ignoring OAuth response.");
      return null;
    }

    const expiresAt = Date.now() + expiresIn * 1000;
    const auth = {
      accessToken,
      tokenType,
      expiresAt,
      obtainedAt: Date.now(),
      state: returnedState || null,
      user: null,
    };
    safeRemoveStorage(AUTH_STATE_KEY);
    return auth;
  }

  function clearHash() {
    if (window.history.replaceState) {
      window.history.replaceState(null, document.title, window.location.href.split("#")[0]);
    } else {
      window.location.hash = "";
    }
  }

  function loadAuthFromStorage() {
    try {
      const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.accessToken || !parsed.expiresAt) return null;
      if (Date.now() >= parsed.expiresAt) {
        safeRemoveStorage(AUTH_STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch (error) {
      console.warn("Failed to parse stored auth", error);
      return null;
    }
  }

  function persistAuth(auth) {
    try {
      if (auth) {
        sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
      } else {
        safeRemoveStorage(AUTH_STORAGE_KEY);
      }
    } catch (error) {
      console.warn("Failed to persist auth", error);
    }
  }

  function setAuth(auth, options = {}) {
    if (auth && auth.expiresAt && Date.now() >= auth.expiresAt) {
      auth = null;
    }
    state.auth = auth;
    persistAuth(auth);
    updateAuthUI();
    updateFormAvailability();

    if (auth && !auth.user && !options.skipUserFetch) {
      fetchDiscordUser(auth).catch(() => {
        setAuth(null, { skipUserFetch: true });
      });
    }
  }

  async function fetchDiscordUser(auth) {
    if (!auth?.accessToken) return null;
    try {
      const response = await fetch("https://discord.com/api/users/@me", {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      });
      if (!response.ok) {
        throw new Error(`Discord profile request failed: ${response.status}`);
      }
      const data = await response.json();
      const user = normalizeDiscordUser(data);
      setAuth({ ...auth, user }, { skipUserFetch: true });
      return user;
    } catch (error) {
      console.warn("Failed to fetch Discord user", error);
      throw error;
    }
  }

  function normalizeDiscordUser(raw) {
    const username = raw?.username || "Discord user";
    const discriminator = raw?.discriminator && raw.discriminator !== "0" ? `#${raw.discriminator}` : "";
    const tag = discriminator ? `${username}${discriminator}` : username;
    const globalName = raw?.global_name || null;
    const displayTag = globalName || tag || "Discord user";
    return {
      id: raw?.id,
      username,
      discriminator: raw?.discriminator || null,
      globalName,
      tag,
      displayTag,
      avatar: raw?.avatar || null,
    };
  }

  function updateAuthUI() {
    const auth = state.auth;
    if (!els.authStatus || !els.loginBtn || !els.logoutBtn) return;

    if (auth && auth.user) {
      els.authStatus.textContent = `Signed in as ${auth.user.displayTag}`;
      els.authStatus.dataset.variant = "success";
      els.logoutBtn.hidden = false;
      els.loginBtn.hidden = true;
    } else if (auth && !auth.user) {
      els.authStatus.textContent = "Signed in. Loading Discord profile...";
      els.authStatus.dataset.variant = "";
      els.logoutBtn.hidden = false;
      els.loginBtn.hidden = true;
    } else {
      els.authStatus.textContent = "Not signed in";
      delete els.authStatus.dataset.variant;
      els.logoutBtn.hidden = true;
      els.loginBtn.hidden = false;
    }
  }

  function updateFormAvailability() {
    if (!els.submitButton) return;
    const signedIn = Boolean(state.auth && state.auth.user);
    els.submitButton.disabled = !signedIn;
    if (!signedIn) {
      setFormStatus("Sign in with Discord to post a listing.", "");
    } else if (!els.formStatus.textContent || els.formStatus.textContent.includes("Sign in")) {
      setFormStatus("Signed in. You can post listings.", "success");
    }
  }

  function safeReadStorage(key) {
    try {
      return sessionStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function safeRemoveStorage(key) {
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      /* no-op */
    }
  }

  function generateStateToken() {
    if (window.crypto && window.crypto.getRandomValues) {
      const bytes = new Uint32Array(4);
      window.crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(8, "0")).join("");
    }
    return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
  }

  function wireForm() {
    if (!els.form) return;
    els.form.addEventListener("submit", (event) => {
      event.preventDefault();
      createListingFromForm();
    });
  }

  function wireFilters() {
    if (els.filterSearch) {
      els.filterSearch.addEventListener("input", (event) => {
        state.filters.text = (event.target.value || "").toLowerCase();
        renderListings();
      });
    }
    if (els.filterType) {
      els.filterType.addEventListener("change", (event) => {
        state.filters.listingType = event.target.value || "all";
        renderListings();
      });
    }
    if (els.filterCategory) {
      els.filterCategory.addEventListener("change", (event) => {
        state.filters.category = event.target.value || "all";
        renderListings();
      });
    }
  }

  async function loadItemData() {
    setFormStatus("Loading item data...", "");

    state.rarityDefs = getRarityDefinitions();

    const [weapons, armors] = await Promise.all([
      fetchJson("pages/items/weapons_data05.json"),
      fetchJson("pages/items/armors_data06.json"),
    ]);
    const weaponItems = Array.isArray(weapons) ? weapons.map((entry) => normalizeItem(entry, "Weapon")) : [];
    const armorItems = Array.isArray(armors) ? armors.map((entry) => normalizeItem(entry, "Armor")) : [];

    if (!weaponItems.length && !armorItems.length) {
      setFormStatus("Unable to load item data. Listings are disabled until data is available.", "error");
      if (els.itemSelect) {
        els.itemSelect.innerHTML = '<option value="">No item data found</option>';
        els.itemSelect.disabled = true;
      }
      return;
    }

    state.items = [...weaponItems, ...armorItems].sort((a, b) => a.name.localeCompare(b.name));
    state.itemLookup = new Map(state.items.map((item) => [item.id, item]));
    renderItemSelect();
    renderSelectedItem(null);
    updateRarityForItem(null);
    updateStatSliders(null);
    void loadPerkOptions();

    let persisted = [];
    try {
      persisted = await loadListingsFromBackend(); // TODO: hook this up to a real database (e.g., Firestore).
    } catch (error) {
      console.warn("Loading stored listings failed", error);
    }

    if (Array.isArray(persisted) && persisted.length) {
      state.listings = persisted;
    }
    seedListings();
    renderListings();
    const signedIn = Boolean(state.auth && state.auth.user);
    setFormStatus(
      signedIn ? "Item data loaded. Ready to post listings." : "Item data loaded. Sign in with Discord to post.",
      signedIn ? "success" : ""
    );
  }

  async function fetchJson(url) {
    const cachedFetch =
      window.RogueCodexUtils && typeof window.RogueCodexUtils.fetchJsonCached === "function"
        ? window.RogueCodexUtils.fetchJsonCached
        : null;
    if (cachedFetch) {
      return await cachedFetch(url);
    }
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to load ${url}`);
      return await response.json();
    } catch (error) {
      console.warn(error.message);
      return null;
    }
  }

  function getRarityDefinitions() {
    const base = Array.isArray(window.rarityDefinitions)
      ? window.rarityDefinitions
      : [
          { name: "Normal", min: 0, max: 0, color: "#ffffff" },
          { name: "Uncommon", min: 2, max: 5, color: "#ffd966" },
          { name: "Rare", min: 6, max: 10, color: "#0000ff" },
          { name: "Epic", min: 11, max: 15, color: "#741b47" },
          { name: "Legendary", min: 16, max: 20, color: "#ff9900" },
          { name: "Mythical", min: 21, max: 25, color: "#6aa84f" },
          { name: "Ascendant", min: 26, max: 30, color: "#ff0000" },
        ];
    return base.map((entry) => ({
      name: entry.name,
      min: Number(entry.min ?? 0),
      max: Number(entry.max ?? 0),
      color: entry.color || "#ffffff",
    }));
  }

  function findRarityIndex(name) {
    if (!name) return -1;
    return state.rarityDefs.findIndex((entry) => entry.name.toLowerCase() === String(name).toLowerCase());
  }

  function getAllowedRarities(item) {
    const defs = state.rarityDefs;
    if (!defs.length) return [];
    const minName = item?.minimumRarity || item?.rarity || defs[0].name;
    const maxName = item?.maximumRarity || item?.rarity || defs[defs.length - 1].name;
    let minIndex = findRarityIndex(minName);
    let maxIndex = findRarityIndex(maxName);
    if (minIndex === -1) minIndex = 0;
    if (maxIndex === -1) maxIndex = defs.length - 1;
    if (minIndex > maxIndex) [minIndex, maxIndex] = [maxIndex, minIndex];
    return defs.slice(minIndex, maxIndex + 1);
  }

  async function loadPerkOptions() {
    if (!els.perkSelect) return;
    try {
      if (typeof loadPerkCardData !== "function") {
        renderPerkOptions([]);
        return;
      }
      const { map } = await loadPerkCardData();
      const names = [];
      map.forEach((value) => {
        if (value.isUnique) return;
        const name = value.card?.querySelector("h3")?.textContent?.trim() || value.slug || "";
        if (name) names.push(name);
      });
      names.sort((a, b) => a.localeCompare(b));
      state.perks = names;
      renderPerkOptions(names);
    } catch (error) {
      console.warn("Failed to load perk options", error);
      renderPerkOptions([]);
    }
  }

  function renderPerkOptions(names) {
    if (!els.perkSelect) return;
    els.perkSelect.innerHTML = "";
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "No perk";
    els.perkSelect.appendChild(empty);
    names.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      els.perkSelect.appendChild(opt);
    });
  }

  function normalizeItem(raw, category) {
    const name = (raw?.Name || raw?.name || "").trim() || `${category} Item`;
    const subtype = raw?.Subtype || raw?.Type || (category === "Weapon" ? "Weapon" : "Armor");
    const minimumRarity = raw?.MinimumRarity || raw?.Minimumrarity || raw?.Minimum || raw?.MinimumTier || null;
    const maximumRarity = raw?.MaximumRarity || raw?.Maximumrarity || raw?.Maximum || raw?.MaximumTier || null;
    const rarity = minimumRarity || raw?.Rarity || maximumRarity || "Unknown";
    const level = raw?.Level ?? raw?.RequirementAmount ?? null;
    const slug = slugify(name);
    const icon = raw?.Icon ? `images/${category === "Weapon" ? "weapons" : "armors"}/${raw.Icon}` : null;
    const skillType = raw?.SkillType || raw?.Skill || "";
    const shardDecomp = typeof raw?.ShardDecompositionCount === "number" ? raw.ShardDecompositionCount : null;
    return {
      id: `${category}-${slug}`,
      name,
      category,
      subtype,
      rarity,
      level,
      icon,
      skillType,
      minimumRarity,
      maximumRarity,
      shardDecomp,
      raw,
    };
  }

  function renderItemSelect() {
    if (!els.itemSelect) return;
    const currentValue = els.itemSelect.value;
    els.itemSelect.innerHTML = "";
    els.itemSelect.disabled = false;

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select an item";
    els.itemSelect.appendChild(placeholder);

    const filter = state.itemFilterText;
    const filteredItems = filter
      ? state.items.filter((item) => {
          const name = item.name.toLowerCase();
          const skill = (item.skillType || "").toLowerCase();
          return name.includes(filter) || skill.includes(filter);
        })
      : state.items;

    const grouped = groupItemsByCategoryAndSubtype(filteredItems);
    grouped.forEach((subtypeMap, category) => {
      subtypeMap.forEach((items, subtype) => {
        const optgroup = document.createElement("optgroup");
        optgroup.label = `${category} - ${subtype}`;
        items.forEach((item) => {
          const option = document.createElement("option");
          option.value = item.id;
          option.textContent = item.name;
          optgroup.appendChild(option);
        });
        els.itemSelect.appendChild(optgroup);
      });
    });

    if (currentValue) {
      els.itemSelect.value = currentValue;
    }
  }

  function groupItemsByCategoryAndSubtype(items) {
    const result = new Map();
    items.forEach((item) => {
      const categoryMap = result.get(item.category) || new Map();
      const subtypeKey = item.subtype || "General";
      const arr = categoryMap.get(subtypeKey) || [];
      arr.push(item);
      categoryMap.set(subtypeKey, arr);
      result.set(item.category, categoryMap);
    });

    result.forEach((subMap) => {
      subMap.forEach((arr, key) => {
        subMap.set(
          key,
          arr.sort((a, b) => a.name.localeCompare(b.name))
        );
      });
    });

    return result;
  }

  function renderSelectedItem(item) {
    renderPreviewBlock(els.itemPreview, item, "Select an item to see its basics.");
  }

  function renderPreviewBlock(container, item, emptyText) {
    if (!container) return;
    container.innerHTML = "";

    if (!item) {
      const p = document.createElement("p");
      p.textContent = emptyText;
      container.appendChild(p);
      return;
    }

    const header = document.createElement("div");
    header.className = "preview-header";
    header.appendChild(buildAvatar(item));

    const headerText = document.createElement("div");
    const title = document.createElement("h4");
    title.textContent = item.name;
    headerText.appendChild(title);
    const subtitle = document.createElement("p");
    subtitle.textContent = `${item.category} - ${item.subtype}`;
    headerText.appendChild(subtitle);
    header.appendChild(headerText);

    container.appendChild(header);

    const meta = document.createElement("div");
    meta.className = "item-meta";
    meta.appendChild(makeChip(item.rarity || "Unknown rarity"));
    if (item.skillType) {
      meta.appendChild(makeChip(item.skillType));
    }
    if (typeof item.level === "number") {
      meta.appendChild(makeChip(`Level ${item.level}`));
    }
    if (item.minimumRarity || item.maximumRarity) {
      const min = item.minimumRarity || "Any";
      const max = item.maximumRarity || "Any";
      meta.appendChild(makeChip(`Rarity: ${min} - ${max}`));
    }
    if (typeof item.shardDecomp === "number") {
      meta.appendChild(makeChip(`Shard Decomp: ${item.shardDecomp}`));
    }
    container.appendChild(meta);
  }

  function makeChip(text) {
    const span = document.createElement("span");
    span.className = "item-chip";
    span.textContent = text;
    return span;
  }

  function buildAvatar(item) {
    const wrapper = document.createElement("div");
    wrapper.className = "item-avatar";

    if (item?.icon) {
      const img = document.createElement("img");
      img.src = item.icon;
      img.alt = `${item.name} icon`;
      img.loading = "lazy";
      img.onerror = () => {
        img.remove();
        wrapper.appendChild(makeAvatarFallback(item));
      };
      wrapper.appendChild(img);
      return wrapper;
    }

    wrapper.appendChild(makeAvatarFallback(item));
    return wrapper;
  }

  function makeAvatarFallback(item) {
    const fallback = document.createElement("span");
    fallback.className = "item-avatar-fallback";
    fallback.textContent = (item?.name || "?").slice(0, 1).toUpperCase();
    return fallback;
  }

  function updateRarityForItem(item) {
    if (!els.raritySelect) return;
    if (!item) {
      setRarityNote("Select an item to see rarity limits.");
    }
    const allowed = getAllowedRarities(item);
    els.raritySelect.innerHTML = "";

    if (!allowed.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No rarity available";
      els.raritySelect.appendChild(opt);
      els.raritySelect.disabled = true;
      setRarityNote("");
      return;
    }

    els.raritySelect.disabled = false;
    const allowedRangeText = `${allowed[0].name} - ${allowed[allowed.length - 1].name}`;
    allowed.forEach((entry, index) => {
      const opt = document.createElement("option");
      opt.value = entry.name;
      opt.textContent = entry.name;
      if (index === 0) opt.selected = true;
      els.raritySelect.appendChild(opt);
    });

    const rarity = getSelectedRarity();
    updateStatSliders(rarity);
    if (item) {
      setRarityNote(
        rarity
          ? `Allowed rarities: ${allowedRangeText}. Bonus stats must total between ${rarity.min} and ${rarity.max}.`
          : ""
      );
    }
  }

  function setRarityNote(text) {
    if (!els.rarityNote) return;
    els.rarityNote.textContent = text || "";
  }

  function getSelectedRarity() {
    const value = els.raritySelect ? els.raritySelect.value : "";
    if (!value) return null;
    return state.rarityDefs.find((entry) => entry.name === value) || null;
  }

  function updateStatSliders(rarity) {
    const sliders = [els.statStr, els.statDex, els.statCon].filter(Boolean);
    if (!sliders.length) return;
    const max = rarity ? Math.max(rarity.max || 0, rarity.min || 0) : 30;
    sliders.forEach((slider) => {
      if (!slider) return;
      slider.max = String(max);
      if (Number(slider.value) > max) {
        slider.value = String(max);
      }
      if (rarity && rarity.min > 0 && totalStats() === 0) {
        slider.value = String(Math.min(rarity.min, max));
      }
    });
    updateStatLabels();
  }

  function updateStatLabels() {
    if (els.statStrValue) els.statStrValue.textContent = els.statStr?.value || "0";
    if (els.statDexValue) els.statDexValue.textContent = els.statDex?.value || "0";
    if (els.statConValue) els.statConValue.textContent = els.statCon?.value || "0";
    updateStatTotalNote();
  }

  function totalStats() {
    return Number(els.statStr?.value || 0) + Number(els.statDex?.value || 0) + Number(els.statCon?.value || 0);
  }

  function updateStatTotalNote() {
    if (!els.statTotalNote) return;
    const total = totalStats();
    const rarity = getSelectedRarity();
    if (!rarity) {
      els.statTotalNote.textContent = `Total bonus: ${total}`;
    } else {
      els.statTotalNote.textContent = `Total bonus: ${total} (allowed ${rarity.min}-${rarity.max})`;
    }
  }

  function getPriceValue() {
    return Number(els.price?.value || 0);
  }

  function syncPriceFields() {
    if (!els.price || !els.priceDisplay) return;
    els.priceDisplay.textContent = els.price.value || "0";
  }
  function createListingFromForm() {
    if (!els.form || !els.itemSelect) return;

    const itemId = els.itemSelect.value;
    const item = state.itemLookup.get(itemId);
    if (!item) {
      setFormStatus("Pick a valid item before posting.", "error");
      return;
    }

    const rarityName = els.raritySelect ? els.raritySelect.value : "";
    const rarity = rarityName ? state.rarityDefs.find((entry) => entry.name === rarityName) : null;
    if (!rarity) {
      setFormStatus("Select a rarity within the item's range.", "error");
      return;
    }

    const stats = {
      str: Number(els.statStr?.value || 0),
      dex: Number(els.statDex?.value || 0),
      con: Number(els.statCon?.value || 0),
    };
    const statTotal = stats.str + stats.dex + stats.con;
    if (statTotal < rarity.min || statTotal > rarity.max) {
      setFormStatus(`Bonus stats must total between ${rarity.min} and ${rarity.max} for ${rarity.name}.`, "error");
      return;
    }

    const priceValue = getPriceValue();

    const perkName = (els.perkSelect?.value || "").trim();

    if (!state.auth || !state.auth.user) {
      setFormStatus("Sign in with Discord to post a listing.", "error");
      return;
    }
    if (state.auth.expiresAt && Date.now() >= state.auth.expiresAt) {
      setAuth(null);
      setFormStatus("Session expired. Please sign in with Discord again.", "error");
      return;
    }

    const listingTypeInput = els.form.querySelector('input[name="listingType"]:checked');
    const listingType = listingTypeInput ? listingTypeInput.value : "WTS";
    const price = getPriceValue();
    const priceCurrency = els.priceCurrency?.value || "Gold";
    const ign = (els.ign?.value || "").trim();
    const notes = (els.notes?.value || "").trim();

    const listing = {
      id: `listing-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      itemId: item.id,
      listingType,
      price: priceValue,
      priceCurrency,
      discordUser: state.auth.user,
      ign,
      notes,
      rarity: rarity.name,
      rarityColor: rarity.color,
      stats,
      perk: perkName || null,
      createdAt: Date.now(),
    };

    state.listings.unshift(listing);
    renderListings();
    setFormStatus(`Listing posted as ${state.auth.user.displayTag}.`, "success");
    els.form.reset();
    const defaultType = els.form.querySelector('input[name="listingType"][value="WTS"]');
    if (defaultType) {
      defaultType.checked = true;
      defaultType.dispatchEvent(new Event("change", { bubbles: true }));
    }
    renderSelectedItem(null);
    if (els.perkSelect) {
      els.perkSelect.value = "";
    }
    if (els.priceCurrency) {
      els.priceCurrency.value = "Gold";
    }
    if (els.price) {
      els.price.value = "0";
    }
    if (els.priceDisplay) {
      els.priceDisplay.textContent = "0";
    }
    updateRarityForItem(null);
    updateStatSliders(null);
    // TODO: hook this up to a real database (e.g., Firestore).
    void saveListingToBackend(listing);
  }

  function renderListings() {
    if (!els.listingFeed) return;
    const filtered = getFilteredListings();
    els.listingFeed.innerHTML = "";

    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = state.listings.length
        ? "No listings match the current filters."
        : "No listings yet. Be the first to post.";
      els.listingFeed.appendChild(empty);
      updateListingCount(0);
      return;
    }

    filtered.forEach((entry) => {
      const card = createListingCard(entry);
      els.listingFeed.appendChild(card);
    });

    updateListingCount(filtered.length);
  }

  function getFilteredListings() {
    return state.listings.filter((entry) => {
      const item = state.itemLookup.get(entry.itemId);
      const name = item?.name?.toLowerCase() || "";
      const notes = entry.notes?.toLowerCase() || "";
      const ign = entry.ign?.toLowerCase() || "";
      const userTag = (entry.discordUser?.displayTag || entry.discordUser?.tag || "").toLowerCase();
      const rarity = (entry.rarity || "").toLowerCase();
      const perk = (entry.perk || "").toLowerCase();
      const skill = (item?.skillType || "").toLowerCase();

      const matchesText =
        !state.filters.text ||
        name.includes(state.filters.text) ||
        notes.includes(state.filters.text) ||
        ign.includes(state.filters.text) ||
        userTag.includes(state.filters.text) ||
        rarity.includes(state.filters.text) ||
        perk.includes(state.filters.text) ||
        skill.includes(state.filters.text);

      const matchesType = state.filters.listingType === "all" || entry.listingType === state.filters.listingType;
      const matchesCategory = state.filters.category === "all" || item?.category === state.filters.category;

      return matchesText && matchesType && matchesCategory;
    });
  }

  function createListingCard(entry) {
    const item = state.itemLookup.get(entry.itemId);

    const card = document.createElement("article");
    card.className = "listing-card";

    const head = document.createElement("div");
    head.className = "listing-head";

    const titleWrap = document.createElement("div");
    titleWrap.className = "listing-title";

    const title = document.createElement("h4");
    title.textContent = item ? item.name : "Unknown item";
    titleWrap.appendChild(title);

    const typeTag = document.createElement("span");
    typeTag.className = `tag-pill ${entry.listingType.toLowerCase()}`;
    typeTag.textContent = entry.listingType;
    titleWrap.appendChild(typeTag);

    head.appendChild(titleWrap);

    const time = document.createElement("span");
    time.className = "meta-pill";
    time.textContent = formatTimestamp(entry.createdAt);
    head.appendChild(time);

    card.appendChild(head);

    const body = document.createElement("div");
    body.className = "listing-body";

    body.appendChild(textLine("Item", item ? `${item.category} - ${item.subtype}` : "Unavailable"));
    const priceText = entry.price ? `${entry.price} ${entry.priceCurrency || ""}`.trim() : "Offer";
    body.appendChild(textLine("Price", priceText));
    body.appendChild(textLine("Discord", formatDiscordUser(entry.discordUser)));
    if (entry.rarity) {
      body.appendChild(textLine("Rarity", entry.rarity));
    }
    if (entry.perk) {
      body.appendChild(textLine("Perk", entry.perk));
    }
    if (entry.stats) {
      body.appendChild(textLine("Bonus Stats", formatStats(entry.stats)));
    }
    if (entry.ign) {
      body.appendChild(textLine("IGN", entry.ign));
    }
    if (entry.notes) {
      body.appendChild(textLine("Notes", entry.notes));
    }

    const meta = document.createElement("div");
    meta.className = "listing-meta";
    if (entry.rarity) meta.appendChild(makeMetaPill(entry.rarity, entry.rarityColor));
    if (typeof item?.level === "number") meta.appendChild(makeMetaPill(`Level ${item.level}`));
    if (item?.category) meta.appendChild(makeMetaPill(item.category));
    if (item?.skillType) meta.appendChild(makeMetaPill(item.skillType));
    body.appendChild(meta);

    card.appendChild(body);
    return card;
  }

  function textLine(label, value) {
    const wrapper = document.createElement("div");
    const safeValue = value === undefined || value === null || value === "" ? "—" : value;
    wrapper.textContent = `${label}: ${safeValue}`;
    return wrapper;
  }

  function formatDiscordUser(user) {
    if (!user) return "Unknown";
    return user.displayTag || user.tag || user.username || "Discord user";
  }

  function formatStats(stats) {
    if (!stats) return "";
    return `STR ${stats.str ?? 0} / DEX ${stats.dex ?? 0} / CON ${stats.con ?? 0}`;
  }

  function makeMetaPill(text, color) {
    const span = document.createElement("span");
    span.className = "meta-pill";
    span.textContent = text;
    if (color) {
      span.style.color = color;
      span.style.borderColor = color;
    }
    return span;
  }

  function updateListingCount(visibleCount) {
    if (!els.listingCount) return;
    const total = state.listings.length;
    if (!total) {
      els.listingCount.textContent = "No listings available yet. Sign in with Discord to create one.";
      return;
    }
    els.listingCount.textContent = `${visibleCount} of ${total} listing${total === 1 ? "" : "s"} shown`;
  }

  function setFormStatus(message, variant) {
    if (!els.formStatus) return;
    els.formStatus.textContent = message || "";
    if (variant) {
      els.formStatus.dataset.variant = variant;
    } else {
      delete els.formStatus.dataset.variant;
    }
  }

  function formatTimestamp(value) {
    const date = typeof value === "number" ? new Date(value) : new Date();
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  function slugify(value) {
    return String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function seedListings() {
    if (!state.items.length || state.listings.length) return;
    const sample = state.items.slice(0, 3);
    const defaultRarity = state.rarityDefs[2] || { name: "Rare", color: "#0000ff", min: 6, max: 10 };
    const defaults = [
      {
        listingType: "WTS",
        price: 1200,
        priceCurrency: "Gold",
        discordUser: {
          displayTag: "codex-helper#2025",
          tag: "codex-helper#2025",
          username: "codex-helper",
          discriminator: "2025",
        },
        notes: "Clean roll, open to bundle deals.",
        rarity: defaultRarity.name,
        rarityColor: defaultRarity.color,
        stats: { str: 4, dex: 3, con: 2 },
        perk: "",
      },
      {
        listingType: "WTB",
        price: 0,
        priceCurrency: "Gold",
        discordUser: {
          displayTag: "scout#8888",
          tag: "scout#8888",
          username: "scout",
          discriminator: "8888",
        },
        notes: "Paying extra for max rarity.",
        rarity: defaultRarity.name,
        rarityColor: defaultRarity.color,
        stats: { str: 2, dex: 2, con: 2 },
        perk: "",
      },
      {
        listingType: "WTT",
        price: 0,
        priceCurrency: "Gold",
        discordUser: {
          displayTag: "merc#3377",
          tag: "merc#3377",
          username: "merc",
          discriminator: "3377",
        },
        notes: "Prefer evening trades.",
        rarity: defaultRarity.name,
        rarityColor: defaultRarity.color,
        stats: { str: 3, dex: 3, con: 3 },
        perk: "",
      },
    ];

    state.listings = sample.map((item, index) => ({
      id: `seed-${index}`,
      itemId: item.id,
      createdAt: Date.now() - index * 60 * 60 * 1000,
      ign: "",
      ...defaults[index],
    }));
  }

  async function loadListingsFromBackend() {
    // TODO: hook this up to a real database (e.g., Firestore).
    return [];
  }

  async function saveListingToBackend(listing) {
    // TODO: hook this up to a real database (e.g., Firestore).
    return listing;
  }
})();
