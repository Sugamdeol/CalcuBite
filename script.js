const POLLINATIONS_API_KEY = 'sk_ZDnV9hilntSLCLGEmJKPxavBNJaPLI4K';

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // Set date
    const dateElem = document.getElementById('today-date');
    if (dateElem) {
        dateElem.textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    // Setup Form
    const setupForm = document.getElementById('setup-form');
    if (setupForm) {
        setupForm.addEventListener('submit', handleProfileSetup);
    }

    // Scan Modal
    const scanBtn = document.getElementById('scan-btn');
    const scanModal = document.getElementById('scan-modal');
    const closeScan = document.querySelector('.close-modal');
    const selectImageBtn = document.getElementById('select-image-btn');
    const fileInput = document.getElementById('file-input');

    if (scanBtn) scanBtn.onclick = () => scanModal.style.display = 'block';
    if (closeScan) closeScan.onclick = () => {
        scanModal.style.display = 'none';
        resetScanUI();
    };

    if (selectImageBtn) selectImageBtn.onclick = () => fileInput.click();
    if (fileInput) fileInput.onchange = handleImageSelect;

    // Log Meal
    const logMealBtn = document.getElementById('log-meal-btn');
    if (logMealBtn) logMealBtn.onclick = logCurrentMeal;

    // Nav
    document.getElementById('dashboard-link').onclick = showDashboardView;
    document.getElementById('profile-link').onclick = () => {
        document.getElementById('profile-setup').style.display = 'block';
        document.getElementById('dashboard-view').style.display = 'none';
    };

    // Load initial data
    if (window.auth && window.auth.currentUser) {
        loadDashboardData();
    }
}

async function handleProfileSetup(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const originalText = btn.textContent;
    btn.textContent = 'AI IS CALCULATING...';
    btn.disabled = true;

    const profileData = {
        gender: document.getElementById('setup-gender').value,
        age: parseInt(document.getElementById('setup-age').value),
        weight: parseFloat(document.getElementById('setup-weight').value),
        height: parseFloat(document.getElementById('setup-height').value),
        activity_level: document.getElementById('setup-activity').value,
        health_conditions: document.getElementById('setup-conditions').value.split(',').map(s => s.trim())
    };

    try {
        // Use Pollinations AI to calculate limits
        const prompt = `As a nutrition expert, calculate daily nutritional limits for a person with these details:
        Gender: ${profileData.gender}, Age: ${profileData.age}, Weight: ${profileData.weight}kg, Height: ${profileData.height}cm,
        Activity: ${profileData.activity_level}, Health/Goals: ${document.getElementById('setup-conditions').value}.

        Return ONLY a JSON object with these keys: calories, protein, carbs, fats, sugar, fiber, sodium (values in grams/mg as appropriate).
        Example: {"calories": 2000, "protein": 150, "carbs": 250, "fats": 70, "sugar": 50, "fiber": 30, "sodium": 2300}`;

        const response = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${POLLINATIONS_API_KEY}`
            },
            body: JSON.stringify({
                model: "openai-large",
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" }
            })
        });

        const result = await response.json();
        const limits = JSON.parse(result.choices[0].message.content);

        // Update profile in DB
        const { error } = await window.auth.supabase
            .from('profiles')
            .update({
                ...profileData,
                daily_limits: limits
            })
            .eq('id', window.auth.currentUser.id);

        if (error) throw error;

        alert('AI Goals set successfully!');
        window.location.reload(); // Refresh to update UI
    } catch (err) {
        console.error('Setup error:', err);
        alert('Error calculating goals. Please try again.');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

async function loadDashboardData() {
    if (!window.auth.currentUser) return;

    // Fetch daily log for today
    const today = new Date().toISOString().split('T')[0];
    const { data: log, error: logError } = await window.auth.supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', window.auth.currentUser.id)
        .eq('log_date', today)
        .single();

    // Fetch profile for limits
    const { data: profile } = await window.auth.supabase
        .from('profiles')
        .select('daily_limits')
        .eq('id', window.auth.currentUser.id)
        .single();

    if (profile && profile.daily_limits) {
        const limits = profile.daily_limits;
        document.getElementById('limit-calories').textContent = limits.calories;
        document.getElementById('limit-sugar').textContent = limits.sugar;
        document.getElementById('limit-protein').textContent = limits.protein;
        document.getElementById('limit-carbs').textContent = limits.carbs;
        document.getElementById('limit-fats').textContent = limits.fats;

        if (log) {
            updateDashboardUI(log, limits);
        }
    }

    loadHistory();
}

function updateDashboardUI(log, limits) {
    document.getElementById('curr-calories').textContent = Math.round(log.calories);
    document.getElementById('curr-sugar').textContent = Math.round(log.sugar);
    document.getElementById('curr-protein').textContent = Math.round(log.protein);
    document.getElementById('curr-carbs').textContent = Math.round(log.carbs);
    document.getElementById('curr-fats').textContent = Math.round(log.fats);

    // Progress bars
    document.getElementById('progress-calories').style.width = Math.min(100, (log.calories / limits.calories) * 100) + '%';
    document.getElementById('progress-sugar').style.width = Math.min(100, (log.sugar / limits.sugar) * 100) + '%';
}

async function loadHistory() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: meals, error } = await window.auth.supabase
        .from('meals')
        .select('*')
        .eq('user_id', window.auth.currentUser.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '';

    if (meals && meals.length > 0) {
        meals.forEach(meal => {
            const date = new Date(meal.created_at).toLocaleDateString();
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <div>
                    <strong style="text-transform: uppercase;">${meal.name}</strong>
                    <div style="font-size: 0.8rem; color: #555;">${date}</div>
                </div>
                <div style="font-weight: 800;">${Math.round(meal.calories)} kcal</div>
            `;
            historyList.appendChild(item);
        });
    } else {
        historyList.innerHTML = '<p style="padding: 1rem; font-weight: 700;">No meals logged yet.</p>';
    }
}

