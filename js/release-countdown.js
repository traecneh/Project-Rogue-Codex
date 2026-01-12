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

  function parseDateMs(value) {
    const ms = Date.parse(value || "");
    return Number.isFinite(ms) ? ms : null;
  }

  function setText(node, value) {
    if (!node) return;
    const next = String(value);
    if (node.textContent !== next) node.textContent = next;
  }

  function setTextAll(root, selector, value) {
    root.querySelectorAll(selector).forEach((node) => setText(node, value));
  }

  function prefersReducedMotion() {
    if (!("matchMedia" in window)) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function getFlipValueNode(digit, selector) {
    const node = digit.querySelector(selector);
    if (!node) return null;
    const valueNode = node.querySelector(".flip-digit-value");
    return valueNode || node;
  }

  function createFlipHalf(className, value) {
    const half = document.createElement("div");
    half.className = className;

    const valueNode = document.createElement("span");
    valueNode.className = "flip-digit-value";
    valueNode.textContent = value;

    half.appendChild(valueNode);
    return half;
  }

  function setFlipDigit(digit, nextValue, { animate, reducedMotion }) {
    if (!digit) return;

    const top = getFlipValueNode(digit, ".flip-digit-top");
    const bottom = getFlipValueNode(digit, ".flip-digit-bottom");
    if (!top || !bottom) return;

    const currentValue = digit.getAttribute("data-flip-value") || top.textContent || "0";
    if (currentValue === nextValue) return;

    digit.setAttribute("data-flip-value", nextValue);

    digit.querySelectorAll(".flip-digit-top-flip, .flip-digit-bottom-flip").forEach((node) => node.remove());

    if (!animate || reducedMotion) {
      top.textContent = nextValue;
      bottom.textContent = nextValue;
      return;
    }

    top.textContent = nextValue;
    bottom.textContent = currentValue;

    const topFlip = createFlipHalf("flip-digit-top-flip", currentValue);
    digit.appendChild(topFlip);

    topFlip.addEventListener(
      "animationend",
      () => {
        topFlip.remove();

        const bottomFlip = createFlipHalf("flip-digit-bottom-flip", nextValue);
        digit.appendChild(bottomFlip);

        bottomFlip.addEventListener(
          "animationend",
          () => {
            bottom.textContent = nextValue;
            bottomFlip.remove();
          },
          { once: true },
        );
      },
      { once: true },
    );
  }

  function updateCountdown(container, targetMs, { animate, reducedMotion }) {
    const now = Date.now();
    const isLive = now >= targetMs;
    let remaining = clampNonNegative(isLive ? now - targetMs : targetMs - now);

    const days = Math.floor(remaining / MS_PER_DAY);
    remaining -= days * MS_PER_DAY;

    const hours = Math.floor(remaining / MS_PER_HOUR);
    remaining -= hours * MS_PER_HOUR;

    const minutes = Math.floor(remaining / MS_PER_MINUTE);
    remaining -= minutes * MS_PER_MINUTE;

    const seconds = Math.floor(remaining / MS_PER_SECOND);

    const hoursStr = pad2(hours);
    const minutesStr = pad2(minutes);
    const secondsStr = pad2(seconds);

    setTextAll(container, "[data-countdown-days]", days);
    setTextAll(container, "[data-countdown-hours]", hoursStr);
    setTextAll(container, "[data-countdown-minutes]", minutesStr);
    setTextAll(container, "[data-countdown-seconds]", secondsStr);

    setFlipDigit(container.querySelector('[data-flip-digit="days"]'), String(days), { animate, reducedMotion });
    setFlipDigit(container.querySelector('[data-flip-digit="hours-tens"]'), hoursStr[0], { animate, reducedMotion });
    setFlipDigit(container.querySelector('[data-flip-digit="hours-ones"]'), hoursStr[1], { animate, reducedMotion });
    setFlipDigit(container.querySelector('[data-flip-digit="minutes-tens"]'), minutesStr[0], { animate, reducedMotion });
    setFlipDigit(container.querySelector('[data-flip-digit="minutes-ones"]'), minutesStr[1], { animate, reducedMotion });
    setFlipDigit(container.querySelector('[data-flip-digit="seconds-tens"]'), secondsStr[0], { animate, reducedMotion });
    setFlipDigit(container.querySelector('[data-flip-digit="seconds-ones"]'), secondsStr[1], { animate, reducedMotion });

    container.classList.toggle("is-complete", isLive);
    container.classList.toggle("is-live", isLive);
  }

  function getCopyValue(container, attr, fallback) {
    const value = container.getAttribute(attr);
    return value !== null && value !== undefined && value !== "" ? value : fallback;
  }

  function buildLiveCopy(container) {
    const kicker = container.querySelector("[data-countdown-kicker]") || container.querySelector(".countdown-kicker");
    const subtitle =
      container.querySelector("[data-countdown-subtitle]") || container.querySelector(".countdown-subtitle");
    const prefix = container.querySelector("[data-countdown-prefix]");
    const flip = container.querySelector(".countdown-flip");

    return {
      kicker,
      subtitle,
      prefix,
      flip,
      liveKicker: getCopyValue(container, "data-live-kicker", ""),
      liveSubtitle: getCopyValue(container, "data-live-subtitle", ""),
      livePrefix: getCopyValue(container, "data-live-prefix", "Live for:"),
      liveAriaLabel: getCopyValue(container, "data-live-aria-label", "Time since release"),
      isLive: null,
    };
  }

  function applyLiveCopy(copy) {
    if (copy.kicker && copy.liveKicker) setText(copy.kicker, copy.liveKicker);
    if (copy.subtitle && copy.liveSubtitle) setText(copy.subtitle, copy.liveSubtitle);
    if (copy.prefix && copy.livePrefix) setText(copy.prefix, copy.livePrefix);
    if (copy.flip && copy.liveAriaLabel) copy.flip.setAttribute("aria-label", copy.liveAriaLabel);
  }

  function startCountdown(container) {
    const targetValue = container.getAttribute("data-target-utc") || "";
    const targetMs = parseDateMs(targetValue);
    if (!Number.isFinite(targetMs)) return;

    const reducedMotion = prefersReducedMotion();
    const copy = buildLiveCopy(container);

    updateCountdown(container, targetMs, { animate: false, reducedMotion });
    if (Date.now() >= targetMs && copy.isLive !== true) {
      copy.isLive = true;
      applyLiveCopy(copy);
    }

    const tick = () => {
      const isLive = Date.now() >= targetMs;
      updateCountdown(container, targetMs, { animate: true, reducedMotion });
      if (copy.isLive !== isLive) {
        copy.isLive = isLive;
        if (isLive) applyLiveCopy(copy);
      }
    };
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
    document.querySelectorAll(SELECTOR).forEach((container) => startCountdown(container));
  });
})();
