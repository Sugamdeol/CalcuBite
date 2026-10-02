/* Navigation uses the app's existing flows and stored nutrition data. */
(() => {
  const date = document.getElementById('workspace-date');
  if (date) date.textContent = new Date().toLocaleDateString(undefined, { weekday:'long', day:'numeric', month:'long' }).toUpperCase();
  document.querySelectorAll('[data-workspace]').forEach(button => {
    button.addEventListener('click', () => {
      const action = button.dataset.workspace;
      if (action === 'profile') document.getElementById('profile-link')?.click();
      else if (action === 'dashboard' && typeof showDashboard === 'function') showDashboard();
      else if (action === 'diary') window.diary?.openDiaryModal(0);
      else {
        document.getElementById('scan-workspace')?.scrollIntoView({ block:'start', behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
        if (action === 'search') document.getElementById('foodSearchInput')?.focus({ preventScroll:true });
      }
    });
  });
  const results = document.getElementById('results');
  const placeholder = document.getElementById('results-placeholder');
  if (results && placeholder) {
    const update = () => { placeholder.hidden = getComputedStyle(results).display !== 'none'; };
    new MutationObserver(update).observe(results, { attributes:true, attributeFilter:['style','class'] });
    update();
  }
  // File upload remains keyboard accessible when the native input is hidden.
  document.querySelectorAll('.input-actions label[for]').forEach(label => {
    label.tabIndex = 0;
    label.setAttribute('role','button');
    label.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault(); document.getElementById(label.htmlFor)?.click();
      }
    });
  });
})();
