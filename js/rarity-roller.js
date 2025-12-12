const rarityDefinitions = [
  { name: "Normal", color: "#ffffff", min: 0, max: 0, perkChance: 0, ac: 0 },
  { name: "Uncommon", color: "#ffd966", min: 2, max: 5, perkChance: 0, ac: 0 },
  { name: "Rare", color: "#0000ff", min: 6, max: 10, perkChance: 0, ac: 0 },
  { name: "Epic", color: "#741b47", min: 11, max: 15, perkChance: 0.4, ac: 2 },
  { name: "Legendary", color: "#ff9900", min: 16, max: 20, perkChance: 0.6, ac: 3 },
  { name: "Mythical", color: "#6aa84f", min: 21, max: 25, perkChance: 0.8, ac: 4 },
  { name: "Ascendant", color: "#ff0000", min: 26, max: 30, perkChance: 1, ac: 5 },
];

let perksCacheForRoller = null;

function initializeRarityRoller() {
  const container = document.getElementById("rarity-roller");
  if (!container) return;

  const rollButton = container.querySelector("[data-rarity-roll]");
  const upgradeButton = container.querySelector("[data-rarity-upgrade]");
  const resultContainer = container.querySelector("[data-rarity-result]");
  if (!rollButton || !resultContainer) return;

  let currentIndex = 0;
  let currentMaxIndex = rarityDefinitions.length - 1;
  let currentPerkOutcome = null;
  let currentPerkMeta = null;
  let perkMapPromise = null;

  const lastIndex = rarityDefinitions.length - 1;

  const getPerkMap = () => {
    if (!perkMapPromise) {
      perkMapPromise = loadPerkCardData().then((data) => data.map);
    }
    return perkMapPromise;
  };

  const computeMaxIndex = (baseIndex) => {
    if (baseIndex >= lastIndex) return lastIndex;
    return randomInt(baseIndex + 1, lastIndex);
  };

  const updateUpgradeAvailability = () => {
    if (!upgradeButton) return;
    const atMax = currentIndex >= currentMaxIndex;
    upgradeButton.disabled = atMax;
  };

  const setLoadingState = (isLoading, activeButton) => {
    const buttons = [rollButton, upgradeButton].filter(Boolean);
    buttons.forEach((btn) => {
      btn.disabled = isLoading;
      if (!activeButton || btn !== activeButton) return;
      if (isLoading) {
        btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
        btn.textContent = btn === rollButton ? "Rolling..." : "Upgrading...";
      } else if (btn.dataset.originalText) {
        btn.textContent = btn.dataset.originalText;
        delete btn.dataset.originalText;
      }
    });
  };

  const renderOutcome = (rarity, perkMap, perkOutcome, perkMeta, maxIndex) => {
    const stats = rarity.max > rarity.min ? randomInt(rarity.min, rarity.max) : rarity.min;
    const statSplit = distributeStats(stats);

    const fragments = [];
    fragments.push(createResultLine("Rarity", rarity.name, rarity.color));
    const maxDef = rarityDefinitions[Math.min(maxIndex, lastIndex)];
    if (maxDef) {
      fragments.push(createResultLine("Max Rarity", maxDef.name, maxDef.color));
    }
    fragments.push(
      createResultLine(
        "Bonus stats",
        rarity.min === rarity.max ? `${stats}` : `${stats} (rolled within ${rarity.min}-${rarity.max})`
      )
    );
    const acValue = typeof rarity.ac === "number" ? rarity.ac : 0;
    fragments.push(createResultLine("Bonus AC", `${acValue}`));
    fragments.push(createResultLine("Split", `STR ${statSplit.str}, DEX ${statSplit.dex}, CON ${statSplit.con}`));

    const perkLabel = perkMeta && perkMeta.source ? `Perk (from ${perkMeta.source} roll)` : "Perk Roll";
    if (!perkMeta || perkMeta.rolled === false) {
      fragments.push(createResultLine(perkLabel, "Not rolled (use Random Rarity)"));
    } else if (!perkMeta.eligible) {
      fragments.push(createResultLine(perkLabel, "Not eligible"));
    } else {
      const chancePercent = `${Math.round((perkMeta.chance || 0) * 100)}%`;
      if (perkOutcome) {
        const perkName = perkOutcome.card.querySelector("h3")
          ? perkOutcome.card.querySelector("h3").textContent.trim()
          : "Perk";
        fragments.push(createResultLine(perkLabel, `Success (${chancePercent}) - ${perkOutcome.tier} ${perkName}`));
      } else {
        fragments.push(createResultLine(perkLabel, `Failed (${chancePercent})`));
      }
    }

    resultContainer.innerHTML = "";
    fragments.forEach((fragment) => resultContainer.appendChild(fragment));
  };

  const renderFromIndex = (index, activeButton, { rerollPerk, setMax } = {}) => {
    const clampedIndex = Math.max(0, Math.min(index, rarityDefinitions.length - 1));
    currentIndex = clampedIndex;
    if (setMax) {
      currentMaxIndex = computeMaxIndex(clampedIndex);
    }
    const rarity = rarityDefinitions[clampedIndex];
    if (!rarity) return;
    setLoadingState(true, activeButton);
    getPerkMap()
      .then((perkMap) => {
        if (rerollPerk) {
          currentPerkOutcome = rollPerk(rarity, perkMap);
          currentPerkMeta = {
            source: rarity.name,
            chance: rarity.perkChance,
            eligible: rarity.perkChance > 0,
            rolled: true,
          };
        }
        renderOutcome(rarity, perkMap, currentPerkOutcome, currentPerkMeta, currentMaxIndex);
      })
      .catch((error) => {
        console.error("Rarity roll failed", error);
        resultContainer.textContent = "Unable to roll rarity.";
      })
      .finally(() => {
        setLoadingState(false, activeButton);
        updateUpgradeAvailability();
      });
  };

  rollButton.addEventListener("click", () => {
    const index = Math.floor(Math.random() * rarityDefinitions.length);
    renderFromIndex(index, rollButton, { rerollPerk: true, setMax: true });
  });

  if (upgradeButton) {
    upgradeButton.addEventListener("click", () => {
      if (currentIndex >= currentMaxIndex) {
        updateUpgradeAvailability();
        return;
      }
      const nextIndex = Math.min(currentIndex + 1, rarityDefinitions.length - 1);
      const boundedNext = Math.min(nextIndex, currentMaxIndex);
      renderFromIndex(boundedNext, upgradeButton, { rerollPerk: false, setMax: false });
    });

    updateUpgradeAvailability();
  }
}

