(() => {
  const DATA_URL = "pages/General/quests_data.json";
  const detail = document.getElementById("quest-detail");
  const browser = document.getElementById("quest-browser");
  const list = document.getElementById("quest-list");
  const empty = document.getElementById("quest-empty");
  const errorMessage = document.getElementById("quest-load-error");
  const resultCount = document.getElementById("quest-result-count");
  const pageSummary = document.getElementById("quest-page-summary");
  const searchInput = document.getElementById("quest-search");
  const kindFilter = document.getElementById("quest-kind-filter");
  const categoryFilter = document.getElementById("quest-category-filter");
  const levelFilter = document.getElementById("quest-level-filter");
  const repeatableFilter = document.getElementById("quest-repeatable-filter");

  if (
    !detail ||
    !browser ||
    !list ||
    !empty ||
    !errorMessage ||
    !resultCount ||
    !pageSummary ||
    !searchInput ||
    !kindFilter ||
    !categoryFilter ||
    !levelFilter ||
    !repeatableFilter
  ) {
    return;
  }

  const state = {
    data: null,
    entries: [],
    entriesById: new Map(),
    selectedId: "",
  };

  const createElement = (tagName, className, text) => {
    const node = document.createElement(tagName);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };

  const formatNumber = (value) =>
    Number(value).toLocaleString("en-US", {
      maximumFractionDigits: 2,
    });

  const coordinatesText = (coordinates) =>
    Array.isArray(coordinates) && coordinates.length === 2
      ? `${formatNumber(coordinates[0])}, ${formatNumber(coordinates[1])}`
      : "";

  const createMapCoordinateLink = (coordinates, label = "") => {
    const text = coordinatesText(coordinates);
    if (!text) return null;
    const href = window.RogueCodexUtils?.buildProjectRogueMapUrl?.(coordinates, label);
    if (!href) return null;

    const accessibleLabel = label || "location";
    const link = createElement("a", "quest-map-link", text);
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = `Open ${accessibleLabel} on Project Rogue Map`;
    link.setAttribute("aria-label", `Open ${accessibleLabel} at ${text} on Project Rogue Map`);
    link.dataset.mapCoordinate = `${coordinates[0]},${coordinates[1]}`;
    return link;
  };

  const appendMapCoordinate = (container, coordinates, label, prefix = "at") => {
    const link = createMapCoordinateLink(coordinates, label);
    if (!link) return;
    if (prefix) container.appendChild(createElement("span", "", prefix));
    container.appendChild(link);
  };

  const entityUrl = (entity) => {
    if (!entity) return "";
    const id = encodeURIComponent(entity.id);
    if (entity.type === "monster") {
      return `pages/enemies/monsters.html?monster=${id}`;
    }
    if (entity.type === "weapon") return `pages/items/weapons.html?weapon=${id}`;
    if (entity.type === "armor") return `pages/items/armors.html?armor=${id}`;
    if (entity.type === "collectable") return `pages/items/collectables.html?collectable=${id}`;
    if (entity.type === "useable") return `pages/items/useables.html?useable=${id}`;
    return "";
  };

  const entityImageCandidates = (entity) => {
    if (!entity || !entity.name) return [];
    if (entity.image) return [entity.image];
    const folder =
      entity.type === "monster"
        ? "monsters"
        : entity.type === "armor"
          ? "armors"
          : entity.type === "weapon"
            ? "weapons"
            : entity.type === "collectable"
              ? "collectables"
              : entity.type === "useable"
                ? "useables"
                : "";
    if (!folder) return [];
    const name = encodeURIComponent(entity.name);
    return [`images/${folder}/${name}.gif`, `images/${folder}/${name}.png`];
  };

  const createEntityImage = (entity) => {
    const candidates = entityImageCandidates(entity);
    if (!candidates.length) return null;
    const image = createElement("img", "quest-entity-image");
    image.alt = "";
    image.loading = "lazy";
    let index = 0;
    image.addEventListener("error", () => {
      index += 1;
      if (index >= candidates.length) {
        image.remove();
        return;
      }
      image.src = candidates[index];
    });
    image.src = candidates[index];
    return image;
  };

  const createEntityLink = (entity, label) => {
    const href = entityUrl(entity);
    if (!href) return createElement("span", "quest-target-label", label || entity?.name || "");
    const link = createElement("a", "quest-entity-link");
    link.href = href;
    const image = createEntityImage(entity);
    if (image) link.appendChild(image);
    link.appendChild(createElement("span", "", label || entity.name));
    return link;
  };

  const createBadge = (text, modifier = "") =>
    createElement("span", `quest-badge${modifier ? ` quest-badge-${modifier}` : ""}`, text);

  const getProvider = (entry) => (entry.kind === "service" ? entry.provider : entry.giver);

  const rewardSummary = (entry) => {
    if (entry.kind === "service") {
      const cost = Array.isArray(entry.costs) ? entry.costs[0] : null;
      return cost ? `${formatNumber(cost.amount)} ${cost.label}` : "Service";
    }
    const guaranteed = entry.rewards?.guaranteed || [];
    const parts = guaranteed.slice(0, 2).map((reward) => {
      if (reward.type === "experience") return `${formatNumber(reward.amount)} XP`;
      if (reward.type === "experience_pool") return `${formatNumber(reward.amount)} XP Pool`;
      return reward.amount > 1 ? `${formatNumber(reward.amount)} ${reward.label}` : reward.label;
    });
    if ((entry.rewards?.choose_one || []).length) parts.push("Choice reward");
    return parts.join(" / ");
  };

  const searchableText = (entry) => {
    const provider = getProvider(entry);
    const objectiveText =
      entry.kind === "quest"
        ? (entry.stages || [])
            .flatMap((stage) => stage.objectives || [])
            .flatMap((objective) => [
              objective.text,
              objective.target?.label,
              objective.target?.entity?.name,
            ])
        : [];
    const rewardText =
      entry.kind === "quest"
        ? [...(entry.rewards?.guaranteed || []), ...(entry.rewards?.choose_one || [])].map(
            (reward) => reward.label
          )
        : (entry.costs || []).map((cost) => cost.label);
    return [
      entry.name,
      entry.category,
      entry.region,
      entry.area,
      provider?.name,
      ...objectiveText,
      ...rewardText,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  };

  const populateFilters = () => {
    const categories = [
      ...new Set(
        state.entries
          .filter((entry) => entry.kind === "quest")
          .map((entry) => entry.category)
          .filter(Boolean)
      ),
    ].sort();
    categories.forEach((category) => {
      const option = createElement("option", "", category);
      option.value = category;
      categoryFilter.appendChild(option);
    });

    const levels = [...new Set(state.entries.map((entry) => entry.min_level).filter(Number.isInteger))].sort(
      (a, b) => a - b
    );
    levels.forEach((level) => {
      const option = createElement("option", "", `Level ${level}`);
      option.value = String(level);
      levelFilter.appendChild(option);
    });
  };

  const filteredEntries = () => {
    const query = searchInput.value.trim().toLowerCase();
    const kind = kindFilter.value;
    const category = categoryFilter.value;
    const level = levelFilter.value;
    return state.entries.filter((entry) => {
      if (query && !searchableText(entry).includes(query)) return false;
      if (kind && entry.kind !== kind) return false;
      if (category && entry.category !== category) return false;
      if (level && String(entry.min_level) !== level) return false;
      if (repeatableFilter.checked && !entry.repeatable) return false;
      return true;
    });
  };

  const renderList = () => {
    const entries = filteredEntries();
    list.replaceChildren();
    entries.forEach((entry) => {
      const button = createElement("button", "quest-list-item");
      button.type = "button";
      button.dataset.entryId = entry.id;
      button.classList.toggle("is-selected", entry.id === state.selectedId);
      button.setAttribute("aria-pressed", entry.id === state.selectedId ? "true" : "false");

      const heading = createElement("span", "quest-list-heading");
      heading.appendChild(createElement("span", "quest-list-name", entry.name));
      heading.appendChild(createBadge(`Lv ${entry.min_level}`));
      button.appendChild(heading);

      const meta = createElement("span", "quest-list-meta");
      meta.appendChild(createElement("span", "", getProvider(entry)?.name || "Unknown"));
      if (entry.kind === "service") {
        meta.appendChild(createBadge("Service", "service"));
      } else {
        meta.appendChild(createElement("span", "", entry.category));
        if (entry.repeatable) meta.appendChild(createBadge("Repeatable", "repeatable"));
      }
      button.appendChild(meta);

      const summary = rewardSummary(entry);
      if (summary) button.appendChild(createElement("span", "quest-list-reward", summary));
      list.appendChild(button);
    });

    resultCount.textContent = `${entries.length} of ${state.entries.length}`;
    empty.hidden = entries.length > 0;
  };

  const appendFacts = (container, entry) => {
    const provider = getProvider(entry);
    const facts = [
      { label: "Level", value: entry.min_level },
      {
        label: entry.kind === "service" ? "Provider" : "Giver",
        value: provider?.name || "Unknown",
        coordinates: provider?.coordinates,
        mapLabel: provider?.name,
      },
      { label: "Area", value: entry.area },
      {
        label: "Type",
        value:
          entry.kind === "service"
            ? "Service"
            : entry.repeatable
              ? "Repeatable quest"
              : `${entry.category} quest`,
      },
    ];
    const factList = createElement("dl", "quest-facts");
    facts.forEach((item) => {
      const fact = createElement("div", "quest-fact");
      fact.appendChild(createElement("dt", "", item.label));
      const value = createElement("dd", "quest-fact-value");
      value.appendChild(createElement("span", "", item.value));
      if (item.coordinates) {
        appendMapCoordinate(value, item.coordinates, item.mapLabel);
      }
      fact.appendChild(value);
      factList.appendChild(fact);
    });
    container.appendChild(factList);
  };

  const createDialogue = (label, text, isTruncated = false) => {
    const disclosure = createElement("details", "quest-dialogue");
    disclosure.appendChild(createElement("summary", "", label));
    const quote = createElement("blockquote", "", text);
    if (isTruncated) {
      quote.appendChild(
        createElement("em", "quest-dialogue-warning", "The captured dialogue ends here and is incomplete.")
      );
    }
    disclosure.appendChild(quote);
    return disclosure;
  };

  const appendTarget = (container, objective) => {
    const target = objective.target;
    if (!target) return;
    const line = createElement("div", "quest-target-line");
    if (target.entity) {
      line.appendChild(createEntityLink(target.entity, target.label));
    } else {
      line.appendChild(createElement("span", "quest-target-label", target.label));
    }
    if (target.coordinates) {
      const mapLabel = target.destination_coordinates ? `${target.label} entrance` : target.label;
      appendMapCoordinate(line, target.coordinates, mapLabel);
    }
    if (target.destination_coordinates) {
      appendMapCoordinate(
        line,
        target.destination_coordinates,
        `${target.label} inside`,
        "inside"
      );
    }
    if (target.markers) {
      line.appendChild(createElement("span", "", `NPC markers ${target.markers}`));
    }
    container.appendChild(line);
    if (target.unresolved_entity) {
      container.appendChild(createElement("p", "quest-inline-note", target.unresolved_entity));
    }
  };

  const appendObjectives = (container, entry) => {
    const section = createElement("section", "quest-section");
    section.appendChild(createElement("h3", "quest-section-title", "Objectives"));
    (entry.stages || []).forEach((stage) => {
      const stageNode = createElement("section", "quest-stage");
      const header = createElement("div", "quest-stage-header");
      header.appendChild(createElement("h4", "quest-stage-title", `Stage ${stage.number}: ${stage.label}`));
      if (stage.unlocks_after) {
        header.appendChild(createElement("span", "quest-stage-unlock", stage.unlocks_after));
      }
      stageNode.appendChild(header);
      const objectiveList = createElement("div", "quest-objectives");
      (stage.objectives || []).forEach((objective) => {
        const objectiveNode = createElement("article", "quest-objective");
        objectiveNode.appendChild(createElement("span", "quest-objective-number", objective.number));
        const body = createElement("div", "quest-objective-body");
        const heading = createElement("div", "quest-objective-heading");
        heading.appendChild(createElement("span", "", objective.text));
        if (objective.quantity) {
          heading.appendChild(
            createElement("span", "quest-objective-quantity", `${formatNumber(objective.quantity)} required`)
          );
        }
        body.appendChild(heading);
        appendTarget(body, objective);
        (objective.notes || []).forEach((note) => {
          body.appendChild(createElement("p", "quest-inline-note", note));
        });
        if (objective.dialogue) {
          body.appendChild(createDialogue("Observed dialogue", objective.dialogue, objective.dialogue_truncated));
        }
        objectiveNode.appendChild(body);
        objectiveList.appendChild(objectiveNode);
      });
      stageNode.appendChild(objectiveList);
      section.appendChild(stageNode);
    });
    container.appendChild(section);
  };

  const appendPrerequisites = (container, entry) => {
    if (!entry.prerequisites?.length) return;
    const section = createElement("section", "quest-section");
    section.appendChild(createElement("h3", "quest-section-title", "Required Quests"));
    const prerequisiteList = createElement("div", "quest-prerequisites");
    entry.prerequisites.forEach((questId) => {
      const prerequisite = state.entriesById.get(questId);
      const link = createElement("a", "quest-prerequisite", prerequisite?.name || questId);
      link.href = `pages/General/quests.html?quest=${encodeURIComponent(questId)}`;
      link.dataset.questId = questId;
      prerequisiteList.appendChild(link);
    });
    section.appendChild(prerequisiteList);
    container.appendChild(section);
  };

  const appendTurnIn = (container, entry) => {
    if (!entry.turn_in) return;
    const section = createElement("section", "quest-section");
    section.appendChild(createElement("h3", "quest-section-title", "Turn In"));
    const line = createElement("div", "quest-turn-in");
    line.appendChild(createElement("strong", "", entry.turn_in.name));
    if (entry.turn_in.area) line.appendChild(createElement("span", "", entry.turn_in.area));
    if (entry.turn_in.coordinates) {
      appendMapCoordinate(
        line,
        entry.turn_in.coordinates,
        entry.turn_in.name
      );
    }
    if (entry.turn_in.markers) {
      line.appendChild(createElement("span", "", `NPC markers ${entry.turn_in.markers}`));
    }
    section.appendChild(line);
    if (entry.turn_in.dialogue) {
      section.appendChild(createDialogue("Turn-in dialogue", entry.turn_in.dialogue));
    }
    container.appendChild(section);
  };

  const createReward = (reward, choice = false) => {
    const node = createElement("li", `quest-reward${choice ? " quest-reward-choice" : ""}`);
    if (reward.entity) {
      node.appendChild(createEntityLink(reward.entity, reward.label));
      if (reward.amount > 1) {
        node.appendChild(createElement("span", "quest-reward-value", `x${formatNumber(reward.amount)}`));
      }
      return node;
    }
    const value =
      reward.type === "experience_pool"
        ? `${formatNumber(reward.amount)} ${reward.label}`
        : `${formatNumber(reward.amount)} ${reward.label}`;
    node.appendChild(createElement("span", "quest-reward-value", value));
    return node;
  };

  const appendRewards = (container, entry) => {
    const guaranteed = entry.rewards?.guaranteed || [];
    const choices = entry.rewards?.choose_one || [];
    if (!guaranteed.length && !choices.length) return;
    const section = createElement("section", "quest-section");
    section.appendChild(createElement("h3", "quest-section-title", "Rewards"));
    const rewardList = createElement("ul", "quest-reward-list");
    guaranteed.forEach((reward) => rewardList.appendChild(createReward(reward)));
    if (choices.length) {
      rewardList.appendChild(createElement("li", "quest-reward-choice-label", "Choose one"));
      choices.forEach((reward) => rewardList.appendChild(createReward(reward, true)));
    }
    section.appendChild(rewardList);
    container.appendChild(section);
  };

  const appendNotes = (container, notes) => {
    if (!notes?.length) return;
    const section = createElement("section", "quest-section");
    section.appendChild(createElement("h3", "quest-section-title", "Field Notes"));
    const noteList = createElement("ul", "quest-note-list");
    notes.forEach((note) => noteList.appendChild(createElement("li", "", note)));
    section.appendChild(noteList);
    container.appendChild(section);
  };

  const renderQuestDetail = (entry) => {
    const fragment = document.createDocumentFragment();
    const header = createElement("header", "quest-detail-header");
    const titleGroup = createElement("div", "quest-detail-title-group");
    const titleRow = createElement("div", "quest-detail-title-row");
    titleRow.appendChild(createElement("h2", "quest-detail-title", entry.name));
    if (entry.repeatable) titleRow.appendChild(createBadge("Repeatable", "repeatable"));
    titleGroup.appendChild(titleRow);
    titleGroup.appendChild(
      createElement(
        "p",
        "quest-detail-subtitle",
        `${entry.region} / ${entry.category} / Observed in game`
      )
    );
    header.appendChild(titleGroup);
    const close = createElement("button", "quest-detail-close", "\u00d7");
    close.type = "button";
    close.dataset.closeDetail = "true";
    close.setAttribute("aria-label", "Close quest details");
    close.title = "Close quest details";
    header.appendChild(close);
    fragment.appendChild(header);

    appendFacts(fragment, entry);
    appendPrerequisites(fragment, entry);
    if (entry.initial_dialogue) {
      fragment.appendChild(createDialogue("Initial dialogue", entry.initial_dialogue));
    }
    appendObjectives(fragment, entry);
    appendTurnIn(fragment, entry);
    appendRewards(fragment, entry);
    appendNotes(fragment, entry.notes);
    detail.replaceChildren(fragment);
  };

  const renderServiceDetail = (entry) => {
    const fragment = document.createDocumentFragment();
    const header = createElement("header", "quest-detail-header");
    const titleGroup = createElement("div", "quest-detail-title-group");
    const titleRow = createElement("div", "quest-detail-title-row");
    titleRow.appendChild(createElement("h2", "quest-detail-title", entry.name));
    titleRow.appendChild(createBadge("Service", "service"));
    titleGroup.appendChild(titleRow);
    titleGroup.appendChild(
      createElement("p", "quest-detail-subtitle", `${entry.region} / Observed in game`)
    );
    header.appendChild(titleGroup);
    const close = createElement("button", "quest-detail-close", "\u00d7");
    close.type = "button";
    close.dataset.closeDetail = "true";
    close.setAttribute("aria-label", "Close service details");
    close.title = "Close service details";
    header.appendChild(close);
    fragment.appendChild(header);

    appendFacts(fragment, entry);

    const resultSection = createElement("section", "quest-section");
    resultSection.appendChild(createElement("h3", "quest-section-title", "Result"));
    resultSection.appendChild(createElement("p", "quest-service-result", entry.result));
    fragment.appendChild(resultSection);

    if (entry.costs?.length) {
      const costSection = createElement("section", "quest-section");
      costSection.appendChild(createElement("h3", "quest-section-title", "Cost"));
      const costs = createElement("ul", "quest-reward-list");
      entry.costs.forEach((cost) => costs.appendChild(createReward(cost)));
      costSection.appendChild(costs);
      fragment.appendChild(costSection);
    }

    if (entry.related_pages?.length) {
      const relatedSection = createElement("section", "quest-section");
      relatedSection.appendChild(createElement("h3", "quest-section-title", "Related System"));
      entry.related_pages.forEach((related) => {
        const link = createElement("a", "quest-related-link", related.label);
        link.href = related.href;
        relatedSection.appendChild(link);
      });
      fragment.appendChild(relatedSection);
    }
    appendNotes(fragment, entry.notes);
    detail.replaceChildren(fragment);
  };

  const renderDetail = () => {
    const entry = state.entriesById.get(state.selectedId);
    if (!entry) {
      detail.replaceChildren(createElement("p", "quest-detail-empty", "No entry selected."));
      return;
    }
    if (entry.kind === "service") renderServiceDetail(entry);
    else renderQuestDetail(entry);
  };

  const buildEntryUrl = (entryId) => {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    if (entryId) url.searchParams.set("quest", entryId);
    return `${url.pathname}${url.search}`;
  };

  const setSelected = (entryId, options = {}) => {
    const nextId = state.entriesById.has(entryId) ? entryId : "";
    state.selectedId = nextId;
    renderList();
    renderDetail();
    if (!options.skipHistory && window.history) {
      const targetUrl = buildEntryUrl(nextId);
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      if (targetUrl !== currentUrl) {
        if (options.replace) history.replaceState({ questId: nextId }, "", targetUrl);
        else history.pushState({ questId: nextId }, "", targetUrl);
      }
    }
  };

  const selectedIdFromLocation = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("quest") || "";
  };

  const initializeData = (data) => {
    const quests = (data.quests || []).map((entry) => ({ ...entry, kind: "quest" }));
    const services = (data.services || []).map((entry) => ({ ...entry, kind: "service" }));
    state.data = data;
    state.entries = [...quests, ...services];
    state.entriesById = new Map(state.entries.map((entry) => [entry.id, entry]));
    populateFilters();
    pageSummary.textContent = `${quests.length} quests / ${services.length} service / Silvest`;
    browser.setAttribute("aria-busy", "false");

    const routeId = selectedIdFromLocation();
    if (state.entriesById.has(routeId)) {
      setSelected(routeId, { skipHistory: true });
    } else {
      setSelected(quests[0]?.id || services[0]?.id || "", { skipHistory: true });
    }
  };

  list.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("[data-entry-id]") : null;
    if (!button) return;
    const entryId = button.dataset.entryId || "";
    const nextId = entryId === state.selectedId ? "" : entryId;
    setSelected(nextId);
    if (nextId && window.matchMedia?.("(max-width: 800px)").matches) {
      const behavior = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      detail.scrollIntoView({ behavior, block: "start" });
    }
  });

  detail.addEventListener("click", (event) => {
    const close = event.target instanceof Element ? event.target.closest("[data-close-detail]") : null;
    if (close) {
      setSelected("");
      return;
    }
    const prerequisite = event.target instanceof Element ? event.target.closest("[data-quest-id]") : null;
    if (prerequisite) {
      event.preventDefault();
      setSelected(prerequisite.dataset.questId || "");
      detail.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  [searchInput, kindFilter, categoryFilter, levelFilter, repeatableFilter].forEach((control) => {
    control.addEventListener(control === searchInput ? "input" : "change", renderList);
  });

  window.addEventListener("popstate", () => {
    setSelected(selectedIdFromLocation(), { skipHistory: true });
  });

  const fetchJson =
    window.RogueCodexUtils && typeof window.RogueCodexUtils.fetchJsonCached === "function"
      ? window.RogueCodexUtils.fetchJsonCached
      : (url) => fetch(url).then((response) => {
          if (!response.ok) throw new Error(`Failed to load ${url}`);
          return response.json();
        });

  fetchJson(DATA_URL)
    .then(initializeData)
    .catch((error) => {
      browser.hidden = true;
      errorMessage.hidden = false;
      console.error(error);
    });
})();
