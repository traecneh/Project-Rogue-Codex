(() => {
  const timeline = document.querySelector('[data-home-timeline]');
  if (!timeline) return;
  const items = [...timeline.querySelectorAll('[data-home-timeline-item]')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let activeIndex = -1;

  function updateFocus() {
    frame = 0;
    const center = innerHeight * 0.5;
    let nearest = 0;
    let distance = Infinity;
    items.forEach((item, index) => {
      const rect = item.getBoundingClientRect();
      const delta = Math.abs(rect.top + rect.height / 2 - center);
      if (delta < distance) { distance = delta; nearest = index; }
    });
    if (nearest === activeIndex) return;
    activeIndex = nearest;
    items.forEach((item, index) => {
      const steps = Math.min(Math.abs(index - nearest), 3);
      item.classList.toggle('is-timeline-focus', index === nearest);
      item.style.setProperty('--timeline-scale', String(1 - steps * 0.055));
      item.style.setProperty('--timeline-opacity', String(1 - steps * 0.13));
    });
  }

  function scheduleFocus() {
    if (!frame) frame = requestAnimationFrame(updateFocus);
  }

  function updateMotion() {
    timeline.classList.toggle('timeline-focus-enabled', !reducedMotion.matches);
    activeIndex = -1;
    scheduleFocus();
  }

  function revealLinkedStory() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    if (!id) return;
    const entry = document.getElementById(id);
    const story = entry?.querySelector('.history-story');
    if (!story) return;
    story.open = true;
    requestAnimationFrame(() => entry.scrollIntoView({block: 'start', behavior: 'instant'}));
  }

  document.querySelectorAll('.history-story').forEach(story => {
    story.addEventListener('toggle', () => { activeIndex = -1; scheduleFocus(); });
    story.addEventListener('keydown', event => {
      if (event.key === 'Escape' && story.open) {
        event.preventDefault();
        story.open = false;
        story.querySelector('summary').focus({preventScroll: true});
      }
    });
  });
  addEventListener('hashchange', revealLinkedStory);
  revealLinkedStory();

  addEventListener('scroll', scheduleFocus, { passive: true });
  addEventListener('resize', scheduleFocus);
  new ResizeObserver(scheduleFocus).observe(timeline);
  reducedMotion.addEventListener('change', updateMotion);
  updateMotion();
})();
