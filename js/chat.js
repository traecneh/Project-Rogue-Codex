const CHAT_MODE_REFERENCE = Object.freeze({
  Say: {
    label: "Say",
    audience: "Audience: players within your visible area.",
    restriction: "Restriction: posts to Local.",
  },
  Whisper: {
    label: "Whisper",
    audience: "Audience: players on your tile or the 8 surrounding tiles.",
    restriction: "Restriction: posts to Local.",
  },
  Global: {
    label: "Global",
    audience: "Audience: server-wide messages sent from safe zones.",
    restriction: "Restriction: Safe Zone Only.",
  },
  Guild: {
    label: "Guild",
    audience: "Audience: members of your guild.",
    restriction: "Restriction: posts to Guild.",
  },
});

function getChatMode(modeId) {
  return CHAT_MODE_REFERENCE[modeId] || CHAT_MODE_REFERENCE.Say;
}

function setChatMode(modeId, root = document) {
  const preview = root.querySelector("[data-chat-preview]");
  if (!preview) return;

  const mode = getChatMode(modeId);
  preview.dataset.currentChatMode = mode.label;

  root.querySelectorAll("[data-chat-mode]").forEach((button) => {
    const isActive = button.dataset.chatMode === mode.label;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  const currentText = root.querySelector("[data-chat-mode-current]");
  if (currentText) currentText.textContent = mode.label;

  const audienceText = root.querySelector("[data-chat-mode-audience]");
  if (audienceText) audienceText.textContent = mode.audience;

  const restrictionText = root.querySelector("[data-chat-mode-restriction]");
  if (restrictionText) restrictionText.textContent = mode.restriction;
}

function initChatModePreview(root = document) {
  const preview = root.querySelector("[data-chat-preview]");
  if (!preview) return;

  root.querySelectorAll("[data-chat-mode]").forEach((button) => {
    button.addEventListener("click", () => setChatMode(button.dataset.chatMode, root));
  });

  setChatMode(preview.dataset.currentChatMode || "Say", root);
}

document.addEventListener("DOMContentLoaded", () => {
  initChatModePreview();
});
