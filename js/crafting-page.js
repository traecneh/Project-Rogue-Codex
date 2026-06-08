const ARMOR_SETS = {
  frost: {
    label: "Frost",
    slots: {
      helm: { src: "images/armors/Frost%20Helmet.png", alt: "Frost Helm" },
      gauntlets: { src: "images/armors/Frost%20Gauntlets.png", alt: "Frost Gauntlets" },
      legs: { src: "images/armors/Frost%20Leggings.png", alt: "Frost Legs" },
      shield: { src: "images/armors/Frost%20Shield.png", alt: "Frost Shield" },
      plate: { src: "images/armors/Frost%20Platemail.png", alt: "Frost Plate" },
    },
  },
  dragon: {
    label: "Dragon",
    slots: {
      helm: { src: "images/armors/Dragon%20Scale%20Helmet.gif", alt: "Dragon Scale Helm" },
      gauntlets: { src: "images/armors/Dragon%20Scale%20Gauntlets.png", alt: "Dragon Scale Gauntlets" },
      legs: { src: "images/armors/Dragon%20Scale%20Leggings.png", alt: "Dragon Scale Legs" },
      shield: { src: "images/armors/Dragon%20Scale%20Shield.png", alt: "Dragon Scale Shield" },
      plate: { src: "images/armors/Dragon%20Scale%20Platemail.png", alt: "Dragon Scale Plate" },
    },
  },
  black: {
    label: "Black Dragon",
    slots: {
      helm: { src: "images/armors/Black%20Dragon%20Helmet.gif", alt: "Black Dragon Helm" },
      gauntlets: { src: "images/armors/Black%20Dragon%20Gauntlets.png", alt: "Black Dragon Gauntlets" },
      legs: { src: "images/armors/Black%20Dragon%20Leggings.png", alt: "Black Dragon Legs" },
      shield: { src: "images/armors/Black%20Dragon%20Shield.png", alt: "Black Dragon Shield" },
      plate: { src: "images/armors/Black%20Dragon%20Armor.png", alt: "Black Dragon Plate" },
    },
  },
  blue: {
    label: "Blue Dragon",
    slots: {
      helm: { src: "images/armors/Blue%20Dragon%20Scale%20Helm.png", alt: "Blue Dragon Scale Helm" },
      gauntlets: { src: "images/armors/Blue%20Dragon%20Scale%20Gloves.png", alt: "Blue Dragon Scale Gloves" },
      legs: { src: "images/armors/Blue%20Dragon%20Scale%20Boots.png", alt: "Blue Dragon Scale Boots" },
      shield: { src: "images/armors/Blue%20Dragon%20Scale%20Shield.png", alt: "Blue Dragon Scale Shield" },
      plate: { src: "images/armors/Blue%20Dragon%20Scale%20Plate.png", alt: "Blue Dragon Scale Plate" },
    },
  },
  red: {
    label: "Red Dragon",
    slots: {
      helm: { src: "images/armors/Red%20Dragon%20Scale%20Helm.png", alt: "Red Dragon Scale Helm" },
      gauntlets: { src: "images/armors/Red%20Dragon%20Scale%20Gloves.png", alt: "Red Dragon Scale Gloves" },
      legs: { src: "images/armors/Red%20Dragon%20Scale%20Boots.png", alt: "Red Dragon Scale Boots" },
      shield: { src: "images/armors/Red%20Dragon%20Scale%20Shield.png", alt: "Red Dragon Scale Shield" },
      plate: { src: "images/armors/Red%20Dragon%20Scale%20Plate.gif", alt: "Red Dragon Scale Plate" },
    },
  },
};

document.addEventListener("DOMContentLoaded", () => {
  initSetPreview();
  initMaterialsCalculator();
});

function initSetPreview() {
  const buttons = Array.from(document.querySelectorAll("[data-set-option]"));
  const previews = Array.from(document.querySelectorAll("[data-slot-preview]"));
  const labels = Array.from(document.querySelectorAll("[data-slot-label]"));

  if (!buttons.length || !previews.length) return;

  const applySet = (setKey) => {
    const armorSet = ARMOR_SETS[setKey] || ARMOR_SETS.frost;
    buttons.forEach((button) => {
      button.dataset.active = button.dataset.setOption === setKey ? "true" : "false";
    });
    previews.forEach((img) => {
      const slot = img.dataset.slot;
      const asset = armorSet.slots[slot];
      if (!asset) return;
      img.src = asset.src;
      img.alt = asset.alt;
    });
    labels.forEach((label) => {
      const slot = label.dataset.slotLabel;
      const asset = armorSet.slots[slot];
      if (asset) label.textContent = asset.alt.replace(`${armorSet.label} `, "");
    });
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => applySet(button.dataset.setOption || "frost"));
  });

  applySet(buttons.find((button) => button.dataset.active === "true")?.dataset.setOption || "frost");
}

