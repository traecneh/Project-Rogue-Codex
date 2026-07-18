(function () {
  const PLAYER_TABLES_URL = "data/player_tables.json";
  const MIN_SKILL_LEVEL = 0;
  const MAX_SKILL_LEVEL = 110;
  const DEFAULT_CURVE_LEVEL = 100;
  const CURVE_PADDING = Object.freeze({ top: 14, right: 14, bottom: 28, left: 58 });
  let SKILL_XP_TOTALS = Object.freeze([]);

  function validateSkillXp(data) {
    const totals = data?.player_tables?.[0]?.skill_exp;
    if (!Array.isArray(totals) || totals.length !== MAX_SKILL_LEVEL + 1 || totals[0] !== 0) {
      throw new Error("Skill XP data must contain cumulative thresholds from Level 0 through Level 110.");
    }
    if (totals.some((total, index) => !Number.isFinite(total) || (index > 0 && total <= totals[index - 1]))) {
      throw new Error("Skill XP thresholds must be finite and strictly increasing after Level 0.");
    }
    return Object.freeze(totals.slice());
  }

  async function loadSkillXp() {
    const response = await fetch(PLAYER_TABLES_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Skill XP data request failed (${response.status}).`);
    return validateSkillXp(await response.json());
  }

  function formatNumber(value) {
    return Math.round(value).toLocaleString();
  }

  function formatCompactNumber(value) {
    return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
  }

  function getSkillTotal(level) {
    return SKILL_XP_TOTALS[level] || 0;
  }

  function getNextSkillTotal(level) {
    return level < MAX_SKILL_LEVEL ? getSkillTotal(level + 1) : getSkillTotal(level);
  }

  function getNextSkillXp(level) {
    return getNextSkillTotal(level) - getSkillTotal(level);
  }

  function clampLevel(level) {
    return Math.min(MAX_SKILL_LEVEL, Math.max(MIN_SKILL_LEVEL, Math.round(level)));
  }

  function getCurvePoint(curve, level) {
    const width = curve.width - CURVE_PADDING.left - CURVE_PADDING.right;
    const height = curve.height - CURVE_PADDING.top - CURVE_PADDING.bottom;
    const max = getSkillTotal(MAX_SKILL_LEVEL);
    return {
      x: CURVE_PADDING.left + (width * (level - MIN_SKILL_LEVEL)) / (MAX_SKILL_LEVEL - MIN_SKILL_LEVEL),
      y: CURVE_PADDING.top + height - (getSkillTotal(level) / max) * height,
    };
  }

  function drawSkillCurve(curve, selectedLevel) {
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
    for (let level = MIN_SKILL_LEVEL; level <= MAX_SKILL_LEVEL; level += 1) {
      const point = getCurvePoint(curve, level);
      if (level === MIN_SKILL_LEVEL) ctx.moveTo(point.x, point.y);
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
    ctx.fillText(`${formatCompactNumber(getSkillTotal(MAX_SKILL_LEVEL))} XP`, 8, chartTop);
    ctx.textBaseline = "bottom";
    ctx.fillText("0 XP", 8, chartBottom);
    ctx.textBaseline = "top";
    ctx.fillText("Lvl 0", chartLeft, chartBottom + 8);
    ctx.textAlign = "right";
    ctx.fillText("Lvl 110", chartRight, chartBottom + 8);
  }

  async function initSkillCurve(root = document) {
    const curve = root.getElementById("skill-xp-curve");
    const tooltip = root.querySelector("[data-skill-curve-tooltip]");
    const levelValue = root.querySelector("[data-skill-curve-level]");
    const totalValue = root.querySelector("[data-skill-curve-total]");
    const nextLabel = root.querySelector("[data-skill-curve-next-label]");
    const nextTotalValue = root.querySelector("[data-skill-curve-next-total]");
    const nextIncrementValue = root.querySelector("[data-skill-curve-next-increment]");
    const tooltipLevel = root.querySelector("[data-skill-curve-tooltip-level]");
    const tooltipTotal = root.querySelector("[data-skill-curve-tooltip-total]");
    const tooltipNext = root.querySelector("[data-skill-curve-tooltip-next]");
    if (
      !curve ||
      !curve.getContext ||
      !tooltip ||
      !levelValue ||
      !totalValue ||
      !nextLabel ||
      !nextTotalValue ||
      !nextIncrementValue
    ) {
      return;
    }

    try {
      SKILL_XP_TOTALS = await loadSkillXp();
    } catch (error) {
      console.error("Unable to load Skill XP data.", error);
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
      const isMaximum = selectedLevel === MAX_SKILL_LEVEL;
      const total = getSkillTotal(selectedLevel);
      const nextTotal = getNextSkillTotal(selectedLevel);
      const nextXp = getNextSkillXp(selectedLevel);
      const nextDescription = isMaximum
        ? `Maximum XP is ${formatNumber(total)}`
        : `Level ${selectedLevel + 1} starts at ${formatNumber(nextTotal)} XP, requiring ${formatNumber(nextXp)} additional XP`;

      levelValue.textContent = `Level ${selectedLevel}`;
      totalValue.textContent = formatNumber(total);
      nextLabel.textContent = isMaximum ? "Maximum XP" : "Next Level At";
      nextTotalValue.textContent = formatNumber(nextTotal);
      nextIncrementValue.hidden = isMaximum;
      nextIncrementValue.textContent = isMaximum ? "" : `(+${formatNumber(nextXp)})`;
      if (tooltipLevel) tooltipLevel.textContent = `Level ${selectedLevel}`;
      if (tooltipTotal) tooltipTotal.textContent = `${formatNumber(total)} XP to reach`;
      if (tooltipNext) {
        tooltipNext.textContent = isMaximum
          ? `Maximum XP: ${formatNumber(total)}`
          : `Level ${selectedLevel + 1} at ${formatNumber(nextTotal)} XP (+${formatNumber(nextXp)})`;
      }
      curve.setAttribute("aria-valuenow", String(selectedLevel));
      curve.setAttribute(
        "aria-valuetext",
        `Level ${selectedLevel}, ${formatNumber(total)} XP to reach, ${nextDescription}`
      );
      drawSkillCurve(curve, selectedLevel);
      if (showTooltip) positionTooltip(selectedLevel);
    };

    const levelFromPointer = (event) => {
      const rect = curve.getBoundingClientRect();
      const internalX = ((event.clientX - rect.left) / rect.width) * curve.width;
      const chartWidth = curve.width - CURVE_PADDING.left - CURVE_PADDING.right;
      const ratio = (internalX - CURVE_PADDING.left) / chartWidth;
      return MIN_SKILL_LEVEL + ratio * (MAX_SKILL_LEVEL - MIN_SKILL_LEVEL);
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
      if (event.key === "Home") nextLevel = MIN_SKILL_LEVEL;
      else if (event.key === "End") nextLevel = MAX_SKILL_LEVEL;
      else if (Object.prototype.hasOwnProperty.call(steps, event.key)) nextLevel += steps[event.key];
      else return;
      event.preventDefault();
      selectLevel(nextLevel, true);
    });
    window.addEventListener("resize", () => {
      tooltip.hidden = true;
      drawSkillCurve(curve, selectedLevel);
    });

    selectLevel(selectedLevel);
  }

  document.addEventListener("DOMContentLoaded", () => {
    void initSkillCurve();
  });
})();
