const FLOOR_CLEANUP_SCENARIOS = Object.freeze({
  before: {
    label: "Worst Case",
    window: "Item survives about 8 minutes.",
    detail: "Item reaches 8 minutes just before a sweep, then is eligible when that sweep checks it.",
  },
  after: {
    label: "Best Case",
    window: "Item can remain up to 11 minutes.",
    detail: "Item reaches 8 minutes just after a sweep, then waits for the next 3 minutes cleanup pass.",
  },
  typical: {
    label: "Typical Window",
    window: "Untouched loot remains for 8-11 minutes.",
    detail: "The exact cleanup moment depends on where the item lands inside the 3 minutes sweep cycle.",
  },
});

function getFloorCleanupScenario(scenarioId) {
  return FLOOR_CLEANUP_SCENARIOS[scenarioId] || FLOOR_CLEANUP_SCENARIOS.before;
}

function setFloorCleanupScenario(scenarioId, root = document) {
  const preview = root.querySelector("[data-cleanup-preview]");
  if (!preview) return;

  const scenario = getFloorCleanupScenario(scenarioId);
  const resolvedId = Object.entries(FLOOR_CLEANUP_SCENARIOS).find(([, value]) => value === scenario)?.[0] || "before";
  preview.dataset.currentCleanupScenario = resolvedId;

  root.querySelectorAll("[data-cleanup-scenario]").forEach((button) => {
    const isActive = button.dataset.cleanupScenario === resolvedId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  const title = root.querySelector("[data-cleanup-scenario-title]");
  if (title) title.textContent = scenario.label;

  const windowText = root.querySelector("[data-cleanup-scenario-window]");
  if (windowText) windowText.textContent = scenario.window;

  const detail = root.querySelector("[data-cleanup-scenario-detail]");
  if (detail) detail.textContent = scenario.detail;
}

function initFloorCleanupPreview(root = document) {
  const preview = root.querySelector("[data-cleanup-preview]");
  if (!preview) return;

  root.querySelectorAll("[data-cleanup-scenario]").forEach((button) => {
    button.addEventListener("click", () => setFloorCleanupScenario(button.dataset.cleanupScenario, root));
  });

  setFloorCleanupScenario(preview.dataset.currentCleanupScenario || "before", root);
}

document.addEventListener("DOMContentLoaded", () => {
  initFloorCleanupPreview();
});
