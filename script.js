// Global variables
let currentMode = 'label';
let conversationHistory = [];
let analysisData = null;
let isCameraOn = false;
let stream = null;
let userDashboardData = null;
let charts = {
    nutrition: null,
    macro: null
};

// DOM elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('capture');
const retakeBtn = document.getElementById('retake');
const errorDiv = document.getElementById('error');
const loadingDiv = document.getElementById('loading');
const resultsDiv = document.getElementById('results');
const fileInput = document.getElementById('fileInput');
const toggleCameraBtn = document.getElementById('toggleCamera');
const cameraContainer = document.querySelector('.camera-container');
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const macroSection = document.getElementById('macronutrient-section');

// Event Listeners for Landing Page and UI
document.addEventListener('DOMContentLoaded', () => {
  const signupBtns = ['landing-signup-btn', 'hero-signup-btn', 'cta-signup-btn'];
  signupBtns.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.onclick = () => window.showRegisterForm();
  });
  const loginBtn = document.getElementById('landing-login-btn');
  if (loginBtn) loginBtn.onclick = () => window.showLoginForm();

  const dashLink = document.getElementById('dashboard-link');
  if (dashLink) dashLink.onclick = (e) => { e.preventDefault(); showDashboard(); };

  const aiSubmit = document.getElementById('ai-submit-button');
  if (aiSubmit) aiSubmit.onclick = submitAIQuestion;

  document.getElementById('labelMode')?.addEventListener('click', () => setMode('label'));
  document.getElementById('foodMode')?.addEventListener('click', () => setMode('food'));
  document.getElementById('gymMode')?.addEventListener('click', () => setMode('gym'));

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      button.classList.add('active');
      const tabId = `${button.dataset.tab}-tab`;
      document.getElementById(tabId)?.classList.add('active');
    });
  });

  document.getElementById('log-meal-button')?.addEventListener('click', logMeal);
});

function setMode(mode) {
  currentMode = mode;
  ['labelMode', 'foodMode', 'gymMode'].forEach(id => document.getElementById(id)?.classList.remove('active'));
  document.getElementById(mode + 'Mode')?.classList.add('active');
  if (macroSection) macroSection.style.display = (mode === 'label' ? 'none' : 'block');
}

// Camera logic
async function initCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream;
    captureBtn.style.display = 'block';
    retakeBtn.style.display = 'none';
    video.style.display = 'block';
    canvas.style.display = 'none';
  } catch (err) {
    errorDiv.textContent = 'Camera error: ' + err.message;
    errorDiv.style.display = 'block';
  }
}

toggleCameraBtn?.addEventListener('click', async () => {
  if (!isCameraOn) {
    cameraContainer.style.display = 'block';
    await initCamera();
    isCameraOn = true;
    toggleCameraBtn.innerHTML = '<i class="fas fa-camera-slash"></i><span>Turn Off Camera</span>';
  } else {
    if (stream) stream.getTracks().forEach(t => t.stop());
    video.srcObject = null;
    cameraContainer.style.display = 'none';
    isCameraOn = false;
    toggleCameraBtn.innerHTML = '<i class="fas fa-camera"></i><span>Turn On Camera</span>';
  }
});

captureBtn?.addEventListener('click', async () => {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  video.style.display = 'none';
  canvas.style.display = 'block';
  captureBtn.style.display = 'none';
  retakeBtn.style.display = 'block';
  const base64 = canvas.toDataURL('image/jpeg').split(',')[1];
  loadingDiv.style.display = 'block';
  await analyzeImage(base64);
});

async function analyzeImage(base64Image) {
  try {
    await window.auth.updateScansRemaining(1);
    const prompt = `Analyze this food image (${currentMode} mode).
    Respond ONLY with a JSON structure:
    {
      "rating": number (1-10),
      "explanation": "short summary",
      "nutritionEstimate": {
        "calories": number,
        "protein": number,
        "carbs": number,
        "fat": number,
        "sugar": number,
        "sodium": number
      },
      "foodIdentification": { "mainItems": ["item1", "item2"] },
      "ingredients": [
        {"name": "ingredient", "healthImpact": "positive|negative|neutral", "description": "why"}
      ],
      "insights": ["insight1", "insight2"],
      "alternatives": [
        {"name": "alt1", "reason": "why it is better"}
      ]
    }`;

    const res = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer sk_ZDnV9hilntSLCLGEmJKPxavBNJaPLI4K' },
      body: JSON.stringify({
        model: "claude-fast",
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }] }],
        response_format: { type: "json_object" }
      })
    });
    const data = await res.json();
    analysisData = window.extractJSON(data.choices[0].message.content);
    displayResults(analysisData);

    if (window.auth.currentUser()) {
      await window.sb.from('scan_history').insert([{
          user_id: window.auth.currentUser().id,
          scan_type: currentMode,
          scan_data: analysisData
      }]);
    }
  } catch (e) {
    errorDiv.textContent = e.message;
    errorDiv.style.display = 'block';
  }
  loadingDiv.style.display = 'none';
}

