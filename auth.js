// ============================================================
// CalcuBite — no-login identity & cloud storage
// ------------------------------------------------------------
// • No signup / no login: every visitor gets an anonymous
//   device identity stored in localStorage.
// • Profile is local-first (localStorage). Scans are unlimited — no ads.
// • Scan history, health goals and app stats are synced to
//   MantleDB (https://mantledb.sh) — free anonymous JSON store.
// • AI is provided by BazaarLink.ai free tier (https://bazaarlink.ai/free).
// ============================================================

const MANTLE_BASE = 'https://mantledb.sh/v2';
const MANTLE_NS = 'calcubite';
// Write key for the claimed "calcubite" namespace. This is a
// client-side app, so the key is intentionally public; it only
// allows writing inside this namespace.
const MANTLE_KEY = '1d9900af5d44ffcdbd2a9cd7c6015428e1af5325ed8dbac23cded566acbb09c2';

// DOM references (may be null until DOMContentLoaded)
let appContainer, userProfileElem, userNameElem, userAvatarElem, userTierElem;

// ------------------------------------------------------------
// MantleDB helpers
// ------------------------------------------------------------
async function mantleFetch(path, options = {}) {
  const res = await window.cb.fetchWithTimeout(`${MANTLE_BASE}/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Mantle-Key': MANTLE_KEY,
      ...(options.headers || {})
    }
  });
  if (!res.ok) throw new Error(`MantleDB ${res.status}`);
  return res.json();
}

const mantleWrite = (path, data) => mantleFetch(path, { method: 'POST', body: JSON.stringify(data) });
const mantleRead = (path) => mantleFetch(path, { method: 'GET' });
const mantleIncrement = (path, key) => mantleFetch(`increment/${path}`, { method: 'POST', body: JSON.stringify({ key }) });

// ------------------------------------------------------------
// Anonymous device identity (replaces Supabase auth)
// ------------------------------------------------------------
function getDeviceId() {
  let id = window.cb.storage.get('cb_device_id');
  if (!id) {
    id = (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    window.cb.storage.set('cb_device_id', id);
  }
  return id;
}

const deviceId = getDeviceId();
const currentUser = { id: deviceId, email: '' };

// ------------------------------------------------------------
// Profile — local-first
// ------------------------------------------------------------
function loadProfile() {
  try {
    const p = JSON.parse(window.cb.storage.get('cb_profile'));
    if (p && typeof p === 'object') return p;
  } catch (e) { /* corrupted profile, reset */ }
  return {
    full_name: 'Guest',
    avatar_url: '',
    health: {}
  };
}

let userProfile = loadProfile();

function saveProfileLocal() {
  window.cb.storage.set('cb_profile', JSON.stringify(userProfile));
}

function persistProfileCloud() {
  mantleWrite(`users/${deviceId}/profile`, { ...userProfile, device_id: deviceId })
    .catch(() => { /* offline is fine — local is source of truth */ });
}

// ------------------------------------------------------------
// Cloud-backed data store (scan history + health goals)
// ------------------------------------------------------------
function loadLocalList(key) {
  try { const list = JSON.parse(window.cb.storage.get(key)); return Array.isArray(list) ? list : []; }
  catch (_) { return []; }
}
let scanHistory = loadLocalList('cb_history');
let healthGoals = loadLocalList('cb_goals');

async function loadUserData() {
  try {
    const h = await mantleRead(`users/${deviceId}/history`);
    if (h && Array.isArray(h.scans)) {
      const ids = new Set(scanHistory.map(s => s.id));
      scanHistory = [...scanHistory, ...h.scans.filter(s => !ids.has(s.id))]
        .sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0,50);
      window.cb.storage.set('cb_history', JSON.stringify(scanHistory));
    }
  } catch (e) { /* no history yet */ }
  try {
    const g = await mantleRead(`users/${deviceId}/goals`);
    if (g && Array.isArray(g.goals) && window.cb.storage.get('cb_goals') === null) {
      healthGoals = g.goals;
      window.cb.storage.set('cb_goals', JSON.stringify(healthGoals));
    }
  } catch (e) { /* no goals yet */ }
  // Food diary: merge cloud copy into local (union by entry id)
  try {
    const d = await mantleRead(`users/${deviceId}/diary`);
    if (d && d.days && typeof d.days === 'object') {
      let local = { days: {} };
      try { local = JSON.parse(window.cb.storage.get('cb_diary')) || local; } catch (e) { /* reset */ }
      if (!local.days) local.days = {};
      local.deleted = [...new Set([...(local.deleted || []), ...(d.deleted || [])])];
      const deleted = new Set(local.deleted);
      let changed = false;
      Object.keys(d.days).forEach(dateKey => {
        const cloudEntries = ((d.days[dateKey] && d.days[dateKey].entries) || []).filter(e => !deleted.has(e.id));
        if (!local.days[dateKey]) {
          if (cloudEntries.length) { local.days[dateKey] = { entries: cloudEntries }; changed = true; }
          return;
        }
        const have = new Set(local.days[dateKey].entries.map(e => e.id));
        cloudEntries.forEach(e => {
          if (!have.has(e.id)) { local.days[dateKey].entries.push(e); changed = true; }
        });
      });
      Object.values(local.days).forEach(day => {
        const before = day.entries.length;
        day.entries = day.entries.filter(e => !deleted.has(e.id));
        if (before !== day.entries.length) changed = true;
      });
      if (changed) {
        window.cb.storage.set('cb_diary', JSON.stringify(local));
        window.dispatchEvent(new CustomEvent('cb-diary-loaded'));
      }
    }
  } catch (e) { /* no diary yet */ }
}

function persistHistory() {
  const slim = scanHistory.slice(0, 50);
  window.cb.storage.set('cb_history', JSON.stringify(slim));
  mantleWrite(`users/${deviceId}/history`, { scans: slim, updated_at: new Date().toISOString() })
    .catch((e) => console.warn('History sync failed:', e.message));
}

function persistGoals() {
  window.cb.storage.set('cb_goals', JSON.stringify(healthGoals));
  mantleWrite(`users/${deviceId}/goals`, { goals: healthGoals, updated_at: new Date().toISOString() })
    .catch((e) => console.warn('Goals sync failed:', e.message));
}

// Food diary cloud sync (called by diary.js)
window._mantleSyncDiary = function (diaryData) {
  return mantleWrite(`users/${deviceId}/diary`, { ...diaryData, updated_at: new Date().toISOString() })
    .catch((e) => console.warn('Diary sync failed:', e.message));
};

function makeId() {
  return (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// Data API consumed by script.js
window.store = {
  addScan(scan) {
    const entry = {
      id: makeId(),
      created_at: new Date().toISOString(),
      scan_type: scan.scan_type || 'food',
      scan_data: scan.scan_data || {}
    };
    scanHistory.unshift(entry);
    scanHistory = scanHistory.slice(0, 50);
    persistHistory();
    return entry;
  },
  getScans: () => scanHistory.slice(),
  getGoals: () => healthGoals.slice(),
  addGoal(goal) {
    const duplicate = healthGoals.some(
      (g) => g.goal_type === goal.goal_type && g.target === goal.target
    );
    if (duplicate) return { ok: false, duplicate: true };
    healthGoals.unshift({
      id: makeId(),
      created_at: new Date().toISOString(),
      progress: 0,
      ...goal
    });
    persistGoals();
    return { ok: true };
  },
  deleteGoal(id) {
    healthGoals = healthGoals.filter((g) => g.id !== id);
    persistGoals();
  },
  updateGoal(id, patch) {
    healthGoals = healthGoals.map((g) => (g.id === id ? { ...g, ...patch } : g));
    persistGoals();
  },
  trackStat(key) {
    mantleIncrement(`stats/app`, key).catch(() => { /* non-critical */ });
  }
};

// ------------------------------------------------------------
// UI helpers
// ------------------------------------------------------------
function bindDomRefs() {
  appContainer = document.getElementById('app-container');
  userProfileElem = document.getElementById('user-profile');
  userNameElem = document.getElementById('user-name');
  userAvatarElem = document.getElementById('user-avatar');
  userTierElem = document.getElementById('user-tier');
}

function updateUIForUser() {
  if (userNameElem) userNameElem.textContent = userProfile.full_name || 'Guest';
  if (userAvatarElem) {
    userAvatarElem.src = userProfile.avatar_url ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.full_name || 'Guest')}&background=random`;
  }
  if (userTierElem) userTierElem.textContent = 'Free';
  if (userProfileElem) userProfileElem.style.display = 'flex';
}

