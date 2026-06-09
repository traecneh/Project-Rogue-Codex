(function () {
  const RACE_BONUSES = Object.freeze({
    human: {
      name: "Human",
      attributeLabel: "Strength / Constitution",
      attributeBonus: 5,
      skillLabel: "Large Blades / Small Blades",
      skillBonus: 5,
    },
    tundrian: {
      name: "Tundrian",
      attributeLabel: "Strength",
      attributeBonus: 10,
      skillLabel: "Axes",
      skillBonus: 5,
    },
    brimlock: {
      name: "Brimlock",
      attributeLabel: "Constitution",
      attributeBonus: 5,
      skillLabel: "Blunts",
      skillBonus: 10,
    },
    komodan: {
      name: "Komodan",
      attributeLabel: "Constitution",
      attributeBonus: 5,
      skillLabel: "Polearms",
      skillBonus: 10,
    },
    elf: {
      name: "Elf",
      attributeLabel: "Dexterity",
      attributeBonus: 10,
      skillLabel: "Polearms",
      skillBonus: 5,
    },
    orc: {
      name: "Orc",
      attributeLabel: "Constitution",
      attributeBonus: 10,
      skillLabel: "Blunts",
      skillBonus: 5,
    },
    gnoll: {
      name: "Gnoll",
      attributeLabel: "Constitution",
      attributeBonus: 5,
      skillLabel: "Large Blades",
      skillBonus: 5,
    },
    "dark-elf": {
      name: "Dark Elf",
      attributeLabel: "Dexterity",
      attributeBonus: 5,
      skillLabel: "Small Blades",
      skillBonus: 5,
    },
  });

  function getSelectedRaceKey(root = document) {
    const selected = root.querySelector("[data-race-option][aria-pressed='true']");
    return selected?.dataset.raceOption || "human";
  }

  function getRaceData(root = document) {
    const key = getSelectedRaceKey(root);
    return RACE_BONUSES[key] || RACE_BONUSES.human;
  }

  function setText(root, selector, value) {
    const element = root.querySelector(selector);
    if (element) element.textContent = value;
  }

  function renderRaceSummary(root = document, race = getRaceData(root)) {
    setText(root, "[data-race-selected-name]", race.name);
    setText(
      root,
      "[data-race-bonus-summary]",
      `+${race.attributeBonus} ${race.attributeLabel}, +${race.skillBonus} ${race.skillLabel}`
    );
    setText(root, "[data-race-stat-label]", race.attributeLabel);
    setText(root, "[data-race-skill-label]", race.skillLabel);
  }

  function readSliderValue(root, selector) {
    const slider = root.querySelector(selector);
    return Number(slider?.value) || 0;
  }

  function updateRacePreview(root = document) {
    const race = getRaceData(root);
    const base = readSliderValue(root, "[data-race-base-slider]");
    const requirement = readSliderValue(root, "[data-race-requirement-slider]");
    const effectiveStat = base + race.attributeBonus;
    const effectiveSkill = base + race.skillBonus;

    renderRaceSummary(root, race);
    setText(root, "[data-race-base]", String(base));
    setText(root, "[data-race-requirement]", String(requirement));
    setText(root, "[data-race-effective-stat]", String(effectiveStat));
    setText(root, "[data-race-effective-skill]", String(effectiveSkill));

    if (base >= requirement) {
      setText(root, "[data-race-requirement-status]", "Meets requirement");
      setText(root, "[data-race-rule-note]", "Base value satisfies the equipment check.");
    } else if (effectiveStat >= requirement || effectiveSkill >= requirement) {
      setText(root, "[data-race-requirement-status]", "Requirement unmet");
      setText(root, "[data-race-rule-note]", "Race bonus is visible, but base value is still short.");
    } else {
      setText(root, "[data-race-requirement-status]", "Requirement unmet");
      setText(root, "[data-race-rule-note]", "Train the base value to meet the equipment check.");
    }
  }

  function setSelectedRace(root, raceKey) {
    root.querySelectorAll("[data-race-option]").forEach((button) => {
      button.setAttribute("aria-pressed", button.dataset.raceOption === raceKey ? "true" : "false");
    });
    root.querySelectorAll("[data-race-card]").forEach((card) => {
      card.classList.toggle("is-selected", card.dataset.raceCard === raceKey);
    });
  }

  function initRacePreviewWidget(root = document) {
    const widget = root.querySelector(".races-preview-widget");
    if (!widget) return;

    root.querySelectorAll("[data-race-option]").forEach((button) => {
      button.addEventListener("click", () => {
        setSelectedRace(root, button.dataset.raceOption);
        updateRacePreview(root);
        widget.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    });

    root.querySelectorAll("[data-race-base-slider], [data-race-requirement-slider]").forEach((slider) => {
      slider.addEventListener("input", () => updateRacePreview(root));
    });

    setSelectedRace(root, getSelectedRaceKey(root));
    updateRacePreview(root);
  }

  document.addEventListener("DOMContentLoaded", () => {
    initRacePreviewWidget();
  });
})();
