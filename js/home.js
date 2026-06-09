(function () {
  const HOME_TIMELINE_FILTERS = Object.freeze({
    all: "All",
    origins: "Origins",
    forks: "Community Forks",
    "project-rogue": "Project Rogue",
  });

  function getTimelineItems(root) {
    return Array.from(root.querySelectorAll("[data-home-timeline-item]"));
  }

  function getFilterButtons(root) {
    return Array.from(root.querySelectorAll("[data-era-filter]"));
  }

  function updateHomeTimelineFilter(filterName, root = document) {
    const normalizedFilter = HOME_TIMELINE_FILTERS[filterName] ? filterName : "all";
    const items = getTimelineItems(root);
    const buttons = getFilterButtons(root);
    let visibleCount = 0;

    items.forEach((item) => {
      const isVisible = normalizedFilter === "all" || item.dataset.era === normalizedFilter;
      item.hidden = !isVisible;
      if (isVisible) visibleCount += 1;
    });

    buttons.forEach((button) => {
      const isActive = button.dataset.eraFilter === normalizedFilter;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    const countLabel = root.querySelector("[data-home-result-count]");
    if (countLabel) {
      const itemLabel = visibleCount === 1 ? "entry" : "entries";
      countLabel.textContent = `${visibleCount} ${itemLabel} shown`;
    }

    return visibleCount;
  }

  function initHomeTimelineFilters(root = document) {
    const buttons = getFilterButtons(root);
    if (!buttons.length) return;

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        updateHomeTimelineFilter(button.dataset.eraFilter || "all", root);
      });
    });

    const activeButton = buttons.find((button) => button.getAttribute("aria-pressed") === "true");
    updateHomeTimelineFilter(activeButton?.dataset.eraFilter || "all", root);
  }

  window.RogueCodexHome = {
    HOME_TIMELINE_FILTERS,
    initHomeTimelineFilters,
    updateHomeTimelineFilter,
  };

  document.addEventListener("DOMContentLoaded", () => {
    initHomeTimelineFilters();
  });
})();
