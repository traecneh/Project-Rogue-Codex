(function () {
  const LEVEL_XP_BANDS = Object.freeze([
    [1, 5, 2000],
    [6, 10, 5000],
    [11, 15, 15000],
    [16, 20, 40000],
    [21, 25, 150000],
    [26, 30, 250000],
    [31, 35, 350000],
    [36, 40, 600000],
    [41, 45, 1000000],
    [46, 50, 1550000],
    [51, 55, 2100000],
    [56, 60, 2650000],
    [61, 65, 3200000],
    [66, 70, 3750000],
    [71, 75, 4300000],
    [76, 80, 4900000],
    [81, 85, 5450000],
    [86, 90, 6000000],
    [91, 95, 6588000],
    [96, 100, 7100000],
    [101, 101, 150000000],
    [102, 102, 350000000],
    [103, 103, 650000000],
    [104, 104, 1100000000],
    [105, 105, 2500000000],
  ]);
  const LEVEL_XP_TOTALS = Object.freeze(buildXpTotals(LEVEL_XP_BANDS));
  const MILESTONE_LEVELS = Object.freeze([1, 10, 25, 50, 75, 100, 105]);

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

  function getLevelTotal(level) {
    return LEVEL_XP_TOTALS[level] || 0;
  }

  function getLevelDelta(level) {
    if (level <= 0) return 0;
    return getLevelTotal(level) - getLevelTotal(level - 1);
  }

  function renderLevelChart(root = document) {
    const chart = root.getElementById("level-xp-chart");
    if (!chart || !LEVEL_XP_TOTALS.length) return;
    chart.textContent = "";
    const max = LEVEL_XP_TOTALS[LEVEL_XP_TOTALS.length - 1];

    LEVEL_XP_TOTALS.slice(1).forEach((total, index) => {
      const level = index + 1;
      const delta = getLevelDelta(level);

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
      value.append(document.createElement("br"));
      const deltaLabel = document.createElement("span");
      deltaLabel.textContent = `(${formatNumber(delta)})`;
      value.append(deltaLabel);

      row.append(label, bar, value);
      chart.append(row);
    });
  }

  function renderLevelCurve(root = document) {
    const curve = root.getElementById("level-xp-curve");
    if (!curve || !curve.getContext || !LEVEL_XP_TOTALS.length) return;

    const ctx = curve.getContext("2d");
    const padding = 8;
    const width = curve.width - padding * 2;
    const height = curve.height - padding * 2;
    const max = LEVEL_XP_TOTALS[LEVEL_XP_TOTALS.length - 1];

    ctx.clearRect(0, 0, curve.width, curve.height);
    ctx.strokeStyle = "#5ab0ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    LEVEL_XP_TOTALS.slice(1).forEach((total, index) => {
      const x = padding + (width * index) / (LEVEL_XP_TOTALS.length - 2);
      const y = padding + height - (total / max) * height;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = "#a0a5b0";
    ctx.font = "10px Tahoma, Verdana, sans-serif";
    ctx.textBaseline = "top";
    const clampY = (value) => Math.max(padding + 2, Math.min(padding + height - 12, value));
    ctx.fillText("Lvl 1", padding, clampY(padding + height - 4));
    ctx.fillText("Lvl 105", padding + width - 40, clampY(padding - 4));
  }

  function renderLevelMilestones(root = document) {
    const container = root.querySelector("[data-level-milestones]");
    if (!container) return;
    container.textContent = "";

    MILESTONE_LEVELS.forEach((level) => {
      const total = getLevelTotal(level);
      const delta = getLevelDelta(level);
      const card = document.createElement("section");
      card.className = "level-milestone-card";

      const label = document.createElement("p");
      label.className = "stat-label";
      label.textContent = "Milestone";

      const heading = document.createElement("h3");
      heading.textContent = `Level ${level}`;

      const copy = document.createElement("p");
      copy.textContent = `${formatNumber(total)} cumulative XP, +${formatNumber(delta)} for this level.`;

      card.append(label, heading, copy);
      container.append(card);
    });
  }

  function initLevelXpWidget(root = document) {
    const damageSlider = root.querySelector("[data-level-damage-slider]");
    const damageValue = root.querySelector("[data-level-damage-value]");
    const baseValue = root.querySelector("[data-level-base-xp]");
    const boostCountValue = root.querySelector("[data-level-boost-count]");
    const multiplierValue = root.querySelector("[data-level-multiplier]");
    const totalXpValue = root.querySelector("[data-level-total-xp]");
    const boostButtons = Array.from(root.querySelectorAll("[data-level-boost]"));
    if (!damageSlider || !damageValue || !baseValue || !boostCountValue || !multiplierValue || !totalXpValue) return;

    const update = () => {
      const damage = Number(damageSlider.value) || 0;
      const activeBoosts = boostButtons.filter((button) => button.getAttribute("aria-pressed") === "true").length;
      const multiplier = 1 + activeBoosts;
      damageValue.textContent = formatNumber(damage);
      baseValue.textContent = formatNumber(damage);
      boostCountValue.textContent = String(activeBoosts);
      multiplierValue.textContent = `${multiplier}x`;
      totalXpValue.textContent = formatNumber(damage * multiplier);
    };

    boostButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const isActive = button.getAttribute("aria-pressed") === "true";
        button.setAttribute("aria-pressed", isActive ? "false" : "true");
        update();
      });
    });
    damageSlider.addEventListener("input", update);
    update();
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderLevelMilestones();
    renderLevelCurve();
    renderLevelChart();
    initLevelXpWidget();
  });
})();
