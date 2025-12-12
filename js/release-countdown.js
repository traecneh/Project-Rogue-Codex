(() => {
  const SELECTOR = "[data-release-countdown]";
  const MS_PER_SECOND = 1000;
  const MS_PER_MINUTE = 60 * MS_PER_SECOND;
  const MS_PER_HOUR = 60 * MS_PER_MINUTE;
  const MS_PER_DAY = 24 * MS_PER_HOUR;

  function clampNonNegative(value) {
    return value < 0 ? 0 : value;
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function setText(node, value) {
    if (!node) return;
    const next = String(value);
    if (node.textContent !== next) node.textContent = next;
  }

  function updateCountdown(container, targetMs) {
    const now = Date.now();
    let remaining = clampNonNegative(targetMs - now);

    const days = Math.floor(remaining / MS_PER_DAY);
    remaining -= days * MS_PER_DAY;

    const hours = Math.floor(remaining / MS_PER_HOUR);
    remaining -= hours * MS_PER_HOUR;

    const minutes = Math.floor(remaining / MS_PER_MINUTE);
    remaining -= minutes * MS_PER_MINUTE;

    const seconds = Math.floor(remaining / MS_PER_SECOND);

    setText(container.querySelector("[data-countdown-days]"), days);
    setText(container.querySelector("[data-countdown-hours]"), pad2(hours));
    setText(container.querySelector("[data-countdown-minutes]"), pad2(minutes));
    setText(container.querySelector("[data-countdown-seconds]"), pad2(seconds));

    container.classList.toggle("is-complete", targetMs - now <= 0);
  }

  function startCountdown(container) {
    const targetValue = container.getAttribute("data-target-utc") || "";
    const targetMs = Date.parse(targetValue);
    if (!Number.isFinite(targetMs)) return;

    updateCountdown(container, targetMs);

    const tick = () => updateCountdown(container, targetMs);
    const schedule = () => {
      const now = Date.now();
      const delay = MS_PER_SECOND - (now % MS_PER_SECOND) + 10;
      return window.setTimeout(() => {
        tick();
        intervalId = window.setInterval(tick, MS_PER_SECOND);
      }, delay);
    };

    let intervalId = null;
    const timeoutId = schedule();

    const stop = () => {
      if (intervalId) window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };

    window.addEventListener("beforeunload", stop, { once: true });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const container = document.querySelector(SELECTOR);
    if (!container) return;
    startCountdown(container);
  });
})();

