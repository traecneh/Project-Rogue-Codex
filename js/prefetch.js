(() => {
  const pending = [];
  const seen = new Set();
  const limit = 4;
  let active = false;
  let intentTimer = null;
  let intendedLink = null;

  const allowed = () => {
    const connection = navigator.connection;
    return document.visibilityState !== "hidden" && !connection?.saveData && !/2g/.test(connection?.effectiveType || "");
  };
  const next = () => {
    if (active || !pending.length || !allowed()) return;
    if (document.readyState !== "complete") {
      window.addEventListener("load", next, {once:true});
      return;
    }
    if (document.querySelector("#items-body, #monsters-body") && document.documentElement.dataset.catalogReady !== "true") {
      document.addEventListener("codex:catalog-ready",next,{once:true});
      return;
    }
    const href = pending.shift();
    active = true;
    window.RogueCodexUtils.prefetchPage(href).finally(() => { active = false; next(); });
  };
  const enqueue = link => {
    if (!allowed() || !link?.isConnected || link.hasAttribute("download")) return;
    let url;
    try { url = new URL(link.href,document.baseURI); } catch { return; }
    if (url.origin !== location.origin || url.pathname === location.pathname || !/\.html$/i.test(url.pathname)) return;
    url.hash = "";
    const key = url.toString();
    if (seen.has(key) || seen.size >= limit) return;
    seen.add(key);
    pending.push(key);
    next();
  };
  const getLink = target => target instanceof Element ? target.closest("a.nav-link[href], a.nav-search-result[href], main a[href]") : null;
  document.addEventListener("pointerover", event => {
    if (event.pointerType === "touch") return;
    const link = getLink(event.target);
    if (!link || link.contains(event.relatedTarget)) return;
    clearTimeout(intentTimer);
    intendedLink = link;
    intentTimer = setTimeout(() => enqueue(link),150);
  });
  document.addEventListener("pointerout", event => {
    if (intendedLink && intendedLink.contains(event.target) && !intendedLink.contains(event.relatedTarget)) {
      clearTimeout(intentTimer);
      intendedLink = null;
    }
  });
  document.addEventListener("focusin", event => enqueue(getLink(event.target)));
  document.addEventListener("visibilitychange", next);
})();
