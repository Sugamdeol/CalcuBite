// Supabase initialization for CalcuBite AI
const supabaseUrl = 'https://msooyauwfmzfrvsdzxhn.supabase.co';
const supabaseKey = 'sb_publishable_Mmk7EBnekxE4treg8XKHZg_ld7NGC5M';
const sb = window.supabase.createClient(supabaseUrl, supabaseKey);

// Global user state
let currentUser = null;
let userProfile = null;

// DOM elements
let authContainer, appContainer, loginTemplate, registerTemplate;
let userNameElem, userAvatarElem, adminLinkElem;

const usernameToEmail = (username) => `${username.trim().toLowerCase()}@nutriscanai-internal.com`;

function extractJSON(text) {
  try {
    const s = text.indexOf('{'), e = text.lastIndexOf('}');
    if (s !== -1 && e !== -1) return JSON.parse(text.substring(s, e + 1));
    return JSON.parse(text);
  } catch (e) { return {}; }
}
window.extractJSON = extractJSON;

document.addEventListener('DOMContentLoaded', () => {
    authContainer = document.getElementById('auth-container');
    appContainer = document.getElementById('app-container');
    loginTemplate = document.getElementById('login-template');
    registerTemplate = document.getElementById('register-template');
    userNameElem = document.getElementById('user-name');
    userAvatarElem = document.getElementById('user-avatar');
    adminLinkElem = document.getElementById('admin-link');

    checkAuth();

    document.getElementById('logout-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
    });

    document.getElementById('profile-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        showProfileModal();
    });
});

async function checkAuth() {
  const { data } = await sb.auth.getSession();
  if (data?.session) {
    currentUser = data.session.user;
    await fetchUserProfile();
    updateUIForUser();
    return true;
  }
  showLandingPage();
  return false;
}

async function fetchUserProfile() {
  if (!currentUser) return;
  const { data, error } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
  if (error && error.code === 'PGRST116') {
      await createUserProfile();
  } else {
      userProfile = data;
  }
}

async function createUserProfile() {
  if (!currentUser) return null;
  const { data } = await sb.from('profiles').insert([{
      id: currentUser.id,
      full_name: currentUser.user_metadata?.full_name || 'User',
      email: currentUser.email,
      nutritional_goals: { calories: 2000, protein: 50, carbs: 275, fat: 78, sugar: 50, sodium: 2300 }
  }]).select().single();
  userProfile = data;
  return data;
}

function updateUIForUser() {
  const lp = document.getElementById('landing-page');
  if (lp) lp.style.display = 'none';
  document.body.classList.remove('landing-mode');
  if (authContainer) authContainer.style.display = 'none';
  if (appContainer) appContainer.style.display = 'block';
  
  if (userNameElem) userNameElem.textContent = userProfile?.full_name || currentUser.email.split('@')[0];
  if (userAvatarElem) userAvatarElem.src = userProfile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userNameElem.textContent)}&background=random`;
  if (adminLinkElem) adminLinkElem.style.display = userProfile?.is_admin ? 'flex' : 'none';
}

function showLandingPage() {
  const lp = document.getElementById('landing-page');
  if (lp) {
    lp.style.display = 'block';
    if (appContainer) appContainer.style.display = 'none';
    if (authContainer) authContainer.style.display = 'none';
    document.body.classList.add('landing-mode');
  } else {
    showLoginForm();
  }
}

function showLoginForm() {
  if (!authContainer) return;
  authContainer.style.display = 'flex';
  if (appContainer) appContainer.style.display = 'none';
  authContainer.innerHTML = '';
  authContainer.appendChild(document.importNode(loginTemplate.content, true));
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('register-link').addEventListener('click', showRegisterForm);
}

function showRegisterForm(e) {
  e?.preventDefault();
  if (!authContainer) return;
  authContainer.style.display = 'flex';
  authContainer.innerHTML = '';
  authContainer.appendChild(document.importNode(registerTemplate.content, true));
  document.getElementById('register-form').addEventListener('submit', handleRegister);
  document.getElementById('login-link').addEventListener('click', showLoginForm);
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email: usernameToEmail(username), password });
    if (error) throw error;
    currentUser = data.user;
    await fetchUserProfile();
    updateUIForUser();
  } catch (err) {
    const errEl = document.getElementById('login-error');
    if (errEl) { errEl.style.display = 'block'; errEl.textContent = err.message; }
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('register-username').value;
  const password = document.getElementById('register-password').value;
  const terms = document.getElementById('terms-agree').checked;
  if (!terms) { alert('Please agree to terms.'); return; }
  const email = usernameToEmail(username);
  try {
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: username } } });
    if (error) throw error;
    if (data.session) {
      currentUser = data.user; await fetchUserProfile(); updateUIForUser();
    } else {
      const loginRes = await sb.auth.signInWithPassword({ email, password });
      if (!loginRes.error) {
        currentUser = loginRes.data.user; await fetchUserProfile(); updateUIForUser();
      } else {
        alert('Success! Please login.'); showLoginForm();
      }
    }
  } catch (err) { alert(err.message); }
}

async function handleLogout() {
  await sb.auth.signOut();
  currentUser = null; userProfile = null;
  showLandingPage();
}

async function updateProfile(data) {
  if (!currentUser) return false;
  const { error } = await sb.from('profiles').update(data).eq('id', currentUser.id);
  if (error) return false;
  userProfile = { ...userProfile, ...data };
  updateUIForUser();
  return true;
}

function showProfileModal() {
  const modal = document.getElementById('profile-modal');
  if (!modal) return;
  if (userProfile) {
    document.getElementById('profile-name').value = userProfile.full_name || '';
    document.getElementById('profile-form').onsubmit = async (e) => {
      e.preventDefault();
      const updateData = {
        full_name: document.getElementById('profile-name').value.trim(),
        gender: document.getElementById('profile-gender')?.value,
        age: parseInt(document.getElementById('profile-age')?.value),
        weight_kg: parseFloat(document.getElementById('profile-weight')?.value),
        height_cm: parseFloat(document.getElementById('profile-height')?.value)
      };
      if (await updateProfile(updateData)) alert('Profile updated!');
    };
  }
  modal.style.display = 'block';
}

async function calculateNutritionalGoals(profile) {
    const prompt = `Based on profile: Gender ${profile.gender}, Age ${profile.age}, Weight ${profile.weight_kg}kg. Respond ONLY with JSON: calories, protein, carbs, fat, sugar, sodium.`;
    const response = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer sk_ZDnV9hilntSLCLGEmJKPxavBNJaPLI4K' },
        body: JSON.stringify({ model: 'claude-fast', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } })
    });
    const data = await response.json();
    return extractJSON(data.choices[0].message.content);
}

window.auth = {
  currentUser: () => currentUser,
  userProfile: () => userProfile,
  updateProfile,
  calculateNutritionalGoals,
  updateScansRemaining: async () => true,
  getNutritionalGoals: () => userProfile?.nutritional_goals || { calories: 2000, protein: 50, carbs: 275, fat: 78, sugar: 50, sodium: 2300 }
};

window.showRegisterForm = showRegisterForm;
window.showLoginForm = showLoginForm;
window.showProfileModal = showProfileModal;
window.sb = sb;
