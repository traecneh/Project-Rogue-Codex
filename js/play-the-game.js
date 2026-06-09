(function () {
  const MONSTER_MANIFEST_URL = "images/monsters/manifest.json";
  const FALLBACK_MONSTERS = Object.freeze([
    "images/monsters/Bee.gif",
    "images/monsters/Bat.gif",
    "images/monsters/Imp.gif",
    "images/monsters/Skeleton.gif",
    "images/monsters/Wolf.gif",
  ]);

  function pickRandomEntry(entries, exclude) {
    if (!entries.length) return null;
    if (entries.length === 1) return entries[0];
    let candidate = entries[Math.floor(Math.random() * entries.length)];
    if (candidate === exclude) {
      candidate = entries[(entries.indexOf(candidate) + 1) % entries.length];
    }
    return candidate;
  }

  function initPlayMonsterEscort(root = document) {
    const wrap = root.querySelector("[data-play-escort-wrap]");
    const cta = root.querySelector("[data-discord-cta]");
    const sprite = root.querySelector("[data-play-monster]");
    const eliteBadge = root.querySelector("[data-play-elite]");
    if (!wrap || !cta || !sprite || !eliteBadge) return;

    const prefersReducedMotion =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const step = 32;
    const quantize = (value) => Math.max(step, Math.round(value / step) * step);
    let monsters = FALLBACK_MONSTERS.slice();
    let currentSrc = null;
    let index = 0;
    let lastWidth = window.innerWidth;

    const clampPathSize = (desired, available) => {
      const max = Math.max(step, Math.floor(Math.max(step, available) / step) * step);
      return Math.min(desired, max);
    };

    const buildPath = () => {
      const halfWidth = clampPathSize(quantize(cta.offsetWidth / 2 + step * 2), (wrap.clientWidth - step) / 2);
      const halfHeight = clampPathSize(quantize(cta.offsetHeight / 2 + step), (wrap.clientHeight - step) / 2);
      const path = [];

      for (let x = -halfWidth; x <= halfWidth; x += step) path.push([x, -halfHeight]);
      for (let y = -halfHeight + step; y <= halfHeight; y += step) path.push([halfWidth, y]);
      for (let x = halfWidth - step; x >= -halfWidth; x -= step) path.push([x, halfHeight]);
      for (let y = halfHeight - step; y > -halfHeight; y -= step) path.push([-halfWidth, y]);

      return path;
    };

    let pathOffsets = buildPath();

    const applyPosition = (dx, dy) => {
      const transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;
      sprite.style.transform = transform;
      eliteBadge.style.transform = transform;
    };

    const setSprite = (src) => {
      if (!src) return;
      currentSrc = src;
      sprite.src = src;
    };

    const stepMove = () => {
      if (!pathOffsets.length) {
        pathOffsets = buildPath();
        index = 0;
      }
      const [dx, dy] = pathOffsets[index];
      applyPosition(dx, dy);
      index = (index + 1) % pathOffsets.length;
    };

    const swapMonster = () => {
      const next = pickRandomEntry(monsters, currentSrc);
      if (!next) return;
      sprite.style.opacity = 0;
      window.setTimeout(() => setSprite(next), 200);
    };

    const setEliteState = () => {
      const roll = Math.random();
      let badge = null;
      if (roll <= 0.05) {
        badge = "elite+.gif";
      } else if (roll <= 0.2) {
        badge = "elite.gif";
      }

      if (badge) {
        eliteBadge.hidden = false;
        eliteBadge.src = `images/${badge}`;
        eliteBadge.style.opacity = 1;
      } else {
        eliteBadge.style.opacity = 0;
      }
    };

    sprite.addEventListener("load", () => {
      sprite.hidden = false;
      sprite.style.opacity = 1;
    });

    fetch(MONSTER_MANIFEST_URL)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("manifest unavailable"))))
      .then((entries) => {
        monsters = Array.isArray(entries) && entries.length ? entries : FALLBACK_MONSTERS.slice();
      })
      .catch(() => {
        monsters = FALLBACK_MONSTERS.slice();
      })
      .finally(() => setSprite(pickRandomEntry(monsters)));

    if (prefersReducedMotion) {
      applyPosition(0, 0);
      eliteBadge.style.opacity = 0;
      return;
    }

    stepMove();
    window.setInterval(stepMove, 300);
    window.setInterval(swapMonster, 5000);
    window.setInterval(setEliteState, 5000);
    setEliteState();

    window.addEventListener("resize", () => {
      const currentWidth = window.innerWidth;
      if (Math.abs(currentWidth - lastWidth) < 1) return;
      lastWidth = currentWidth;
      pathOffsets = buildPath();
      index = 0;
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initPlayMonsterEscort();
  });
})();
