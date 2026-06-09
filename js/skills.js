(function () {
  const SKILL_XP_TOTALS = Object.freeze([
    0,
    25, 62, 125, 250, 375, 500, 625, 750, 875, 1000, 1500, 2000, 2500, 3750, 5000, 6250, 7500, 8750, 10000, 11250,
    12500, 15000, 17500, 20000, 22500, 25000, 37500, 50000, 62500, 75000, 87500, 100000, 112500, 125000, 150000,
    175000, 200000, 225000, 250000, 312500, 375000, 437500, 500000, 562500, 625000, 687500, 750000, 812500,
    875000, 1000000, 1125000, 1250000, 1375000, 1500000, 1625000, 1750000, 1875000, 2000000, 2125000, 2250000,
    2375000, 2500000, 2625000, 2750000, 2875000, 3000000, 3125000, 3250000, 3375000, 3500000, 3625000, 3750000,
    3875000, 4000000, 4250000, 4750000, 5000000, 5250000, 5500000, 5750000, 6000000, 6250000, 6500000, 6750000,
    7000000, 7250000, 7500000, 7750000, 8000000, 8250000, 8500000, 8750000, 9000000, 9250000, 9500000, 9750000,
    10000000, 10500000, 11250000, 12500000, 15000000, 17500000, 20000000, 22500000, 25000000, 27500000, 30000000,
    32500000, 35000000, 40000000,
  ]);

  function formatNumber(value) {
    return Math.round(value).toLocaleString();
  }

  function getSkillTotal(level) {
    return SKILL_XP_TOTALS[level] || 0;
  }

  function getSkillDelta(level) {
    if (level <= 0) return 0;
    return getSkillTotal(level) - getSkillTotal(level - 1);
  }

  function renderSkillChart(root = document) {
    const chart = root.getElementById("skill-xp-chart");
    if (!chart || !SKILL_XP_TOTALS.length) return;
    chart.textContent = "";
    const max = SKILL_XP_TOTALS[SKILL_XP_TOTALS.length - 1];

    SKILL_XP_TOTALS.forEach((total, level) => {
      if (level > 110) return;
      const delta = getSkillDelta(level);

      const row = document.createElement("div");
      row.className = "weight-row";

      const label = document.createElement("div");
      label.className = "weight-label";
      label.textContent = `Lvl ${level}`;

      const bar = document.createElement("div");
      bar.className = "weight-bar";
      bar.style.setProperty("--fill", `${(total / max) * 100}%`);

      const value = document.createElement("div");
      value.className = "weight-value";
      value.append(document.createTextNode(formatNumber(total)));
      if (level > 0) {
        value.append(document.createElement("br"));
        const deltaLabel = document.createElement("span");
        deltaLabel.textContent = `(${formatNumber(delta)})`;
        value.append(deltaLabel);
      }

      row.append(label, bar, value);
      chart.append(row);
    });
  }

  function renderSkillCurve(root = document) {
    const curve = root.getElementById("skill-xp-curve");
    if (!curve || !curve.getContext || !SKILL_XP_TOTALS.length) return;

    const ctx = curve.getContext("2d");
    const padding = 8;
    const width = curve.width - padding * 2;
    const height = curve.height - padding * 2;
    const max = SKILL_XP_TOTALS[SKILL_XP_TOTALS.length - 1];

    ctx.clearRect(0, 0, curve.width, curve.height);
    ctx.strokeStyle = "#5ab0ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    SKILL_XP_TOTALS.forEach((total, index) => {
      const x = padding + (width * index) / (SKILL_XP_TOTALS.length - 1);
      const y = padding + height - (total / max) * height;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = "#a0a5b0";
    ctx.font = "10px Tahoma, Verdana, sans-serif";
    ctx.textBaseline = "top";
    const clampY = (value) => Math.max(padding + 2, Math.min(padding + height - 12, value));
    ctx.fillText("Lvl 0", padding, clampY(padding + height - 4));
    ctx.fillText("Lvl 110", padding + width - 36, clampY(padding - 4));
  }

  function initSkillRequirementWidget(root = document) {
    const baseSlider = root.querySelector("[data-skill-base-slider]");
    const requirementSlider = root.querySelector("[data-skill-requirement-slider]");
    const raceToggle = root.querySelector("[data-skill-race-toggle]");
    const baseValue = root.querySelector("[data-skill-base]");
    const requirementValue = root.querySelector("[data-skill-requirement]");
    const effectiveValue = root.querySelector("[data-skill-effective]");
    const statusValue = root.querySelector("[data-skill-status]");
    const noteValue = root.querySelector("[data-skill-note]");
    if (!baseSlider || !requirementSlider || !raceToggle || !baseValue || !requirementValue || !effectiveValue || !statusValue) {
      return;
    }

    const update = () => {
      const base = Number(baseSlider.value) || 0;
      const requirement = Number(requirementSlider.value) || 0;
      const hasRaceBonus = raceToggle.getAttribute("aria-pressed") === "true";
      const effective = base + (hasRaceBonus ? 10 : 0);

      baseValue.textContent = String(base);
      requirementValue.textContent = String(requirement);
      effectiveValue.textContent = String(effective);

      if (base >= requirement) {
        statusValue.textContent = "Meets requirement";
        if (noteValue) noteValue.textContent = "Base skill satisfies the equipment check.";
      } else if (effective >= requirement) {
        statusValue.textContent = "Requirement unmet";
        if (noteValue) noteValue.textContent = "Race bonus is visible, but base skill is still short.";
      } else {
        statusValue.textContent = "Requirement unmet";
        if (noteValue) noteValue.textContent = "Train base skill to meet the equipment check.";
      }
    };

    baseSlider.addEventListener("input", update);
    requirementSlider.addEventListener("input", update);
    raceToggle.addEventListener("click", () => {
      const isActive = raceToggle.getAttribute("aria-pressed") === "true";
      raceToggle.setAttribute("aria-pressed", isActive ? "false" : "true");
      update();
    });
    update();
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderSkillCurve();
    renderSkillChart();
    initSkillRequirementWidget();
  });
})();
