(function () {
  const CONSTITUTION_REGEN_BENCHMARKS = Object.freeze([25, 50, 100, 150, 200, 500]);

  function formatNumber(value) {
    return Math.round(value).toLocaleString();
  }

  function formatRegenTick(value) {
    return `${value.toFixed(1)} HP / 2s`;
  }

  function formatRegenPerSecond(value) {
    return `${(value / 2).toFixed(1)} HP/s`;
  }

  function readSliderValue(root, selector) {
    const slider = root.querySelector(selector);
    return Number(slider?.value) || 0;
  }

  function setText(root, selector, value) {
    const element = root.querySelector(selector);
    if (element) element.textContent = value;
  }

  function calculateMaxHealth(level, constitution, strength) {
    return 20 + level * 15 + constitution * 10 + strength * 2;
  }

  function calculateRegenTick(constitution) {
    return constitution / 3;
  }

  function calculateEffectiveRegen(regenTick, regenBonus) {
    return regenTick * (1 + regenBonus / 100);
  }

  function updateConstitutionCalculator(root = document) {
    const level = readSliderValue(root, "[data-constitution-level-slider]");
    const constitution = readSliderValue(root, "[data-constitution-con-slider]");
    const strength = readSliderValue(root, "[data-constitution-str-slider]");
    const regenBonus = readSliderValue(root, "[data-constitution-regen-bonus-slider]");

    const maxHealth = calculateMaxHealth(level, constitution, strength);
    const regenTick = calculateRegenTick(constitution);
    const effectiveRegen = calculateEffectiveRegen(regenTick, regenBonus);

    setText(root, "[data-constitution-level]", String(level));
    setText(root, "[data-constitution-con]", String(constitution));
    setText(root, "[data-constitution-str]", String(strength));
    setText(root, "[data-constitution-regen-bonus]", `${regenBonus}%`);
    setText(root, "[data-constitution-max-health]", formatNumber(maxHealth));
    setText(root, "[data-constitution-regen-tick]", formatRegenTick(regenTick));
    setText(root, "[data-constitution-regen-per-sec]", formatRegenPerSecond(regenTick));
    setText(root, "[data-constitution-effective-regen]", formatRegenTick(effectiveRegen));
  }

  function renderRegenBenchmarks(root = document) {
    const chart = root.querySelector("[data-constitution-regen-chart]");
    if (!chart) return;
    chart.textContent = "";
    const maxRegen = calculateRegenTick(CONSTITUTION_REGEN_BENCHMARKS[CONSTITUTION_REGEN_BENCHMARKS.length - 1]);

    CONSTITUTION_REGEN_BENCHMARKS.forEach((constitution) => {
      const regenTick = calculateRegenTick(constitution);
      const card = document.createElement("section");
      card.className = "constitution-benchmark-card";

      const label = document.createElement("p");
      label.className = "stat-label";
      label.textContent = `${constitution} CON`;

      const title = document.createElement("h3");
      title.textContent = formatRegenTick(regenTick);

      const description = document.createElement("p");
      description.textContent = `${formatRegenPerSecond(regenTick)} from Con / 3.`;

      const track = document.createElement("div");
      track.className = "constitution-bar-track";
      const fill = document.createElement("span");
      fill.className = "constitution-bar-fill";
      fill.style.setProperty("--fill", `${(regenTick / maxRegen) * 100}%`);
      track.append(fill);

      card.append(label, title, description, track);
      chart.append(card);
    });
  }

  function initConstitutionCalculator(root = document) {
    const widget = root.querySelector(".constitution-calculator-widget");
    if (!widget) return;
    root
      .querySelectorAll(
        "[data-constitution-level-slider], [data-constitution-con-slider], [data-constitution-str-slider], [data-constitution-regen-bonus-slider]"
      )
      .forEach((slider) => {
        slider.addEventListener("input", () => updateConstitutionCalculator(root));
      });
    updateConstitutionCalculator(root);
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderRegenBenchmarks();
    initConstitutionCalculator();
  });
})();
