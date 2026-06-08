(() => {
  const DEFAULT_SPEED = "1000";
  const SPEED_OPTIONS = [
    { value: "750", label: "750ms" },
    { value: "1000", label: "1000ms" },
    { value: "1250", label: "1250ms" },
    { value: "1500", label: "1500ms" },
  ];
  const STACK_SCENARIOS = [
    { label: "1x T1", tierIndex: 0, count: 1 },
    { label: "3x T1", tierIndex: 0, count: 3 },
    { label: "3x T2", tierIndex: 1, count: 3 },
    { label: "3x T3", tierIndex: 2, count: 3 },
  ];

  const stackEffect = (label, values, options = {}) => ({
    label,
    values,
    prefix: options.prefix || "",
    unit: options.unit || "",
    suffix: options.suffix || label,
    proc: options.proc === true,
    stack: options.stack !== false,
  });

  const speedChance = (label, values, options = {}) => ({
    label,
    values,
    proc: options.proc !== false,
    suffix: options.suffix || label,
    unit: options.unit || "%",
  });

  const damageBonus = (target) => ({
    effects: [stackEffect(`${target} damage`, [11, 13, 15], { prefix: "+", unit: "%", suffix: `${target} damage` })],
  });

  const resistance = (label) => ({
    effects: [stackEffect(label, [8, 10, 12], { prefix: "+", unit: "%", suffix: label })],
  });

  const PERK_CALCULATIONS = {
    Beastslayer: damageBonus("Beast/Animal"),
    Consecration: damageBonus("Undead/Disease Beast"),
    Demonsbane: damageBonus("Demon/Fire Beast"),
    Executioner: damageBonus("Humanoid/Giant"),
    Iceshatter: damageBonus("Ice Beast"),
    Slayer: {
      effects: [stackEffect("all monster damage", [5, 7, 9], { prefix: "+", unit: "%", suffix: "all monster damage" })],
    },
    Venomshock: damageBonus("Electric/Poison Beast"),
    Epidemic: {
      effects: [
        stackEffect("disease damage", [3, 4, 5], { prefix: "+", unit: "%", suffix: "disease damage" }),
        stackEffect("disease chance", [4, 6, 8], { prefix: "+", unit: "%", suffix: "disease chance" }),
      ],
    },
    Garrote: {
      note: "Requires 100 base Strength.",
      effects: [
        stackEffect("bleed chance", [4, 5, 6], { prefix: "+", unit: "%", suffix: "bleed chance" }),
        stackEffect("bleed damage", [2.5, 3, 3.5], { prefix: "+", unit: "%", suffix: "bleed damage" }),
      ],
    },
    "Lethal Toxins": {
      effects: [
        stackEffect("poison damage", [3, 4, 5], { prefix: "+", unit: "%", suffix: "poison damage" }),
        stackEffect("poison chance", [4, 6, 8], { prefix: "+", unit: "%", suffix: "poison chance" }),
      ],
    },
    Desperation: {
      note: "Base damage bonus is 2% per copy; missing-health scaling stacks by tier.",
      effects: [
        stackEffect("base damage", [2, 2, 2], { prefix: "+", unit: "%", suffix: "base damage" }),
        stackEffect("missing-health damage", [6, 8, 10], { prefix: "+", unit: "%", suffix: "max missing-health damage" }),
      ],
    },
    Destruction: {
      effects: [stackEffect("damage dealt", [4, 5, 6], { prefix: "+", unit: "%", suffix: "damage dealt" })],
    },
    Hawkeye: {
      effects: [
        stackEffect("to-hit", [8, 10, 12], { prefix: "+", suffix: "to-hit" }),
        stackEffect("crit chance", [3, 4, 5], { prefix: "+", unit: "%", suffix: "crit chance" }),
      ],
    },
    Overpower: {
      effects: [
        stackEffect("critical damage", [3, 4, 5], { prefix: "+", unit: "%", suffix: "critical damage" }),
        stackEffect("crit chance", [3, 4, 5], { prefix: "+", unit: "%", suffix: "crit chance" }),
      ],
    },
    "Bloodlust": {
      note: "Proc/min assumes continuous attacking. Chance and exhaustion reduction are additive.",
      effects: [
        stackEffect("trigger chance", [3, 4, 5], { unit: "%", suffix: "trigger chance", proc: true }),
        stackEffect("duration bonus", [0, 1.5, 3], { prefix: "+", unit: "s", suffix: "duration bonus" }),
        stackEffect("exhaustion reduction", [6, 9, 12], { prefix: "-", unit: "s", suffix: "exhaustion" }),
      ],
    },
    Brutality: {
      speedChance: speedChance("trigger chance", [2, 3, 3, 4]),
      note: "Trigger chance follows weapon-speed buckets; duration bonus stacks by tier.",
      effects: [stackEffect("duration bonus", [15, 30, 45], { prefix: "+", unit: "s", suffix: "duration bonus" })],
    },
    Swiftness: {
      speedChance: speedChance("trigger chance", [2, 3, 3, 4]),
      note: "Trigger chance follows weapon-speed buckets; duration bonus stacks by tier.",
      effects: [stackEffect("duration bonus", [15, 30, 45], { prefix: "+", unit: "s", suffix: "duration bonus" })],
    },
    Tenacity: {
      note: "Trigger chance is based on being attacked; duration bonus stacks by tier.",
      effects: [stackEffect("duration bonus", [15, 30, 45], { prefix: "+", unit: "s", suffix: "duration bonus" })],
    },
    Alchemist: {
      effects: [stackEffect("potion healing", [30, 40, 50], { prefix: "+", unit: "%", suffix: "potion healing" })],
    },
    Bloodthirster: {
      speedChance: speedChance("heal trigger chance", [21, 26, 31, 36]),
      effects: [stackEffect("max health heal", [4, 6, 8], { unit: "%", suffix: "max health heal" })],
      note: "PvE effectiveness is half of the PvP heal value.",
    },
    Lifesteal: {
      effects: [
        stackEffect("PvP damage stolen", [6, 8, 10], { unit: "%", suffix: "PvP damage stolen" }),
        stackEffect("PvE damage stolen", [3, 4, 5], { unit: "%", suffix: "PvE damage stolen" }),
      ],
    },
    Rejuvenation: {
      effects: [
        stackEffect("base constitution tick", [10, 15, 20], { prefix: "+", suffix: "base constitution tick" }),
        stackEffect("per 25 player levels", [2, 3, 4], { prefix: "+", suffix: "per 25 player levels" }),
      ],
    },
    Vampirism: {
      speedChance: speedChance("HoT trigger chance", [8, 10, 11, 13]),
      note: "HoT ticks 5 times. PvE values are capped by the perk text.",
      effects: [
        stackEffect("PvP target max health per tick", [3, 3.75, 4.5], {
          unit: "%",
          suffix: "PvP target max health per tick",
        }),
        stackEffect("PvE target max health per tick", [1, 1.5, 2], {
          unit: "%",
          suffix: "PvE target max health per tick",
        }),
      ],
    },
    "Critical Aegis": {
      effects: [
        stackEffect("critical damage overshield", [10, 17.5, 25], {
          unit: "%",
          suffix: "critical damage overshield",
        }),
      ],
    },
    Impenetrable: {
      effects: [stackEffect("armor", [4, 5, 6], { prefix: "+", suffix: "armor" })],
    },
    Juggernaut: {
      note: "20% trigger chance. Reduction is multiplicative, so stacked copies are shown as listed tier values.",
      effects: [stackEffect("damage reduction", [25, 30, 35], { unit: "%", suffix: "damage reduction", stack: false })],
    },
    Parry: {
      speedChance: speedChance("parry chance", [6, 7, 9, 10]),
      effects: [stackEffect("damage reduction", [70, 80, 90], { unit: "%", suffix: "damage reduction", stack: false })],
    },
    "Toxic Shell": {
      effects: [
        stackEffect("poison damage overshield", [25, 35, 45], { unit: "%", suffix: "poison damage overshield" }),
      ],
    },
    Vitality: {
      effects: [stackEffect("health", [200, 250, 300], { prefix: "+", suffix: "health" })],
    },
    Antacid: resistance("Acid resistance"),
    "Demon Blood": resistance("Fire resistance"),
    "Frozen Heart": resistance("Cold resistance"),
    Hazmat: resistance("Disease resistance"),
    "Lightning Field": resistance("Lightning resistance"),
    "Magic Shield": {
      effects: [stackEffect("all resistances", [2, 3, 4], { prefix: "+", unit: "%", suffix: "all resistances" })],
    },
    Tourniquet: resistance("Poison resistance"),
    Antitoxin: {
      effects: [
        stackEffect("PvP poison avoidance", [20, 25, 30], { unit: "%", suffix: "PvP poison avoidance" }),
        stackEffect("PvE poison avoidance", [30, 35, 40], { unit: "%", suffix: "PvE poison avoidance" }),
      ],
    },
    Immunization: {
      effects: [
        stackEffect("PvP disease avoidance", [20, 25, 30], { unit: "%", suffix: "PvP disease avoidance" }),
        stackEffect("PvE disease avoidance", [30, 35, 40], { unit: "%", suffix: "PvE disease avoidance" }),
      ],
    },
    "Bolstered Strength": {
      effects: [stackEffect("max weight", [125, 175, 225], { prefix: "+", suffix: "max weight" })],
    },
    Knowledge: {
      effects: [stackEffect("experience gained", [10, 12.5, 15], { prefix: "+", unit: "%", suffix: "experience gained" })],
    },
    Moneybags: {
      effects: [stackEffect("gold dropped", [20, 25, 30], { prefix: "+", unit: "%", suffix: "gold dropped" })],
    },
    "Blood Siphon": {
      note: "PvE effectiveness is half of the listed value.",
      effects: [stackEffect("bleed damage HoT", [33, 66, 100], { unit: "%", suffix: "bleed damage HoT" })],
    },
    "Crimson Feast": {
      note: "PvE effectiveness is half of the listed value.",
      effects: [stackEffect("disease damage HoT", [33, 66, 100], { unit: "%", suffix: "disease damage HoT" })],
    },
    Envenomation: {
      effects: [stackEffect("poison chance", [5, 10, 15], { prefix: "+", unit: "%", suffix: "poison chance" })],
    },
    "Flame Buffet": {
      speedChance: speedChance("DoT trigger chance", [15, 20, 25, 30]),
      effects: [
        stackEffect("damage per tick low roll", [50, 100, 200], { suffix: "damage/tick low roll", stack: false }),
        stackEffect("damage per tick high roll", [100, 200, 300], { suffix: "damage/tick high roll", stack: false }),
      ],
    },
    Lycan: {
      effects: [stackEffect("disease chance", [5, 10, 15], { prefix: "+", unit: "%", suffix: "disease chance" })],
    },
    "Plague Eater": {
      effects: [stackEffect("damage taken reflected per tick", [5, 10, 15], { unit: "%", suffix: "damage taken reflected per tick" })],
    },
    Runic: {
      effects: [
        stackEffect("PvE damage stolen", [10, 12.5, 15], { unit: "%", suffix: "PvE damage stolen" }),
        stackEffect("PvP damage stolen", [20, 25, 30], { unit: "%", suffix: "PvP damage stolen" }),
      ],
    },
    Vengeance: {
      note: "Chance scales from Constitution/3; damage ranges use Constitution scaling and are not speed based.",
      effects: [
        stackEffect("Con damage low roll", [0.2, 0.25, 0.33], { suffix: "Con damage low roll", stack: false }),
        stackEffect("Con damage high roll", [0.25, 0.33, 0.5], { suffix: "Con damage high roll", stack: false }),
      ],
    },
  };

  const normalizedCalculations = new Map(
    Object.entries(PERK_CALCULATIONS).map(([name, metadata]) => [normalizePerkName(name), metadata])
  );

  function normalizePerkName(value) {
    return String(value || "")
      .trim()
      .replace(/\s*\(\s*tier\s*\d+\s*\)\s*$/i, "")
      .replace(/\s*\(\s*t\s*\d+\s*\)\s*$/i, "")
      .replace(/\s*tier\s*\d+\s*$/i, "")
      .trim()
      .toLowerCase();
  }

  const attacksPerMinute = (speedValue) => {
    const speed = Number(speedValue) || Number(DEFAULT_SPEED);
    return speed > 0 ? 60000 / speed : 0;
  };

  const speedBucketIndex = (speedValue) => {
    const speed = Number(speedValue) || Number(DEFAULT_SPEED);
    if (speed <= 750) return 0;
    if (speed <= 1000) return 1;
    if (speed <= 1250) return 2;
    return 3;
  };

  const formatNumber = (value) => {
    if (!Number.isFinite(value)) return "";
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, "").replace(/\.$/, "");
  };

  const formatEffectValue = (effect, scenario) => {
    const base = Number(effect.values?.[scenario.tierIndex]);
    if (!Number.isFinite(base)) return "";
    const value = effect.stack === false ? base : base * scenario.count;
    return `${effect.prefix || ""}${formatNumber(value)}${effect.unit || ""} ${effect.suffix || effect.label}`.trim();
  };

  const appendText = (parent, tagName, className, text) => {
    const node = document.createElement(tagName);
    if (className) node.className = className;
    node.textContent = text;
    parent.appendChild(node);
    return node;
  };

  const currentSpeedLabel = (speedValue) => {
    const value = String(speedValue || DEFAULT_SPEED);
    return SPEED_OPTIONS.find((option) => option.value === value)?.label || `${value}ms`;
  };

  const appendSpeedContext = (tooltip, metadata, speedValue) => {
    const speedLabel = currentSpeedLabel(speedValue);
    const attacks = attacksPerMinute(speedValue);
    appendText(tooltip, "p", "perk-math-context", `${speedLabel}: ${formatNumber(attacks)} attacks/min`);

    if (!metadata.speedChance) return;
    const chance = Number(metadata.speedChance.values?.[speedBucketIndex(speedValue)]);
    if (!Number.isFinite(chance)) return;
    const parts = [`${formatNumber(chance)}${metadata.speedChance.unit || "%"} ${metadata.speedChance.suffix}`];
    if (metadata.speedChance.proc) {
      parts.push(`${formatNumber((attacks * chance) / 100)} procs/min`);
    }
    appendText(tooltip, "p", "perk-math-context", parts.join("; "));
  };

  const buildScenarioLine = (metadata, scenario, speedValue) => {
    const effects = Array.isArray(metadata.effects) ? metadata.effects : [];
    const parts = effects.map((effect) => formatEffectValue(effect, scenario)).filter(Boolean);
    effects
      .filter((effect) => effect.proc)
      .forEach((effect) => {
        const chance = Number(effect.values?.[scenario.tierIndex]) * (effect.stack === false ? 1 : scenario.count);
        if (Number.isFinite(chance)) {
          parts.push(`${formatNumber((attacksPerMinute(speedValue) * chance) / 100)} procs/min`);
        }
      });
    return `${scenario.label}: ${parts.join(", ")}`;
  };

  const renderPerkMath = (perkName, speedValue = DEFAULT_SPEED) => {
    const metadata = normalizedCalculations.get(normalizePerkName(perkName));
    if (!metadata) return null;

    const wrapper = document.createElement("div");
    wrapper.className = "perk-math";
    wrapper.dataset.perkMath = "true";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "perk-math-trigger";
    trigger.textContent = "Stacking";
    trigger.setAttribute("aria-label", `${perkName} stacking examples`);
    wrapper.appendChild(trigger);

    const tooltip = document.createElement("div");
    tooltip.className = "perk-math-tooltip";
    tooltip.setAttribute("role", "tooltip");
    appendText(tooltip, "strong", "perk-math-title", "Stack examples");
    appendSpeedContext(tooltip, metadata, speedValue);
    STACK_SCENARIOS.forEach((scenario) => {
      const line = buildScenarioLine(metadata, scenario, speedValue);
      if (!line.endsWith(": ")) appendText(tooltip, "p", "perk-math-row", line);
    });
    if (metadata.note) appendText(tooltip, "p", "perk-math-note", metadata.note);
    wrapper.appendChild(tooltip);
    return wrapper;
  };

  window.RogueCodexPerkCalculations = {
    DEFAULT_SPEED,
    SPEED_OPTIONS,
    STACK_SCENARIOS,
    PERK_CALCULATIONS,
    attacksPerMinute,
    renderPerkMath,
  };
})();