function displayResults(data) {
  resultsDiv.style.display = 'block';
  document.getElementById('healthScore').innerHTML = `
    <div class="score-container">
        <div class="score-circle">
            <span class="score-value">${data.rating || 0}</span>
        </div>
        <div class="score-info">
            <h3>Health Score</h3>
            <p>${data.explanation || 'No explanation provided.'}</p>
        </div>
    </div>
  `;

  const n = data.nutritionEstimate || {};
  document.getElementById('nutritionBreakdown').innerHTML = `
    <div class="nutrition-item"><small>Calories</small><div>${n.calories || 0} kcal</div></div>
    <div class="nutrition-item"><small>Protein</small><div>${n.protein || 0}g</div></div>
    <div class="nutrition-item"><small>Carbs</small><div>${n.carbs || 0}g</div></div>
    <div class="nutrition-item"><small>Fat</small><div>${n.fat || 0}g</div></div>
    <div class="nutrition-item"><small>Sugar</small><div>${n.sugar || 0}g</div></div>
    <div class="nutrition-item"><small>Sodium</small><div>${n.sodium || 0}mg</div></div>
  `;

  // Ingredients
  const ingredientsList = document.getElementById('ingredients');
  if (ingredientsList && data.ingredients) {
      ingredientsList.innerHTML = data.ingredients.map(i => `
        <div class="ingredient-card ${i.healthImpact}">
            <div class="ingredient-header">
                <strong>${i.name}</strong>
                <span class="impact-badge">${i.healthImpact}</span>
            </div>
            <p>${i.description}</p>
        </div>
      `).join('');
  }

  // Insights
  const insightsList = document.getElementById('insights');
  if (insightsList && data.insights) {
      insightsList.innerHTML = `<ul>${data.insights.map(i => `<li>${i}</li>`).join('')}</ul>`;
  }

  // Alternatives
  const alternativesList = document.getElementById('alternatives');
  if (alternativesList && data.alternatives) {
      alternativesList.innerHTML = data.alternatives.map(a => `
        <div class="alternative-card">
            <h4>${a.name}</h4>
            <p>${a.reason}</p>
        </div>
      `).join('');
  }

  updateCharts(n);
  resultsDiv.scrollIntoView({ behavior: 'smooth' });
}

function updateCharts(n) {
    const ctx1 = document.getElementById('nutritionChart').getContext('2d');
    const ctx2 = document.getElementById('macronutrientChart').getContext('2d');

    const goals = window.auth.getNutritionalGoals();

    if (charts.nutrition) charts.nutrition.destroy();
    charts.nutrition = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: ['Calories', 'Sugar', 'Sodium'],
            datasets: [{
                label: 'In this meal',
                data: [n.calories || 0, n.sugar || 0, n.sodium || 0],
                backgroundColor: 'rgba(79, 70, 229, 0.6)'
            }, {
                label: 'Daily Goal',
                data: [goals.calories, goals.sugar, goals.sodium],
                backgroundColor: 'rgba(200, 200, 200, 0.4)'
            }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });

    if (charts.macro) charts.macro.destroy();
    charts.macro = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: ['Protein', 'Carbs', 'Fat'],
            datasets: [{
                data: [n.protein || 0, n.carbs || 0, n.fat || 0],
                backgroundColor: ['#10b981', '#3b82f6', '#f59e0b']
            }]
        },
        options: { responsive: true }
    });
}

async function logMeal() {
    if (!analysisData || !window.auth.currentUser()) return;
    const btn = document.getElementById('log-meal-button');
    btn.disabled = true;
    btn.textContent = 'Logging...';

    try {
        const { error } = await window.sb.from('meal_logs').insert([{
            user_id: window.auth.currentUser().id,
            meal_data: analysisData,
            calories: analysisData.nutritionEstimate?.calories || 0
        }]);
        if (error) throw error;

        document.getElementById('log-success-alert').style.display = 'block';
        setTimeout(() => { document.getElementById('log-success-alert').style.display = 'none'; }, 3000);
    } catch (e) { alert('Failed to log meal: ' + e.message); }

    btn.disabled = false;
    btn.textContent = 'Log This Meal';
}

