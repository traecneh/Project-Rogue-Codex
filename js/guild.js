const GUILD_PARTY_SEQUENCE = Object.freeze([
  {
    id: "A",
    label: "Party A",
    description: "Party A is selected as the active guild party slot.",
  },
  {
    id: "B",
    label: "Party B",
    description: "Party B is selected as the alternate guild party slot.",
  },
  {
    id: "C",
    label: "Party C",
    description: "Party C is selected as the third guild party slot.",
  },
]);

function findGuildParty(partyId) {
  return GUILD_PARTY_SEQUENCE.find((party) => party.id === partyId) || GUILD_PARTY_SEQUENCE[0];
}

function setGuildParty(partyId, root = document) {
  const preview = root.querySelector("[data-party-preview]");
  if (!preview) return;

  const party = findGuildParty(partyId);
  preview.dataset.currentParty = party.id;

  root.querySelectorAll("[data-party-option]").forEach((button) => {
    const isActive = button.dataset.partyOption === party.id;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  const currentText = root.querySelector("[data-party-current]");
  if (currentText) currentText.textContent = party.label;

  const descriptionText = root.querySelector("[data-party-description]");
  if (descriptionText) descriptionText.textContent = party.description;
}

function nextGuildPartyId(currentPartyId) {
  const currentIndex = GUILD_PARTY_SEQUENCE.findIndex((party) => party.id === currentPartyId);
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % GUILD_PARTY_SEQUENCE.length;
  return GUILD_PARTY_SEQUENCE[nextIndex].id;
}

function initGuildPartyPreview(root = document) {
  const preview = root.querySelector("[data-party-preview]");
  if (!preview) return;

  root.querySelectorAll("[data-party-option]").forEach((button) => {
    button.addEventListener("click", () => setGuildParty(button.dataset.partyOption, root));
  });

  const cycleButton = root.querySelector("[data-party-cycle]");
  if (cycleButton) {
    cycleButton.addEventListener("click", () => {
      setGuildParty(nextGuildPartyId(preview.dataset.currentParty), root);
    });
  }

  setGuildParty(preview.dataset.currentParty || "A", root);
}

document.addEventListener("DOMContentLoaded", () => {
  initGuildPartyPreview();
});
