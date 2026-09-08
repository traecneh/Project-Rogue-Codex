(() => {
  const main = document.querySelector('.character-page .main-content');
  if (!main) return;

  const tooltip = document.createElement('div');
  tooltip.id = 'character-tooltip';
  tooltip.className = 'character-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  document.body.appendChild(tooltip);
  let active = null;
  let anchorRect = null;
  let timer = null;
  let generation = 0;
  const hide = () => {
    clearTimeout(timer);
    generation += 1;
    active?.removeAttribute('aria-describedby');
    active = null;
    anchorRect = null;
    tooltip.hidden = true;
  };
  const show = (button, read) => {
    hide();
    active = button;
    tooltip.textContent = read();
    tooltip.hidden = false;
    button.setAttribute('aria-describedby', tooltip.id);
    const rect = button.getBoundingClientRect();
    anchorRect = rect;
    const size = tooltip.getBoundingClientRect();
    const top = rect.bottom + size.height + 16 <= innerHeight ? rect.bottom + 8 : rect.top - size.height - 8;
    tooltip.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - size.width - 12))}px`;
    tooltip.style.top = `${Math.max(12, Math.min(top, innerHeight - size.height - 12))}px`;
  };
  const bind = (button, read) => {
    button.addEventListener('mouseenter', () => show(button, read));
    button.addEventListener('mouseleave', () => {
      if (document.activeElement !== button) timer = setTimeout(hide, 150);
    });
    button.addEventListener('focus', () => {
      const pending = generation;
      requestAnimationFrame(() => {
        if (pending === generation && document.activeElement === button) show(button, read);
      });
    });
    button.addEventListener('blur', () => { if (active === button) hide(); });
    button.addEventListener('click', () => show(button, read));
  };
  const addHelp = (label, read) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'character-help';
    button.textContent = label.textContent.trim();
    button.setAttribute('aria-label', `${button.textContent} details`);
    label.replaceChildren(button);
    bind(button, read);
  };
  const describe = (source) => [...source.children].map(node => {
    const lines = node.matches('ul, ol') ? [...node.children] : [node];
    return lines.map(line => line.textContent.trim().replace(/\s+/g, ' ')).join('\n');
  }).join('\n\n');
  const compactCard = (card) => {
    if (card.dataset.characterCompact) return;
    const heading = card.querySelector('h3');
    const content = [...card.children].filter(node => node !== heading && !node.classList.contains('stat-label'));
    if (!heading || !content.length) return;
    card.dataset.characterCompact = 'true';
    const source = document.createElement('div');
    source.className = 'character-help-source';
    content.forEach(node => source.appendChild(node));
    source.hidden = true;
    card.appendChild(source);
    addHelp(heading, () => `${heading.textContent.trim()}\n\n${describe(source)}`);
  };

  main.querySelectorAll('[data-character-help]').forEach(node => {
    const label = node.querySelector('.stat-output-label') || node;
    addHelp(label, () => node.dataset.characterHelp);
  });
  const enhance = () => {
    main.querySelectorAll('[data-character-summary] > .stat-card, .perk-grid > .stat-card, [data-weapon-specialty] > .stat-card').forEach(compactCard);
    main.querySelectorAll('a[href]').forEach(link => {
      const url = new URL(link.href);
      if (url.pathname === location.pathname && url.hash) return;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      if (!link.title) link.title = 'Opens in a new tab';
    });
  };
  enhance();
  // Perk/equipment references arrive asynchronously from the existing data loaders.
  const observer = new MutationObserver(enhance);
  observer.observe(main, {childList: true, subtree: true});

  const racePerks = main.querySelectorAll('[data-character-perk]');
  if (racePerks.length && typeof loadPerkCardData === 'function') {
    loadPerkCardData().then(({map}) => racePerks.forEach(node => {
      const perk = map.get(node.dataset.characterPerk.toLowerCase());
      if (perk) node.dataset.characterHelp = describe(perk.card);
    })).catch(() => {}); // The existing inline description remains the fallback.
  }

  tooltip.addEventListener('mouseenter', () => clearTimeout(timer));
  tooltip.addEventListener('mouseleave', hide);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
  document.addEventListener('click', event => {
    if (!event.target.closest('.character-help, .character-tooltip')) hide();
  });
  window.addEventListener('resize', hide);
  window.addEventListener('scroll', event => {
    if (!active || (event.target instanceof Node && tooltip.contains(event.target))) return;
    const rect = active.getBoundingClientRect();
    // A queued scroll event can arrive after a click has positioned the tooltip.
    // Dismiss only when scrolling actually moves its anchor.
    if (!anchorRect || Math.abs(rect.top - anchorRect.top) > .5 || Math.abs(rect.left - anchorRect.left) > .5) hide();
  }, true);
})();
