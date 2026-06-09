const EXPERIENCE_XP_THRESHOLDS = Object.freeze([
  2000, 4000, 6000, 8000, 10000, 15000, 20000, 25000, 30000, 40000, 50000, 60000, 80000, 100000,
  120000, 140000, 160000, 200000, 300000, 400000, 500000, 600000, 750000, 1000000, 1250000, 1500000,
  1750000, 2000000, 2250000, 2500000, 2750000, 3000000, 3500000, 4000000, 4500000, 5000000, 5500000,
  6000000, 7000000, 8000000, 9000000, 10000000, 11000000, 12000000, 13000000, 14000000, 15000000,
  16000000, 17000000, 18000000, 19000000, 20000000, 21000000, 22000000, 23000000, 24000000, 26000000,
  28000000, 30000000, 32000000, 34000000, 36000000, 38000000, 40000000, 42000000, 44000000, 46000000,
  48000000, 51000000, 54000000, 57000000, 60000000, 63000000, 66000000, 69000000, 72000000, 75000000,
  78000000, 81000000, 84000000, 87000000, 90000000, 93000000, 96000000, 100000000, 104000000,
  108000000, 113000000, 118000000, 123000000, 128000000, 133000000, 138000000, 143000000, 148000000,
  153000000, 160000000, 168000000, 178000000, 350000000, 700000000, 1050000000, 1400000000,
  1750000000,
]);

const EXPERIENCE_ALLOWED_SPEEDS = Object.freeze([750, 1000, 1250, 1500]);
const EXPERIENCE_POOL_CAP = 3;

function formatExperienceNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatExperienceDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "-";
  const totalSeconds = Math.ceil(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function getExperienceNeeded(level) {
  if (level < 1 || level > EXPERIENCE_XP_THRESHOLDS.length) return null;
  const nextRequirement = EXPERIENCE_XP_THRESHOLDS[level - 1];
  const currentRequirement = level > 1 ? EXPERIENCE_XP_THRESHOLDS[level - 2] : 0;
  return nextRequirement - currentRequirement;
}

function getExperiencePoolBuildRate(level) {
  return level >= 90 ? 1 : 3;
}

function getNearestExperienceSpeed(value) {
  return EXPERIENCE_ALLOWED_SPEEDS.reduce((best, speed) => {
    return Math.abs(speed - value) < Math.abs(best - value) ? speed : best;
  }, EXPERIENCE_ALLOWED_SPEEDS[0]);
}

function createExperienceState(widget) {
  return {
    intervalId: null,
    level: Number(widget.querySelector("[data-xp-level-input]")?.value || 10),
    xp: Number(widget.querySelector("[data-xp-current-input]")?.value || 0),
    pool: Number(widget.querySelector("[data-xp-pool-input]")?.value || 1),
    minGain: Number(widget.querySelector("[data-xp-min-input]")?.value || 100),
    maxGain: Number(widget.querySelector("[data-xp-max-input]")?.value || 100),
    xpMultiplier: Number(widget.querySelector("[data-xp-multiplier-input]")?.value || 1.07),
    weaponSpeed: Number(widget.querySelector("[data-xp-speed-input]")?.value || 1000),
    lastBase: 0,
    lastBonus: 0,
    lastTotal: 0,
  };
}

function getExperienceState(widget) {
  if (!widget.experienceState) {
    widget.experienceState = createExperienceState(widget);
  }
  return widget.experienceState;
}

function normalizeExperienceState(state) {
  state.level = Math.min(EXPERIENCE_XP_THRESHOLDS.length, Math.max(1, Math.round(state.level || 1)));
  state.pool = Math.min(EXPERIENCE_POOL_CAP, Math.max(0, Number(state.pool) || 0));
  state.minGain = Math.min(235, Math.max(0, Math.round(state.minGain || 0)));
  state.maxGain = Math.min(235, Math.max(0, Math.round(state.maxGain || 0)));
  if (state.minGain > state.maxGain) state.maxGain = state.minGain;
  state.xpMultiplier = Math.min(10.9, Math.max(1.07, Number(state.xpMultiplier) || 1.07));
  state.weaponSpeed = getNearestExperienceSpeed(Number(state.weaponSpeed) || 1000);

  while (true) {
    const xpNeeded = getExperienceNeeded(state.level);
    if (!xpNeeded) {
      state.xp = 0;
      break;
    }
    if (state.xp >= xpNeeded && state.level < EXPERIENCE_XP_THRESHOLDS.length) {
      state.xp -= xpNeeded;
      state.level += 1;
    } else {
      state.xp = Math.max(0, Math.min(state.xp, xpNeeded));
      break;
    }
  }
}

function calculateExperienceTick(state, forcedRoll = null) {
  const xpNeeded = getExperienceNeeded(state.level);
  if (!xpNeeded) {
    return { baseGain: 0, bonusGain: 0, poolSpent: 0, totalGain: 0 };
  }

  const roll =
    forcedRoll === null
      ? Math.floor(Math.random() * (state.maxGain - state.minGain + 1)) + state.minGain
      : Math.max(0, Number(forcedRoll) || 0);
  const baseGain = roll * state.xpMultiplier;
  const percentGain = (baseGain / xpNeeded) * 100;
  let bonusGain = 0;
  let poolSpent = 0;

  if (state.pool > 0 && percentGain > 0) {
    const poolPercentAvailable = state.pool * 100;
    const percentFromPool = Math.min(poolPercentAvailable, percentGain);
    bonusGain = baseGain * (percentFromPool / percentGain);
    poolSpent = percentFromPool / 100;
  }

  return {
    baseGain,
    bonusGain,
    poolSpent,
    totalGain: baseGain + bonusGain,
  };
}

function applyExperienceGain(state, gain) {
  state.xp += gain;
  while (true) {
    const xpNeeded = getExperienceNeeded(state.level);
    if (!xpNeeded) {
      state.xp = 0;
      break;
    }
    if (state.xp >= xpNeeded && state.level < EXPERIENCE_XP_THRESHOLDS.length) {
      state.xp -= xpNeeded;
      state.level += 1;
    } else {
      break;
    }
  }
}

function readExperienceInputs(widget, state) {
  const levelInput = widget.querySelector("[data-xp-level-input]");
  const xpInput = widget.querySelector("[data-xp-current-input]");
  const poolInput = widget.querySelector("[data-xp-pool-input]");
  const minInput = widget.querySelector("[data-xp-min-input]");
  const maxInput = widget.querySelector("[data-xp-max-input]");
  const multiplierInput = widget.querySelector("[data-xp-multiplier-input]");
  const speedInput = widget.querySelector("[data-xp-speed-input]");

  if (levelInput) state.level = Number(levelInput.value);
  if (xpInput) state.xp = Number(xpInput.value);
  if (poolInput) state.pool = Number(poolInput.value);
  if (minInput) state.minGain = Number(minInput.value);
  if (maxInput) state.maxGain = Number(maxInput.value);
  if (multiplierInput) state.xpMultiplier = Number(multiplierInput.value);
  if (speedInput) state.weaponSpeed = Number(speedInput.value);
  normalizeExperienceState(state);
}

function syncExperienceInputs(widget, state) {
  const xpNeeded = getExperienceNeeded(state.level);
  const levelInput = widget.querySelector("[data-xp-level-input]");
  const xpInput = widget.querySelector("[data-xp-current-input]");
  const poolInput = widget.querySelector("[data-xp-pool-input]");
  const minInput = widget.querySelector("[data-xp-min-input]");
  const maxInput = widget.querySelector("[data-xp-max-input]");
  const multiplierInput = widget.querySelector("[data-xp-multiplier-input]");
  const speedInput = widget.querySelector("[data-xp-speed-input]");

  if (levelInput) levelInput.value = String(state.level);
  if (xpInput) {
    xpInput.disabled = !xpNeeded;
    xpInput.max = String(xpNeeded || 0);
    xpInput.step = "1";
    xpInput.value = String(Math.round(state.xp));
  }
  if (poolInput) poolInput.value = state.pool.toFixed(2);
  if (minInput) minInput.value = String(state.minGain);
  if (maxInput) maxInput.value = String(state.maxGain);
  if (multiplierInput) multiplierInput.value = state.xpMultiplier.toFixed(2);
  if (speedInput) speedInput.value = String(state.weaponSpeed);
}

function setExperienceText(widget, selector, text) {
  const node = widget.querySelector(selector) || document.querySelector(selector);
  if (node) node.textContent = text;
}

function updateExperienceSimulator(root = document) {
  const widget = root.querySelector("[data-experience-widget]");
  if (!widget) return;

  const state = getExperienceState(widget);
  normalizeExperienceState(state);
  syncExperienceInputs(widget, state);

  const xpNeeded = getExperienceNeeded(state.level);
  const effectiveMin = state.minGain * state.xpMultiplier;
  const effectiveMax = state.maxGain * state.xpMultiplier;
  const averageGain = (effectiveMin + effectiveMax) / 2;
  const projectedRate = averageGain * (1000 / state.weaponSpeed);
  const remainingXp = xpNeeded ? Math.max(0, xpNeeded - state.xp) : 0;
  const eta = projectedRate > 0 && remainingXp > 0 ? remainingXp / projectedRate : 0;
  const buildRate = getExperiencePoolBuildRate(state.level).toFixed(1);

  setExperienceText(widget, "[data-xp-level]", String(state.level));
  setExperienceText(widget, "[data-xp-current]", formatExperienceNumber(Math.floor(state.xp)));
  setExperienceText(widget, "[data-xp-needed]", xpNeeded ? formatExperienceNumber(xpNeeded) : "Max");
  setExperienceText(widget, "[data-xp-pool]", state.pool.toFixed(2));
  setExperienceText(widget, "[data-xp-pool-remaining]", state.pool.toFixed(2));
  setExperienceText(widget, "[data-xp-min]", formatExperienceNumber(state.minGain));
  setExperienceText(widget, "[data-xp-max]", formatExperienceNumber(state.maxGain));
  setExperienceText(widget, "[data-xp-min-effective]", formatExperienceNumber(Number(effectiveMin.toFixed(1))));
  setExperienceText(widget, "[data-xp-max-effective]", formatExperienceNumber(Number(effectiveMax.toFixed(1))));
  setExperienceText(widget, "[data-xp-multiplier]", `${state.xpMultiplier.toFixed(2)}x`);
  setExperienceText(widget, "[data-xp-speed]", String(state.weaponSpeed));
  setExperienceText(widget, "[data-xp-base]", formatExperienceNumber(Number(state.lastBase.toFixed(1))));
  setExperienceText(widget, "[data-xp-bonus]", formatExperienceNumber(Number(state.lastBonus.toFixed(1))));
  setExperienceText(widget, "[data-xp-total]", formatExperienceNumber(Number(state.lastTotal.toFixed(1))));
  setExperienceText(widget, "[data-xp-rate]", `${formatExperienceNumber(Number(projectedRate.toFixed(1)))} xp/s`);
  setExperienceText(widget, "[data-xp-eta]", xpNeeded ? formatExperienceDuration(eta) : "Max level");
  setExperienceText(widget, "[data-xp-build-rate]", `+${buildRate} levels per 24 hours`);

  const progress = xpNeeded ? Math.min(100, (state.xp / xpNeeded) * 100) : 100;
  setExperienceText(widget, "[data-xp-progress]", xpNeeded ? `${progress.toFixed(1)}%` : "Max level");

  const startButton = widget.querySelector("[data-xp-start]");
  const stopButton = widget.querySelector("[data-xp-stop]");
  if (startButton) startButton.disabled = Boolean(state.intervalId) || !xpNeeded;
  if (stopButton) stopButton.disabled = !state.intervalId;
}

function stopExperienceSimulation(widget) {
  const state = getExperienceState(widget);
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
}

function runExperienceTick(widget, forcedRoll = null) {
  const state = getExperienceState(widget);
  readExperienceInputs(widget, state);
  const tick = calculateExperienceTick(state, forcedRoll);
  state.pool = Math.max(0, state.pool - tick.poolSpent);
  state.lastBase = tick.baseGain;
  state.lastBonus = tick.bonusGain;
  state.lastTotal = tick.totalGain;
  applyExperienceGain(state, tick.totalGain);
  normalizeExperienceState(state);
  updateExperienceSimulator(document);
}

function initExperienceSimulator(root = document) {
  const widget = root.querySelector("[data-experience-widget]");
  if (!widget) return;

  getExperienceState(widget);
  updateExperienceSimulator(root);

  widget
    .querySelectorAll(
      "[data-xp-level-input], [data-xp-current-input], [data-xp-pool-input], [data-xp-min-input], [data-xp-max-input], [data-xp-multiplier-input], [data-xp-speed-input]"
    )
    .forEach((input) => {
      input.addEventListener("input", () => {
        stopExperienceSimulation(widget);
        readExperienceInputs(widget, getExperienceState(widget));
        updateExperienceSimulator(root);
      });
    });

  const runTickButton = widget.querySelector("[data-xp-run-tick]");
  if (runTickButton) {
    runTickButton.addEventListener("click", () => runExperienceTick(widget, getExperienceState(widget).minGain));
  }

  const startButton = widget.querySelector("[data-xp-start]");
  if (startButton) {
    startButton.addEventListener("click", () => {
      const state = getExperienceState(widget);
      if (state.intervalId || !getExperienceNeeded(state.level)) return;
      state.intervalId = setInterval(() => runExperienceTick(widget), state.weaponSpeed);
      updateExperienceSimulator(root);
    });
  }

  const stopButton = widget.querySelector("[data-xp-stop]");
  if (stopButton) {
    stopButton.addEventListener("click", () => stopExperienceSimulation(widget));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initExperienceSimulator();
});
