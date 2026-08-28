// ============================================================
// CalcuBite — diary.js
// Food diary + daily calorie/macro targets + Today strip +
// dashboard diary section + shareable result card + weekly report.
// Local-first (localStorage) with MantleDB cloud sync.
// ============================================================

(function () {
  const DIARY_KEY = '***';
  const MEALS = ['breakfast', 'lunch', 'dinner', 'snacks'];
  const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snacks: 'Snacks' };
  const MEAL_ICONS = { breakfast: 'fa-sun', lunch: 'fa-utensils', dinner: 'fa-moon', snacks: 'fa-cookie-bite' };

  // ---------------- storage ----------------
  function loadDiary() {
    try {
      const d = JSON.parse(localStorage.getItem(DIARY_KEY));
      if (d && typeof d === 'object' && d.days) return d;
    } catch (e) { /* corrupted */ }
    return { days: {} };
  }
  let diary = loadDiary();

  function saveDiary() {
    // keep last 60 days only
    const keys = Object.keys(diary.days).sort();
    while (keys.length > 60) { delete diary.days[keys.shift()]; }
    localStorage.setItem(DIARY_KEY, JSON.stringify(diary));
    // cloud sync (fire-and-forget; auth.js exposes MantleDB via window.store internals)
    try {
      if (window._mantleSyncDiary) window._mantleSyncDiary(diary);
    } catch (e) { /* non-critical */ }
  }

  function todayKey(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  }

  function getDay(dateStr) {
    if (!diary.days[dateStr]) diary.days[dateStr] = { entries: [] };
    return diary.days[dateStr];
  }

  // ---------------- daily targets ----------------
  // Mifflin-St Jeor BMR + activity multiplier + goal adjustment.
  function computeTargets() {
    const h = (window.auth && window.auth.getHealth) ? window.auth.getHealth() : {};
    const w = parseFloat(h.weightKg), ht = parseFloat(h.heightCm), a = parseFloat(h.age);
    let bmr;
    const hasProfile = isFinite(w) && isFinite(ht) && isFinite(a) && w > 0 && ht > 0 && a > 0;
    if (hasProfile) {
      bmr = h.sex === 'female'
        ? 10 * w + 6.25 * ht - 5 * a - 161
        : 10 * w + 6.25 * ht - 5 * a + 5;
    } else {
      bmr = 1550; // neutral default when no profile
    }
    const factors = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
    let kcal = bmr * (factors[h.activity] || 1.375);
    if (h.goal === 'lose-weight') kcal -= 500;
    if (h.goal === 'gain-muscle') kcal += 300;
    kcal = Math.max(1200, Math.round(kcal));

    let p = 0.30, c = 0.40, f = 0.30;
    if (h.goal === 'gain-muscle') { p = 0.35; c = 0.40; f = 0.25; }
    if (h.goal === 'lose-weight') { p = 0.35; c = 0.35; f = 0.30; }

    return {
      calories: kcal,
      protein: Math.round(kcal * p / 4),
      carbs: Math.round(kcal * c / 4),
      fat: Math.round(kcal * f / 9),
      basedOnProfile: hasProfile
    };
  }

  function dayTotals(dateStr) {
    const day = diary.days[dateStr];
    const t = { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0, byMeal: { breakfast: 0, lunch: 0, dinner: 0, snacks: 0 } };
    if (!day) return t;
    day.entries.forEach(e => {
      t.calories += e.calories || 0;
      t.protein += e.protein || 0;
      t.carbs += e.carbs || 0;
      t.fat += e.fat || 0;
      t.count++;
      if (t.byMeal[e.meal] !== undefined) t.byMeal[e.meal] += e.calories || 0;
    });
    return t;
  }

  // ---------------- add entries ----------------
  function addEntry(entry) {
    const day = getDay(todayKey());
    day.entries.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      time: new Date().toISOString(),
      meal: MEALS.includes(entry.meal) ? entry.meal : guessMeal(),
      name: entry.name || 'Food item',
      calories: Math.round(entry.calories || 0),
      protein: Math.round((entry.protein || 0) * 10) / 10,
      carbs: Math.round((entry.carbs || 0) * 10) / 10,
      fat: Math.round((entry.fat || 0) * 10) / 10,
      serving: entry.serving || '',
      source: entry.source || 'manual'
    });
    saveDiary();
    renderTodayStrip();
    return true;
  }

  function removeEntry(dateStr, id) {
    const day = diary.days[dateStr];
    if (!day) return;
    day.entries = day.entries.filter(e => e.id !== id);
    saveDiary();
    renderTodayStrip();
  }

  function guessMeal() {
    const h = new Date().getHours();
    if (h < 11) return 'breakfast';
    if (h < 16) return 'lunch';
    if (h < 21) return 'dinner';
    return 'snacks';
  }

  // Extract diary-ready numbers from whatever analysis is showing
  function entryFromCurrentAnalysis() {
    const data = window.analysisData || (typeof analysisData !== 'undefined' ? analysisData : null);
    if (!data) return null;
    const meta = data.productMeta || window.lastProductMeta || {};
    const ne = data.nutritionEstimate || {};

    let name = meta.name || (data.foodIdentification && data.foodIdentification.mainItems
      ? data.foodIdentification.mainItems[0] : 'Scanned food');

    let calories, protein, carbs, fat, serving = '';
    if (meta.source === 'off' && meta.per100 && meta.per100.kcal != null) {
      const p100 = meta.per100;
      // prefer per-serving if a serving size in grams is available
      const servMatch = (meta.servingSize || '').match(/([\d.,]+)\s*g/);
      const servG = servMatch ? parseFloat(servMatch[1].replace(',', '.')) : null;
      if (servG && servG > 0) {
        const f = servG / 100;
        calories = p100.kcal * f; protein = (p100.protein || 0) * f;
        carbs = (p100.carbs || 0) * f; fat = (p100.fat || 0) * f;
        serving = `per serving (${meta.servingSize})`;
      } else {
        calories = p100.kcal; protein = p100.protein || 0;
        carbs = p100.carbs || 0; fat = p100.fat || 0;
        serving = 'per 100 g';
      }
    } else {
      calories = meta.kcalEstimate != null ? meta.kcalEstimate : parseNum(ne.calories);
      protein = meta.proteinEstimate != null ? meta.proteinEstimate : parseNum(ne.protein);
      carbs = meta.carbsEstimate != null ? meta.carbsEstimate : parseNum(ne.carbs);
      fat = meta.fatEstimate != null ? meta.fatEstimate : parseNum(ne.fat);
      serving = 'per serving (AI estimate)';
    }
    return { name, calories, protein, carbs, fat, serving, source: meta.source || 'ai' };
  }

  function parseNum(v) {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return v;
    const m = String(v).match(/([\d.,]+)/);
    return m ? parseFloat(m[1].replace(',', '.')) || 0 : 0;
  }

  // ---------------- "Add to Diary" flow ----------------
  function openMealPicker() {
    const entry = entryFromCurrentAnalysis();
    if (!entry) { if (window.cbToast) window.cbToast('Analyze a food first'); return; }

    let modal = document.getElementById('meal-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'meal-modal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content modal-slim">
          <div class="modal-header">
            <h2><i class="fas fa-plus-circle"></i> Add to Food Diary</h2>
            <span class="close-modal">&times;</span>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Food name</label>
              <input type="text" id="meal-food-name">
            </div>
            <div class="form-group">
              <label>Calories <small id="meal-macro-hint" style="font-weight:400"></small></label>
              <input type="number" id="meal-calories" min="0">
            </div>
            <div class="form-group">
              <label>Add to meal</label>
              <div class="meal-chips" id="meal-chips">
                ${MEALS.map(m => `<button type="button" class="meal-chip" data-meal="${m}"><i class="fas ${MEAL_ICONS[m]}"></i> ${MEAL_LABELS[m]}</button>`).join('')}
              </div>
            </div>
            <button id="meal-confirm" class="primary-button" style="width:100%"><i class="fas fa-check"></i> Add to diary</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.querySelector('.close-modal').addEventListener('click', () => modal.style.display = 'none');
      window.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
      modal.querySelectorAll('.meal-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          modal.querySelectorAll('.meal-chip').forEach(c => c.classList.remove('selected'));
          chip.classList.add('selected');
        });
      });
      modal.querySelector('#meal-confirm').addEventListener('click', () => {
        const name = modal.querySelector('#meal-food-name').value.trim();
        const calories = parseFloat(modal.querySelector('#meal-calories').value) || 0;
        const sel = modal.querySelector('.meal-chip.selected');
        const meal = sel ? sel.dataset.meal : guessMeal();
        const e = modal._pendingEntry;
        addEntry({ ...e, name: name || e.name, calories, meal });
        modal.style.display = 'none';
        if (window.cbToast) window.cbToast(`Added to ${MEAL_LABELS[meal]} ✓`);
      });
    }
    modal._pendingEntry = entry;
    modal.querySelector('#meal-food-name').value = entry.name;
    modal.querySelector('#meal-calories').value = Math.round(entry.calories || 0);
    modal.querySelector('#meal-macro-hint').textContent =
      entry.protein || entry.carbs || entry.fat
        ? ` — P ${Math.round(entry.protein || 0)}g · C ${Math.round(entry.carbs || 0)}g · F ${Math.round(entry.fat || 0)}g (${entry.serving})` : '';
    // preselect guessed meal
    modal.querySelectorAll('.meal-chip').forEach(c => {
      c.classList.toggle('selected', c.dataset.meal === guessMeal());
    });
    modal.style.display = 'block';
  }

  function updateAddButton() {
    const btn = document.getElementById('addToDiaryBtn');
    if (!btn) return;
    const entry = entryFromCurrentAnalysis();
    btn.style.display = entry ? 'inline-flex' : 'none';
  }

  // ---------------- Today strip ----------------
  function renderTodayStrip() {
    const host = document.getElementById('today-strip');
    if (!host) return;
    const targets = computeTargets();
    const t = dayTotals(todayKey());
    const pct = Math.min(100, Math.round(t.calories / targets.calories * 100));
    const over = t.calories > targets.calories;

    const ring = (val, goal, color) => {
      const p = goal > 0 ? Math.min(100, val / goal * 100) : 0;
      return `<div class="macro-mini">
        <div class="macro-mini-bar"><div style="width:${p}%;background:${color}"></div></div>
        <span>${Math.round(val)}/${goal}g</span>
      </div>`;
    };

    host.innerHTML = `
      <div class="today-inner">
        <div class="today-ring-wrap">
          <svg viewBox="0 0 42 42" class="today-ring" aria-hidden="true">
            <circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--bg-tertiary)" stroke-width="5"></circle>
            <circle cx="21" cy="21" r="15.9" fill="none" stroke="${over ? 'var(--danger)' : 'var(--primary)'}"
              stroke-width="5" stroke-linecap="butt"
              stroke-dasharray="${pct} ${100 - pct}" stroke-dashoffset="25"></circle>
            <text x="21" y="21" class="today-ring-text" text-anchor="middle" dominant-baseline="central">${pct}%</text>
          </svg>
          <div class="today-kcal">
            <strong>${Math.round(t.calories).toLocaleString()}</strong>
            <small>/ ${targets.calories.toLocaleString()} kcal</small>
          </div>
        </div>
        <div class="today-macros">
          ${ring(t.protein, targets.protein, 'var(--primary)')}
          ${ring(t.carbs, targets.carbs, 'var(--secondary)')}
          ${ring(t.fat, targets.fat, 'var(--warning)')}
          ${targets.basedOnProfile ? '' : '<small class="today-hint"><i class="fas fa-info-circle"></i> Add height/weight/age in Profile for personal targets</small>'}
        </div>
        <div class="today-meals">
          ${MEALS.map(m => `
            <div class="today-meal ${t.byMeal[m] > 0 ? 'has-food' : ''}">
              <i class="fas ${MEAL_ICONS[m]}"></i>
              <span>${MEAL_LABELS[m]}</span>
              <strong>${t.byMeal[m] > 0 ? Math.round(t.byMeal[m]) + ' kcal' : '—'}</strong>
            </div>`).join('')}
        </div>
        <button class="secondary-button today-diary-btn" id="openDiaryBtn"><i class="fas fa-book-open"></i> Diary</button>
      </div>`;
    const openBtn = host.querySelector('#openDiaryBtn');
    if (openBtn) openBtn.addEventListener('click', openDiaryModal);
  }

  // ---------------- Full diary modal ----------------
  function openDiaryModal(dateOffset = 0) {
    let modal = document.getElementById('diary-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'diary-modal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h2><i class="fas fa-book-open"></i> Food Diary</h2>
            <span class="close-modal">&times;</span>
          </div>
          <div class="modal-body">
            <div class="diary-nav">
              <button id="diary-prev" class="icon-btn" aria-label="Previous day"><i class="fas fa-chevron-left"></i></button>
              <strong id="diary-date-label"></strong>
              <button id="diary-next" class="icon-btn" aria-label="Next day"><i class="fas fa-chevron-right"></i></button>
            </div>
            <div id="diary-summary" class="diary-summary"></div>
            <div id="diary-meals"></div>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.querySelector('.close-modal').addEventListener('click', () => modal.style.display = 'none');
      window.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
      modal.querySelector('#diary-prev').addEventListener('click', () => { modal._offset = (modal._offset || 0) - 1; renderDiaryModal(); });
      modal.querySelector('#diary-next').addEventListener('click', () => { if ((modal._offset || 0) < 0) { modal._offset++; renderDiaryModal(); } });
    }
    modal._offset = dateOffset;
    renderDiaryModal();
    modal.style.display = 'block';
  }

  function renderDiaryModal() {
    const modal = document.getElementById('diary-modal');
    if (!modal) return;
    const offset = modal._offset || 0;
    const dateStr = todayKey(offset);
    const d = new Date(dateStr + 'T12:00:00');
    const label = offset === 0 ? 'Today' : offset === -1 ? 'Yesterday'
      : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    modal.querySelector('#diary-date-label').textContent = label;
    modal.querySelector('#diary-next').style.visibility = offset >= 0 ? 'hidden' : 'visible';

    const targets = computeTargets();
    const t = dayTotals(dateStr);
    modal.querySelector('#diary-summary').innerHTML = `
      <div class="diary-sum-card"><small>Calories</small><strong>${Math.round(t.calories)} / ${targets.calories}</strong></div>
      <div class="diary-sum-card"><small>Protein</small><strong>${Math.round(t.protein)} / ${targets.protein}g</strong></div>
      <div class="diary-sum-card"><small>Carbs</small><strong>${Math.round(t.carbs)} / ${targets.carbs}g</strong></div>
      <div class="diary-sum-card"><small>Fat</small><strong>${Math.round(t.fat)} / ${targets.fat}g</strong></div>`;

    const day = diary.days[dateStr];
    const mealsHtml = MEALS.map(m => {
      const entries = day ? day.entries.filter(e => e.meal === m) : [];
      const kcal = entries.reduce((s, e) => s + (e.calories || 0), 0);
      return `
        <div class="diary-meal-block">
          <div class="diary-meal-head">
            <span><i class="fas ${MEAL_ICONS[m]}"></i> ${MEAL_LABELS[m]}</span>
            <span class="diary-meal-kcal">${kcal > 0 ? Math.round(kcal) + ' kcal' : ''}</span>
          </div>
          ${entries.length === 0 ? '<p class="diary-empty">Nothing logged yet.</p>' :
            entries.map(e => `
              <div class="diary-entry">
                <div class="diary-entry-info">
                  <strong>${escapeHtml(e.name)}</strong>
                  <small>${Math.round(e.calories || 0)} kcal · P ${Math.round(e.protein || 0)}g · C ${Math.round(e.carbs || 0)}g · F ${Math.round(e.fat || 0)}g${e.serving ? ' · ' + escapeHtml(e.serving) : ''}</small>
                </div>
                <button class="icon-btn diary-del" data-id="${e.id}" aria-label="Remove"><i class="fas fa-trash"></i></button>
              </div>`).join('')}
        </div>`;
    }).join('');
    const mealsHost = modal.querySelector('#diary-meals');
    mealsHost.innerHTML = mealsHtml;
    mealsHost.querySelectorAll('.diary-del').forEach(btn => {
      btn.addEventListener('click', () => { removeEntry(dateStr, btn.dataset.id); renderDiaryModal(); });
    });
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---------------- Dashboard section ----------------
  function enhanceDashboard(dashboardModal) {
    if (!dashboardModal || dashboardModal.querySelector('.diary-dashboard-section')) return;
    const section = document.createElement('div');
    section.className = 'dashboard-section diary-dashboard-section';
    section.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem">
        <h3><i class="fas fa-book-open"></i> Food Diary — Last 7 Days</h3>
        <div style="display:flex;gap:.5rem">
          <button id="weekly-report-btn" class="secondary-button"><i class="fas fa-robot"></i> AI Weekly Report</button>
          <button id="open-full-diary" class="secondary-button"><i class="fas fa-calendar-alt"></i> Open Diary</button>
        </div>
      </div>
      <div id="diary-week-chart-wrap" class="chart-container" style="height:220px"><canvas id="diary-week-chart"></canvas></div>
      <div id="weekly-report-out" class="weekly-report-out" style="display:none"></div>`;
    // insert after the health-goals section
    const goalsSection = dashboardModal.querySelector('.health-goals');
    if (goalsSection && goalsSection.nextSibling) goalsSection.parentNode.insertBefore(section, goalsSection.nextSibling);
    else dashboardModal.querySelector('.dashboard-content').appendChild(section);

    section.querySelector('#open-full-diary').addEventListener('click', () => openDiaryModal(0));
    section.querySelector('#weekly-report-btn').addEventListener('click', generateWeeklyReport);
    renderWeekChart(dashboardModal);
  }

  function last7Days() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const key = todayKey(-i);
      days.push({ key, totals: dayTotals(key) });
    }
    return days;
  }

  function renderWeekChart(dashboardModal) {
    const canvas = dashboardModal.querySelector('#diary-week-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    if (window.diaryWeekChart) { window.diaryWeekChart.destroy(); window.diaryWeekChart = null; }
    const days = last7Days();
    const targets = computeTargets();
    window.diaryWeekChart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: days.map(d => new Date(d.key + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' })),
        datasets: [{
          label: 'Calories eaten',
          data: days.map(d => Math.round(d.totals.calories)),
          backgroundColor: 'rgba(22,163,74,0.75)',
          borderColor: '#141414',
          borderWidth: 2
        }, {
          label: 'Target',
          data: days.map(() => targets.calories),
          type: 'line',
          borderColor: '#ef4444',
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { y: { beginAtZero: true } },
        plugins: { legend: { display: true } }
      }
    });
  }

  // ---------------- Weekly AI report ----------------
  async function generateWeeklyReport() {
    const out = document.getElementById('weekly-report-out');
    const btn = document.getElementById('weekly-report-btn');
    if (!out) return;
    const days = last7Days();
    const logged = days.filter(d => d.totals.count > 0);
    if (logged.length === 0) {
      out.style.display = 'block';
      out.innerHTML = '<p>Add some meals to your diary first — then I can summarize your week! 🍽️</p>';
      return;
    }
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Writing report...'; }
    out.style.display = 'block';
    out.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Analyzing your week...</p>';

    const targets = computeTargets();
    const summary = days.map(d =>
      `${d.key}: ${Math.round(d.totals.calories)} kcal, ${Math.round(d.totals.protein)}g protein, ` +
      `${Math.round(d.totals.carbs)}g carbs, ${Math.round(d.totals.fat)}g fat, ${d.totals.count} items logged`
    ).join('\n');
    const foods = [];
    logged.forEach(d => (diary.days[d.key].entries || []).forEach(e => foods.push(`${e.name} (${Math.round(e.calories)} kcal, ${e.meal})`)));

    try {
      const raw = await aiChat([
        { role: 'system', content: 'You are a friendly nutrition coach. Be concise, specific and encouraging. Use short paragraphs and a few bullet points. No markdown headers.' },
        { role: 'user', content: `Here is my food diary for the last 7 days (daily target: ${targets.calories} kcal, ${targets.protein}g protein):\n${summary}\n\nFoods eaten:\n${foods.slice(0, 40).join('\n')}\n\nGive me a short weekly report: what went well, what to watch out for, and 3 concrete tips for next week.` }
      ], { temperature: 0.5, max_tokens: 2000 });
      out.innerHTML = raw.split('\n').filter(l => l.trim()).map(l => `<p>${escapeHtml(l.replace(/^[-*•]\s*/, '• '))}</p>`).join('');
    } catch (e) {
      out.innerHTML = `<p>The free AI is busy right now. Please try again in a minute.</p>`;
    }
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-robot"></i> AI Weekly Report'; }
  }

  // ---------------- Share result card ----------------
  async function shareResultCard() {
    const data = window.analysisData || (typeof analysisData !== 'undefined' ? analysisData : null);
    if (!data) { if (window.cbToast) window.cbToast('Analyze a food first'); return; }
    const meta = data.productMeta || {};
    const ne = data.nutritionEstimate || {};
    const name = meta.name || (data.foodIdentification && data.foodIdentification.mainItems ? data.foodIdentification.mainItems[0] : 'Food analysis');
    const rating = data.rating || '?';

    const c = document.createElement('canvas');
    c.width = 1080; c.height = 1080;
    const ctx = c.getContext('2d');
    // background
    ctx.fillStyle = '#f6efe2'; ctx.fillRect(0, 0, 1080, 1080);
    // header band
    ctx.fillStyle = '#16a34a'; ctx.fillRect(0, 0, 1080, 180);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 64px Inter, Arial, sans-serif';
    ctx.fillText('CalcuBite AI', 60, 115);
    ctx.font = '500 30px Inter, Arial, sans-serif';
    ctx.fillText('Analyze what\'s really in your food', 60, 155);
    // product card
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#141414'; ctx.lineWidth = 6;
    roundRect(ctx, 60, 240, 960, 640, 24); ctx.fill(); ctx.stroke();
    // rating circle
    const ratingColor = rating >= 7 ? '#10b981' : rating >= 4 ? '#f59e0b' : '#ef4444';
    ctx.beginPath(); ctx.arc(200, 400, 90, 0, Math.PI * 2);
    ctx.fillStyle = ratingColor; ctx.fill();
    ctx.strokeStyle = '#141414'; ctx.lineWidth = 6; ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = '900 84px Inter, Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.fillText(String(rating), 200, 430);
    ctx.font = '600 26px Inter, Arial, sans-serif';
    ctx.fillText('/ 10', 200, 520);
    ctx.textAlign = 'left';
    // name
    ctx.fillStyle = '#141414'; ctx.font = '800 44px Inter, Arial, sans-serif';
    wrapText(ctx, name, 340, 380, 620, 54);
    if (meta.brand) { ctx.font = '500 30px Inter, Arial, sans-serif'; ctx.fillStyle = '#525252'; ctx.fillText(meta.brand, 340, 470); }
    // nutrition rows
    const rows = [
      ['Calories', ne.calories || '—'],
      ['Protein', ne.protein || '—'],
      ['Carbs', ne.carbs || '—'],
      ['Fat', ne.fat || '—']
    ];
    let y = 600;
    rows.forEach(([k, v]) => {
      ctx.fillStyle = '#f6efe2'; ctx.strokeStyle = '#141414'; ctx.lineWidth = 4;
      roundRect(ctx, 120, y, 840, 58, 12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#141414'; ctx.font = '700 28px Inter, Arial, sans-serif';
      ctx.fillText(k, 150, y + 39);
      ctx.textAlign = 'right'; ctx.fillText(String(v), 930, y + 39); ctx.textAlign = 'left';
      y += 74;
    });
    // footer
    ctx.fillStyle = '#141414'; ctx.font = '600 30px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Scanned with CalcuBite AI — calcubite.vercel.app', 540, 990);
    ctx.textAlign = 'left';

    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const file = new File([blob], 'calcubite-result.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'CalcuBite analysis', text: `${name} — ${rating}/10 on CalcuBite AI` });
        return;
      } catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'calcubite-result.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    if (window.cbToast) window.cbToast('Result card downloaded ✓');
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function wrapText(ctx, text, x, y, maxW, lineH) {
    const words = String(text).split(' ');
    let line = '', lines = 0;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, y); y += lineH; line = w; lines++;
        if (lines >= 2) { ctx.fillText(line + '…', x, y); return; }
      } else line = test;
    }
    ctx.fillText(line, x, y);
  }

  // ---------------- toast ----------------
  window.cbToast = function (msg) {
    let t = document.getElementById('cb-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'cb-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2600);
  };

  // ---------------- init ----------------
  document.addEventListener('DOMContentLoaded', () => {
    renderTodayStrip();
    const addBtn = document.getElementById('addToDiaryBtn');
    if (addBtn) addBtn.addEventListener('click', openMealPicker);
    const shareBtn = document.getElementById('shareResultBtn');
    if (shareBtn) shareBtn.addEventListener('click', shareResultCard);
    // refresh strip when returning to the tab (date may have rolled over)
    document.addEventListener('visibilitychange', () => { if (!document.hidden) renderTodayStrip(); });
    // cloud diary merged in by auth.js after load
    window.addEventListener('cb-diary-loaded', () => {
      diary = loadDiary();
      renderTodayStrip();
    });
  });

  window.diary = {
    addEntry, removeEntry, openDiaryModal, renderTodayStrip,
    enhanceDashboard, updateAddButton, openMealPicker,
    computeTargets, dayTotals, todayKey, shareResultCard,
    last7Days
  };
})();
