(function () {
  const PLAYER_TABLES_URL = "data/player_tables.json";
  const MIN_LEVEL = 1;
  const MAX_LEVEL = 105;
  const DEFAULT_CURVE_LEVEL = 100;
  const CURVE_PADDING = Object.freeze({ top: 14, right: 14, bottom: 28, left: 58 });
  let LEVEL_XP_THRESHOLDS = Object.freeze([]);

  function validatePlayerXp(data) {
    const totals = data?.player_tables?.[0]?.player_exp;
    if (!Array.isArray(totals) || totals.length !== MAX_LEVEL + 1 || totals[0] !== 0) {
      throw new Error("Player XP data must contain the Level 1 zero plus 105 cumulative thresholds.");
    }
    if (totals.some((total, index) => !Number.isFinite(total) || (index > 0 && total <= totals[index - 1]))) {
      throw new Error("Player XP thresholds must be finite and strictly increasing after the initial zero.");
    }
    return Object.freeze(totals.slice());
  }

  async function loadPlayerXp() {
    const response = await fetch(PLAYER_TABLES_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Player XP data request failed (${response.status}).`);
    return validatePlayerXp(await response.json());
  }

  function formatNumber(value) {
    return Math.round(value).toLocaleString();
  }

  function getLevelTotal(level) {
    return LEVEL_XP_THRESHOLDS[level - 1] || 0;
  }

  function getNextLevelTotal(level) {
    return LEVEL_XP_THRESHOLDS[level] || getMaxTotal();
  }

  function getNextLevelXp(level) {
    const current = getLevelTotal(level);
    return getNextLevelTotal(level) - current;
  }

  function getMaxTotal() {
    return LEVEL_XP_THRESHOLDS[LEVEL_XP_THRESHOLDS.length - 1] || 0;
  }

  function clampLevel(level) {
    return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(level)));
  }

  function getCurvePoint(curve, level) {
    const width = curve.width - CURVE_PADDING.left - CURVE_PADDING.right;
    const height = curve.height - CURVE_PADDING.top - CURVE_PADDING.bottom;
    const max = getMaxTotal();
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
    ctx.lineTo(chartRight, chartTop);
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
    ctx.fillText(`${formatNumber(getMaxTotal() / 1000000000)}B XP`, 8, chartTop);
    ctx.textBaseline = "bottom";
    ctx.fillText("0 XP", 8, chartBottom);
    ctx.textBaseline = "top";
    ctx.fillText("Lvl 1", chartLeft, chartBottom + 8);
    ctx.textAlign = "right";
    ctx.fillText("Lvl 105 cap", chartRight, chartBottom + 8);
  }

  async function initLevelCurve(root = document) {
    const curve = root.getElementById("level-xp-curve");
    const tooltip = root.querySelector("[data-level-curve-tooltip]");
    const levelValue = root.querySelector("[data-level-curve-level]");
    const totalValue = root.querySelector("[data-level-curve-total]");
    const nextTotalValue = root.querySelector("[data-level-curve-next-total]");
    const deltaValue = root.querySelector("[data-level-curve-delta]");
    const tooltipLevel = root.querySelector("[data-level-curve-tooltip-level]");
    const tooltipTotal = root.querySelector("[data-level-curve-tooltip-total]");
    const tooltipDelta = root.querySelector("[data-level-curve-tooltip-delta]");
    const deltaLabel = root.querySelector("[data-level-curve-delta-label]");
    if (
      !curve ||
      !curve.getContext ||
      !tooltip ||
      !levelValue ||
      !totalValue ||
      !nextTotalValue ||
      !deltaValue ||
      !deltaLabel
    ) {
      return;
    }

    try {
      LEVEL_XP_THRESHOLDS = await loadPlayerXp();
    } catch (error) {
      console.error("Unable to load Player XP data.", error);
      return;
    }

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
      const nextTotal = getNextLevelTotal(selectedLevel);
      const nextXp = getNextLevelXp(selectedLevel);
      const nextDescription =
        selectedLevel === MAX_LEVEL
          ? `Maximum XP is ${formatNumber(nextTotal)}, requiring ${formatNumber(nextXp)} additional XP`
          : `Level ${selectedLevel + 1} starts at ${formatNumber(nextTotal)} XP, requiring ${formatNumber(nextXp)} additional XP`;
      levelValue.textContent = `Level ${selectedLevel}`;
      totalValue.textContent = formatNumber(total);
      nextTotalValue.textContent = formatNumber(nextTotal);
      deltaValue.textContent = `(+${formatNumber(nextXp)})`;
      deltaLabel.textContent = selectedLevel === MAX_LEVEL ? "Maximum XP" : "Next Level At";
      if (tooltipLevel) tooltipLevel.textContent = `Level ${selectedLevel}`;
      if (tooltipTotal) tooltipTotal.textContent = `${formatNumber(total)} XP to reach`;
      if (tooltipDelta) {
        tooltipDelta.textContent =
          selectedLevel === MAX_LEVEL
            ? `Maximum XP: ${formatNumber(nextTotal)} (+${formatNumber(nextXp)})`
            : `Level ${selectedLevel + 1} at ${formatNumber(nextTotal)} XP (+${formatNumber(nextXp)})`;
      }
      curve.setAttribute("aria-valuenow", String(selectedLevel));
      curve.setAttribute(
        "aria-valuetext",
        `Level ${selectedLevel}, ${formatNumber(total)} XP to reach, ${nextDescription}`
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
    void initLevelCurve();
  });
})();
