(function () {
  const LEVEL_XP_TOTALS = Object.freeze([
    0,
    2000, 4000, 6000, 8000, 10000, 15000, 20000, 25000, 30000, 40000, 50000, 60000, 80000, 100000, 120000, 140000,
    160000, 200000, 300000, 400000, 500000, 600000, 750000, 1000000, 1250000, 1500000, 1750000, 2000000, 2250000,
    2500000, 2750000, 3000000, 3500000, 4000000, 4500000, 5000000, 5500000, 6000000, 7000000, 8000000, 9000000,
    10000000, 11000000, 12000000, 13000000, 14000000, 15000000, 16000000, 17000000, 18000000, 19000000, 20000000,
    21000000, 22000000, 23000000, 24000000, 26000000, 28000000, 30000000, 32000000, 34000000, 36000000, 38000000,
    40000000, 42000000, 44000000, 46000000, 48000000, 51000000, 54000000, 57000000, 60000000, 63000000, 66000000,
    69000000, 72000000, 75000000, 78000000, 81000000, 84000000, 87000000, 90000000, 93000000, 96000000, 100000000,
    104000000, 108000000, 113000000, 118000000, 123000000, 128000000, 133000000, 138000000, 143000000, 148000000,
    153000000, 160000000, 168000000, 178000000, 350000000, 700000000, 1050000000, 1400000000, 1750000000,
  ]);
  const MILESTONE_LEVELS = Object.freeze([1, 10, 25, 50, 75, 100, 105]);

  function formatNumber(value) {
    return Math.round(value).toLocaleString();
  }

  function getLevelTotal(level) {
    return LEVEL_XP_TOTALS[level - 1] || 0;
  }

  function getLevelDelta(level) {
    if (level <= 1) return 0;
    return getLevelTotal(level) - getLevelTotal(level - 1);
  }

  function renderLevelChart(root = document) {
    const chart = root.getElementById("level-xp-chart");
    if (!chart || !LEVEL_XP_TOTALS.length) return;
    chart.textContent = "";
    const max = LEVEL_XP_TOTALS[LEVEL_XP_TOTALS.length - 1];

    LEVEL_XP_TOTALS.forEach((total, index) => {
      const level = index + 1;
      if (level > 105) return;
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
      if (level > 1) {
        value.append(document.createElement("br"));
        const deltaLabel = document.createElement("span");
        deltaLabel.textContent = `(${formatNumber(delta)})`;
        value.append(deltaLabel);
      }

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
    LEVEL_XP_TOTALS.forEach((total, index) => {
      const x = padding + (width * index) / (LEVEL_XP_TOTALS.length - 1);
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
      label.textContent = level === 1 ? "Starting Level" : "Milestone";

      const heading = document.createElement("h3");
      heading.textContent = `Level ${level}`;

      const copy = document.createElement("p");
      copy.textContent =
        level === 1
          ? "0 total XP."
          : `${formatNumber(total)} total XP, +${formatNumber(delta)} from the previous level.`;

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
