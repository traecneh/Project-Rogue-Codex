(function () {
  const STRENGTH_WEIGHT_BENCHMARKS = Object.freeze([5, 25, 50, 100, 150, 200, 500]);

  function formatNumber(value) {
    return Math.round(value).toLocaleString();
  }

  function formatDecimal(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }

  function readSliderValue(root, selector) {
    const slider = root.querySelector(selector);
    return Number(slider?.value) || 0;
  }

  function setText(root, selector, value) {
    const element = root.querySelector(selector);
    if (element) element.textContent = value;
  }

  function calculateMeleeMultiplier(skill, strength, dexterity) {
    return 1 + skill / 50 + strength / 100 + dexterity / 200;
  }

  function calculateMaxWeight(strength) {
    return 150 + strength * 3;
  }

  function calculateMaxHealth(level, constitution, strength) {
    return 20 + level * 15 + constitution * 10 + strength * 2;
  }

  function calculateBleedChance(strength) {
    return strength >= 100 ? strength / 10 : 0;
  }

  function calculateBleedDamage(strength, hitDamage) {
    return strength >= 100 ? hitDamage * 0.075 : 0;
  }

  function updateStrengthCalculator(root = document) {
    const skill = readSliderValue(root, "[data-strength-skill-slider]");
    const strength = readSliderValue(root, "[data-strength-str-slider]");
    const dexterity = readSliderValue(root, "[data-strength-dex-slider]");
    const level = readSliderValue(root, "[data-strength-level-slider]");
    const constitution = readSliderValue(root, "[data-strength-con-slider]");
    const hitDamage = readSliderValue(root, "[data-strength-hit-slider]");

    const multiplier = calculateMeleeMultiplier(skill, strength, dexterity);
    const maxWeight = calculateMaxWeight(strength);
    const maxHealth = calculateMaxHealth(level, constitution, strength);
    const bleedChance = calculateBleedChance(strength);
    const bleedDamage = calculateBleedDamage(strength, hitDamage);

    setText(root, "[data-strength-skill]", String(skill));
    setText(root, "[data-strength-str]", String(strength));
    setText(root, "[data-strength-dex]", String(dexterity));
    setText(root, "[data-strength-level]", String(level));
    setText(root, "[data-strength-con]", String(constitution));
    setText(root, "[data-strength-hit]", formatNumber(hitDamage));
    setText(root, "[data-strength-multiplier]", `${multiplier.toFixed(2)}x`);
    setText(root, "[data-strength-max-weight]", formatNumber(maxWeight));
    setText(root, "[data-strength-max-health]", formatNumber(maxHealth));
    setText(root, "[data-strength-bleed-chance]", `${bleedChance.toFixed(1)}%`);
    setText(root, "[data-strength-bleed-damage]", formatDecimal(bleedDamage));
    setText(
      root,
      "[data-strength-bleed-note]",
      strength >= 100 ? "Bleed is unlocked." : "Requires 100 base Strength."
    );
  }

  function renderWeightBenchmarks(root = document) {
    const chart = root.querySelector("[data-strength-weight-chart]");
    if (!chart) return;
    chart.textContent = "";
    const maxWeight = calculateMaxWeight(STRENGTH_WEIGHT_BENCHMARKS[STRENGTH_WEIGHT_BENCHMARKS.length - 1]);

    STRENGTH_WEIGHT_BENCHMARKS.forEach((strength) => {
      const weight = calculateMaxWeight(strength);
      const card = document.createElement("section");
      card.className = "strength-benchmark-card";

      const label = document.createElement("p");
      label.className = "stat-label";
      label.textContent = `${strength} STR`;

      const title = document.createElement("h3");
      title.textContent = `${formatNumber(weight)} weight`;

      const description = document.createElement("p");
      description.textContent = `Formula: 150 + ${strength * 3}.`;

      const track = document.createElement("div");
      track.className = "strength-bar-track";
      const fill = document.createElement("span");
      fill.className = "strength-bar-fill";
      fill.style.setProperty("--fill", `${(weight / maxWeight) * 100}%`);
      track.append(fill);

      card.append(label, title, description, track);
      chart.append(card);
    });
  }

  function initStrengthCalculator(root = document) {
    const widget = root.querySelector(".strength-calculator-widget");
    if (!widget) return;
    root.querySelectorAll("[data-strength-skill-slider], [data-strength-str-slider], [data-strength-dex-slider], [data-strength-level-slider], [data-strength-con-slider], [data-strength-hit-slider]").forEach((slider) => {
      slider.addEventListener("input", () => updateStrengthCalculator(root));
    });
    updateStrengthCalculator(root);
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderWeightBenchmarks();
    initStrengthCalculator();
  });
})();
