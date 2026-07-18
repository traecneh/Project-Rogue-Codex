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
  const MIN_LEVEL = 1;
  const MAX_LEVEL = 105;
  const DEFAULT_CURVE_LEVEL = 100;
  const CURVE_PADDING = Object.freeze({ top: 14, right: 14, bottom: 28, left: 58 });

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

  function clampLevel(level) {
    return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(level)));
  }

  function getCurvePoint(curve, level) {
    const width = curve.width - CURVE_PADDING.left - CURVE_PADDING.right;
    const height = curve.height - CURVE_PADDING.top - CURVE_PADDING.bottom;
    const max = getLevelTotal(MAX_LEVEL);
    return {
      x: CURVE_PADDING.left + (width * (level - MIN_LEVEL)) / (MAX_LEVEL - MIN_LEVEL),
      y: CURVE_PADDING.top + height - (getLevelTotal(level) / max) * height,
    };
  }

  function drawLevelCurve(curve, selectedLevel) {
    const ctx = curve.getContext("2d");
    if (!ctx) return;
    const chartLeft = CURVE_PADDING.left;
    const chartRight = curve.width - CURVE_PADDING.right;
    const chartTop = CURVE_PADDING.top;
    const chartBottom = curve.height - CURVE_PADDING.bottom;

    ctx.clearRect(0, 0, curve.width, curve.height);
    ctx.strokeStyle = "rgba(160, 165, 176, 0.16)";
    ctx.lineWidth = 1;
    [0, 0.25, 0.5, 0.75, 1].forEach((ratio) => {
      const y = chartBottom - (chartBottom - chartTop) * ratio;
      ctx.beginPath();
      ctx.moveTo(chartLeft, y);
      ctx.lineTo(chartRight, y);
      ctx.stroke();
    });

    ctx.strokeStyle = "#5ab0ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let level = MIN_LEVEL; level <= MAX_LEVEL; level += 1) {
      const point = getCurvePoint(curve, level);
      if (level === MIN_LEVEL) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();

    const selectedPoint = getCurvePoint(curve, selectedLevel);
    ctx.strokeStyle = "rgba(75, 255, 75, 0.65)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(selectedPoint.x, chartTop);
    ctx.lineTo(selectedPoint.x, chartBottom);
    ctx.stroke();

    ctx.fillStyle = "#4bff4b";
    ctx.beginPath();
    ctx.arc(selectedPoint.x, selectedPoint.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#0c1118";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#a0a5b0";
    ctx.font = "11px Tahoma, Verdana, sans-serif";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText("5B XP", 8, chartTop);
    ctx.textBaseline = "bottom";
    ctx.fillText("0 XP", 8, chartBottom);
    ctx.textBaseline = "top";
    ctx.fillText("Lvl 1", chartLeft, chartBottom + 8);
    ctx.textAlign = "right";
    ctx.fillText("Lvl 105", chartRight, chartBottom + 8);
  }

  function initLevelCurve(root = document) {
    const curve = root.getElementById("level-xp-curve");
    const tooltip = root.querySelector("[data-level-curve-tooltip]");
    const levelValue = root.querySelector("[data-level-curve-level]");
    const totalValue = root.querySelector("[data-level-curve-total]");
    const deltaValue = root.querySelector("[data-level-curve-delta]");
    const tooltipLevel = root.querySelector("[data-level-curve-tooltip-level]");
    const tooltipTotal = root.querySelector("[data-level-curve-tooltip-total]");
    const tooltipDelta = root.querySelector("[data-level-curve-tooltip-delta]");
    if (!curve || !curve.getContext || !tooltip || !levelValue || !totalValue || !deltaValue) return;

    let selectedLevel = DEFAULT_CURVE_LEVEL;

    const positionTooltip = (level) => {
      const curveRect = curve.getBoundingClientRect();
      if (!curveRect.width || !curveRect.height) return;
      const point = getCurvePoint(curve, level);
      const pointX = (point.x / curve.width) * curveRect.width;
      const pointY = (point.y / curve.height) * curveRect.height;
      tooltip.hidden = false;
      const halfWidth = tooltip.offsetWidth / 2;
      const left = Math.min(curveRect.width - halfWidth - 6, Math.max(halfWidth + 6, pointX));
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${pointY}px`;
      tooltip.classList.toggle("is-below", pointY < tooltip.offsetHeight + 18);
    };

    const selectLevel = (level, showTooltip = false) => {
      selectedLevel = clampLevel(level);
      const total = getLevelTotal(selectedLevel);
      const delta = getLevelDelta(selectedLevel);
      levelValue.textContent = `Level ${selectedLevel}`;
      totalValue.textContent = formatNumber(total);
      deltaValue.textContent = formatNumber(delta);
      if (tooltipLevel) tooltipLevel.textContent = `Level ${selectedLevel}`;
      if (tooltipTotal) tooltipTotal.textContent = `${formatNumber(total)} cumulative XP`;
      if (tooltipDelta) tooltipDelta.textContent = `${formatNumber(delta)} XP for this level`;
      curve.setAttribute("aria-valuenow", String(selectedLevel));
      curve.setAttribute(
        "aria-valuetext",
        `Level ${selectedLevel}, ${formatNumber(total)} cumulative XP, ${formatNumber(delta)} XP for this level`
      );
      drawLevelCurve(curve, selectedLevel);
      if (showTooltip) positionTooltip(selectedLevel);
    };

    const levelFromPointer = (event) => {
      const rect = curve.getBoundingClientRect();
      const internalX = ((event.clientX - rect.left) / rect.width) * curve.width;
      const chartWidth = curve.width - CURVE_PADDING.left - CURVE_PADDING.right;
      const ratio = (internalX - CURVE_PADDING.left) / chartWidth;
      return MIN_LEVEL + ratio * (MAX_LEVEL - MIN_LEVEL);
    };

    curve.addEventListener("pointermove", (event) => selectLevel(levelFromPointer(event), true));
    curve.addEventListener("pointerdown", (event) => {
      curve.focus({ preventScroll: true });
      selectLevel(levelFromPointer(event), true);
    });
    curve.addEventListener("pointerleave", () => {
      tooltip.hidden = true;
    });
    curve.addEventListener("pointercancel", () => {
      tooltip.hidden = true;
    });
    curve.addEventListener("focus", () => positionTooltip(selectedLevel));
    curve.addEventListener("blur", () => {
      tooltip.hidden = true;
    });
    curve.addEventListener("keydown", (event) => {
      const steps = {
        ArrowLeft: -1,
        ArrowRight: 1,
        PageDown: -5,
        PageUp: 5,
      };
      let nextLevel = selectedLevel;
      if (event.key === "Home") nextLevel = MIN_LEVEL;
      else if (event.key === "End") nextLevel = MAX_LEVEL;
      else if (Object.prototype.hasOwnProperty.call(steps, event.key)) nextLevel += steps[event.key];
      else return;
      event.preventDefault();
      selectLevel(nextLevel, true);
    });
    window.addEventListener("resize", () => {
      tooltip.hidden = true;
      drawLevelCurve(curve, selectedLevel);
    });

    selectLevel(selectedLevel);
  }

  document.addEventListener("DOMContentLoaded", () => {
    initLevelCurve();
  });
})();
