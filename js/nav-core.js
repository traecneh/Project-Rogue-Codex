function setRandomLogo() {
  const logo = document.querySelector(".site-logo-image");
  if (!logo) return;
  const logos = ["images/logo-1.png", "images/logo-2.png"];
  const pick = Math.random() < 0.5 ? logos[0] : logos[1];
  logo.src = pick;
}

function initializeActiveNavLink() {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;

  const links = Array.from(sidebar.querySelectorAll("a.nav-link[href]"));
  if (!links.length) return;

  const normalizePath = (pathname) => {
    let normalized = String(pathname || "").toLowerCase().replace(/\\/g, "/");
    normalized = normalized.replace(/\/index\.html$/, "/");
    if (normalized.endsWith("/")) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  };

  const currentPath = normalizePath(window.location.pathname);
  let activeLink = null;

  links.forEach((link) => {
    const resolvedHref = link.href || "";
    if (!resolvedHref) return;
    let url;
    try {
      url = new URL(resolvedHref);
    } catch (error) {
      return;
    }
    if (url.origin !== window.location.origin) return;
    const linkPath = normalizePath(url.pathname);
    if (linkPath === currentPath) {
      activeLink = link;
    }
  });

  if (!activeLink) return;
  links.forEach((link) => {
    link.classList.remove("active");
    link.removeAttribute("aria-current");
  });
  activeLink.classList.add("active");
  activeLink.setAttribute("aria-current", "page");
}

function getPreferredScrollBehavior() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  } catch (error) {
    return "smooth";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const sidebarRoot = document.getElementById("sidebar-root");
  const navPromise = fetch("nav.html")
    .then((response) => {
      if (!response.ok) throw new Error("Failed to load navigation");
      return response.text();
    })
    .then((html) => {
      if (sidebarRoot) {
        sidebarRoot.outerHTML = html;
        setRandomLogo();
        initializeSidebar();
        initializeSiteSearch();
        initializeActiveNavLink();
      }
    })
    .catch((error) => console.error(error));

  navPromise.finally(() => {
    initializeWeightSlider();
    initializeMultiplierWidget();
    initializeHealthWidget();
    initializeRegenWidget();
    initializeBleedWidget();
    initializeDexCritWidget();
    initializeDexDrWidget();
    initializeWeaponSpecialtyReferences();
    initializeKeywordLinks();
    initializePerkAnchors();
    initializePerkEmbeds();
    initializeCursorToggle();
    initializeRarityRoller();
  });
});

function initializeSidebar() {
  const NAV_STATE_STORAGE_KEY = "nav-expanded-state";
  const NAV_COLLAPSED_STORAGE_KEY = "nav-collapsed-state";

  const sidebarRoot = document.querySelector(".sidebar");
  const collapseToggle = document.querySelector("[data-collapse-toggle]");
  const layoutRoot = document.querySelector(".layout");

  const loadNavState = () => {
    try {
      const raw = localStorage.getItem(NAV_STATE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  };

  const saveNavState = (state) => {
    try {
      localStorage.setItem(NAV_STATE_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      /* noop: storage may be unavailable */
    }
  };

  const loadCollapsedState = () => {
    try {
      return localStorage.getItem(NAV_COLLAPSED_STORAGE_KEY) === "true";
    } catch (error) {
      return false;
    }
  };

  const saveCollapsedState = (value) => {
    try {
      localStorage.setItem(NAV_COLLAPSED_STORAGE_KEY, String(Boolean(value)));
    } catch (error) {
      /* noop: storage may be unavailable */
    }
  };

  const applyCollapsedState = (collapsed) => {
    if (sidebarRoot) {
      sidebarRoot.classList.toggle("collapsed", collapsed);
    }
    if (layoutRoot) {
      layoutRoot.classList.toggle("nav-collapsed", collapsed);
    }
    if (collapseToggle) {
      collapseToggle.textContent = collapsed ? "\u00BB" : "\u00AB";
      collapseToggle.setAttribute("aria-label", collapsed ? "Expand navigation" : "Collapse navigation");
      collapseToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
      collapseToggle.setAttribute("aria-pressed", collapsed ? "true" : "false");
    }
  };

  applyCollapsedState(loadCollapsedState());

  if (collapseToggle) {
    collapseToggle.addEventListener("click", () => {
      const nextCollapsed = sidebarRoot ? !sidebarRoot.classList.contains("collapsed") : false;
      applyCollapsedState(nextCollapsed);
      saveCollapsedState(nextCollapsed);
    });
  }

  const sections = document.querySelectorAll("[data-section]");
  const navState = loadNavState();

  const updateIcon = (headerBtn, expanded) => {
    const icon = headerBtn.querySelector(".nav-header-icon");
    if (!icon) return;
    icon.textContent = expanded ? "-" : "+";
  };

  sections.forEach((section) => {
    const headerBtn = section.querySelector(".nav-header");
    if (!headerBtn) return;

    const controlId = headerBtn.getAttribute("aria-controls") || section.id || "";
    const defaultExpanded = headerBtn.getAttribute("aria-expanded") === "true";
    const savedExpanded =
      controlId && Object.prototype.hasOwnProperty.call(navState, controlId) ? navState[controlId] : undefined;
    const initiallyExpanded = typeof savedExpanded === "boolean" ? savedExpanded : defaultExpanded;

    headerBtn.setAttribute("aria-expanded", String(initiallyExpanded));
    section.classList.toggle("collapsed", !initiallyExpanded);
    updateIcon(headerBtn, initiallyExpanded);

    headerBtn.addEventListener("click", () => {
      const isExpanded = headerBtn.getAttribute("aria-expanded") === "true";
      const nextExpanded = !isExpanded;
      headerBtn.setAttribute("aria-expanded", String(nextExpanded));
      section.classList.toggle("collapsed", !nextExpanded);
      updateIcon(headerBtn, nextExpanded);

      if (controlId) {
        navState[controlId] = nextExpanded;
        saveNavState(navState);
      }
    });
  });

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetId = link.getAttribute("href").slice(1);
      const target = document.getElementById(targetId);
      if (!target) return;

      event.preventDefault();
      const behavior = getPreferredScrollBehavior();
      target.scrollIntoView({
        behavior,
        block: "start",
      });
    });
  });
}
