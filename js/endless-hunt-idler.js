(() => {
  const XP_TOTALS = [
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
  ];

  const ARMOR_SLOTS = ["helmet", "chest", "gauntlets", "leggings", "shield"];
  const SLOT_ORDER = ["weapon", ...ARMOR_SLOTS];
  const SLOT_LABELS = {
    weapon: "Weapon",
    helmet: "Helmet",
    chest: "Chest",
    gauntlets: "Gauntlets",
    leggings: "Leggings",
    shield: "Shield",
  };

  const RESIST_KEYS = ["fire", "cold", "electric", "acid", "poison", "disease"];
  const STATUS_THREAT_MULTIPLIER = {
    poison: 1.08,
    disease: 1.12,
    bleed: 1.06,
    freeze: 1.15,
    shock: 1.14,
  };

  const STANCE_CONFIG = {
    balanced: {
      label: "Balanced",
      dpsMultiplier: 1,
      hpMultiplier: 1,
      incomingMultiplier: 1,
      goldMultiplier: 1,
      xpMultiplier: 1,
      tatterMultiplier: 1,
      executeBonus: 0,
    },
    aggressive: {
      label: "Aggressive",
      dpsMultiplier: 1.18,
      hpMultiplier: 0.97,
      incomingMultiplier: 1.12,
      goldMultiplier: 1.02,
      xpMultiplier: 1.04,
      tatterMultiplier: 1,
      executeBonus: 0.04,
    },
    guarded: {
      label: "Guarded",
      dpsMultiplier: 0.9,
      hpMultiplier: 1.1,
      incomingMultiplier: 0.78,
      goldMultiplier: 0.96,
      xpMultiplier: 0.98,
      tatterMultiplier: 0.96,
      executeBonus: 0,
    },
    greedy: {
      label: "Greedy",
      dpsMultiplier: 0.97,
      hpMultiplier: 0.98,
      incomingMultiplier: 1.07,
      goldMultiplier: 1.22,
      xpMultiplier: 1,
      tatterMultiplier: 1.18,
      executeBonus: 0,
    },
    executioner: {
      label: "Executioner",
      dpsMultiplier: 1.08,
      hpMultiplier: 1,
      incomingMultiplier: 1.04,
      goldMultiplier: 1.05,
      xpMultiplier: 1.08,
      tatterMultiplier: 1.05,
      executeBonus: 0.16,
    },
  };

  const ACTIVE_SKILL = {
    label: "Hunter's Burst",
    cooldownEncounters: 5,
    dpsMultiplier: 1.65,
    hpMultiplier: 1.04,
    incomingMultiplier: 0.9,
  };

  const WAYPOINT_INTERVAL = 3;
  const BOSS_INTERVAL = 10;
  const CHECKPOINT_BOSS_HEALTH_MULTIPLIER = 20;
  const CHECKPOINT_BOSS_DAMAGE_MULTIPLIER = 4;
  const WAYPOINT_CHOICES = {
    camp: {
      label: "Set Camp",
      description: "Refresh Hunter's Burst and reduce incoming damage for the next 6 fights.",
      duration: 6,
      effect: {
        playerDpsMultiplier: 1,
        incomingMultiplier: 0.84,
        goldMultiplier: 1,
        tatterMultiplier: 1,
        eliteChanceBonus: 0,
        upgradeChanceBonus: 0,
      },
    },
    cache: {
      label: "Raid Cache",
      description: "Gain gold now, then improve tatters and gear upgrade odds for the next 6 fights.",
      duration: 6,
      immediateGoldPerZone: 38,
      effect: {
        playerDpsMultiplier: 1,
        incomingMultiplier: 1,
        goldMultiplier: 1.08,
        tatterMultiplier: 1.25,
        eliteChanceBonus: 0,
        upgradeChanceBonus: 0.08,
      },
    },
    contract: {
      label: "Take Contract",
      description: "Face a harder trail with more elite pressure, but earn better gold and damage output for the next 6 fights.",
      duration: 6,
      effect: {
        playerDpsMultiplier: 1.14,
        incomingMultiplier: 1.08,
        goldMultiplier: 1.14,
        tatterMultiplier: 1.08,
        eliteChanceBonus: 0.16,
        upgradeChanceBonus: 0.04,
      },
    },
  };

  const SKILL_AUTOCAST_LABELS = {
    manual: "Manual Only",
    elite: "Elite+ Only",
    danger: "When Losing",
    smart: "Danger / Elite",
    always: "Always When Ready",
  };

  const ARCHETYPE_CONFIG = {
    bulwark: {
      label: "Shielded",
      healthMultiplier: 1.32,
      damageMultiplier: 0.93,
      counterHint: "Burst or aggressive pressure cracks shielded monsters.",
    },
    evasive: {
      label: "Evasive",
      healthMultiplier: 1.08,
      damageMultiplier: 1.06,
      counterHint: "Accuracy and burst help pin evasive targets down.",
    },
    regenerating: {
      label: "Regenerating",
      healthMultiplier: 1.18,
      damageMultiplier: 1.03,
      counterHint: "Execution windows and burst prevent long sustain fights.",
    },
    sorcerous: {
      label: "Sorcerous",
      healthMultiplier: 0.98,
      damageMultiplier: 1.22,
      counterHint: "Guarded stance and matching resist blunt spell pressure.",
    },
  };

  const MAX_ZONE_LEVEL = 150;
  const DEFAULT_ZONE_LEVEL = 1;
  const TICK_INTERVAL_MS = 750;
  const MAX_LOG_LINES = 45;

  const intFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  const decimalFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

  const state = {
    dom: {},
    data: {
      monsters: [],
      weapons: [],
      armors: [],
    },
    running: false,
    timerId: null,
    controlsEnabled: false,
    iterationsPerTick: 1,
    zoneLevel: DEFAULT_ZONE_LEVEL,
    autoPush: true,
    stance: "balanced",
    skill: {
      cooldownRemaining: 0,
      manualQueued: false,
      autocast: "smart",
      totalUses: 0,
    },
    waypoint: {
      pendingZone: null,
      activeChoiceId: "",
      remainingEncounters: 0,
      completedZones: new Set(),
      totalChoices: 0,
    },
    boss: {
      defeatedZones: new Set(),
      lastGateNoticeZone: null,
    },
    xp: 0,
    level: 1,
    gold: 0,
    kills: 0,
    deaths: 0,
    encounters: 0,
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    recentOutcomes: [],
    tatters: new Map(),
    loadout: {
      weapon: null,
      armors: {},
    },
    loadoutDirty: true,
    lastEncounter: null,
    lastWeaponUpgrade: "Weapon: none yet",
    lastArmorUpgrade: "Armor: none yet",
    lastTatterDrop: "Tatter: none yet",
    lastSkillUse: "Skill: none yet",
    lastCounterPlay: "Counter: none yet",
    lastArchetypeSummary: "Archetype: none yet",
    logLines: [],
    pendingLogEntries: [],
    logNeedsFullRender: true,
  };

  const toNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const formatNumber = (value) => intFormatter.format(Math.round(toNumber(value, 0)));
  const formatDecimal = (value) => decimalFormatter.format(toNumber(value, 0));
  const formatPercent = (value) => `${formatDecimal(toNumber(value, 0) * 100)}%`;
  const getStanceConfig = () => STANCE_CONFIG[state.stance] || STANCE_CONFIG.balanced;
  const getSkillAutocastLabel = (value = state.skill.autocast) => SKILL_AUTOCAST_LABELS[value] || SKILL_AUTOCAST_LABELS.smart;
  const isEliteVariant = (variant) => normalizeText(variant) && normalizeText(variant) !== "Normal";
  const getWaypointChoiceConfig = (choiceId) => WAYPOINT_CHOICES[choiceId] || null;
  const getActiveWaypointChoice = () => {
    if (!state.waypoint.activeChoiceId || state.waypoint.remainingEncounters <= 0) return null;
    return getWaypointChoiceConfig(state.waypoint.activeChoiceId);
  };
  const getWaypointEffects = () => {
    const activeChoice = getActiveWaypointChoice();
    return (
      activeChoice?.effect || {
        playerDpsMultiplier: 1,
        incomingMultiplier: 1,
        goldMultiplier: 1,
        tatterMultiplier: 1,
        eliteChanceBonus: 0,
        upgradeChanceBonus: 0,
      }
    );
  };
  const getNextWaypointZone = () => {
    if (state.waypoint.pendingZone !== null) return state.waypoint.pendingZone;
    const nextZone = Math.floor(state.zoneLevel / WAYPOINT_INTERVAL) * WAYPOINT_INTERVAL + WAYPOINT_INTERVAL;
    return nextZone <= MAX_ZONE_LEVEL ? nextZone : null;
  };
  const isBossCheckpointZone = (zoneLevel) => {
    const zone = Math.max(1, Math.round(toNumber(zoneLevel, 1)));
    return zone >= BOSS_INTERVAL && zone % BOSS_INTERVAL === 0;
  };
  const getNextBossCheckpointZone = () => {
    for (let zone = BOSS_INTERVAL; zone <= MAX_ZONE_LEVEL; zone += BOSS_INTERVAL) {
      if (!state.boss.defeatedZones.has(zone)) return zone;
    }
    return null;
  };
  const getZoneUnlockCap = () => getNextBossCheckpointZone() ?? MAX_ZONE_LEVEL;
  const isCheckpointBossActive = (zoneLevel = state.zoneLevel) => {
    const zone = Math.max(1, Math.round(toNumber(zoneLevel, 1)));
    return isBossCheckpointZone(zone) && !state.boss.defeatedZones.has(zone);
  };
  const getBossGateMessage = (checkpointZone = getZoneUnlockCap()) => {
    if (checkpointZone === null) return "All boss checkpoints are cleared.";
    return `Defeat the zone ${formatNumber(checkpointZone)} boss to move past zone ${formatNumber(checkpointZone)}.`;
  };
  const setZoneTarget = (zoneLevel, { suppressStatus = false } = {}) => {
    const requestedZone = clamp(Math.round(toNumber(zoneLevel, DEFAULT_ZONE_LEVEL)), 1, MAX_ZONE_LEVEL);
    const unlockCap = getZoneUnlockCap();
    const nextZone = Math.min(requestedZone, unlockCap);

    state.zoneLevel = nextZone;
    syncZoneControls();

    if (requestedZone > unlockCap && !suppressStatus) {
      setStatus(getBossGateMessage(unlockCap));
    }

    return nextZone;
  };

  const normalizeText = (value) => {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  };

  const computeDps = (minDamage, maxDamage, attackSpeed) => {
    const min = toNumber(minDamage, 0);
    const max = toNumber(maxDamage, 0);
    const speed = toNumber(attackSpeed, 0);
    if (speed <= 0) return 0;
    const average = (min + max) / 2;
    return Number((average * (1000 / speed)).toFixed(2));
  };

  const normalizeElementLabel = (value) => {
    const raw = normalizeText(value);
    if (!raw) return "None";
    const lower = raw.toLowerCase();
    if (lower === "0" || lower === "none" || lower === "-") return "None";
    if (lower.includes("lightning") || lower.includes("electric")) return "Electric";
    if (lower.includes("fire")) return "Fire";
    if (lower.includes("cold") || lower.includes("ice") || lower.includes("frost")) return "Cold";
    if (lower.includes("acid")) return "Acid";
    if (lower.includes("poison") || lower.includes("venom")) return "Poison";
    if (lower.includes("disease")) return "Disease";
    if (lower.includes("magic")) return "Magic";
    return raw;
  };

  const elementKeyFromLabel = (label) => {
    const lower = normalizeText(label).toLowerCase();
    if (!lower || lower === "none") return "";
    if (lower.includes("fire")) return "fire";
    if (lower.includes("cold") || lower.includes("ice") || lower.includes("frost")) return "cold";
    if (lower.includes("electric") || lower.includes("lightning")) return "electric";
    if (lower.includes("acid")) return "acid";
    if (lower.includes("poison") || lower.includes("venom")) return "poison";
    if (lower.includes("disease")) return "disease";
    return "";
  };

  const normalizeSlot = (value) => {
    const lower = normalizeText(value).toLowerCase();
    if (!lower) return "";
    if (lower.includes("helm")) return "helmet";
    if (lower.includes("chest") || lower.includes("plate") || lower.includes("tunic") || lower.includes("robe")) {
      return "chest";
    }
    if (lower.includes("gaunt") || lower.includes("glove")) return "gauntlets";
    if (lower.includes("legging") || lower.includes("greave")) return "leggings";
    if (lower.includes("shield")) return "shield";
    return "";
  };

  const extractResistances = (fields = {}) => ({
    fire: toNumber(fields.fire_resistance, 0),
    cold: toNumber(fields.cold_resistance, 0),
    electric: toNumber(fields.electric_resistance ?? fields.lightning_resistance, 0),
    acid: toNumber(fields.acid_resistance, 0),
    poison: toNumber(fields.poison_resistance, 0),
    disease: toNumber(fields.disease_resistance, 0),
  });

  const extractPrimaryStats = (fields = {}) => ({
    strength: toNumber(fields.strength, 0),
    dexterity: toNumber(fields.dexterity, 0),
    constitution: toNumber(fields.constitution, 0),
    toHit: toNumber(fields.to_hit, 0),
  });

  const normalizeMonster = (entry) => {
    if (!entry || typeof entry !== "object") return null;
    const fields = entry && typeof entry.fields === "object" ? entry.fields : {};
    const level = clamp(Math.round(toNumber(fields.level ?? entry.level, 0)), 0, MAX_ZONE_LEVEL);
    const health = Math.max(1, toNumber(fields.health ?? entry.health, 1));
    const minDamage = Math.max(0, toNumber(fields.min_damage ?? entry.min_damage, 0));
    const maxDamage = Math.max(minDamage, toNumber(fields.max_damage ?? entry.max_damage, minDamage));
    const attackSpeed = Math.max(1, toNumber(fields.attack_speed ?? entry.attack_speed, 1000));
    const fallbackDps = maxDamage > 0 ? Number(((minDamage + maxDamage) / 2).toFixed(2)) : 0;
    const dps = computeDps(minDamage, maxDamage, attackSpeed) || fallbackDps;

    return {
      id: entry.id ?? entry.ID ?? -1,
      name: normalizeText(entry.name || entry.Name || `Monster ${entry.id ?? ""}`) || "Unknown Monster",
      level,
      health,
      minDamage,
      maxDamage,
      attackSpeed,
      dps,
      element: normalizeElementLabel(fields.elemental_attack_label ?? fields.elemental_attack ?? entry.elemental_attack_label),
      statusEffect: normalizeText(fields.status_effect_label ?? entry.status_effect_label),
      type: normalizeText(fields.type_label ?? entry.type_label),
      uncommonTatter: normalizeText(fields.uncommon_tatter_label ?? entry.uncommon_tatter_label),
      rareTatter: normalizeText(fields.rare_tatter_label ?? entry.rare_tatter_label),
      isBoss: Boolean(fields.is_boss),
      isBerserker: Boolean(fields.is_berserker),
      hasThorns: Boolean(fields.has_thorns),
    };
  };

  const normalizeWeapon = (entry) => {
    if (!entry || typeof entry !== "object") return null;
    const fields = entry && typeof entry.fields === "object" ? entry.fields : {};
    const level = Math.max(0, Math.round(toNumber(fields.level_requirement ?? fields.level ?? entry.level, 0)));
    const minDamage = Math.max(0, toNumber(fields.min_damage ?? entry.min_damage, 0));
    const maxDamage = Math.max(minDamage, toNumber(fields.max_damage ?? entry.max_damage, minDamage));
    const attackSpeed = Math.max(1, toNumber(fields.attack_speed ?? entry.attack_speed, 1000));
    const dps = computeDps(minDamage, maxDamage, attackSpeed);
    const stats = extractPrimaryStats(fields);
    const resistances = extractResistances(fields);
    const element = normalizeElementLabel(fields.element_label ?? fields.element ?? entry.element_label ?? entry.element);
    const perk = normalizeText(fields.perk_label ?? entry.perk_label);
    const subtype = normalizeText(fields.subtype_label ?? entry.subtype_label);

    const score =
      dps +
      stats.strength * 0.55 +
      stats.dexterity * 0.45 +
      stats.constitution * 0.35 +
      stats.toHit * 0.7 +
      (element !== "None" ? 2 : 0);

    return {
      id: entry.id ?? entry.ID ?? -1,
      name: normalizeText(entry.name || entry.Name || `Weapon ${entry.id ?? ""}`) || "Unknown Weapon",
      level,
      minDamage,
      maxDamage,
      attackSpeed,
      dps,
      element,
      subtype: subtype || "Weapon",
      perk,
      stats,
      resistances,
      score,
    };
  };

  const normalizeArmor = (entry) => {
    if (!entry || typeof entry !== "object") return null;
    const fields = entry && typeof entry.fields === "object" ? entry.fields : {};
    const levelFromItem = Math.round(toNumber(fields.level ?? entry.level, 0));
    const playerRequirement = Math.round(toNumber(fields.player_level_requirement ?? entry.player_level_requirement, 0));
    const level = Math.max(0, Math.max(levelFromItem, playerRequirement));
    const slotLabel = normalizeText(fields.slot_label ?? entry.slot_label);
    const slotNorm = normalizeSlot(slotLabel || fields.slot || entry.slot);
    if (!slotNorm) return null;

    const armorValue = Math.max(0, toNumber(fields.armor ?? entry.armor, 0));
    const resistances = extractResistances(fields);
    const stats = extractPrimaryStats(fields);
    const perk = normalizeText(fields.perk_label ?? entry.perk_label);

    const resistSum = RESIST_KEYS.reduce((sum, key) => sum + toNumber(resistances[key], 0), 0);
    const score =
      armorValue +
      resistSum * 0.4 +
      stats.constitution * 1.8 +
      stats.strength * 0.8 +
      stats.dexterity * 0.6 +
      stats.toHit * 0.9;

    return {
      id: entry.id ?? entry.ID ?? -1,
      name: normalizeText(entry.name || entry.Name || `Armor ${entry.id ?? ""}`) || "Unknown Armor",
      level,
      slotLabel: slotLabel || SLOT_LABELS[slotNorm],
      slotNorm,
      armor: armorValue,
      resistances,
      stats,
      perk,
      score,
    };
  };

  const resolveUrl = (path) => {
    const utils = window.RogueCodexUtils;
    if (utils && typeof utils.getAbsoluteUrl === "function") {
      return utils.getAbsoluteUrl(path);
    }
    return new URL(path, document.baseURI).toString();
  };

  const fetchJson = async (path) => {
    const response = await fetch(resolveUrl(path), { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load ${path}`);
    }
    return response.json();
  };

  const normalizeNameForFilter = (value) => normalizeText(value).toLowerCase();

  const buildNameSet = (list) => {
    if (!Array.isArray(list)) return new Set();
    return new Set(list.map((value) => normalizeNameForFilter(value)).filter(Boolean));
  };

  const loadAllowlists = async () => {
    const utils = window.RogueCodexUtils;
    if (utils && typeof utils.loadAllowlists === "function") {
      const allowlists = await utils.loadAllowlists();
      return allowlists && typeof allowlists === "object" ? allowlists : {};
    }
    try {
      return await fetchJson("data/allowlists.json");
    } catch (error) {
      return {};
    }
  };

  const setStatus = (message) => {
    if (state.dom.status) {
      state.dom.status.textContent = message;
    }
  };

  const setControlsEnabled = (enabled) => {
    state.controlsEnabled = enabled;
    const disabled = !enabled;
    const controls = [
      state.dom.startButton,
      state.dom.stepButton,
      state.dom.resetButton,
      state.dom.speedSelect,
      state.dom.zoneSlider,
      state.dom.autoPushCheckbox,
      state.dom.skillModeSelect,
    ].filter(Boolean);
    controls.forEach((control) => {
      control.disabled = disabled;
    });
    state.dom.stanceButtons.forEach((button) => {
      button.disabled = disabled;
    });
    updateSkillTriggerState();
    updateWaypointChoiceState();
  };

  const markLoadoutDirty = () => {
    state.loadoutDirty = true;
  };

  const updateStanceButtonState = () => {
    state.dom.stanceButtons.forEach((button) => {
      const key = button.getAttribute("data-idler-stance");
      button.setAttribute("aria-pressed", key === state.stance ? "true" : "false");
    });
  };

  const getSkillReadyText = () => {
    if (state.skill.manualQueued && state.skill.cooldownRemaining <= 0) {
      return "Queued";
    }
    if (state.skill.cooldownRemaining > 0) {
      return `Ready in ${formatNumber(state.skill.cooldownRemaining)} fights`;
    }
    return "Ready";
  };

  const updateSkillTriggerState = () => {
    const button = state.dom.skillTriggerButton;
    if (!button) return;
    const ready = state.skill.cooldownRemaining <= 0;
    const queued = state.skill.manualQueued && ready;
    const blockedByWaypoint = state.waypoint.pendingZone !== null;
    button.dataset.queued = queued ? "true" : "false";
    button.textContent = queued
      ? "Cancel Hunter's Burst"
      : ready
        ? "Queue Hunter's Burst"
        : `Hunter's Burst (${formatNumber(state.skill.cooldownRemaining)} fights)`;
    button.disabled = !state.controlsEnabled || !ready || blockedByWaypoint;
  };

  const updateWaypointChoiceState = () => {
    const hasPendingChoice = state.waypoint.pendingZone !== null;
    if (state.dom.waypointSection) {
      state.dom.waypointSection.hidden = !hasPendingChoice;
    }
    state.dom.waypointChoiceButtons.forEach((button) => {
      button.disabled = !state.controlsEnabled || !hasPendingChoice;
    });
    if (state.dom.startButton) {
      state.dom.startButton.disabled = !state.controlsEnabled || hasPendingChoice;
    }
    if (state.dom.stepButton) {
      state.dom.stepButton.disabled = !state.controlsEnabled || hasPendingChoice;
    }
  };

  const createLogLine = (message, { placeholder = false } = {}) => {
    const line = document.createElement("div");
    line.className = "idler-log-line";
    line.textContent = message;
    if (placeholder) {
      line.dataset.idlerPlaceholder = "true";
    }
    return line;
  };

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false });
    const entry = `[${timestamp}] ${message}`;
    state.logLines.push(entry);
    state.pendingLogEntries.push(entry);
    if (state.logLines.length > MAX_LOG_LINES) {
      state.logLines.splice(0, state.logLines.length - MAX_LOG_LINES);
    }
  };

  const renderLog = () => {
    const container = state.dom.logContainer;
    if (!container) return;

    if (state.logNeedsFullRender) {
      const fragment = document.createDocumentFragment();
      if (!state.logLines.length) {
        fragment.appendChild(createLogLine("No events yet.", { placeholder: true }));
      } else {
        state.logLines.forEach((entry) => {
          fragment.appendChild(createLogLine(entry));
        });
      }
      container.replaceChildren(fragment);
      container.scrollTop = container.scrollHeight;
      state.pendingLogEntries = [];
      state.logNeedsFullRender = false;
      return;
    }

    if (!state.pendingLogEntries.length) return;

    const wasNearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 16;
    const placeholder = container.querySelector("[data-idler-placeholder='true']");
    if (placeholder) {
      placeholder.remove();
    }

    const fragment = document.createDocumentFragment();
    state.pendingLogEntries.forEach((entry) => {
      fragment.appendChild(createLogLine(entry));
    });
    container.appendChild(fragment);

    while (container.children.length > state.logLines.length && container.firstElementChild) {
      container.firstElementChild.remove();
    }

    if (!state.logLines.length) {
      container.replaceChildren(createLogLine("No events yet.", { placeholder: true }));
    } else if (wasNearBottom) {
      container.scrollTop = container.scrollHeight;
    }

    state.pendingLogEntries = [];
  };

  const scoreArmor = (armor, preferredElementKey = "") => {
    if (!armor) return 0;
    const resistSum = RESIST_KEYS.reduce((sum, key) => sum + toNumber(armor.resistances[key], 0), 0);
    const preferred = preferredElementKey ? toNumber(armor.resistances[preferredElementKey], 0) : 0;
    return (
      toNumber(armor.armor, 0) +
      resistSum * 0.4 +
      preferred * 1.4 +
      toNumber(armor.stats.constitution, 0) * 1.8 +
      toNumber(armor.stats.strength, 0) * 0.8 +
      toNumber(armor.stats.dexterity, 0) * 0.6 +
      toNumber(armor.stats.toHit, 0) * 0.9
    );
  };

  const scoreWeapon = (weapon) => {
    if (!weapon) return 0;
    return (
      toNumber(weapon.dps, 0) +
      toNumber(weapon.stats.strength, 0) * 0.55 +
      toNumber(weapon.stats.dexterity, 0) * 0.45 +
      toNumber(weapon.stats.constitution, 0) * 0.35 +
      toNumber(weapon.stats.toHit, 0) * 0.7 +
      (weapon.element && weapon.element !== "None" ? 2 : 0)
    );
  };

  const getZoneWeaponDpsCap = (monsterLevel) => {
    const level = Math.max(1, toNumber(monsterLevel, 1));
    return 10 + level * 0.9 + Math.sqrt(level) * 2.4;
  };

  const pickStarterWeapon = () => {
    const pool = state.data.weapons.filter((weapon) => toNumber(weapon.dps, 0) > 0);
    if (!pool.length) return null;

    const sortedByDps = pool.slice().sort((a, b) => toNumber(a.dps, 0) - toNumber(b.dps, 0));
    const lastIndex = sortedByDps.length - 1;
    const bandStart = Math.floor(lastIndex * 0.08);
    const bandEnd = Math.floor(lastIndex * 0.22);
    const starterBand = sortedByDps.slice(bandStart, Math.max(bandStart + 1, bandEnd + 1));
    const fallbackBand = sortedByDps.slice(0, Math.max(8, Math.floor(sortedByDps.length * 0.2)));
    const source = starterBand.length ? starterBand : fallbackBand;

    // Keep starter choices inside a low-DPS bracket while still preferring useful affixes/stats.
    return source
      .slice()
      .sort((a, b) => scoreWeapon(b) - scoreWeapon(a) || toNumber(a.dps, 0) - toNumber(b.dps, 0))[0];
  };

  const pickStarterArmor = (slot) => {
    const slotItems = state.data.armors.filter((armor) => armor.slotNorm === slot);
    if (!slotItems.length) return null;
    const early = slotItems.filter((armor) => armor.level <= 10);
    const source = early.length ? early : slotItems;
    return source
      .slice()
      .sort((a, b) => scoreArmor(b) - scoreArmor(a) || a.level - b.level)[0];
  };

  const buildStarterLoadout = () => {
    state.loadout.weapon = pickStarterWeapon();
    const armors = {};
    ARMOR_SLOTS.forEach((slot) => {
      armors[slot] = pickStarterArmor(slot);
    });
    state.loadout.armors = armors;
    markLoadoutDirty();
  };

  const getTotalTatters = () => {
    let total = 0;
    state.tatters.forEach((count) => {
      total += toNumber(count, 0);
    });
    return total;
  };

  const getLevelFromXp = (xp) => {
    const totalXp = Math.max(0, toNumber(xp, 0));
    for (let i = XP_TOTALS.length - 1; i >= 0; i -= 1) {
      if (totalXp >= XP_TOTALS[i]) {
        return i + 1;
      }
    }
    return 1;
  };

  const getXpSnapshot = () => {
    const level = state.level;
    const maxLevel = XP_TOTALS.length;
    if (level >= maxLevel) {
      return {
        currentFloor: XP_TOTALS[maxLevel - 1],
        next: null,
        progress: 1,
      };
    }

    const levelIndex = clamp(level - 1, 0, XP_TOTALS.length - 1);
    const currentFloor = XP_TOTALS[levelIndex];
    const next = XP_TOTALS[levelIndex + 1];
    const span = Math.max(1, next - currentFloor);
    const progress = clamp((state.xp - currentFloor) / span, 0, 1);
    return {
      currentFloor,
      next,
      progress,
    };
  };

  const accumulateLoadoutStats = () => {
    const totals = {
      armor: 0,
      strength: 0,
      dexterity: 0,
      constitution: 0,
      toHit: 0,
      resistances: {
        fire: 0,
        cold: 0,
        electric: 0,
        acid: 0,
        poison: 0,
        disease: 0,
      },
    };

    const applyStatsFromItem = (item, includeArmorValue) => {
      if (!item) return;
      if (includeArmorValue) {
        totals.armor += toNumber(item.armor, 0);
      }
      totals.strength += toNumber(item.stats.strength, 0);
      totals.dexterity += toNumber(item.stats.dexterity, 0);
      totals.constitution += toNumber(item.stats.constitution, 0);
      totals.toHit += toNumber(item.stats.toHit, 0);
      RESIST_KEYS.forEach((key) => {
        totals.resistances[key] += toNumber(item.resistances[key], 0);
      });
    };

    applyStatsFromItem(state.loadout.weapon, false);
    ARMOR_SLOTS.forEach((slot) => {
      applyStatsFromItem(state.loadout.armors[slot], true);
    });

    return totals;
  };

  const pickMonsterPoolForZone = (zoneLevel) => {
    if (!state.data.monsters.length) return [];
    const zone = clamp(Math.round(toNumber(zoneLevel, DEFAULT_ZONE_LEVEL)), 1, MAX_ZONE_LEVEL);
    const inRange = state.data.monsters.filter((monster) => Math.abs(monster.level - zone) <= 8);
    if (inRange.length) return inRange;

    return state.data.monsters
      .slice()
      .sort((a, b) => Math.abs(a.level - zone) - Math.abs(b.level - zone))
      .slice(0, 20);
  };

  const pickMonsterArchetype = (monster, variant) => {
    if (!monster) return "";
    if (Math.random() < 0.48) return "";

    const weighted = [];
    const statusKey = normalizeText(monster.statusEffect).toLowerCase();

    if (monster.hasThorns || monster.isBoss) {
      weighted.push("bulwark", "bulwark");
    }
    if (monster.element && monster.element !== "None") {
      weighted.push("sorcerous", "sorcerous");
    }
    if (statusKey === "freeze" || statusKey === "shock" || statusKey === "bleed") {
      weighted.push("evasive", "evasive");
    }
    if (statusKey === "poison" || statusKey === "disease" || isEliteVariant(variant)) {
      weighted.push("regenerating", "regenerating");
    }

    if (!weighted.length) {
      weighted.push("bulwark", "evasive", "regenerating", "sorcerous");
    }

    return weighted[Math.floor(Math.random() * weighted.length)] || "";
  };

  const buildZoneMonster = (base, zoneLevel, { roll = Math.random(), forceCheckpointBoss = false } = {}) => {
    if (!base) return null;

    const waypointEffects = getWaypointEffects();
    const eliteBonus = clamp(toNumber(waypointEffects.eliteChanceBonus, 0), 0, 0.3);
    let variant = "Normal";
    let healthMultiplier = 1;
    let damageMultiplier = 1;
    const checkpointZone = clamp(Math.round(toNumber(zoneLevel, DEFAULT_ZONE_LEVEL)), 1, MAX_ZONE_LEVEL);
    const isCheckpointBoss = forceCheckpointBoss || isCheckpointBossActive(checkpointZone);
    const corruptedThreshold = 0.12 + eliteBonus * 0.35;
    const eliteThreshold = 0.3 + eliteBonus;

    if (isCheckpointBoss) {
      variant = "Boss";
      healthMultiplier = CHECKPOINT_BOSS_HEALTH_MULTIPLIER;
      damageMultiplier = CHECKPOINT_BOSS_DAMAGE_MULTIPLIER;
    } else if (base.isBoss || roll < 0.04) {
      variant = "Elite+";
      healthMultiplier = 10;
      damageMultiplier = 2.0;
    } else if (base.isBerserker || roll < corruptedThreshold) {
      variant = "Corrupted";
      healthMultiplier = 5;
      damageMultiplier = 1.75;
    } else if (roll < eliteThreshold) {
      variant = "Elite";
      healthMultiplier = 3;
      damageMultiplier = 1.5;
    }

    const statusKey = normalizeText(base.statusEffect).toLowerCase();
    const statusMultiplier = STATUS_THREAT_MULTIPLIER[statusKey] || 1;
    const thornsMultiplier = base.hasThorns ? 1.08 : 1;
    const archetypeKey = pickMonsterArchetype(base, variant);
    const archetype = archetypeKey ? ARCHETYPE_CONFIG[archetypeKey] : null;

    return {
      ...base,
      variant,
      checkpointZone: isCheckpointBoss ? checkpointZone : null,
      isCheckpointBoss,
      archetypeKey,
      archetype: archetype ? archetype.label : "None",
      archetypeHint: archetype ? archetype.counterHint : "No special counter needed.",
      health: Math.max(1, Math.round(base.health * healthMultiplier * (archetype?.healthMultiplier ?? 1))),
      dps: Number((base.dps * damageMultiplier * statusMultiplier * thornsMultiplier * (archetype?.damageMultiplier ?? 1)).toFixed(2)),
      healthMultiplier,
      damageMultiplier,
    };
  };

  const selectMonsterForZone = (zoneLevel) => {
    const pool = pickMonsterPoolForZone(zoneLevel);
    if (!pool.length) return null;

    const base = pool[Math.floor(Math.random() * pool.length)];
    return buildZoneMonster(base, zoneLevel);
  };

  const getArchetypeCombatProfile = (target, loadoutStats, preferredResist, cappedResist, useSkill) => {
    let playerDpsMultiplier = 1;
    let incomingMultiplier = 1;
    let countered = false;
    let counterplay = target?.archetypeHint || "No special counter needed.";

    switch (target?.archetypeKey) {
      case "bulwark":
        playerDpsMultiplier *= 0.78;
        if (state.stance === "aggressive") {
          playerDpsMultiplier *= 1.14;
          countered = true;
          counterplay = "Aggressive stance breaks through the shield wall.";
        }
        if (state.stance === "executioner") {
          playerDpsMultiplier *= 1.18;
          countered = true;
          counterplay = "Executioner stance punishes shield openings.";
        }
        if (useSkill) {
          playerDpsMultiplier *= 1.22;
          countered = true;
          counterplay = "Hunter's Burst cracks the shielded front.";
        }
        break;
      case "evasive": {
        const accuracyWindow = clamp(0.78 + toNumber(loadoutStats.toHit, 0) * 0.008, 0.72, 1.02);
        playerDpsMultiplier *= accuracyWindow;
        if (state.stance === "aggressive") {
          playerDpsMultiplier *= 1.08;
          countered = true;
          counterplay = "Aggressive pressure helps pin the evasive target.";
        }
        if (useSkill) {
          playerDpsMultiplier *= 1.1;
          countered = true;
          counterplay = "Hunter's Burst catches the evasive target mid-dodge.";
        }
        break;
      }
      case "regenerating":
        playerDpsMultiplier *= 0.84;
        if (state.stance === "aggressive") {
          playerDpsMultiplier *= 1.08;
          countered = true;
          counterplay = "Aggressive pressure limits regeneration windows.";
        }
        if (state.stance === "executioner") {
          playerDpsMultiplier *= 1.18;
          countered = true;
          counterplay = "Executioner stance cuts through regeneration.";
        }
        if (useSkill) {
          playerDpsMultiplier *= 1.16;
          countered = true;
          counterplay = "Hunter's Burst overwhelms the monster's regeneration.";
        }
        break;
      case "sorcerous":
        incomingMultiplier *= 1.18;
        if (state.stance === "guarded") {
          incomingMultiplier *= 0.82;
          countered = true;
          counterplay = "Guarded stance steadies you against the spell burst.";
        }
        if (useSkill) {
          incomingMultiplier *= 0.88;
          countered = true;
          counterplay = "Hunter's Burst shortens the sorcerous damage window.";
        }
        if (preferredResist && cappedResist >= 24) {
          incomingMultiplier *= 0.9;
          countered = true;
          counterplay = "Matching resist dampens the sorcerous barrage.";
        }
        break;
      default:
        break;
    }

    return {
      playerDpsMultiplier,
      incomingMultiplier,
      countered,
      counterplay,
    };
  };

  const getCombatSnapshot = (monster, { useSkill = false } = {}) => {
    const target = monster || { level: state.zoneLevel, dps: 1, element: "None", variant: "Normal", archetypeKey: "" };
    const stance = getStanceConfig();
    const waypointEffects = getWaypointEffects();
    const loadoutStats = accumulateLoadoutStats();
    const baseWeaponDps = Math.max(1, toNumber(state.loadout.weapon?.dps, 1));
    const levelScale = 1 + Math.max(0, state.level - 1) * 0.011;
    const statScale =
      1 +
      loadoutStats.strength * 0.006 +
      loadoutStats.dexterity * 0.004 +
      loadoutStats.toHit * 0.0022;
    let playerDps = Math.max(1, baseWeaponDps * levelScale * statScale * stance.dpsMultiplier);

    let playerHp = Math.max(
      120,
      (160 + state.level * 22 + loadoutStats.constitution * 10 + loadoutStats.armor * 2.6) * stance.hpMultiplier
    );

    const preferredResist = elementKeyFromLabel(target.element);
    const resistValue = preferredResist ? loadoutStats.resistances[preferredResist] : 0;
    const cappedResist = clamp(toNumber(resistValue, 0), 0, 60);
    const resistMitigation = cappedResist / 100;
    const armorMitigation = loadoutStats.armor / (loadoutStats.armor + 180 + toNumber(target.level, 1) * 7);
    const totalMitigation = clamp(resistMitigation * 0.75 + armorMitigation * 0.55, 0, 0.85);
    let incomingDps = Math.max(0.05, toNumber(target.dps, 1) * (1 - totalMitigation) * stance.incomingMultiplier);

    const archetypeProfile = getArchetypeCombatProfile(target, loadoutStats, preferredResist, cappedResist, useSkill);
    playerDps *= archetypeProfile.playerDpsMultiplier;
    incomingDps *= archetypeProfile.incomingMultiplier;
    playerDps *= toNumber(waypointEffects.playerDpsMultiplier, 1);
    incomingDps *= toNumber(waypointEffects.incomingMultiplier, 1);

    if (stance.executeBonus > 0 && (isEliteVariant(target.variant) || target.archetypeKey)) {
      playerDps *= 1 + stance.executeBonus;
    }

    if (useSkill) {
      playerDps *= ACTIVE_SKILL.dpsMultiplier;
      playerHp *= ACTIVE_SKILL.hpMultiplier;
      incomingDps *= ACTIVE_SKILL.incomingMultiplier;
    }

    return {
      playerDps: Math.max(1, Number(playerDps.toFixed(2))),
      playerHp: Math.max(120, Math.round(playerHp)),
      incomingDps: Math.max(0.05, Number(incomingDps.toFixed(2))),
      totalMitigation,
      preferredResist,
      cappedResist,
      loadoutStats,
      stanceLabel: stance.label,
      rewardGoldMultiplier: stance.goldMultiplier * toNumber(waypointEffects.goldMultiplier, 1),
      rewardXpMultiplier: stance.xpMultiplier,
      rewardTatterMultiplier: stance.tatterMultiplier * toNumber(waypointEffects.tatterMultiplier, 1),
      rewardUpgradeChanceBonus: toNumber(waypointEffects.upgradeChanceBonus, 0),
      skillUsed: useSkill,
      counterplay: archetypeProfile.counterplay,
      archetypeCountered: archetypeProfile.countered,
    };
  };

  const resolveEncounter = (monster, combat) => {
    const timeToKill = monster.health / combat.playerDps;
    const timeToDie = combat.incomingDps <= 0 ? Number.POSITIVE_INFINITY : combat.playerHp / combat.incomingDps;
    const isKill = timeToKill <= timeToDie;
    const duration = Math.max(0.2, Math.min(isKill ? timeToKill : timeToDie, 45));
    const damageDealt = Math.min(monster.health, combat.playerDps * duration);
    const damageTaken = Math.max(0, combat.incomingDps * duration);
    const survivalRatio = timeToKill <= 0 ? Number.POSITIVE_INFINITY : timeToDie / timeToKill;

    return {
      timeToKill,
      timeToDie,
      isKill,
      duration,
      damageDealt,
      damageTaken,
      survivalRatio,
    };
  };

  const shouldUseActiveSkill = (monster, previewOutcome) => {
    if (state.skill.cooldownRemaining > 0) {
      return { useSkill: false, reason: "" };
    }

    if (state.skill.manualQueued) {
      return { useSkill: true, reason: "manual" };
    }

    const dangerous = !previewOutcome.isKill || previewOutcome.survivalRatio < 1.15;
    const smartTarget =
      dangerous ||
      isEliteVariant(monster.variant) ||
      monster.archetypeKey === "bulwark" ||
      monster.archetypeKey === "regenerating" ||
      (monster.archetypeKey === "sorcerous" && previewOutcome.survivalRatio < 1.4);

    switch (state.skill.autocast) {
      case "elite":
        return { useSkill: isEliteVariant(monster.variant), reason: "elite" };
      case "danger":
        return { useSkill: dangerous, reason: "danger" };
      case "always":
        return { useSkill: true, reason: "always" };
      case "manual":
        return { useSkill: false, reason: "" };
      case "smart":
      default:
        return { useSkill: smartTarget, reason: dangerous ? "danger" : isEliteVariant(monster.variant) ? "elite" : "archetype" };
    }
  };

  const pickRandomTop = (list, scoreFn, topCount = 12) => {
    if (!Array.isArray(list) || !list.length) return null;
    const sorted = list.slice().sort((a, b) => scoreFn(b) - scoreFn(a));
    const top = sorted.slice(0, Math.min(topCount, sorted.length));
    return top[Math.floor(Math.random() * top.length)] || null;
  };

  const maybeEquipWeapon = (monster, bonusChance) => {
    const chance = 0.16 + bonusChance + toNumber(getWaypointEffects().upgradeChanceBonus, 0);
    if (Math.random() > chance) return null;

    const current = state.loadout.weapon;
    const currentDps = Math.max(1, toNumber(current?.dps, 1));
    const zoneCap = getZoneWeaponDpsCap(monster.level);
    const stepMultiplier = 1.1 + bonusChance * 0.8;
    const upgradeMinDps = currentDps * 1.015 + 0.2;
    const upgradeMaxDps = Math.max(upgradeMinDps + 0.5, Math.min(zoneCap, currentDps * stepMultiplier + 1.5));

    let source = state.data.weapons.filter((weapon) => {
      const dps = toNumber(weapon.dps, 0);
      return dps >= upgradeMinDps && dps <= upgradeMaxDps;
    });

    if (!source.length) {
      source = state.data.weapons.filter((weapon) => {
        const dps = toNumber(weapon.dps, 0);
        return dps > currentDps * 1.01 && dps <= zoneCap;
      });
    }

    if (!source.length) return null;

    const candidate = pickRandomTop(source, scoreWeapon, 12);
    if (!candidate) return null;

    const currentScore = scoreWeapon(current);
    const candidateScore = scoreWeapon(candidate);

    if (!current || candidateScore > currentScore * 1.04) {
      state.loadout.weapon = candidate;
      markLoadoutDirty();
      state.lastWeaponUpgrade = `Weapon: ${candidate.name} (Lvl ${candidate.level}, ${formatDecimal(candidate.dps)} DPS)`;
      addLog(`Weapon upgrade -> ${candidate.name} (${formatDecimal(candidate.dps)} DPS).`);
      return candidate;
    }

    return null;
  };

  const maybeEquipArmor = (monster, bonusChance) => {
    const chance = 0.2 + bonusChance + toNumber(getWaypointEffects().upgradeChanceBonus, 0);
    if (Math.random() > chance) return null;

    const slot = ARMOR_SLOTS[Math.floor(Math.random() * ARMOR_SLOTS.length)];
    const minLevel = Math.max(0, monster.level - 30);
    const maxLevel = monster.level + 10;
    const preferredResist = elementKeyFromLabel(monster.element);
    const slotCandidates = state.data.armors.filter(
      (armor) => armor.slotNorm === slot && armor.level >= minLevel && armor.level <= maxLevel
    );
    const source = slotCandidates.length
      ? slotCandidates
      : state.data.armors.filter((armor) => armor.slotNorm === slot);
    const candidate = pickRandomTop(source, (armor) => scoreArmor(armor, preferredResist), 12);
    if (!candidate) return null;

    const current = state.loadout.armors[slot];
    const currentScore = scoreArmor(current, preferredResist);
    const candidateScore = scoreArmor(candidate, preferredResist);

    if (!current || candidateScore > currentScore * 1.07) {
      state.loadout.armors[slot] = candidate;
      markLoadoutDirty();
      state.lastArmorUpgrade = `Armor: ${SLOT_LABELS[slot]} -> ${candidate.name} (Armor ${formatNumber(candidate.armor)})`;
      addLog(`${SLOT_LABELS[slot]} upgrade -> ${candidate.name}.`);
      return { slot, candidate };
    }

    return null;
  };

  const addTatter = (name) => {
    const current = state.tatters.get(name) || 0;
    state.tatters.set(name, current + 1);
  };

  const maybeCollectTatters = (monster, bonusChance, tatterMultiplier = 1) => {
    const drops = [];
    const uncommonName = normalizeText(monster.uncommonTatter);
    const rareName = normalizeText(monster.rareTatter);
    const uncommonChance = clamp((0.08 + bonusChance) * tatterMultiplier, 0, 0.9);
    const rareChance = clamp((0.03 + bonusChance * 0.5) * tatterMultiplier, 0, 0.7);

    if (uncommonName && uncommonName.toLowerCase() !== "none" && Math.random() < uncommonChance) {
      addTatter(uncommonName);
      drops.push(uncommonName);
    }

    if (rareName && rareName.toLowerCase() !== "none" && Math.random() < rareChance) {
      addTatter(rareName);
      drops.push(rareName);
    }

    if (drops.length) {
      state.lastTatterDrop = `Tatter: ${drops.join(", ")}`;
      addLog(`Tatter found -> ${drops.join(", ")}.`);
    }

    return drops;
  };

  const advanceWaypointEffect = () => {
    const activeChoice = getActiveWaypointChoice();
    if (!activeChoice) return;

    state.waypoint.remainingEncounters = Math.max(0, state.waypoint.remainingEncounters - 1);
    if (state.waypoint.remainingEncounters > 0) return;

    state.waypoint.activeChoiceId = "";
    addLog(`Waypoint boon expired -> ${activeChoice.label}.`);
  };

  const maybeTriggerWaypointChoice = (zoneLevel) => {
    const zone = Math.max(1, Math.round(toNumber(zoneLevel, 1)));
    if (zone < WAYPOINT_INTERVAL || zone % WAYPOINT_INTERVAL !== 0) return false;
    if (state.waypoint.pendingZone === zone || state.waypoint.completedZones.has(zone)) return false;

    state.waypoint.pendingZone = zone;
    stopRun();
    setStatus(`Waypoint choice ready at zone ${formatNumber(zone)}. Pick a route boon before continuing.`);
    addLog(`Waypoint reached -> zone ${formatNumber(zone)}. Choose your next route.`);
    return true;
  };

  const applyWaypointChoice = (choiceId) => {
    const choice = getWaypointChoiceConfig(choiceId);
    const pendingZone = state.waypoint.pendingZone;
    if (!choice || pendingZone === null) return;

    state.waypoint.pendingZone = null;
    state.waypoint.completedZones.add(pendingZone);
    state.waypoint.totalChoices += 1;
    state.waypoint.activeChoiceId = choiceId;
    state.waypoint.remainingEncounters = choice.duration;

    if (choiceId === "camp") {
      state.skill.cooldownRemaining = 0;
      state.skill.manualQueued = false;
      state.lastSkillUse = `Skill: ${ACTIVE_SKILL.label} refreshed at camp`;
      addLog(`Waypoint choice -> ${choice.label}. ${ACTIVE_SKILL.label} refreshed for the next push.`);
    } else if (choiceId === "cache") {
      const bonusGold = Math.round(pendingZone * toNumber(choice.immediateGoldPerZone, 0));
      state.gold += bonusGold;
      addLog(`Waypoint choice -> ${choice.label}. Found +${formatNumber(bonusGold)} gold in the cache.`);
    } else {
      addLog(`Waypoint choice -> ${choice.label}. Expect heavier resistance and better rewards.`);
    }

    setStatus(`Waypoint choice locked in: ${choice.label}.`);
  };

  const getSkillReasonLabel = (reason) => {
    switch (reason) {
      case "manual":
        return "manual queue";
      case "elite":
        return "elite trigger";
      case "danger":
        return "danger trigger";
      case "archetype":
        return "archetype counter";
      case "always":
        return "always-on";
      default:
        return "burst trigger";
    }
  };

  const adjustZoneFromPerformance = () => {
    if (!state.autoPush) return;
    if (state.recentOutcomes.length < 10) return;

    const wins = state.recentOutcomes.reduce((sum, result) => sum + (result ? 1 : 0), 0);
    const ratio = wins / state.recentOutcomes.length;
    if (ratio >= 0.85 && state.zoneLevel < MAX_ZONE_LEVEL) {
      const nextZone = state.zoneLevel + 1;
      const unlockCap = getZoneUnlockCap();
      if (nextZone > unlockCap) {
        if (state.boss.lastGateNoticeZone !== unlockCap) {
          state.boss.lastGateNoticeZone = unlockCap;
          setStatus(getBossGateMessage(unlockCap));
          addLog(`Checkpoint locked -> zone ${formatNumber(unlockCap)} boss blocks the next bracket.`);
        }
        return;
      }

      state.boss.lastGateNoticeZone = null;
      state.zoneLevel = nextZone;
      state.recentOutcomes = [];
      addLog(`Auto-push -> zone target increased to ${state.zoneLevel}.`);
      syncZoneControls();
      maybeTriggerWaypointChoice(state.zoneLevel);
      return;
    }
    if (ratio <= 0.35 && state.zoneLevel > 1) {
      state.boss.lastGateNoticeZone = null;
      state.zoneLevel -= 1;
      state.recentOutcomes = [];
      addLog(`Auto-push -> zone target reduced to ${state.zoneLevel}.`);
      syncZoneControls();
    }
  };

  const simulateEncounter = () => {
    if (state.waypoint.pendingZone !== null) return false;
    const monster = selectMonsterForZone(state.zoneLevel);
    if (!monster) return false;

    const previewCombat = getCombatSnapshot(monster);
    const previewOutcome = resolveEncounter(monster, previewCombat);
    const skillDecision = shouldUseActiveSkill(monster, previewOutcome);
    const manualQueued = state.skill.manualQueued;
    const combat = skillDecision.useSkill ? getCombatSnapshot(monster, { useSkill: true }) : previewCombat;
    const outcome = resolveEncounter(monster, combat);
    const isKill = outcome.isKill;
    const duration = outcome.duration;
    const damageDealt = outcome.damageDealt;
    const damageTaken = outcome.damageTaken;
    const xpMultiplier = combat.rewardXpMultiplier;
    const xpGain = Math.max(0, Math.round(damageDealt * xpMultiplier));
    const goldBase = monster.level * 2.5 + monster.health * 0.012;
    const goldGain = Math.max(0, Math.round((isKill ? goldBase : goldBase * 0.3) * combat.rewardGoldMultiplier));

    state.encounters += 1;
    state.kills += isKill ? 1 : 0;
    state.deaths += isKill ? 0 : 1;
    state.totalDamageDealt += damageDealt;
    state.totalDamageTaken += damageTaken;
    state.xp += xpGain;
    state.gold += goldGain;

    const previousLevel = state.level;
    state.level = getLevelFromXp(state.xp);
    if (state.level > previousLevel) {
      addLog(`Level up: ${previousLevel} -> ${state.level}.`);
    }

    if (isKill && monster.isCheckpointBoss && monster.checkpointZone !== null) {
      state.boss.defeatedZones.add(monster.checkpointZone);
      state.boss.lastGateNoticeZone = null;
      const unlockCap = getZoneUnlockCap();
      if (unlockCap >= MAX_ZONE_LEVEL && getNextBossCheckpointZone() === null) {
        addLog(`Checkpoint cleared -> zone ${formatNumber(monster.checkpointZone)} boss defeated. The full hunt is unlocked.`);
        setStatus(`Checkpoint boss defeated at zone ${formatNumber(monster.checkpointZone)}. All brackets are now open.`);
      } else {
        addLog(`Checkpoint cleared -> zone ${formatNumber(monster.checkpointZone)} boss defeated. Zones through ${formatNumber(unlockCap)} unlocked.`);
        setStatus(`Checkpoint boss defeated at zone ${formatNumber(monster.checkpointZone)}. Zones through ${formatNumber(unlockCap)} are now open.`);
      }
    }

    const variantBonusChance = monster.isCheckpointBoss
      ? 0.2
      : monster.variant === "Elite+"
        ? 0.1
        : monster.variant === "Corrupted"
          ? 0.06
          : monster.variant === "Elite"
            ? 0.03
            : 0;

    let weaponUpgrade = null;
    let armorUpgrade = null;
    let tatterDrops = [];

    if (combat.skillUsed) {
      state.skill.cooldownRemaining = ACTIVE_SKILL.cooldownEncounters;
      state.skill.totalUses += 1;
      state.skill.manualQueued = false;
      const skillReasonLabel = getSkillReasonLabel(skillDecision.reason);
      state.lastSkillUse = `Skill: ${ACTIVE_SKILL.label} (${skillReasonLabel})`;
      if (manualQueued || isEliteVariant(monster.variant) || !previewOutcome.isKill || monster.archetypeKey) {
        addLog(`${ACTIVE_SKILL.label} -> ${monster.name}${monster.archetypeKey ? ` [${monster.archetype}]` : ""} (${skillReasonLabel}).`);
      }
    } else {
      if (state.skill.cooldownRemaining > 0) {
        state.skill.cooldownRemaining -= 1;
      }
      state.lastSkillUse =
        state.skill.cooldownRemaining > 0
          ? `Skill: Recharging (${formatNumber(state.skill.cooldownRemaining)} fights)`
          : state.skill.manualQueued
            ? `Skill: ${ACTIVE_SKILL.label} queued`
            : "Skill: Held in reserve";
    }

    if (isKill) {
      weaponUpgrade = maybeEquipWeapon(monster, variantBonusChance);
      armorUpgrade = maybeEquipArmor(monster, variantBonusChance);
      tatterDrops = maybeCollectTatters(monster, variantBonusChance, combat.rewardTatterMultiplier);
    } else if (Math.random() < 0.22) {
      addLog(`Defeat: ${monster.name} (${monster.variant}) won this fight.`);
    }

    const counterplaySummary =
      !monster.archetypeKey && combat.skillUsed && !previewOutcome.isKill
        ? "Hunter's Burst salvaged a losing fight."
        : combat.counterplay;

    state.lastArchetypeSummary = monster.archetypeKey ? `Archetype: ${monster.archetype}` : "Archetype: none";
    state.lastCounterPlay = `Counter: ${counterplaySummary}`;

    state.lastEncounter = {
      monsterName: monster.name,
      level: monster.level,
      monsterDps: monster.dps,
      variant: monster.variant,
      isCheckpointBoss: monster.isCheckpointBoss,
      checkpointZone: monster.checkpointZone,
      archetype: monster.archetype,
      archetypeKey: monster.archetypeKey,
      element: monster.element,
      statusEffect: monster.statusEffect,
      result: isKill ? "Victory" : "Defeat",
      duration,
      xpGain,
      goldGain,
      damageDealt,
      damageTaken,
      tatterDrops,
      weaponUpgrade,
      armorUpgrade,
      stanceLabel: combat.stanceLabel,
      skillUsed: combat.skillUsed,
      skillReason: skillDecision.reason,
      counterplay: counterplaySummary,
      combat,
    };

    state.recentOutcomes.push(isKill ? 1 : 0);
    if (state.recentOutcomes.length > 20) {
      state.recentOutcomes.shift();
    }

    adjustZoneFromPerformance();
    advanceWaypointEffect();
    return state.waypoint.pendingZone === null;
  };

  const getReferenceMonster = () => {
    if (state.lastEncounter) {
      return {
        level: state.lastEncounter.level,
        dps: toNumber(state.lastEncounter.monsterDps, 1),
        element: state.lastEncounter.element,
        variant: state.lastEncounter.variant,
        archetypeKey: state.lastEncounter.archetypeKey,
      };
    }
    const pool = pickMonsterPoolForZone(state.zoneLevel);
    const base = pool[0];
    if (!base) {
      return { level: state.zoneLevel, dps: 1, element: "None", variant: isCheckpointBossActive(state.zoneLevel) ? "Boss" : "Normal", archetypeKey: "" };
    }
    if (isCheckpointBossActive(state.zoneLevel)) {
      return {
        level: base.level,
        dps: Number((base.dps * CHECKPOINT_BOSS_DAMAGE_MULTIPLIER).toFixed(2)),
        element: base.element,
        variant: "Boss",
        archetypeKey: "",
      };
    }
    return base;
  };

  const formatResistSummary = (resistances = {}) => {
    const parts = RESIST_KEYS.map((key) => ({
      key,
      value: toNumber(resistances[key], 0),
    }))
      .filter((entry) => entry.value !== 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 2)
      .map((entry) => `${entry.key}: ${formatNumber(entry.value)}`);
    return parts.length ? parts.join(" | ") : "No notable resist";
  };

  const renderLoadout = () => {
    const container = state.dom.loadoutGrid;
    if (!container || !state.loadoutDirty) return;

    const fragment = document.createDocumentFragment();

    SLOT_ORDER.forEach((slot) => {
      const card = document.createElement("section");
      card.className = "idler-loadout-card";

      const title = document.createElement("h3");
      title.className = "idler-loadout-title";
      title.textContent = SLOT_LABELS[slot];
      card.appendChild(title);

      const item = slot === "weapon" ? state.loadout.weapon : state.loadout.armors[slot];
      const name = document.createElement("p");
      name.className = "idler-loadout-name";
      name.textContent = item ? item.name : "Empty";
      card.appendChild(name);

      const meta = document.createElement("p");
      meta.className = "idler-loadout-meta";
      if (!item) {
        meta.textContent = "No item equipped.";
      } else if (slot === "weapon") {
        meta.textContent =
          `Lvl ${formatNumber(item.level)} | ${formatDecimal(item.dps)} DPS | ${item.subtype}` +
          (item.element && item.element !== "None" ? ` | ${item.element}` : "");
      } else {
        meta.textContent =
          `Lvl ${formatNumber(item.level)} | Armor ${formatNumber(item.armor)} | ` + formatResistSummary(item.resistances);
      }
      card.appendChild(meta);
      fragment.appendChild(card);
    });

    container.replaceChildren(fragment);
    state.loadoutDirty = false;
  };

  const renderEncounterFeed = () => {
    const encounter = state.lastEncounter;
    if (!encounter) {
      if (state.dom.lastMonster) state.dom.lastMonster.textContent = "-";
      if (state.dom.lastOutcome) state.dom.lastOutcome.textContent = "-";
      if (state.dom.lastGains) state.dom.lastGains.textContent = "-";
      if (state.dom.lastArchetype) state.dom.lastArchetype.textContent = "Archetype: none yet";
      if (state.dom.lastSkill) state.dom.lastSkill.textContent = "Skill: none yet";
      if (state.dom.lastCounter) state.dom.lastCounter.textContent = "Counter: none yet";
      return;
    }

    if (state.dom.lastMonster) {
      const status = encounter.statusEffect ? ` | Status ${encounter.statusEffect}` : "";
      const variantLabel = encounter.isCheckpointBoss ? `Boss Checkpoint ${formatNumber(encounter.checkpointZone)}` : encounter.variant;
      const archetype = encounter.archetypeKey ? `, ${encounter.archetype}` : "";
      state.dom.lastMonster.textContent =
        `${encounter.result}: ${encounter.monsterName} (Lvl ${formatNumber(encounter.level)}, ${variantLabel}${archetype}, ${encounter.element}${status})`;
    }

    if (state.dom.lastOutcome) {
      state.dom.lastOutcome.textContent =
        `Fight ${formatDecimal(encounter.duration)}s | Dealt ${formatNumber(encounter.damageDealt)} | Took ${formatNumber(encounter.damageTaken)} | ${encounter.stanceLabel}` +
        (encounter.skillUsed ? ` | ${ACTIVE_SKILL.label}` : "");
    }

    if (state.dom.lastGains) {
      state.dom.lastGains.textContent = `Gains: +${formatNumber(encounter.xpGain)} XP, +${formatNumber(encounter.goldGain)} gold`;
    }

    if (state.dom.lastArchetype) {
      state.dom.lastArchetype.textContent = state.lastArchetypeSummary;
    }
    if (state.dom.lastSkill) {
      state.dom.lastSkill.textContent = state.lastSkillUse;
    }
    if (state.dom.lastCounter) {
      state.dom.lastCounter.textContent = state.lastCounterPlay;
    }
  };

  const renderWaypointState = () => {
    const pendingZone = state.waypoint.pendingZone;
    const activeChoice = getActiveWaypointChoice();
    const nextZone = getNextWaypointZone();

    if (state.dom.waypointTitle) {
      state.dom.waypointTitle.textContent =
        pendingZone !== null ? `Zone ${formatNumber(pendingZone)} reached.` : "No waypoint choice pending.";
    }
    if (state.dom.waypointDescription) {
      state.dom.waypointDescription.textContent =
        pendingZone !== null
          ? "Pick one small route boon before continuing the hunt."
          : activeChoice
            ? `${activeChoice.label} is active for the current push.`
            : "The next route choice appears every 3 zones.";
    }

    if (state.dom.waypointActive) {
      state.dom.waypointActive.textContent =
        pendingZone !== null ? "Choice Pending" : activeChoice ? activeChoice.label : "None";
    }
    if (state.dom.waypointRemaining) {
      state.dom.waypointRemaining.textContent = activeChoice ? formatNumber(state.waypoint.remainingEncounters) : "0";
    }
    if (state.dom.waypointNext) {
      state.dom.waypointNext.textContent = nextZone === null ? "-" : `Zone ${formatNumber(nextZone)}`;
    }
    if (state.dom.waypointCount) {
      state.dom.waypointCount.textContent = formatNumber(state.waypoint.totalChoices);
    }

    updateWaypointChoiceState();
  };

  const renderStats = () => {
    const xp = getXpSnapshot();
    const wins = state.recentOutcomes.reduce((sum, result) => sum + (result ? 1 : 0), 0);
    const recentWinRate = state.recentOutcomes.length ? wins / state.recentOutcomes.length : 0;
    const referenceMonster = getReferenceMonster();
    const combat = getCombatSnapshot(referenceMonster);
    const stance = getStanceConfig();

    const kdrValue = state.deaths ? state.kills / state.deaths : state.kills;
    const preferredResistLabel = combat.preferredResist ? `${combat.preferredResist}: ${formatNumber(combat.cappedResist)}` : "N/A";

    if (state.dom.level) state.dom.level.textContent = formatNumber(state.level);
    if (state.dom.xpTotal) state.dom.xpTotal.textContent = formatNumber(state.xp);
    if (state.dom.xpNext) {
      state.dom.xpNext.textContent = xp.next === null ? "Level cap reached" : formatNumber(Math.max(0, xp.next - state.xp));
    }
    const xpPercent = Math.round(xp.progress * 100);
    if (state.dom.xpFill) state.dom.xpFill.style.width = `${xpPercent}%`;
    if (state.dom.xpProgress) {
      state.dom.xpProgress.setAttribute("aria-valuenow", String(xp.next === null ? 100 : xpPercent));
      state.dom.xpProgress.setAttribute(
        "aria-valuetext",
        xp.next === null ? "Level cap reached." : `${xpPercent}% to next level, ${formatNumber(Math.max(0, xp.next - state.xp))} XP remaining.`
      );
    }

    if (state.dom.zoneLabel) state.dom.zoneLabel.textContent = formatNumber(state.zoneLevel);
    if (state.dom.zoneValue) state.dom.zoneValue.textContent = formatNumber(state.zoneLevel);
    const nextBossZone = getNextBossCheckpointZone();
    const zoneUnlockCap = getZoneUnlockCap();
    if (state.dom.zoneLock) {
      state.dom.zoneLock.textContent =
        nextBossZone === null
          ? "All bosses cleared"
          : isCheckpointBossActive(state.zoneLevel)
            ? `Boss at Zone ${formatNumber(nextBossZone)}`
            : `Locked at Zone ${formatNumber(nextBossZone)}`;
    }
    if (state.dom.zoneUnlockNote) {
      state.dom.zoneUnlockNote.textContent =
        nextBossZone === null
          ? `All checkpoint bosses cleared. Zones are fully unlocked through ${formatNumber(MAX_ZONE_LEVEL)}.`
          : isCheckpointBossActive(state.zoneLevel)
            ? `Checkpoint boss active at Zone ${formatNumber(nextBossZone)}. Defeat it to unlock higher brackets.`
            : `Unlocked through Zone ${formatNumber(zoneUnlockCap)}. Defeat the Zone ${formatNumber(nextBossZone)} boss to push farther.`;
    }

    if (state.dom.winRate) state.dom.winRate.textContent = formatPercent(recentWinRate);
    const winRatePercent = Math.round(recentWinRate * 100);
    if (state.dom.winRateFill) state.dom.winRateFill.style.width = `${winRatePercent}%`;
    if (state.dom.winRateProgress) {
      state.dom.winRateProgress.setAttribute("aria-valuenow", String(winRatePercent));
      state.dom.winRateProgress.setAttribute(
        "aria-valuetext",
        state.recentOutcomes.length
          ? `${formatPercent(recentWinRate)} recent win rate across ${formatNumber(state.recentOutcomes.length)} fights.`
          : "No encounters recorded yet."
      );
    }

    if (state.dom.playerDps) state.dom.playerDps.textContent = formatDecimal(combat.playerDps);
    if (state.dom.playerHp) state.dom.playerHp.textContent = formatNumber(combat.playerHp);
    if (state.dom.playerArmor) state.dom.playerArmor.textContent = formatNumber(combat.loadoutStats.armor);
    if (state.dom.playerResist) state.dom.playerResist.textContent = preferredResistLabel;

    if (state.dom.gold) state.dom.gold.textContent = formatNumber(state.gold);
    if (state.dom.encounters) state.dom.encounters.textContent = formatNumber(state.encounters);
    if (state.dom.tatters) state.dom.tatters.textContent = formatNumber(getTotalTatters());
    if (state.dom.kills) state.dom.kills.textContent = formatNumber(state.kills);
    if (state.dom.deaths) state.dom.deaths.textContent = formatNumber(state.deaths);
    if (state.dom.stanceLabel) state.dom.stanceLabel.textContent = stance.label;
    if (state.dom.skillReady) state.dom.skillReady.textContent = getSkillReadyText();
    if (state.dom.skillModeLabel) state.dom.skillModeLabel.textContent = getSkillAutocastLabel();
    if (state.dom.skillUses) state.dom.skillUses.textContent = formatNumber(state.skill.totalUses);
    if (state.dom.skillQueue) state.dom.skillQueue.textContent = state.skill.manualQueued ? "Queued" : "No";
    if (state.dom.skillStatus) {
      state.dom.skillStatus.textContent =
        state.skill.manualQueued && state.skill.cooldownRemaining <= 0
          ? `${ACTIVE_SKILL.label}: queued for the next encounter.`
          : state.skill.cooldownRemaining > 0
            ? `${ACTIVE_SKILL.label}: recharging (${formatNumber(state.skill.cooldownRemaining)} fights remaining).`
            : `${ACTIVE_SKILL.label}: ready. Autocast is ${getSkillAutocastLabel().toLowerCase()}.`;
    }
    if (state.dom.skillModeSelect && state.dom.skillModeSelect.value !== state.skill.autocast) {
      state.dom.skillModeSelect.value = state.skill.autocast;
    }

    if (state.dom.lastWeaponUpgrade) state.dom.lastWeaponUpgrade.textContent = state.lastWeaponUpgrade;
    if (state.dom.lastArmorUpgrade) state.dom.lastArmorUpgrade.textContent = state.lastArmorUpgrade;
    if (state.dom.lastTatter) state.dom.lastTatter.textContent = state.lastTatterDrop;

    if (state.dom.totalDamage) state.dom.totalDamage.textContent = `Damage dealt: ${formatNumber(state.totalDamageDealt)}`;
    if (state.dom.totalTaken) state.dom.totalTaken.textContent = `Damage taken: ${formatNumber(state.totalDamageTaken)}`;
    if (state.dom.kdr) state.dom.kdr.textContent = `KDR: ${formatDecimal(kdrValue)}`;

    renderWaypointState();
    updateStanceButtonState();
    updateSkillTriggerState();
    renderEncounterFeed();
    renderLoadout();
    renderLog();
  };

  const syncZoneControls = () => {
    if (state.dom.zoneSlider) {
      state.dom.zoneSlider.value = String(state.zoneLevel);
    }
    if (state.dom.zoneValue) {
      state.dom.zoneValue.textContent = formatNumber(state.zoneLevel);
    }
    if (state.dom.zoneLabel) {
      state.dom.zoneLabel.textContent = formatNumber(state.zoneLevel);
    }
  };

  const stopRun = () => {
    if (state.timerId) {
      window.clearInterval(state.timerId);
      state.timerId = null;
    }
    state.running = false;
    if (state.dom.startButton) {
      state.dom.startButton.textContent = "Start Run";
    }
  };

  const runTick = () => {
    if (!state.data.monsters.length || !state.data.weapons.length || !state.data.armors.length) return;
    if (state.waypoint.pendingZone !== null) {
      renderStats();
      return;
    }
    const iterations = clamp(Math.round(toNumber(state.iterationsPerTick, 1)), 1, 200);
    for (let i = 0; i < iterations; i += 1) {
      const shouldContinue = simulateEncounter();
      if (!shouldContinue) break;
    }
    renderStats();
  };

  const startRun = () => {
    if (state.running) return;
    if (state.waypoint.pendingZone !== null) {
      setStatus(`Waypoint choice ready at zone ${formatNumber(state.waypoint.pendingZone)}. Pick a route boon before continuing.`);
      renderStats();
      return;
    }
    state.running = true;
    if (state.dom.startButton) {
      state.dom.startButton.textContent = "Pause Run";
    }
    state.timerId = window.setInterval(runTick, TICK_INTERVAL_MS);
    addLog("Run started.");
    renderLog();
  };

  const toggleRun = () => {
    if (state.running) {
      stopRun();
      addLog("Run paused.");
      renderLog();
      return;
    }
    startRun();
  };

  const resetRunState = ({ resetLoadout = false, silent = false } = {}) => {
    stopRun();
    if (resetLoadout) {
      buildStarterLoadout();
    }
    state.zoneLevel = DEFAULT_ZONE_LEVEL;
    syncZoneControls();
    state.xp = 0;
    state.level = getLevelFromXp(0);
    state.gold = 0;
    state.kills = 0;
    state.deaths = 0;
    state.encounters = 0;
    state.totalDamageDealt = 0;
    state.totalDamageTaken = 0;
    state.recentOutcomes = [];
    state.tatters = new Map();
    state.lastEncounter = null;
    state.lastWeaponUpgrade = "Weapon: none yet";
    state.lastArmorUpgrade = "Armor: none yet";
    state.lastTatterDrop = "Tatter: none yet";
    state.lastSkillUse = "Skill: none yet";
    state.lastCounterPlay = "Counter: none yet";
    state.lastArchetypeSummary = "Archetype: none yet";
    state.skill.cooldownRemaining = 0;
    state.skill.manualQueued = false;
    state.skill.totalUses = 0;
    state.waypoint.pendingZone = null;
    state.waypoint.activeChoiceId = "";
    state.waypoint.remainingEncounters = 0;
    state.waypoint.completedZones = new Set();
    state.waypoint.totalChoices = 0;
    state.boss.defeatedZones = new Set();
    state.boss.lastGateNoticeZone = null;
    state.logLines = [];
    state.pendingLogEntries = [];
    state.logNeedsFullRender = true;
    if (!silent) {
      addLog("Run reset.");
    }
  };

  const bindControls = () => {
    if (state.dom.startButton) {
      state.dom.startButton.addEventListener("click", toggleRun);
    }

    if (state.dom.stepButton) {
      state.dom.stepButton.addEventListener("click", () => {
        if (state.running) return;
        if (state.waypoint.pendingZone !== null) {
          setStatus(`Waypoint choice ready at zone ${formatNumber(state.waypoint.pendingZone)}. Pick a route boon before continuing.`);
          renderStats();
          return;
        }
        simulateEncounter();
        renderStats();
      });
    }

    if (state.dom.resetButton) {
      state.dom.resetButton.addEventListener("click", () => {
        resetRunState({ resetLoadout: true, silent: false });
        renderStats();
      });
    }

    if (state.dom.speedSelect) {
      state.dom.speedSelect.addEventListener("change", () => {
        state.iterationsPerTick = clamp(Math.round(toNumber(state.dom.speedSelect.value, 1)), 1, 200);
      });
    }

    if (state.dom.zoneSlider) {
      state.dom.zoneSlider.addEventListener("input", () => {
        setZoneTarget(state.dom.zoneSlider.value);
        renderStats();
      });
    }

    if (state.dom.autoPushCheckbox) {
      state.dom.autoPushCheckbox.addEventListener("change", () => {
        state.autoPush = Boolean(state.dom.autoPushCheckbox.checked);
      });
    }

    state.dom.stanceButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.getAttribute("data-idler-stance");
        if (!key || !Object.prototype.hasOwnProperty.call(STANCE_CONFIG, key) || key === state.stance) return;
        state.stance = key;
        updateStanceButtonState();
        addLog(`Stance -> ${STANCE_CONFIG[key].label}.`);
        renderStats();
      });
    });

    if (state.dom.skillModeSelect) {
      state.dom.skillModeSelect.addEventListener("change", () => {
        const nextMode = state.dom.skillModeSelect.value;
        if (!Object.prototype.hasOwnProperty.call(SKILL_AUTOCAST_LABELS, nextMode)) return;
        state.skill.autocast = nextMode;
        renderStats();
      });
    }

    if (state.dom.skillTriggerButton) {
      state.dom.skillTriggerButton.addEventListener("click", () => {
        if (state.skill.cooldownRemaining > 0) return;
        state.skill.manualQueued = !state.skill.manualQueued;
        addLog(state.skill.manualQueued ? `${ACTIVE_SKILL.label} queued for the next encounter.` : `${ACTIVE_SKILL.label} queue canceled.`);
        renderStats();
      });
    }

    state.dom.waypointChoiceButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const choiceId = button.getAttribute("data-idler-waypoint-choice");
        if (!choiceId) return;
        applyWaypointChoice(choiceId);
        renderStats();
        startRun();
      });
    });
  };

  const cacheDom = () => {
    const root = document.getElementById("endless-hunt-idler");
    if (!root) return false;
    state.dom.root = root;
    state.dom.status = document.getElementById("idler-status");
    state.dom.startButton = document.getElementById("idler-start");
    state.dom.stepButton = document.getElementById("idler-step");
    state.dom.resetButton = document.getElementById("idler-reset");
    state.dom.speedSelect = document.getElementById("idler-speed");
    state.dom.zoneSlider = document.getElementById("idler-zone-slider");
    state.dom.zoneValue = document.getElementById("idler-zone-value");
    state.dom.zoneUnlockNote = document.getElementById("idler-zone-unlock-note");
    state.dom.autoPushCheckbox = document.getElementById("idler-auto-push");
    state.dom.stanceButtons = Array.from(root.querySelectorAll("[data-idler-stance]"));
    state.dom.skillModeSelect = document.getElementById("idler-skill-mode");
    state.dom.skillTriggerButton = document.getElementById("idler-skill-trigger");
    state.dom.skillStatus = document.getElementById("idler-skill-status");
    state.dom.waypointSection = document.getElementById("idler-waypoint-section");
    state.dom.waypointTitle = document.getElementById("idler-waypoint-title");
    state.dom.waypointDescription = document.getElementById("idler-waypoint-description");
    state.dom.waypointChoiceButtons = Array.from(root.querySelectorAll("[data-idler-waypoint-choice]"));

    state.dom.level = document.getElementById("idler-level");
    state.dom.xpTotal = document.getElementById("idler-xp-total");
    state.dom.xpNext = document.getElementById("idler-xp-next");
    state.dom.xpProgress = document.getElementById("idler-xp-progress");
    state.dom.xpFill = document.getElementById("idler-xp-fill");
    state.dom.zoneLabel = document.getElementById("idler-zone-label");
    state.dom.zoneLock = document.getElementById("idler-zone-lock");
    state.dom.winRate = document.getElementById("idler-win-rate");
    state.dom.winRateProgress = document.getElementById("idler-win-rate-progress");
    state.dom.winRateFill = document.getElementById("idler-win-rate-fill");
    state.dom.playerDps = document.getElementById("idler-player-dps");
    state.dom.playerHp = document.getElementById("idler-player-hp");
    state.dom.playerArmor = document.getElementById("idler-player-armor");
    state.dom.playerResist = document.getElementById("idler-player-resist");
    state.dom.gold = document.getElementById("idler-gold");
    state.dom.encounters = document.getElementById("idler-encounters");
    state.dom.tatters = document.getElementById("idler-tatters");
    state.dom.kills = document.getElementById("idler-kills");
    state.dom.deaths = document.getElementById("idler-deaths");
    state.dom.stanceLabel = document.getElementById("idler-stance-label");
    state.dom.skillReady = document.getElementById("idler-skill-ready");
    state.dom.skillModeLabel = document.getElementById("idler-skill-mode-label");
    state.dom.skillUses = document.getElementById("idler-skill-uses");
    state.dom.skillQueue = document.getElementById("idler-skill-queue");
    state.dom.waypointActive = document.getElementById("idler-waypoint-active");
    state.dom.waypointRemaining = document.getElementById("idler-waypoint-remaining");
    state.dom.waypointNext = document.getElementById("idler-waypoint-next");
    state.dom.waypointCount = document.getElementById("idler-waypoint-count");

    state.dom.loadoutGrid = document.getElementById("idler-loadout-grid");
    state.dom.lastMonster = document.getElementById("idler-last-monster");
    state.dom.lastOutcome = document.getElementById("idler-last-outcome");
    state.dom.lastGains = document.getElementById("idler-last-gains");
    state.dom.lastWeaponUpgrade = document.getElementById("idler-last-weapon-upgrade");
    state.dom.lastArmorUpgrade = document.getElementById("idler-last-armor-upgrade");
    state.dom.lastTatter = document.getElementById("idler-last-tatter");
    state.dom.totalDamage = document.getElementById("idler-total-damage");
    state.dom.totalTaken = document.getElementById("idler-total-taken");
    state.dom.kdr = document.getElementById("idler-kdr");
    state.dom.lastArchetype = document.getElementById("idler-last-archetype");
    state.dom.lastSkill = document.getElementById("idler-last-skill");
    state.dom.lastCounter = document.getElementById("idler-last-counter");
    state.dom.logContainer = document.getElementById("idler-log");
    return true;
  };

  const loadData = async () => {
    const [monstersRaw, weaponsRaw, armorsRaw, allowlistsRaw] = await Promise.all([
      fetchJson("pages/enemies/monsters_data03.json"),
      fetchJson("pages/items/weapons_data05.json"),
      fetchJson("pages/items/armors_data06.json"),
      loadAllowlists(),
    ]);

    const monsterAllow = buildNameSet(allowlistsRaw?.monsters?.allow);
    const monsterBlock = buildNameSet(allowlistsRaw?.monsters?.block);
    const weaponBlock = buildNameSet(allowlistsRaw?.weapons?.block);
    const armorBlock = buildNameSet(allowlistsRaw?.armors?.block);

    const isMonsterVisible = (monster) => {
      const nameKey = normalizeNameForFilter(monster?.name);
      if (!nameKey) return false;
      if (monsterAllow.size && !monsterAllow.has(nameKey)) return false;
      if (monsterBlock.size && monsterBlock.has(nameKey)) return false;
      return true;
    };

    const isWeaponVisible = (weapon) => {
      const nameKey = normalizeNameForFilter(weapon?.name);
      if (!nameKey) return false;
      return !weaponBlock.has(nameKey);
    };

    const isArmorVisible = (armor) => {
      const nameKey = normalizeNameForFilter(armor?.name);
      if (!nameKey) return false;
      return !armorBlock.has(nameKey);
    };

    state.data.monsters = (Array.isArray(monstersRaw) ? monstersRaw : [])
      .map((entry) => normalizeMonster(entry))
      .filter((monster) => monster && monster.health > 0 && monster.dps > 0 && isMonsterVisible(monster))
      .sort((a, b) => a.level - b.level || a.health - b.health);

    state.data.weapons = (Array.isArray(weaponsRaw) ? weaponsRaw : [])
      .map((entry) => normalizeWeapon(entry))
      .filter((weapon) => weapon && weapon.dps > 0 && isWeaponVisible(weapon))
      .sort((a, b) => a.level - b.level || scoreWeapon(b) - scoreWeapon(a));

    state.data.armors = (Array.isArray(armorsRaw) ? armorsRaw : [])
      .map((entry) => normalizeArmor(entry))
      .filter((armor) => armor && armor.slotNorm && isArmorVisible(armor))
      .sort((a, b) => a.level - b.level || scoreArmor(b) - scoreArmor(a));

    if (!state.data.monsters.length || !state.data.weapons.length || !state.data.armors.length) {
      throw new Error("One or more idler data sets are empty.");
    }
  };

  const initialize = async () => {
    if (!cacheDom()) return;
    bindControls();
    state.dom.root?.setAttribute("aria-busy", "true");
    setControlsEnabled(false);
    setStatus("Loading monsters, weapons, armors, and XP table...");

    try {
      await loadData();
      buildStarterLoadout();
      resetRunState({ resetLoadout: false, silent: true });
      state.iterationsPerTick = clamp(Math.round(toNumber(state.dom.speedSelect?.value, 1)), 1, 200);
      setZoneTarget(state.dom.zoneSlider?.value, { suppressStatus: true });
      state.autoPush = Boolean(state.dom.autoPushCheckbox?.checked);
      updateStanceButtonState();
      syncZoneControls();
      addLog(
        `Ready: ${formatNumber(state.data.monsters.length)} monsters, ${formatNumber(state.data.weapons.length)} weapons, ${formatNumber(state.data.armors.length)} armors.`
      );
      addLog("Press Start Run to begin the Endless Hunt.");
      setStatus("Data loaded. Prototype is ready.");
      state.dom.root?.setAttribute("aria-busy", "false");
      setControlsEnabled(true);
      renderStats();
    } catch (error) {
      console.error(error);
      setStatus("Failed to load idler data. Check browser console for details.");
      state.dom.root?.setAttribute("aria-busy", "false");
      addLog("Load error: unable to start idler prototype.");
      renderLog();
    }
  };

  document.addEventListener("DOMContentLoaded", initialize);
})();
