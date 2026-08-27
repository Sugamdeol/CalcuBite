// ============================================================
// CalcuBite — no-login identity, limits & cloud storage
// ------------------------------------------------------------
// • No signup / no login: every visitor gets an anonymous
//   device identity stored in localStorage.
// • Profile + scan limits are local-first (localStorage).
// • Scan history, health goals and app stats are synced to
//   MantleDB (https://mantledb.sh) — free anonymous JSON store.
// • AI is provided by Puter.js (https://puter.com) — keyless.
// ============================================================

const MANTLE_BASE = 'https://mantledb.sh/v2';
const MANTLE_NS = 'calcubite';
// Write key for the claimed "calcubite" namespace. This is a
// client-side app, so the key is intentionally public; it only
// allows writing inside this namespace.
const MANTLE_KEY = '1d9900af5d44ffcdbd2a9cd7c6015428e1af5325ed8dbac23cded566acbb09c2';
const DAILY_FREE_SCANS = 5;

// DOM references (may be null until DOMContentLoaded)
let appContainer, userProfileElem, userNameElem, userAvatarElem, userTierElem, premiumNotification;

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
    scans_remaining: DAILY_FREE_SCANS,
    last_scan_reset: new Date().toISOString()
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
  premiumNotification = document.getElementById('premium-notification');
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
function adUnlimitedActive() {
  const t = localStorage.getItem('cb_last_ad');
  return !!t && (Date.now() - new Date(t).getTime()) < 24 * 60 * 60 * 1000;
}

async function updateScansRemaining(scansUsed = 1) {
  // Watching an ad unlocks scans for 24 hours
  if (adUnlimitedActive()) return true;

  if (typeof userProfile.scans_remaining !== 'number') {
    userProfile.scans_remaining = DAILY_FREE_SCANS;
  }

  if (userProfile.scans_remaining <= 0) {
    if (premiumNotification) premiumNotification.style.display = 'flex';
    return false;
  }

  userProfile.scans_remaining -= scansUsed;
  saveProfileLocal();
  persistProfileCloud();
  return true;
}

async function resetDailyScanCount() {
  const lastReset = new Date(userProfile.last_scan_reset || 0);
  const now = new Date();
  const dayDiff = Math.floor((now - lastReset) / (1000 * 60 * 60 * 24));

  if (dayDiff >= 1) {
    userProfile.scans_remaining = DAILY_FREE_SCANS;
    userProfile.last_scan_reset = now.toISOString();
    saveProfileLocal();
    persistProfileCloud();
  }
}

async function watchAd() {
  // Simulated ad reward: unlocks scanning for the next 24 hours.
  localStorage.setItem('cb_last_ad', new Date().toISOString());
  userProfile.scans_remaining = DAILY_FREE_SCANS;
  saveProfileLocal();
  persistProfileCloud();
  if (premiumNotification) premiumNotification.style.display = 'none';
  window.store.trackStat('ads_watched');
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
  const emailInput = document.getElementById('profile-email');
  const planInput = document.getElementById('profile-plan');
  const avatarImg = document.getElementById('profile-avatar-img');
  const freePlan = document.getElementById('free-plan');
  const proPlan = document.getElementById('pro-plan');
  const currentPlanBtn = document.getElementById('current-plan-btn');
  const upgradePlanBtn = document.getElementById('upgrade-plan-btn');

  if (!nameInput) {
    console.error('Essential profile elements not found');
    return;
  }

  nameInput.value = userProfile.full_name || '';
  if (emailInput) {
    emailInput.value = '';
    emailInput.placeholder = 'No account needed';
    emailInput.disabled = true;
  }
  if (planInput) planInput.value = 'Free';

  if (avatarImg) {
    avatarImg.src = userProfile.avatar_url ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(nameInput.value || 'Guest')}&background=random`;
  }

  if (freePlan) freePlan.classList.add('active-plan');
  if (proPlan) proPlan.classList.remove('active-plan');
  if (currentPlanBtn) currentPlanBtn.style.display = 'none';
  if (upgradePlanBtn) {
    upgradePlanBtn.style.display = 'block';
    upgradePlanBtn.textContent = 'Watch Ad Now';
    upgradePlanBtn.disabled = false;
  }

  const adRewardDesc = document.querySelector('.ad-setting-item:nth-child(2) p');
  if (adRewardDesc) {
    adRewardDesc.textContent = 'Watching an ad unlocks unlimited scans for 24 hours.';
  }

  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.onsubmit = async (e) => {
      e.preventDefault();
      const newName = nameInput.value.trim();
      if (newName && newName !== userProfile.full_name) {
        const success = await updateProfile({ full_name: newName });
        alert(success ? 'Profile updated successfully!' : 'Failed to update profile.');
      }
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

  if (upgradePlanBtn) {
    upgradePlanBtn.onclick = () => watchAd();
  }
}

function showUpgradeModal() {
  watchAd();
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

  const watchAdButton = document.getElementById('watch-ad-button');
  if (watchAdButton) {
    watchAdButton.addEventListener('click', () => watchAd());
  }

  const watchAdNow = document.getElementById('watch-ad-now');
  if (watchAdNow) {
    watchAdNow.addEventListener('click', () => watchAd());
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
  resetDailyScanCount,
  watchAd,
  updateProfile,
  showProfileModal,
  showUpgradeModal,
  currentUser: () => currentUser,
  userProfile: () => userProfile,
  isPremium: () => false,
  lastAdWatched: () => localStorage.getItem('cb_last_ad')
};
