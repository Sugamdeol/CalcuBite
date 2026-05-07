// NutriScan AI - Core Logic
const API_KEY = 'sk_ZDnV9hilntSLCLGEmJKPxavBNJaPLI4K';
const POLLINATIONS_BASE = 'https://gen.pollinations.ai/v1/chat/completions';

// DOM Elements
const sections = {
    auth: document.getElementById('auth-section'),
    onboarding: document.getElementById('onboarding-section'),
    dashboard: document.getElementById('dashboard-section'),
    scan: document.getElementById('scan-section'),
    history: document.getElementById('history-section')
};

const nav = document.getElementById('main-nav');
const loading = document.getElementById('loading-overlay');

let currentUser = null;
let userProfile = null;
let chartInstance = null;
let lastAnalysis = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    initAuthListeners();
    initNavListeners();
    initScanListeners();
    
    try {
        currentUser = await window.auth.getCurrentUser();
        if (currentUser) {
            await loadApp();
        } else {
            showSection('auth');
        }
    } catch (e) {
        console.error("Initialization error:", e);
        showSection('auth');
    }
});

function showSection(name) {
    Object.values(sections).forEach(s => s.classList.add('hidden'));
    sections[name].classList.remove('hidden');
    if (currentUser) {
        nav.classList.remove('hidden');
    } else {
        nav.classList.add('hidden');
    }
}

// Auth Handlers
function initAuthListeners() {
    const signupBtn = document.getElementById('show-signup');
    const loginBtn = document.getElementById('show-login');

    if (signupBtn) signupBtn.onclick = () => {
        document.getElementById('login-card').classList.add('hidden');
        document.getElementById('signup-card').classList.remove('hidden');
    };
    if (loginBtn) loginBtn.onclick = () => {
        document.getElementById('signup-card').classList.add('hidden');
        document.getElementById('login-card').classList.remove('hidden');
    };

    document.getElementById('login-submit').onclick = async () => {
        const u = document.getElementById('login-username').value;
        const p = document.getElementById('login-password').value;
        if (!u || !p) return alert("Please enter username and password");
        try {
            await window.auth.login(u, p);
            window.location.reload();
        } catch (e) { console.error(e); alert("Error: " + e.message); }
    };

    document.getElementById('signup-submit').onclick = async () => {
        const u = document.getElementById('signup-username').value;
        const f = document.getElementById('signup-fullname').value;
        const p = document.getElementById('signup-password').value;
        if (!u || !f || !p) return alert("Please fill all fields");
        try {
            await window.auth.signup(u, f, p);
            alert('Signup successful! Please login.');
            window.location.reload();
        } catch (e) { console.error(e); alert("Error: " + e.message); }
    };

    document.getElementById('logout-btn').onclick = (e) => {
        e.preventDefault();
        window.auth.logout();
    };
}

// App Loading
async function loadApp() {
    userProfile = await window.auth.getProfile(currentUser.id);

    if (!userProfile || !userProfile.gender) {
        showSection('onboarding');
        initOnboarding();
    } else {
        showSection('dashboard');
        await refreshDashboard();
    }
}

function initOnboarding() {
    document.getElementById('onboarding-form').onsubmit = async (e) => {
        e.preventDefault();
        loading.style.display = 'block';
        
        const profile = {
            gender: document.getElementById('user-gender').value,
            age: parseInt(document.getElementById('user-age').value),
            weight: parseFloat(document.getElementById('user-weight').value),
            height: parseFloat(document.getElementById('user-height').value),
            activity_level: document.getElementById('user-activity').value,
            health_conditions: document.getElementById('user-conditions').value.split(',').map(s => s.trim()).filter(s => s)
        };

        // Get AI to set limits
        const limits = await getAILimits(profile);
        profile.daily_limits = limits;

        try {
            await window.auth.updateProfile(currentUser.id, profile);
            userProfile = { ...userProfile, ...profile };
            loading.style.display = 'none';
            showSection('dashboard');
            refreshDashboard();
        } catch (err) {
            console.error(err);
            alert("Failed to save profile. Try again.");
            loading.style.display = 'none';
        }
    };
}

