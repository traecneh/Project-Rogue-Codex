const MONSTER_DR_RULES = Object.freeze({
  startGap: 20,
  capGap: 30,
  maxEffect: 25,
  monsterLevelCap: 100,
});

function formatMonsterDrPercent(value) {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}%`;
}

function formatMonsterDrGap(gap) {
  if (gap === 0) return "Even level";
  return `${gap > 0 ? "+" : ""}${gap}`;
}

function calculateMonsterDamageReduction(playerLevel, rawMonsterLevel) {
  const monsterLevel = Math.min(rawMonsterLevel, MONSTER_DR_RULES.monsterLevelCap);
  const gap = monsterLevel - playerLevel;

  if (gap <= 0) {
    return {
      effect: 0,
      gap,
      monsterLevel,
      note: "Monster is at or below your level; no scaling applies.",
    };
  }

  if (gap <= MONSTER_DR_RULES.startGap) {
    return {
      effect: 0,
      gap,
      monsterLevel,
      note: `Scaling begins at +${MONSTER_DR_RULES.startGap}; current gap is ${formatMonsterDrGap(gap)}.`,
    };
  }

  const clampedGap = Math.min(gap, MONSTER_DR_RULES.capGap);
  const scalingWindow = MONSTER_DR_RULES.capGap - MONSTER_DR_RULES.startGap;
  const gapIntoWindow = clampedGap - MONSTER_DR_RULES.startGap;
  const effect = (gapIntoWindow / scalingWindow) * MONSTER_DR_RULES.maxEffect;
  const note =
    gap >= MONSTER_DR_RULES.capGap
      ? `Gap is +${MONSTER_DR_RULES.capGap} or higher; effect is capped at ${formatMonsterDrPercent(
          MONSTER_DR_RULES.maxEffect
        )}.`
      : `${gapIntoWindow} levels into the +${MONSTER_DR_RULES.startGap} to +${MONSTER_DR_RULES.capGap} window.`;

  return { effect, gap, monsterLevel, note };
}

function updateMonsterDamageReduction(root = document) {
  const widget = root.querySelector("[data-monster-dr-widget]");
  if (!widget) return;

  const playerInput = widget.querySelector("[data-player-input]");
  const monsterInput = widget.querySelector("[data-monster-input]");
  if (!playerInput || !monsterInput) return;

  const playerLevel = Number(playerInput.value);
  const rawMonsterLevel = Number(monsterInput.value);
  const result = calculateMonsterDamageReduction(playerLevel, rawMonsterLevel);
  const monsterDamage = 100 + result.effect;
  const playerDamage = Math.max(0, 100 - result.effect);

  const playerValue = widget.querySelector("[data-player-value]");
  if (playerValue) playerValue.textContent = String(playerLevel);

  const monsterValue = widget.querySelector("[data-monster-value]");
  if (monsterValue) monsterValue.textContent = String(rawMonsterLevel);

  const monsterCap = widget.querySelector("[data-monster-cap]");
  if (monsterCap) {
    monsterCap.textContent =
      rawMonsterLevel > MONSTER_DR_RULES.monsterLevelCap ? ` (treated as ${MONSTER_DR_RULES.monsterLevelCap})` : "";
  }

  const gapValue = widget.querySelector("[data-level-gap]");
  if (gapValue) gapValue.textContent = formatMonsterDrGap(result.gap);

  const gapNote = widget.querySelector("[data-gap-note]");
  if (gapNote) gapNote.textContent = result.note;

  const scalingValue = widget.querySelector("[data-scaling-value]");
  if (scalingValue) scalingValue.textContent = formatMonsterDrPercent(result.effect);

  const monsterDamageValue = widget.querySelector("[data-monster-damage]");
  if (monsterDamageValue) monsterDamageValue.textContent = formatMonsterDrPercent(monsterDamage);

  const playerDamageValue = widget.querySelector("[data-player-damage]");
  if (playerDamageValue) playerDamageValue.textContent = formatMonsterDrPercent(playerDamage);

  const resultNote = widget.querySelector("[data-result-note]");
  if (!resultNote) return;

  if (result.effect === 0) {
    resultNote.textContent =
      result.gap <= 0
        ? "Monster is not high enough level to trigger any scaling."
        : `Gap is ${formatMonsterDrGap(result.gap)}; scaling starts at +${MONSTER_DR_RULES.startGap}.`;
    return;
  }

  const capNote =
    rawMonsterLevel > MONSTER_DR_RULES.monsterLevelCap
      ? ` Using treated level ${MONSTER_DR_RULES.monsterLevelCap} for scaling.`
      : "";
  resultNote.textContent = `At ${formatMonsterDrGap(result.gap)}, monsters deal ${formatMonsterDrPercent(
    result.effect
  )} more damage and take ${formatMonsterDrPercent(result.effect)} less from you.${capNote}`;
}

function initMonsterDamageReductionCalculator(root = document) {
  const widget = root.querySelector("[data-monster-dr-widget]");
  if (!widget) return;

  widget.querySelectorAll("[data-player-input], [data-monster-input]").forEach((input) => {
    input.addEventListener("input", () => updateMonsterDamageReduction(root));
  });

  updateMonsterDamageReduction(root);
}

document.addEventListener("DOMContentLoaded", () => {
  initMonsterDamageReductionCalculator();
});
