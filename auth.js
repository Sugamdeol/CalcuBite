// ============================================================
// CalcuBite — no-login identity & cloud storage
// ------------------------------------------------------------
// • No signup / no login: every visitor gets an anonymous
//   device identity stored in localStorage.
// • Profile is local-first (localStorage). Scans are unlimited — no ads.
// • Scan history, health goals and app stats are synced to
//   MantleDB (https://mantledb.sh) — free anonymous JSON store.
// • AI is provided by Pollinations.ai (https://pollinations.ai) — free, keyless.
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
  const res = await fetch(`${MANTLE_BASE}/${path}`, {
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
  let id = localStorage.getItem('cb_device_id');
  if (!id) {
    id = (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('cb_device_id', id);
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
    const p = JSON.parse(localStorage.getItem('cb_profile'));
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
  localStorage.setItem('cb_profile', JSON.stringify(userProfile));
}

function persistProfileCloud() {
  mantleWrite(`users/${deviceId}/profile`, { ...userProfile, device_id: deviceId })
    .catch(() => { /* offline is fine — local is source of truth */ });
}

// ------------------------------------------------------------
// Cloud-backed data store (scan history + health goals)
// ------------------------------------------------------------
let scanHistory = [];
let healthGoals = [];

async function loadUserData() {
  try {
    const h = await mantleRead(`users/${deviceId}/history`);
    if (h && Array.isArray(h.scans)) scanHistory = h.scans;
  } catch (e) { /* no history yet */ }
  try {
    const g = await mantleRead(`users/${deviceId}/goals`);
    if (g && Array.isArray(g.goals)) healthGoals = g.goals;
  } catch (e) { /* no goals yet */ }
}

function persistHistory() {
  const slim = scanHistory.slice(0, 50);
  mantleWrite(`users/${deviceId}/history`, { scans: slim, updated_at: new Date().toISOString() })
    .catch((e) => console.warn('History sync failed:', e.message));
}

function persistGoals() {
  mantleWrite(`users/${deviceId}/goals`, { goals: healthGoals, updated_at: new Date().toISOString() })
    .catch((e) => console.warn('Goals sync failed:', e.message));
}

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
      alert(success ? 'Profile saved!' : 'Failed to save profile.');
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
