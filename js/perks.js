let perkCardCachePromise = null;

const STAT_MATCHERS = [
  { name: "strength", regex: /\bstrength\b/i },
  { name: "dexterity", regex: /\bdexterity\b/i },
  { name: "constitution", regex: /\bconstitution\b/i },
];

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

  perkCardCachePromise = fetch("pages/systems/perks.html")
    .then((response) => {
      if (!response.ok) throw new Error("Failed to load perks reference");
      return response.text();
    })
    .then((html) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const cards = Array.from(doc.querySelectorAll("#perk-list .stat-card, #unique-effects .stat-card"));
      const map = new Map();
      cards.forEach((card) => {
        const heading = card.querySelector("h3");
        if (!heading) return;
        const name = heading.textContent.trim();
        if (!name) return;
        const slug = getPerkSlug(name);
        if (!slug) return;
        card.id = slug;
        card.setAttribute("data-perk-name", name);
        const isUnique = Boolean(card.closest("#unique-effects"));
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