function initMaterialsCalculator() {
  const slider = document.querySelector("[data-materials-range]");
  const valueLabel = document.querySelector("[data-materials-value]");
  const chips = Array.from(document.querySelectorAll("[data-material-options] .calc-chip"));
  const summary = document.querySelector("[data-material-summary]");

  if (!slider || !valueLabel || !chips.length || !summary) return;

  const slotLabels = {
    helm: { singular: "Helm", plural: "Helms" },
    gauntlets: { singular: "Gauntlets", plural: "Gauntlets" },
    legs: { singular: "Legs", plural: "Legs" },
    shield: { singular: "Shield", plural: "Shields" },
    plate: { singular: "Plate", plural: "Plates" },
  };

  const state = {
    currentMats: Number(slider.value),
    slotCounts: chips.reduce((acc, chip) => {
      acc[chip.dataset.slot] = 0;
      return acc;
    }, {}),
  };

  const formatNumber = (num) => num.toLocaleString();
  const pluralize = (count, singular, plural) => (count === 1 ? singular : plural || `${singular}s`);

  const describeSelection = () => {
    const items = Object.entries(state.slotCounts)
      .filter(([, count]) => count > 0)
      .map(([slot, count]) => {
        const labels = slotLabels[slot] || { singular: slot, plural: `${slot}s` };
        return `${count} ${pluralize(count, labels.singular, labels.plural)}`;
      });

    if (!items.length) return "";
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    const last = items.pop();
    return `${items.join(", ")}, and ${last}`;
  };

  const updateSummary = () => {
    const selectedChips = chips.filter((chip) => state.slotCounts[chip.dataset.slot] > 0);
    const totalCost = selectedChips.reduce(
      (sum, chip) => sum + Number(chip.dataset.cost) * state.slotCounts[chip.dataset.slot],
      0
    );

    if (!selectedChips.length) {
      summary.textContent = "Select at least one slot to see totals.";
      return;
    }

    const selectionLabel = describeSelection();
    const diff = state.currentMats - totalCost;
    const materialLabel = pluralize(Math.abs(diff), "material");

    if (diff >= 0) {
      summary.textContent = `You have enough materials to craft ${selectionLabel}. ${formatNumber(diff)} ${materialLabel} remain.`;
    } else {
      summary.textContent = `Need ${formatNumber(Math.abs(diff))} more ${materialLabel} to craft ${selectionLabel}.`;
    }
  };

  const setChipActive = (chip, isActive) => {
    chip.dataset.active = isActive ? "true" : "false";
  };

  const updateChipCount = (chip) => {
    const countEl = chip.querySelector("[data-qty-count]");
    if (countEl) countEl.textContent = state.slotCounts[chip.dataset.slot];
  };

  const adjustSlotCount = (slot, newValue) => {
    const chip = chips.find((candidate) => candidate.dataset.slot === slot);
    if (!chip) return;

    state.slotCounts[slot] = Math.max(0, newValue);
    setChipActive(chip, state.slotCounts[slot] > 0);
    updateChipCount(chip);
    updateSummary();
  };

  const toggleChip = (chip) => {
    const slot = chip.dataset.slot;
    adjustSlotCount(slot, state.slotCounts[slot] > 0 ? 0 : 1);
  };

  slider.addEventListener("input", () => {
    state.currentMats = Number(slider.value);
    valueLabel.textContent = formatNumber(state.currentMats);
    updateSummary();
  });

  chips.forEach((chip) => {
    chip.dataset.active = "false";
    chip.addEventListener("click", (event) => {
      if (event.target.closest(".calc-qty-control")) return;
      toggleChip(chip);
    });
    chip.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleChip(chip);
      }
    });

    const slot = chip.dataset.slot;
    const minusBtn = chip.querySelector("[data-qty-minus]");
    const plusBtn = chip.querySelector("[data-qty-plus]");

    if (minusBtn) {
      minusBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        adjustSlotCount(slot, state.slotCounts[slot] - 1);
      });
    }

    if (plusBtn) {
      plusBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        adjustSlotCount(slot, state.slotCounts[slot] + 1);
      });
    }
  });

  valueLabel.textContent = formatNumber(state.currentMats);
  updateSummary();
}
