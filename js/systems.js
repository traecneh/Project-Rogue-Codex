(() => {
  const main = document.querySelector('.systems-page .main-content');
  if (!main) return;

  const tooltip = document.createElement('div');
  tooltip.id = 'system-tooltip';
  tooltip.className = 'system-tooltip';
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
    button.className = 'system-help';
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
    if (card.dataset.systemCompact) return;
    const heading = card.querySelector('h3');
    const content = [...card.children].filter(node => node !== heading && !node.classList.contains('stat-label'));
    if (!heading || !content.length || content.some(node => node.querySelector('a, button, input, select'))) return;
    card.dataset.systemCompact = 'true';
    const source = document.createElement('div');
    source.className = 'system-help-source';
    content.forEach(node => source.appendChild(node));
    source.hidden = true;
    card.appendChild(source);
    addHelp(heading, () => `${heading.textContent.trim()}\n\n${describe(source)}`);
  };

  main.querySelectorAll('[data-system-help]').forEach(node => addHelp(node, () => node.dataset.systemHelp));
  main.querySelectorAll('[class]').forEach(node => {
    const classes = [...node.classList];
    if (classes.some(name => name.endsWith('-grid')) && !node.matches('.perk-grid, .stat-grid, .calculator-grid')) node.classList.add('system-grid');
    if (classes.some(name => name.endsWith('-card')) && !node.matches('.stat-card')) node.classList.add('system-card');
    if (classes.some(name => name.endsWith('-section')) || node.matches('section') && node.querySelector(':scope > h2')) node.classList.add('system-section');
    if (classes.some(name => name.endsWith('-flow'))) node.classList.add('system-flow');
    if (classes.some(name => name.endsWith('-summary-grid'))) node.classList.add('system-summary-grid');
    if (classes.some(name => name.endsWith('-summary-card'))) compactCard(node);
  });
  main.querySelectorAll('.ascendancy-page .purge-rule-card, .encounter-rule-card, .pvp-consequence-card, .pvp-feed-card, .guild-action-card, .guild-panel, .chat-panel, .experience-build-card, .monster-dr-reference-card, .anti-zerg-moderation-card, #stacking-rules .stat-card').forEach(compactCard);
  main.querySelectorAll('.monster-dr-result-card').forEach(card => {
    const label = card.querySelector('.stat-label');
    const description = [...card.querySelectorAll('p')].find(node => node !== label);
    if (label && description) {
      description.hidden = true;
      description.classList.add('system-help-source');
      addHelp(label, () => description.textContent.trim());
    }
  });
  tooltip.addEventListener('mouseenter', () => clearTimeout(timer));
  tooltip.addEventListener('mouseleave', hide);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
  document.addEventListener('click', event => {
    if (!event.target.closest('.system-help, .system-tooltip')) hide();
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