let currentScannedMeal = null;

async function handleImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = (event) => {
        const preview = document.getElementById('preview-image');
        preview.src = event.target.result;
        preview.style.display = 'block';
        document.getElementById('select-image-btn').style.display = 'none';
    };
    reader.readAsDataURL(file);

    // Analyze with AI
    document.getElementById('scanning-loader').style.display = 'block';
    document.getElementById('scan-result').style.display = 'none';

    try {
        // For real image scanning, we'd upload to a storage or use a vision model
        // Since we are using pollinations, and for the sake of this demo/implementation
        // We will assume the user has selected an image and we'll prompt the AI
        // In a real scenario, we'd pass the base64 to a vision-capable model.

        // Convert to base64 for vision
        const base64Image = await toBase64(file);

        const response = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${POLLINATIONS_API_KEY}`
            },
            body: JSON.stringify({
                model: "openai-large", // Or a vision model if available, but let's try prompting
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "Identify this food and provide nutritional facts (calories, protein, carbs, fats, sugar, fiber, sodium). Return ONLY JSON." },
                            { type: "image_url", image_url: { url: base64Image } }
                        ]
                    }
                ],
                response_format: { type: "json_object" }
            })
        });

        const result = await response.json();
        const nutrition = JSON.parse(result.choices[0].message.content);

        currentScannedMeal = nutrition;

        document.getElementById('detected-food').textContent = nutrition.name || "Detected Meal";
        document.getElementById('detected-nutrition').innerHTML = `
            Calories: ${nutrition.calories} kcal<br>
            Protein: ${nutrition.protein}g | Carbs: ${nutrition.carbs}g | Fats: ${nutrition.fats}g<br>
            Sugar: ${nutrition.sugar}g | Sodium: ${nutrition.sodium}mg
        `;
        document.getElementById('scan-result').style.display = 'block';
    } catch (err) {
        console.error('Scan error:', err);
        alert('AI failed to analyze the image. Make sure it is clear!');
    } finally {
        document.getElementById('scanning-loader').style.display = 'none';
    }
}

async function logCurrentMeal() {
    if (!currentScannedMeal) return;

    const btn = document.getElementById('log-meal-btn');
    btn.disabled = true;
    btn.textContent = 'LOGGING...';

    try {
        const { error } = await window.auth.supabase
            .from('meals')
            .insert([{
                user_id: window.auth.currentUser.id,
                name: currentScannedMeal.name || "Scanned Meal",
                calories: currentScannedMeal.calories,
                protein: currentScannedMeal.protein,
                carbs: currentScannedMeal.carbs,
                fats: currentScannedMeal.fats,
                sugar: currentScannedMeal.sugar,
                fiber: currentScannedMeal.fiber,
                sodium: currentScannedMeal.sodium
            }]);

        if (error) throw error;

        alert('Meal logged!');
        document.getElementById('scan-modal').style.display = 'none';
        resetScanUI();
        loadDashboardData();
    } catch (err) {
        console.error('Logging error:', err);
        alert('Failed to log meal.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'LOG MEAL';
    }
}

function resetScanUI() {
    document.getElementById('preview-image').style.display = 'none';
    document.getElementById('select-image-btn').style.display = 'block';
    document.getElementById('scan-result').style.display = 'none';
    document.getElementById('file-input').value = '';
    currentScannedMeal = null;
}

function showDashboardView() {
    document.getElementById('profile-setup').style.display = 'none';
    document.getElementById('dashboard-view').style.display = 'block';
}

function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}
