// ============================================================
// CalcuBite — onboarding.js
// First-run welcome flow: what it does → personalize → go.
// ============================================================

(function () {
  const FLAG = 'cb_onboarded_v1';

  const STEPS = [
    {
      icon: 'fa-wand-magic-sparkles',
      title: 'Welcome to CalcuBite 👋',
      body: `
        <p>Point your camera at any food and get instant, science-backed answers.</p>
        <ul class="onb-list">
          <li><i class="fas fa-camera"></i> <strong>Snap a label or a meal</strong> — AI reads it in seconds</li>
          <li><i class="fas fa-barcode"></i> <strong>Scan barcodes</strong> — verified data for 3M+ packaged foods</li>
          <li><i class="fas fa-keyboard"></i> <strong>Type or speak</strong> — "2 chapatis + dal" works too</li>
          <li><i class="fas fa-book-open"></i> <strong>Track your day</strong> — calories &amp; macros against your personal target</li>
        </ul>`
    },
    {
      icon: 'fa-user-gear',
      title: 'Make it yours (optional)',
      body: `
        <p>Tell us a little about yourself and CalcuBite will personalize ratings, advice and your daily calorie target. Skip anything you like.</p>
        <div class="onb-form">
          <div class="onb-row">
            <div class="form-group"><label>Age</label><input type="number" id="onb-age" min="10" max="100" placeholder="e.g. 25"></div>
            <div class="form-group"><label>Sex</label>
              <select id="onb-sex"><option value="">Prefer not to say</option><option value="male">Male</option><option value="female">Female</option></select>
            </div>
          </div>
          <div class="onb-row">
            <div class="form-group"><label>Height (cm)</label><input type="number" id="onb-height" min="100" max="250" placeholder="e.g. 170"></div>
            <div class="form-group"><label>Weight (kg)</label><input type="number" id="onb-weight" min="30" max="250" placeholder="e.g. 65"></div>
          </div>
          <div class="form-group"><label>Your goal</label>
            <select id="onb-goal">
              <option value="">No specific goal</option>
              <option value="lose-weight">Lose weight</option>
              <option value="maintain">Stay healthy / maintain</option>
              <option value="gain-muscle">Build muscle</option>
            </select>
          </div>
          <div class="form-group"><label>Dietary preference</label>
            <select id="onb-diet">
              <option value="">No preference</option>
              <option value="vegetarian">Vegetarian</option>
              <option value="vegan">Vegan</option>
              <option value="eggetarian">Eggetarian</option>
              <option value="non-vegetarian">Non-vegetarian</option>
            </select>
          </div>
        </div>`
    },
    {
      icon: 'fa-rocket',
      title: 'You\'re all set!',
      body: `
        <ul class="onb-list">
          <li><i class="fas fa-infinity"></i> <strong>Unlimited &amp; free</strong> — no account, no limits</li>
          <li><i class="fas fa-mobile-screen"></i> <strong>Installable</strong> — add to your home screen for the full app feel</li>
          <li><i class="fas fa-wifi"></i> <strong>Works offline</strong> — the app itself loads without internet</li>
        </ul>
        <p class="onb-go">Scan your first food now 🍎</p>`
    }
  ];

  function buildOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'onboarding-overlay';
    overlay.innerHTML = `
      <div class="onb-card">
        <button class="onb-skip" id="onb-skip">Skip</button>
        <div class="onb-icon-wrap"><div class="onb-icon"><i class="fas" id="onb-icon"></i></div></div>
        <h2 id="onb-title"></h2>
        <div class="onb-body" id="onb-body"></div>
        <div class="onb-dots" id="onb-dots"></div>
        <div class="onb-actions">
          <button class="secondary-button" id="onb-back" style="display:none"><i class="fas fa-arrow-left"></i> Back</button>
          <button class="primary-button" id="onb-next">Next <i class="fas fa-arrow-right"></i></button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    let step = 0;
    const iconEl = overlay.querySelector('#onb-icon');
    const titleEl = overlay.querySelector('#onb-title');
    const bodyEl = overlay.querySelector('#onb-body');
    const dotsEl = overlay.querySelector('#onb-dots');
    const backBtn = overlay.querySelector('#onb-back');
    const nextBtn = overlay.querySelector('#onb-next');
    const skipBtn = overlay.querySelector('#onb-skip');

    function render() {
      const s = STEPS[step];
      iconEl.className = 'fas ' + s.icon;
      titleEl.textContent = s.title;
      bodyEl.innerHTML = s.body;
      dotsEl.innerHTML = STEPS.map((_, i) => `<span class="onb-dot ${i === step ? 'active' : ''}"></span>`).join('');
      backBtn.style.display = step === 0 ? 'none' : 'inline-flex';
      nextBtn.innerHTML = step === STEPS.length - 1
        ? '<i class="fas fa-camera"></i> Start Scanning'
        : 'Next <i class="fas fa-arrow-right"></i>';
      skipBtn.style.display = step === STEPS.length - 1 ? 'none' : 'block';
    }

    function collectProfile() {
      if (!window.auth || !window.auth.updateProfile) return;
      const health = {};
      const age = parseFloat(overlay.querySelector('#onb-age')?.value);
      const sex = overlay.querySelector('#onb-sex')?.value;
      const height = parseFloat(overlay.querySelector('#onb-height')?.value);
      const weight = parseFloat(overlay.querySelector('#onb-weight')?.value);
      const goal = overlay.querySelector('#onb-goal')?.value;
      const diet = overlay.querySelector('#onb-diet')?.value;
      if (isFinite(age)) health.age = age;
      if (sex) health.sex = sex;
      if (isFinite(height)) health.heightCm = height;
      if (isFinite(weight)) health.weightKg = weight;
      if (goal) health.goal = goal;
      if (diet) health.dietaryPreference = diet;
      if (Object.keys(health).length) {
        try { window.auth.updateProfile({ health }); } catch (e) { /* non-critical */ }
      }
    }

    function finish() {
      collectProfile();
      localStorage.setItem(FLAG, '1');
      overlay.classList.add('closing');
      setTimeout(() => overlay.remove(), 350);
      if (window.diary) window.diary.renderTodayStrip(); // refresh targets with new profile
      if (window.cbToast) window.cbToast('Welcome to CalcuBite! 🎉');
    }

    nextBtn.addEventListener('click', () => {
      if (step === STEPS.length - 1) { finish(); return; }
      if (step === 1) collectProfile(); // save as they go
      step++;
      render();
    });
    backBtn.addEventListener('click', () => { if (step > 0) { step--; render(); } });
    skipBtn.addEventListener('click', finish);

    render();
    return overlay;
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem(FLAG)) return;
    // small delay so the app paints first
    setTimeout(buildOverlay, 400);
  });

  window.onboarding = { reset: () => localStorage.removeItem(FLAG) };
})();