// No login anymore: go straight into the app.
async function checkAuth() {
  bindDomRefs();

  const landingPage = document.getElementById('landing-page');
  const authContainer = document.getElementById('auth-container');
  if (landingPage) landingPage.style.display = 'none';
  if (authContainer) authContainer.style.display = 'none';
  if (appContainer) appContainer.style.display = 'block';
  document.body.classList.remove('landing-mode');

  updateUIForUser();
  loadUserData(); // fire-and-forget cloud load
}

// Kept for backward compatibility with old call sites.
function showLandingPage() { checkAuth(); }

// ------------------------------------------------------------
// Scan limits (freemium) — local-first
// ------------------------------------------------------------
async function updateScansRemaining(scansUsed = 1) {
  // CalcuBite is ad-free: scans are unlimited. Kept for API compatibility.
  return true;
}

// ------------------------------------------------------------
// Profile update + modal
// ------------------------------------------------------------
async function updateProfile(profileData) {
  userProfile = { ...userProfile, ...profileData };
  saveProfileLocal();
  persistProfileCloud();
  updateUIForUser();
  window.dispatchEvent(new Event('cb-profile-updated'));
  return true;
}

function showProfileModal() {
  const profileModal = document.getElementById('profile-modal');
  if (!profileModal) {
    console.error('Profile modal element not found');
    return;
  }
  populateProfileModal();
  profileModal.style.display = 'block';
}