async function getAILimits(profile) {
    const prompt = `Based on this profile: Gender: ${profile.gender}, Age: ${profile.age}, Weight: ${profile.weight}kg, Height: ${profile.height}cm, Activity: ${profile.activity_level}, Conditions: ${profile.health_conditions.join(', ') || 'None'}. Set daily nutritional limits. Return ONLY a JSON object: {"calories": number, "sugar": number, "protein": number, "carbs": number, "fats": number, "sodium": number, "fiber": number}`;

    try {
        const res = await fetch(POLLINATIONS_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
            body: JSON.stringify({
                model: 'openai-large',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' }
            })
        });
        const data = await res.json();
        return JSON.parse(data.choices[0].message.content);
    } catch (e) {
        console.error(e);
        return { calories: 2000, sugar: 50, protein: 50, carbs: 250, fats: 70, sodium: 2300, fiber: 25 };
    }
}

// Nav
function initNavListeners() {
    document.getElementById('nav-dashboard').onclick = (e) => { e.preventDefault(); showSection('dashboard'); refreshDashboard(); };
    document.getElementById('nav-scan').onclick = (e) => { e.preventDefault(); showSection('scan'); };
    document.getElementById('nav-history').onclick = (e) => { e.preventDefault(); showSection('history'); loadHistory(); };
    document.getElementById('nav-profile').onclick = (e) => { e.preventDefault(); alert('Profile settings coming soon!'); };
}

// Dashboard
async function refreshDashboard() {
    const today = new Date().toISOString().split('T')[0];
    const { data: log } = await window.sb.from('daily_logs').select('*').eq('user_id', currentUser.id).eq('log_date', today).maybeSingle();

    const limits = userProfile.daily_limits || { calories: 2000, sugar: 50 };
    const current = log || { calories: 0, sugar: 0 };

    document.getElementById('dash-calories').textContent = `${Math.round(current.calories)} / ${limits.calories}`;
    document.getElementById('dash-sugar').textContent = `${Math.round(current.sugar)}g / ${limits.sugar}g`;

    const calPercent = Math.min((current.calories / limits.calories) * 100, 100);
    const sugarPercent = Math.min((current.sugar / limits.sugar) * 100, 100);

    document.getElementById('bar-calories').style.width = `${calPercent}%`;
    document.getElementById('bar-sugar').style.width = `${sugarPercent}%`;

    initWeeklyChart();
}

async function initWeeklyChart() {
    const canvas = document.getElementById('weeklyChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (chartInstance) chartInstance.destroy();

    const { data: logs } = await window.sb.from('daily_logs')
        .select('log_date, calories')
        .eq('user_id', currentUser.id)
        .order('log_date', { ascending: false })
        .limit(7);

    if (!logs || logs.length === 0) return;

    const labels = logs.map(l => l.log_date).reverse();
    const values = logs.map(l => l.calories).reverse();

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Calories',
                data: values,
                backgroundColor: '#3366FF',
                borderColor: '#000000',
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: '#000', lineWidth: 1 } },
                x: { grid: { display: false } }
            },
            plugins: {
                legend: { labels: { font: { weight: 'bold', family: 'Public Sans' } } }
            }
        }
    });
}

// Scan Logic
function initScanListeners() {
    const video = document.getElementById('video');
    const captureBtn = document.getElementById('capture-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('file-input');

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
            video.srcObject = stream;
        }).catch(err => {
            console.warn("Camera access denied or unavailable:", err);
        });
    }

    captureBtn.onclick = () => {
        const canvas = document.getElementById('canvas');
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        context.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg');
        analyzeFood(imageData);
    };

    uploadBtn.onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => analyzeFood(event.target.result);
        reader.readAsDataURL(file);
    };

    document.getElementById('log-meal-btn').onclick = logMeal;
}

async function analyzeFood(base64Image) {
    loading.style.display = 'block';

    const prompt = `Analyze this food image. Provide nutritional information for the estimated portion size. Return ONLY a JSON object: {"food_name": "string", "calories": number, "sugar": number, "protein": number, "carbs": number, "fats": number, "sodium": number, "fiber": number, "health_rating": "A-F", "reasoning": "string"}`;

    try {
        const res = await fetch(POLLINATIONS_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
            body: JSON.stringify({
                model: 'openai-large',
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: base64Image } }
                    ]
                }],
                response_format: { type: 'json_object' }
            })
        });
        const data = await res.json();
        lastAnalysis = JSON.parse(data.choices[0].message.content);
        displayResults(lastAnalysis);
    } catch (e) {
        alert('AI analysis failed. Please try again.');
        console.error(e);
    } finally {
        loading.style.display = 'none';
    }
}

