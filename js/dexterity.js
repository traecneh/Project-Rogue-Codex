(function () {
  const DEXTERITY_DR_BENCHMARKS = Object.freeze([50, 100, 150, 200, 500]);
  const CRIT_MULTIPLIER = 1.35;
  const DR_SCALE = 0.00125;
  const SAMPLE_INCOMING_DAMAGE = 1000;

  function formatNumber(value) {
    return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }

  function formatPercent(value, digits = 2) {
    return `${value.toFixed(digits)}%`;
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

  function calculateCritChance(baseDexterity) {
    return baseDexterity / 2.5;
  }

  function calculateDamageReduction(totalDexterity) {
    const scaledDexterity = totalDexterity * DR_SCALE;
    return scaledDexterity / (1 + scaledDexterity);
  }

  function calculatePostReductionDamage(totalDexterity) {
    return SAMPLE_INCOMING_DAMAGE * (1 - calculateDamageReduction(totalDexterity));
  }

  function updateDexterityCalculator(root = document) {
    const skill = readSliderValue(root, "[data-dexterity-skill-slider]");
    const strength = readSliderValue(root, "[data-dexterity-str-slider]");
    const dexterity = readSliderValue(root, "[data-dexterity-dex-slider]");
    const critDexterity = readSliderValue(root, "[data-dexterity-crit-dex-slider]");
    const drDexterity = readSliderValue(root, "[data-dexterity-dr-slider]");

    const multiplier = calculateMeleeMultiplier(skill, strength, dexterity);
    const critChance = calculateCritChance(critDexterity);
    const damageReduction = calculateDamageReduction(drDexterity) * 100;
    const postReductionDamage = calculatePostReductionDamage(drDexterity);

    setText(root, "[data-dexterity-skill]", String(skill));
    setText(root, "[data-dexterity-str]", String(strength));
    setText(root, "[data-dexterity-dex]", String(dexterity));
    setText(root, "[data-dexterity-crit-dex]", String(critDexterity));
    setText(root, "[data-dexterity-dr-dex]", String(drDexterity));
    setText(root, "[data-dexterity-multiplier]", `${multiplier.toFixed(2)}x`);
    setText(root, "[data-dexterity-crit-chance]", formatPercent(critChance, 1));
    setText(root, "[data-dexterity-crit-multiplier]", `${CRIT_MULTIPLIER.toFixed(2)}x`);
    setText(root, "[data-dexterity-dr]", `${formatPercent(damageReduction)} DR`);
    setText(root, "[data-dexterity-post-dr]", `${formatNumber(postReductionDamage)} / 1,000`);
  }

  function renderDamageReductionBenchmarks(root = document) {
    const chart = root.querySelector("[data-dexterity-dr-chart]");
    if (!chart) return;
    chart.textContent = "";
    const maxReduction = calculateDamageReduction(DEXTERITY_DR_BENCHMARKS[DEXTERITY_DR_BENCHMARKS.length - 1]);

    DEXTERITY_DR_BENCHMARKS.forEach((dexterity) => {
      const reduction = calculateDamageReduction(dexterity);
      const damageTaken = calculatePostReductionDamage(dexterity);
      const card = document.createElement("section");
      card.className = "dexterity-benchmark-card";

      const label = document.createElement("p");
      label.className = "stat-label";
      label.textContent = `${dexterity} Total DEX`;

      const title = document.createElement("h3");
      title.textContent = `${formatPercent(reduction * 100)} DR`;

      const description = document.createElement("p");
      description.textContent = `${formatNumber(damageTaken)} damage taken from 1,000.`;

      const track = document.createElement("div");
      track.className = "dexterity-bar-track";
      const fill = document.createElement("span");
      fill.className = "dexterity-bar-fill";
      fill.style.setProperty("--fill", `${(reduction / maxReduction) * 100}%`);
      track.append(fill);

      card.append(label, title, description, track);
      chart.append(card);
    });
  }

  function initDexterityCalculator(root = document) {
    const widget = root.querySelector(".dexterity-calculator-widget");
    if (!widget) return;
    root
      .querySelectorAll(
        "[data-dexterity-skill-slider], [data-dexterity-str-slider], [data-dexterity-dex-slider], [data-dexterity-crit-dex-slider], [data-dexterity-dr-slider]"
      )
      .forEach((slider) => {
        slider.addEventListener("input", () => updateDexterityCalculator(root));
      });
    updateDexterityCalculator(root);
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderDamageReductionBenchmarks();
    initDexterityCalculator();
  });
})();
