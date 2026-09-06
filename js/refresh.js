/* Progressive enhancement: native filters remain the data source. */
(() => {
  document.querySelectorAll('.item-filters, .monster-filters').forEach(bar => {
    const selects = [...bar.querySelectorAll('select[multiple]')];
    if (!selects.length) return;
    const chips = document.createElement('div');
    chips.className = 'filter-chips';
    const reset = document.createElement('button');
    reset.type = 'button'; reset.className = 'refresh-button'; reset.textContent = 'Clear filters';
    const views = [];
    function sync() {
      chips.replaceChildren();
      views.forEach(({select, summary, name, options}) => {
        const selected = [...select.selectedOptions];
        summary.textContent = name + (selected.length ? ` (${selected.length})` : '');
        options.querySelectorAll('input').forEach(input => { input.checked = select.options[input.dataset.index]?.selected || false; });
        selected.forEach(option => {
          const chip = document.createElement('button'); chip.type = 'button'; chip.className = 'filter-chip';
          chip.textContent = `${name}: ${option.textContent} ×`;
          chip.setAttribute('aria-label', `Remove ${name}: ${option.textContent}`);
          chip.onclick = () => { option.selected = false; select.dispatchEvent(new Event('change', {bubbles:true})); };
          chips.append(chip);
        });
      });
      reset.hidden = !selects.some(select => select.selectedOptions.length);
    }
    selects.forEach(select => {
      const label = bar.querySelector(`label[for="${select.id}"]`) || select.parentElement.querySelector('.filter-label');
      const rawName = label?.textContent.trim() || select.getAttribute('aria-label');
      const name = rawName === 'EleAttack' ? 'Attack element' : rawName;
      const popover = document.createElement('details'); popover.className = 'filter-popover';
      const summary = document.createElement('summary'); summary.textContent = name;
      const options = document.createElement('div'); options.className = 'filter-options';
      popover.append(summary, options); select.after(popover); select.hidden = true; if (label) label.hidden = true;
      function populate() {
        options.replaceChildren();
        [...select.options].forEach((option, index) => {
          const row = document.createElement('label'); const input = document.createElement('input');
          input.type = 'checkbox'; input.dataset.index = index; input.checked = option.selected;
          input.onchange = () => { option.selected = input.checked; select.dispatchEvent(new Event('change', {bubbles:true})); };
          row.append(input, document.createTextNode(option.textContent)); options.append(row);
        }); sync();
      }
      views.push({select, summary, name, options});
      new MutationObserver(populate).observe(select, {childList:true});
      select.addEventListener('change', sync); populate();
      popover.addEventListener('toggle', () => { if (popover.open) bar.querySelectorAll('details').forEach(other => { if(other !== popover) other.open = false; }); });
    });
    reset.onclick = () => { bar.querySelectorAll('details').forEach(p => p.open = false); selects.forEach(select => { [...select.options].forEach(option => option.selected = false); select.dispatchEvent(new Event('change', {bubbles:true})); }); };
    bar.append(reset, chips); sync();
    document.addEventListener('click', event => { if (!bar.contains(event.target)) bar.querySelectorAll('details').forEach(p => p.open = false); });
    bar.addEventListener('keydown', event => { if(event.key === 'Escape') bar.querySelectorAll('details[open]').forEach(p => { p.open = false; p.querySelector('summary').focus(); }); });
  });
  const panel = document.querySelector('#item-details, #monster-details');
  if (!panel) return;
  panel.classList.add('refresh-detail'); panel.setAttribute('role', 'region'); panel.setAttribute('aria-labelledby', 'details-name'); panel.tabIndex = -1;
  const properties = panel.querySelector('#details-properties');
  if(properties) {
    const resistanceNames = new Set(['Fire', 'Poison', 'Cold', 'Holy', 'Disease', 'Acid', 'Electric', 'Dark']);
    const enhanceProperties = () => {
      propertyObserver.disconnect();
      const rows = [...properties.querySelectorAll(':scope > .detail-row')];
      const resistanceRows = rows.filter(row => {
        const labels = [...row.querySelectorAll('.detail-label')];
        return labels.length && labels.every(label => resistanceNames.has(label.textContent.trim()));
      });
      if(resistanceRows.length && resistanceRows.every(row => [...row.querySelectorAll('.detail-value')].every(value => value.textContent.trim() === '0'))) {
        const disclosure = document.createElement('details'); disclosure.className = 'zero-resistances';
        const summary = document.createElement('summary'); summary.textContent = 'Resistances · all 0';
        disclosure.append(summary); resistanceRows[0].before(disclosure); resistanceRows.forEach(row => disclosure.append(row));
      }
      propertyObserver.observe(properties, {childList:true});
    };
    const propertyObserver = new MutationObserver(enhanceProperties);
    enhanceProperties();
  }
  let wasOpen = false, previousFocus;
  let keyboardInteraction = false;
  document.addEventListener('pointerdown', () => {
    keyboardInteraction = false;
    document.documentElement.classList.add('detail-pointer-mode');
  }, true);
  document.addEventListener('keydown', () => {
    keyboardInteraction = true;
    document.documentElement.classList.remove('detail-pointer-mode');
  }, true);
  const mobile = window.matchMedia('(max-width: 800px)');
  const inline = /\/(weapons|armors|monsters|collectables|useables)\.html$/.test(location.pathname);
  const tableBody = document.querySelector('#items-body, #monsters-body');
  const home = document.createComment('Detail panel resting position');
  panel.before(home);
  const closeButton = panel.querySelector('#details-close');
  let selectedId, expandedRow, selectedRow;
  let tableObserver;
  if (inline) panel.classList.add('inline-detail');
  function positionPanel(reveal = false) {
    if (!inline || !tableBody) return;
    tableObserver?.disconnect();
    const open = panel.classList.contains('show');
    const row = [...tableBody.querySelectorAll(':scope > tr[data-id]')].find(row => row.dataset.id === String(selectedId));
    if (selectedRow && selectedRow !== row) {
      selectedRow.classList.remove('detail-selected-row');
      selectedRow.querySelector('a[aria-controls]')?.setAttribute('aria-expanded', 'false');
    }
    if (mobile.matches || !open || !row) {
      home.after(panel);
      expandedRow?.remove(); expandedRow = null;
    } else {
      if (!expandedRow?.isConnected || expandedRow.previousElementSibling !== row) {
        expandedRow?.remove();
        expandedRow = document.createElement('tr'); expandedRow.className = 'inline-details-row';
        const cell = document.createElement('td'); cell.colSpan = row.cells.length;
        expandedRow.append(cell); row.after(expandedRow); cell.append(panel);
      }
    }
    selectedRow = row;
    if (row) {
      row.classList.toggle('detail-selected-row', open);
      const link = row.querySelector('.weapon-link, .armor-link, .monster-link, .misc-item-link');
      if (link) {
        link.setAttribute('aria-controls', panel.id); link.setAttribute('aria-expanded', String(open));
        if (open) previousFocus = link;
      }
      if (open && reveal && !mobile.matches) requestAnimationFrame(() => {
        if (!panel.classList.contains('show') || selectedRow !== row || mobile.matches) return;
        const wrapper = tableBody.closest('.items-table-wrapper, .monsters-table-wrapper');
        const availableHeight = Math.min(wrapper?.clientHeight || innerHeight, innerHeight) - 64;
        // Center the details, not just the triggering row. Tall panels start
        // below the sticky table header so their title remains visible.
        panel.scrollIntoView({block: panel.offsetHeight <= availableHeight ? 'center' : 'start', behavior: 'instant'});
      });
    }
    tableObserver?.observe(tableBody, {childList:true});
    // Filtering an expanded entry out of the list closes it through the page's existing route handler.
    if (open && selectedId !== undefined && !row) closeButton.click();
  }
  if (inline && tableBody) {
    closeButton.textContent = 'Back to results';
    closeButton.setAttribute('aria-label', 'Back to results');
    tableBody.addEventListener('click', event => {
      const row = event.target.closest('tr[data-id]');
      if (!row || row.parentElement !== tableBody || !panel.classList.contains('show') || row.dataset.id !== String(selectedId)) return;
      const control = event.target.closest('a, button, input, select, summary, [tabindex]');
      // Perk links and stat tooltips keep their own actions.
      if (control && !control.matches('.weapon-link, .armor-link, .monster-link, .misc-item-link')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeButton.click();
    }, true);
    tableObserver = new MutationObserver(() => positionPanel());
    tableObserver.observe(tableBody, {childList:true});
    panel.addEventListener('codex:select-detail', event => {
      selectedId = event.detail.id;
      positionPanel(event.detail.scroll);
    });
  }
  function updateModal() {
    const modal = mobile.matches && panel.classList.contains('show');
    panel.setAttribute('role', modal ? 'dialog' : 'region');
    if (modal) panel.setAttribute('aria-modal', 'true'); else panel.removeAttribute('aria-modal');
    document.querySelectorAll('.main-content > :not(.refresh-detail), #sidebar-root, .sidebar').forEach(element => element.inert = modal);
    document.body.classList.toggle('detail-modal-open', modal);
  }
  mobile.addEventListener('change', () => { positionPanel(); updateModal(); });
  const navObserver = new MutationObserver(() => {
    if (document.querySelector('.sidebar')) { updateModal(); navObserver.disconnect(); }
  });
  navObserver.observe(document.querySelector('.layout'), {childList:true});
  new MutationObserver(() => {
    const open = panel.classList.contains('show');
    positionPanel();
    updateModal();
    if(open && !wasOpen) {
      if (!inline) previousFocus = document.activeElement;
      // Desktop pointer users keep focus on the row. Focusing the entire region
      // draws a clipped outline along the table edge and carries it back to the name.
      if (!inline || mobile.matches || keyboardInteraction) panel.focus({preventScroll:true});
      panel.scrollTop = 0;
    }
    if(!open && wasOpen && previousFocus?.isConnected && (!inline || mobile.matches || keyboardInteraction)) previousFocus.focus({preventScroll:true});
    wasOpen = open;
  }).observe(panel, {attributes:true, attributeFilter:['class']});
  document.addEventListener('keydown', event => {
    if (!panel.classList.contains('show')) return;
    if(event.key === 'Escape') document.getElementById('details-close').click();
    if(event.key === 'Tab' && mobile.matches) {
      const targets = [...panel.querySelectorAll('a[href], button, input, select, [tabindex="0"]')].filter(el => el.getClientRects().length && !el.disabled);
      const first = targets[0], last = targets[targets.length - 1];
      if(event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last?.focus(); }
      else if(!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
})();