async function submitAIQuestion() {
  const input = document.getElementById('ai-question-input');
  const chat = document.getElementById('ai-chat-container');
  if (!input.value.trim()) return;
  chat.innerHTML += `<div class="user-msg">User: ${input.value}</div>`;
  const q = input.value;
  input.value = '';
  try {
    const res = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer sk_ZDnV9hilntSLCLGEmJKPxavBNJaPLI4K' },
      body: JSON.stringify({ model: "claude-fast", messages: [{ role: "user", content: q }] })
    });
    const data = await res.json();
    chat.innerHTML += `<div class="ai-msg">AI: ${data.choices[0].message.content}</div>`;
    chat.scrollTop = chat.scrollHeight;
  } catch (e) { chat.innerHTML += `<div class="error-msg">Error: ${e.message}</div>`; }
}

// Dashboard Logic
async function showDashboard() {
  let modal = document.getElementById('dashboard-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'dashboard-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header"><h2>Your Health Dashboard</h2><span class="close-modal">&times;</span></div>
        <div class="modal-body">
          <div id="today-intake" style="background: #4f46e5; color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3>Daily Calorie Target: <span id="today-calories-target">2000</span></h3>
          </div>
          <h3>Personal Profile</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
            <input type="text" id="dash-gender" placeholder="Gender (male/female)">
            <input type="number" id="dash-age" placeholder="Age">
            <input type="number" id="dash-weight" placeholder="Weight (kg)">
            <input type="number" id="dash-height" placeholder="Height (cm)">
          </div>
          <div style="display: flex; gap: 10px; margin-bottom: 20px;">
            <button id="dash-save" class="primary-button" style="flex:1">Save Profile</button>
            <button id="dash-gen" class="secondary-button" style="flex:1; background: #7c3aed; color: white;">Generate AI Targets</button>
          </div>
          <div id="dash-status" style="margin-bottom: 15px; color: #4f46e5; font-weight: 500; display:none;"></div>
          <h3>Recent Activity</h3>
          <div id="recent-scans-list" style="max-height: 200px; overflow-y: auto;"></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('.close-modal').onclick = () => modal.style.display = 'none';

    document.getElementById('dash-save').onclick = async () => {
        const d = {
            gender: document.getElementById('dash-gender').value,
            age: parseInt(document.getElementById('dash-age').value),
            weight_kg: parseFloat(document.getElementById('dash-weight').value),
            height_cm: parseFloat(document.getElementById('dash-height').value)
        };
        if (await window.auth.updateProfile(d)) alert('Profile updated!');
    };
    
    document.getElementById('dash-gen').onclick = async () => {
        const statusEl = document.getElementById('dash-status');
        const d = {
            gender: document.getElementById('dash-gender').value,
            age: parseInt(document.getElementById('dash-age').value),
            weight_kg: parseFloat(document.getElementById('dash-weight').value),
            height_cm: parseFloat(document.getElementById('dash-height').value)
        };
        if (!d.gender || !d.age || !d.weight_kg) { alert('Please fill in your profile first.'); return; }

        statusEl.style.display = 'block';
        statusEl.textContent = 'AI is calculating your targets...';
        try {
            const goals = await window.auth.calculateNutritionalGoals(d);
            if (await window.auth.updateProfile({ nutritional_goals: goals })) {
                alert('AI Targets updated!');
                populateDashboardUI();
            }
        } catch (e) { alert('AI Error: ' + e.message); }
        statusEl.style.display = 'none';
    };
  }

  await populateDashboardUI();
  modal.style.display = 'block';
}

async function populateDashboardUI() {
    const profile = window.auth.userProfile();
    if (profile) {
        document.getElementById('dash-gender').value = profile.gender || '';
        document.getElementById('dash-age').value = profile.age || '';
        document.getElementById('dash-weight').value = profile.weight_kg || '';
        document.getElementById('dash-height').value = profile.height_cm || '';

        const goals = window.auth.getNutritionalGoals();
        document.getElementById('today-calories-target').textContent = goals.calories || '2000';
    }

    // Fetch recent scans
    if (window.auth.currentUser()) {
        const { data } = await window.sb.from('scan_history')
            .select('*')
            .eq('user_id', window.auth.currentUser().id)
            .order('created_at', { ascending: false })
            .limit(5);
        
        const list = document.getElementById('recent-scans-list');
        if (list && data) {
            list.innerHTML = data.map(s => `
                <div style="padding: 10px; border-bottom: 1px solid #eee;">
                    <strong>${s.scan_type.toUpperCase()}</strong>: ${s.scan_data.rating}/10
                    <div style="font-size: 0.8rem; color: #666;">${new Date(s.created_at).toLocaleDateString()}</div>
                </div>
            `).join('');
            if (data.length === 0) list.innerHTML = '<p>No recent scans found.</p>';
        }
    }
}