function displayResults(data) {
    const content = document.getElementById('analysis-content');
    content.innerHTML = `
        <div class="stat-value">${data.food_name}</div>
        <div class="dashboard-grid" style="grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));">
            <div class="card stat-card" style="box-shadow: 4px 4px 0px #000; padding: 1rem; margin-bottom: 0;">
                <div class="stat-label">Cals</div>
                <div class="stat-value" style="font-size: 1.5rem;">${data.calories}</div>
            </div>
            <div class="card stat-card" style="box-shadow: 4px 4px 0px #000; padding: 1rem; margin-bottom: 0;">
                <div class="stat-label">Sugar</div>
                <div class="stat-value" style="font-size: 1.5rem;">${data.sugar}g</div>
            </div>
            <div class="card stat-card" style="box-shadow: 4px 4px 0px #000; padding: 1rem; margin-bottom: 0;">
                <div class="stat-label">Rating</div>
                <div class="stat-value" style="font-size: 1.5rem;">${data.health_rating}</div>
            </div>
        </div>
        <p class="mt-2"><strong>Why:</strong> ${data.reasoning}</p>
    `;
    document.getElementById('scan-results').classList.remove('hidden');
}

async function logMeal() {
    if (!lastAnalysis) return;
    loading.style.display = 'block';

    try {
        // Save to history
        await window.sb.from('scan_history').insert({
            user_id: currentUser.id,
            food_name: lastAnalysis.food_name,
            nutrition_data: lastAnalysis
        });

        // Update daily logs
        const today = new Date().toISOString().split('T')[0];
        const { data: existing } = await window.sb.from('daily_logs').select('*').eq('user_id', currentUser.id).eq('log_date', today).maybeSingle();

        if (existing) {
            await window.sb.from('daily_logs').update({
                calories: existing.calories + lastAnalysis.calories,
                sugar: existing.sugar + lastAnalysis.sugar,
                protein: existing.protein + (lastAnalysis.protein || 0),
                carbs: existing.carbs + (lastAnalysis.carbs || 0),
                fats: existing.fats + (lastAnalysis.fats || 0),
                sodium: existing.sodium + (lastAnalysis.sodium || 0),
                fiber: existing.fiber + (lastAnalysis.fiber || 0),
                logged_items: [...existing.logged_items, lastAnalysis.food_name]
            }).eq('id', existing.id);
        } else {
            await window.sb.from('daily_logs').insert({
                user_id: currentUser.id,
                log_date: today,
                calories: lastAnalysis.calories,
                sugar: lastAnalysis.sugar,
                protein: lastAnalysis.protein || 0,
                carbs: lastAnalysis.carbs || 0,
                fats: lastAnalysis.fats || 0,
                sodium: lastAnalysis.sodium || 0,
                fiber: lastAnalysis.fiber || 0,
                logged_items: [lastAnalysis.food_name]
            });
        }

        alert('Meal logged successfully!');
        showSection('dashboard');
        refreshDashboard();
    } catch (e) {
        alert('Failed to log meal.');
        console.error(e);
    } finally {
        loading.style.display = 'none';
    }
}

async function loadHistory() {
    const { data: items } = await window.sb.from('scan_history')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(50);

    const container = document.getElementById('history-list');
    if (!items || items.length === 0) {
        container.innerHTML = '<p class="text-center">No meals logged yet.</p>';
        return;
    }
    container.innerHTML = items.map(item => `
        <div class="history-item">
            <div>
                <strong>${item.food_name}</strong><br>
                <small>${new Date(item.created_at).toLocaleDateString()} ${new Date(item.created_at).toLocaleTimeString()}</small>
            </div>
            <div class="stat-label">${item.nutrition_data.calories} kcal</div>
        </div>
    `).join('');
}