function populateProfileModal() {
  const nameInput = document.getElementById('profile-name');
  const avatarImg = document.getElementById('profile-avatar-img');

  if (!nameInput) {
    console.error('Essential profile elements not found');
    return;
  }

  nameInput.value = userProfile.full_name || '';

  if (avatarImg) {
    avatarImg.src = userProfile.avatar_url ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(nameInput.value || 'Guest')}&background=random`;
  }

  // Populate health profile fields
  const h = userProfile.health || {};
  const healthValues = {
    'health-age': h.age || '',
    'health-sex': h.sex || '',
    'health-height': h.heightCm || '',
    'health-weight': h.weightKg || '',
    'health-activity': h.activity || '',
    'health-goal': h.goal || '',
    'health-dietary': h.dietary || '',
    'health-conditions': h.conditions || ''
  };
  Object.keys(healthValues).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = healthValues[id];
  });

  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.onsubmit = async (e) => {
      e.preventDefault();
      const newName = nameInput.value.trim();
      const health = collectHealthForm();
      const success = await updateProfile({
        full_name: newName || userProfile.full_name,
        health
      });
      window.cbToast?.(success ? 'Profile saved' : 'Failed to save profile.');
    };
  }

  const changeAvatarBtn = document.getElementById('change-avatar');
  if (changeAvatarBtn) {
    changeAvatarBtn.onclick = () => {
      // No cloud file storage anymore — regenerate the avatar instead.
      const url = `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.full_name || 'Guest')}&background=random&size=128`;
      updateProfile({ avatar_url: url });
      if (avatarImg) avatarImg.src = url;
      if (userAvatarElem) userAvatarElem.src = url;
    };
  }
}

// Read the health profile form values
function collectHealthForm() {
  const get = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };
  return {
    age: get('health-age'),
    sex: get('health-sex'),
    heightCm: get('health-height'),
    weightKg: get('health-weight'),
    activity: get('health-activity'),
    goal: get('health-goal'),
    dietary: get('health-dietary'),
    conditions: get('health-conditions')
  };
}

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  bindDomRefs();
  checkAuth();

  const profileLink = document.getElementById('profile-link');
  if (profileLink) {
    profileLink.addEventListener('click', (e) => {
      e.preventDefault();
      showProfileModal();
    });
  }

  // Close modals when clicking outside
  window.addEventListener('click', (e) => {
    document.querySelectorAll('.modal').forEach((modal) => {
      if (e.target === modal) modal.style.display = 'none';
    });
  });

  // Close buttons in modals
  document.querySelectorAll('.close-modal').forEach((button) => {
    button.addEventListener('click', () => {
      const modal = button.closest('.modal');
      if (modal) modal.style.display = 'none';
    });
  });
});

// ------------------------------------------------------------
// Public API (same surface as before — consumed by script.js)
// ------------------------------------------------------------
window.auth = {
  checkAuth,
  updateScansRemaining,
  updateProfile,
  showProfileModal,
  currentUser: () => currentUser,
  userProfile: () => userProfile,
  getHealth: () => userProfile.health || {},
  readHealthForm: () => collectHealthForm(),
  isPremium: () => false
};
