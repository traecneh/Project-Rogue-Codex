let perkCardCachePromise = null;

const STAT_MATCHERS = [
  { name: "strength", regex: /\bstrength\b/i },
  { name: "dexterity", regex: /\bdexterity\b/i },
  { name: "constitution", regex: /\bconstitution\b/i },
];

const PERKS_INDEX_SCHEMA_VERSION = 3;
const PERK_DETAIL_EMPHASIS_REGEX = /(\[[^\]]+\]|\([^)]+\)|\{[^}]+\})/g;
const PVP_PREFIX_REGEX = /^(PvP:|PvE:)/i;

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

function getPerksIndexUrl() {
  try {
    const base = document.baseURI || window.location.href;
    const resolved = new URL("pages/systems/perks.json", base);
    if (resolved.protocol === "http:" || resolved.protocol === "https:") {
      resolved.searchParams.set("v", String(PERKS_INDEX_SCHEMA_VERSION));
    }
    return resolved.toString();
  } catch (error) {
    return "pages/systems/perks.json";
  }
}

function fetchPerksIndex() {
  const url = getPerksIndexUrl();
  return fetch(url, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("Failed to load perks.json");
      return response.json();
    })
    .catch((error) => {
      console.warn(error.message || error);
      return null;
    });
}

function appendFormattedText(target, value) {
  const raw = (value ?? "").toString();
  if (!raw) return;

  const prefixMatch = raw.match(PVP_PREFIX_REGEX);
  let remaining = raw;
  if (prefixMatch) {
    const prefix = document.createElement("strong");
    prefix.textContent = prefixMatch[0];
    target.appendChild(prefix);
    remaining = raw.slice(prefixMatch[0].length);
  }

  let lastIndex = 0;
  for (const match of remaining.matchAll(PERK_DETAIL_EMPHASIS_REGEX)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      target.appendChild(document.createTextNode(remaining.slice(lastIndex, index)));
    }
    const strong = document.createElement("strong");
    strong.textContent = match[0];
    target.appendChild(strong);
    lastIndex = index + match[0].length;
  }
  if (lastIndex < remaining.length) {
    target.appendChild(document.createTextNode(remaining.slice(lastIndex)));
  }
}

function appendPerkParagraph(card, line) {
  const paragraph = document.createElement("p");
  appendFormattedText(paragraph, line);
  card.appendChild(paragraph);
}

function appendPerkList(card, lines) {
  const list = document.createElement("ul");
  lines.forEach((line) => {
    const item = document.createElement("li");
    appendFormattedText(item, line);
    list.appendChild(item);
  });
  card.appendChild(list);
}

function buildPerkCard(entry) {
  const card = document.createElement("section");
  card.className = "stat-card";

  const name = entry && typeof entry.name === "string" ? entry.name.trim() : "";
  const heading = document.createElement("h3");
  heading.textContent = name || "Unknown";
  card.appendChild(heading);

  const details = Array.isArray(entry?.details)
    ? entry.details.map((line) => (line ?? "").toString().trim()).filter(Boolean)
    : [];
  if (!details.length) {
    appendPerkParagraph(card, "Perk info unavailable.");
    return card;
  }

  const leadLine = details[0];
  const hasLeadParagraph =
    details.length > 1 &&
    (leadLine.trim().endsWith(":") || leadLine.toLowerCase().startsWith("this perk only works"));
  const useList = details.length >= 3 || details.some((line) => PVP_PREFIX_REGEX.test(line)) || hasLeadParagraph;

  let lines = details;
  if (hasLeadParagraph) {
    appendPerkParagraph(card, leadLine);
    lines = details.slice(1);
  }

  if (useList && lines.length > 1) {
    appendPerkList(card, lines);
  } else {
    lines.forEach((line) => appendPerkParagraph(card, line));
  }

  const slug = entry?.slug || getPerkSlug(name);
  if (slug) card.id = slug;
  if (name) card.setAttribute("data-perk-name", name);
  return card;
}

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
      target.scrollIntoView({ behavior: getPreferredScrollBehavior(), block: "start" });
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

  perkCardCachePromise = fetchPerksIndex()
    .then((index) => {
      const perks = Array.isArray(index?.perks) ? index.perks : [];
      if (!perks.length) {
        throw new Error("Perks index unavailable");
      }
      const map = new Map();
      perks.forEach((entry) => {
        const name = entry && typeof entry.name === "string" ? entry.name.trim() : "";
        if (!name) return;
        const card = buildPerkCard(entry);
        const slug = entry?.slug || getPerkSlug(name);
        if (!slug) return;
        const isUnique = entry?.isUnique === true;
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

window.RogueCodexPerks = Object.assign(window.RogueCodexPerks || {}, {
  fetchPerksIndex,
  buildPerkCard,
});
