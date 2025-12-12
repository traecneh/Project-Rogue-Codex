function initializeCursorToggle() {
  const body = document.body;
  if (!body || body.dataset.cursorToggleInit === "true") return;

  body.dataset.cursorToggleInit = "true";

  window.addEventListener("keydown", (event) => {
    const key = event.key || event.keyCode;
    if (!key) return;
    const isQ = typeof key === "string" ? key.toLowerCase() === "q" : key === 81;
    if (!isQ) return;
    body.classList.toggle("cursor-attack");
  });
}

