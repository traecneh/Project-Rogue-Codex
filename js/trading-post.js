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
    auth: null,
    filters: {
      text: "",
      listingType: "all",
      category: "all",
    },
  };

  const els = {
    itemSelect: null,
    itemPreview: null,
    previewCard: null,
    form: null,
    submitButton: null,
    listingTypeGroup: null,
    price: null,
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
    wireForm();
    wireFilters();
    loadItemData();
  });

  function cacheElements() {
    els.itemSelect = document.getElementById("item-select");
    els.itemPreview = document.getElementById("item-preview");
    els.previewCard = document.getElementById("preview-card");
    els.form = document.getElementById("listing-form");
    els.submitButton = els.form ? els.form.querySelector('button[type="submit"]') : null;
    els.listingTypeGroup = document.getElementById("listing-type");
    els.price = document.getElementById("price-input");
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
    if (els.itemSelect) {
      els.itemSelect.addEventListener("change", () => {
        const item = state.itemLookup.get(els.itemSelect.value);
        renderSelectedItem(item);
      });
    }
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

    const [weapons, armors] = await Promise.all([fetchJson("pages/items/weapons.json"), fetchJson("pages/items/armor.json")]);
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
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to load ${url}`);
      return await response.json();
    } catch (error) {
      console.warn(error.message);
      return null;
    }
  }

  function normalizeItem(raw, category) {
    const name = (raw?.Name || raw?.name || "").trim() || `${category} Item`;
    const subtype = raw?.Subtype || raw?.Type || (category === "Weapon" ? "Weapon" : "Armor");
    const rarity = raw?.MinimumRarity || raw?.Rarity || raw?.MaximumRarity || "Unknown";
    const level = raw?.Level ?? raw?.RequirementAmount ?? null;
    const slug = slugify(name);
    const icon = raw?.Icon ? `images/${category === "Weapon" ? "weapons" : "armors"}/${raw.Icon}` : null;
    return {
      id: `${category}-${slug}`,
      name,
      category,
      subtype,
      rarity,
      level,
      icon,
      raw,
    };
  }

  function renderItemSelect() {
    if (!els.itemSelect) return;
    els.itemSelect.innerHTML = "";
    els.itemSelect.disabled = false;

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select an item";
    els.itemSelect.appendChild(placeholder);

    const grouped = groupItemsByCategoryAndSubtype(state.items);
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
    renderPreviewBlock(els.previewCard, item, "Choose an item to inspect level, subtype, and rarity.");
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
    if (typeof item.level === "number") {
      meta.appendChild(makeChip(`Level ${item.level}`));
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

  function createListingFromForm() {
    if (!els.form || !els.itemSelect) return;

    const itemId = els.itemSelect.value;
    const item = state.itemLookup.get(itemId);
    if (!item) {
      setFormStatus("Pick a valid item before posting.", "error");
      return;
    }

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
    const price = (els.price?.value || "").trim();
    const ign = (els.ign?.value || "").trim();
    const notes = (els.notes?.value || "").trim();

    const listing = {
      id: `listing-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      itemId: item.id,
      listingType,
      price: price || "Offer",
      discordUser: state.auth.user,
      ign,
      notes,
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

      const matchesText =
        !state.filters.text ||
        name.includes(state.filters.text) ||
        notes.includes(state.filters.text) ||
        ign.includes(state.filters.text) ||
        userTag.includes(state.filters.text);

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
    body.appendChild(textLine("Price", entry.price || "Offer"));
    body.appendChild(textLine("Discord", formatDiscordUser(entry.discordUser)));
    if (entry.ign) {
      body.appendChild(textLine("IGN", entry.ign));
    }
    if (entry.notes) {
      body.appendChild(textLine("Notes", entry.notes));
    }

    const meta = document.createElement("div");
    meta.className = "listing-meta";
    if (item?.rarity) meta.appendChild(makeMetaPill(item.rarity));
    if (typeof item?.level === "number") meta.appendChild(makeMetaPill(`Level ${item.level}`));
    if (item?.category) meta.appendChild(makeMetaPill(item.category));
    body.appendChild(meta);

    card.appendChild(body);
    return card;
  }

  function textLine(label, value) {
    const wrapper = document.createElement("div");
    wrapper.textContent = `${label}: ${value}`;
    return wrapper;
  }

  function formatDiscordUser(user) {
    if (!user) return "Unknown";
    return user.displayTag || user.tag || user.username || "Discord user";
  }

  function makeMetaPill(text) {
    const span = document.createElement("span");
    span.className = "meta-pill";
    span.textContent = text;
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
    const defaults = [
      {
        listingType: "WTS",
        price: "1200g",
        discordUser: {
          displayTag: "codex-helper#2025",
          tag: "codex-helper#2025",
          username: "codex-helper",
          discriminator: "2025",
        },
        notes: "Clean roll, open to bundle deals.",
      },
      {
        listingType: "WTB",
        price: "Offer",
        discordUser: {
          displayTag: "scout#8888",
          tag: "scout#8888",
          username: "scout",
          discriminator: "8888",
        },
        notes: "Paying extra for max rarity.",
      },
      {
        listingType: "WTT",
        price: "Trade my polearm set",
        discordUser: {
          displayTag: "merc#3377",
          tag: "merc#3377",
          username: "merc",
          discriminator: "3377",
        },
        notes: "Prefer evening trades.",
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
