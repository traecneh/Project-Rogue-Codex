// Collapsible navigation panels
document.addEventListener("DOMContentLoaded", () => {
  const NAV_STATE_STORAGE_KEY = "nav-expanded-state";

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

  // Smooth scrolling for internal links
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetId = link.getAttribute("href").slice(1);
      const target = document.getElementById(targetId);
      if (!target) return;

      event.preventDefault();
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  });
});
