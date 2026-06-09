(function () {
  const HOME_TIMELINE_FILTERS = Object.freeze({
    all: "All",
    origins: "Origins",
    forks: "Community Forks",
    "project-rogue": "Project Rogue",
  });
  const CODEX_MANIFEST_URL = "data/codex_manifest.json";

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

  function formatManifestDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown";
    return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
  }

  function formatNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toLocaleString("en-US") : "--";
  }

  function shortValue(value, length = 12) {
    const text = String(value || "").trim();
    return text ? text.slice(0, length) : "--";
  }

  function setFreshnessText(root, selector, value) {
    const element = root.querySelector(selector);
    if (element) element.textContent = value;
  }

  function renderCodexFreshness(manifest, root = document) {
    const summary = manifest?.summary || {};
    setFreshnessText(root, "[data-freshness-generated]", formatManifestDate(manifest?.generated_at_utc));
    setFreshnessText(root, "[data-freshness-total-records]", formatNumber(summary.data_records));
    setFreshnessText(root, "[data-freshness-total-assets]", formatNumber(summary.asset_entries));
    setFreshnessText(root, "[data-freshness-content-hash]", shortValue(summary.content_sha256));
    setFreshnessText(root, "[data-freshness-commit]", shortValue(manifest?.source_commit, 7));

    const status = root.querySelector("[data-freshness-status]");
    if (status) {
      status.textContent = "Current";
      status.classList.remove("is-error");
    }
  }

  function renderCodexFreshnessError(root = document) {
    [
      "[data-freshness-generated]",
      "[data-freshness-total-records]",
      "[data-freshness-total-assets]",
      "[data-freshness-content-hash]",
      "[data-freshness-commit]",
    ].forEach((selector) => {
      setFreshnessText(root, selector, "Unavailable");
    });
    const status = root.querySelector("[data-freshness-status]");
    if (status) {
      status.textContent = "Unavailable";
      status.classList.add("is-error");
    }
  }

  function initCodexFreshness(root = document, fetcher = window.fetch) {
    const panel = root.querySelector("[data-freshness-panel]");
    if (!panel || typeof fetcher !== "function") return Promise.resolve(null);
    const manifestUrl = panel.dataset.manifestUrl || CODEX_MANIFEST_URL;

    return fetcher(manifestUrl, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`Manifest request failed: ${response.status}`);
        return response.json();
      })
      .then((manifest) => {
        renderCodexFreshness(manifest, root);
        return manifest;
      })
      .catch(() => {
        renderCodexFreshnessError(root);
        return null;
      });
  }

  window.RogueCodexHome = {
    CODEX_MANIFEST_URL,
    HOME_TIMELINE_FILTERS,
    initCodexFreshness,
    initHomeTimelineFilters,
    renderCodexFreshness,
    updateHomeTimelineFilter,
  };

  document.addEventListener("DOMContentLoaded", () => {
    initHomeTimelineFilters();
    initCodexFreshness();
  });
})();
