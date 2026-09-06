(() => {
  const dialog = document.createElement('dialog'); dialog.className = 'archive-dialog';
  dialog.setAttribute('aria-label', 'Archive image preview');
  const form = document.createElement('form'); form.method = 'dialog';
  const caption = document.createElement('span');
  const close = document.createElement('button'); close.className = 'refresh-button'; close.textContent = 'Close preview';
  const preview = document.createElement('img');
  form.append(caption, close); dialog.append(form, preview); document.body.append(dialog);
  document.querySelectorAll('.home-timeline-media img').forEach(img => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'archive-image-button';
    button.setAttribute('aria-label', `Enlarge ${img.alt}`);
    img.before(button); button.append(img);
    const label = document.createElement('span'); label.className = 'archive-image-caption'; label.textContent = 'VIEW ARCHIVE IMAGE ↗'; button.append(label);
    button.onclick = () => { preview.src = img.src; preview.alt = img.alt; caption.textContent = img.alt; dialog.showModal(); };
  });
  dialog.addEventListener('click', event => { if(event.target === dialog) { const box = dialog.getBoundingClientRect(); if(event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });
})();