function rollRandomRarity() {
  const index = Math.floor(Math.random() * rarityDefinitions.length);
  return rarityDefinitions[index];
}

function rollPerk(rarity, perkMap) {
  if (!rarity || rarity.perkChance <= 0 || !perkMap) return null;
  const roll = Math.random();
  if (roll > rarity.perkChance) return null;

  const eligiblePerks = [];
  perkMap.forEach((value, key) => {
    if (value.isUnique) return;
    eligiblePerks.push(value);
  });
  if (!eligiblePerks.length) return null;

  const perk = eligiblePerks[Math.floor(Math.random() * eligiblePerks.length)];
  const tierRoll = randomInt(1, 3);
  return {
    card: perk.card,
    tier: `T${tierRoll}`,
  };
}

function randomInt(min, max) {
  if (min === max) return min;
  const low = Math.ceil(min);
  const high = Math.floor(max);
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function createResultLine(label, value, color) {
  const wrapper = document.createElement("div");
  wrapper.className = "rarity-result-line";

  const labelEl = document.createElement("span");
  labelEl.className = "rarity-result-label";
  labelEl.textContent = label;

  const valueEl = document.createElement("span");
  valueEl.className = "rarity-result-value";
  valueEl.textContent = value;
  if (color) {
    valueEl.style.color = color;
  }

  wrapper.appendChild(labelEl);
  wrapper.appendChild(valueEl);
  return wrapper;
}

function distributeStats(total) {
  if (!total) return { str: 0, dex: 0, con: 0 };
  let remaining = total;
  const weights = [Math.random(), Math.random(), Math.random()];
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  const allocations = weights.map((w) => Math.floor((w / weightSum) * total));
  let [str, dex, con] = allocations;
  const assigned = str + dex + con;
  remaining -= assigned;
  const buckets = ["str", "dex", "con"];
  while (remaining > 0) {
    const bucket = buckets[Math.floor(Math.random() * buckets.length)];
    if (bucket === "str") str += 1;
    else if (bucket === "dex") dex += 1;
    else con += 1;
    remaining -= 1;
  }
  return { str, dex, con };
}

