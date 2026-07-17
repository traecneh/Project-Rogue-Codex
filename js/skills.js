(function () {
  const SKILL_XP_BANDS = Object.freeze([
    [1, 5, 75],
    [6, 10, 125],
    [11, 15, 800],
    [16, 20, 1500],
    [21, 25, 3000],
    [26, 30, 12000],
    [31, 35, 20000],
    [36, 40, 40000],
    [41, 45, 70000],
    [46, 50, 100000],
    [51, 55, 130000],
    [56, 60, 200000],
    [61, 65, 275000],
    [66, 70, 355000],
    [71, 75, 440000],
    [76, 80, 525000],
    [81, 85, 605000],
    [86, 90, 685000],
    [91, 95, 787500],
    [96, 100, 750000],
    [101, 101, 1500000],
    [102, 102, 1900000],
    [103, 103, 2400000],
    [104, 104, 3000000],
    [105, 105, 3700000],
    [106, 106, 4500000],
    [107, 107, 5500000],
    [108, 108, 6700000],
    [109, 109, 8100000],
    [110, 110, 12700000],
  ]);
  const SKILL_XP_TOTALS = Object.freeze(buildXpTotals(SKILL_XP_BANDS));

  function buildXpTotals(bands) {
    const totals = [0];
    let cumulative = 0;
    bands.forEach(([start, end, xpPerLevel]) => {
      for (let level = start; level <= end; level += 1) {
        cumulative += xpPerLevel;
        totals[level] = cumulative;
      }
    });
    return totals;
  }

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
