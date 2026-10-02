/* Navigation uses the app's existing flows and stored nutrition data. */
(() => {
  document.getElementById('cancel-analysis')?.addEventListener('click', window.cb.cancelTask);
  const theme = window.cb.storage.get('cb_theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  if (theme === 'dark') toggleTheme();
  window.addEventListener('cb-profile-updated', () => window.diary?.renderTodayStrip());
  document.getElementById('foodSearchInput')?.setAttribute('aria-label', 'Describe a food or meal');
  document.getElementById('error')?.setAttribute('role', 'alert');
  document.querySelectorAll('.tab-button').forEach(button => button.setAttribute('type','button'));
  const date = document.getElementById('workspace-date');
  if (date) date.textContent = new Date().toLocaleDateString(undefined, { weekday:'long', day:'numeric', month:'long' }).toUpperCase();
  document.querySelectorAll('[data-workspace]').forEach(button => {
    button.addEventListener('click', () => {
      const action = button.dataset.workspace;
      if (action === 'profile') document.getElementById('profile-link')?.click();
      else if ((action === 'dashboard' || action === 'report') && typeof showDashboard === 'function') showDashboard(action === 'report');
      else if (action === 'diary') window.diary?.openDiaryModal(0);
      else {
        document.body.classList.remove('analysis-view');
        document.getElementById('scan-workspace')?.scrollIntoView({ block:'start', behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
        if (action === 'search') document.getElementById('foodSearchInput')?.focus({ preventScroll:true });
      }
    });
  });
  const results = document.getElementById('results');
  const placeholder = document.getElementById('results-placeholder');
  if (results && placeholder) {
    let wasVisible = false;
    const update = () => {
      const visible = results.style.display !== 'none' && results.style.display !== '';
      placeholder.hidden = visible;
      if (visible && !wasVisible) {
        document.body.classList.add('analysis-view');
        results.scrollIntoView({block:'start',behavior:'instant'});
      }
      wasVisible = visible;
    };
    new MutationObserver(update).observe(results, { attributes:true, attributeFilter:['style','class'] });
    update();
  }
  document.getElementById('back-to-food')?.addEventListener('click', () => {
    document.body.classList.remove('analysis-view');
    document.getElementById('foodSearchInput')?.focus();
  });
  window.addEventListener('cb-analysis-ready', () => {
    document.body.classList.add('analysis-view');
    results?.scrollIntoView({block:'start',behavior:'instant'});
  });
  document.querySelectorAll('#toggleCamera,#barcodeScanBtn,#fileInput,#barcodeFileInput').forEach(control => {
    control.addEventListener(control.tagName === 'INPUT' ? 'change' : 'click', () => {
      document.querySelector('.photo-options').open = true;
    });
  });
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

/* All static and dynamically created dialogs share keyboard behavior. */
(() => {
  let active = null, previous = null;
  const focusables = modal => [...modal.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]')]
    .filter(el => !el.disabled && el.getClientRects().length);
  const sync = () => {
    document.querySelectorAll('.modal, #onboarding-overlay').forEach(modal => {
      modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true');
      const title = modal.querySelector('h2,h3');
      if (title) { if (!title.id) title.id = (modal.id || 'dialog') + '-title'; modal.setAttribute('aria-labelledby',title.id); }
      modal.querySelectorAll('.close-modal').forEach(close => {
        if (close.tagName !== 'BUTTON') {
          close.tabIndex=0; close.setAttribute('role','button');
          if (!close.dataset.keyboardBound) { close.dataset.keyboardBound='true'; close.addEventListener('keydown',e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); close.click(); } }); }
        }
        close.setAttribute('aria-label','Close dialog');
      });
    });
    const open = [...document.querySelectorAll('.modal, #onboarding-overlay')].filter(el => getComputedStyle(el).display !== 'none' && el.getClientRects().length).at(-1) || null;
    if (open !== active) {
      if (!active && open) previous=document.activeElement;
      active=open;
      document.body.classList.toggle('dialog-open',!!open);
      if (open) { const target=focusables(open)[0] || open; open.tabIndex=-1; target.focus({preventScroll:true}); }
      else previous?.focus?.({preventScroll:true});
    }
  };
  new MutationObserver(sync).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});
  document.addEventListener('keydown',event => {
    if (!active) return;
    if (event.key==='Escape') { const close=active.querySelector('.close-modal, .onb-skip'); if (close) close.click(); else active.style.display='none'; event.preventDefault(); }
    if (event.key==='Tab') {
      const items=focusables(active); const first=items[0], last=items.at(-1);
      if (!first) { event.preventDefault(); active.focus(); }
      else if (event.shiftKey && (document.activeElement===first || !active.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement===last || !active.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
  });
  sync();
})();
