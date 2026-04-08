// Global variables
let currentMode = 'label'; // Default mode is label analysis
let conversationHistory = [];
let currentTheme = 'light';
let analysisData = null;
let isCameraOn = false;
let stream = null;
let chartInstance = null;
let userDashboardData = null;
let userHealthGoals = null;

// DOM elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('capture');
const retakeBtn = document.getElementById('retake');
const errorDiv = document.getElementById('error');
const loadingDiv = document.getElementById('loading');
const resultsDiv = document.getElementById('results');
const cameraPermissionDiv = document.getElementById('cameraPermission');
const requestPermissionBtn = document.getElementById('requestPermission');
const fileInput = document.getElementById('fileInput');
const toggleCameraBtn = document.getElementById('toggleCamera');
const cameraContainer = document.querySelector('.camera-container');
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const macroSection = document.getElementById('macronutrient-section');

// Mode toggle functionality
document.getElementById('labelMode').addEventListener('click', () => {
  currentMode = 'label';
  document.getElementById('labelMode').classList.add('active');
  document.getElementById('foodMode').classList.remove('active');
  document.getElementById('gymMode').classList.remove('active');
  
  // Toggle macronutrient chart visibility based on mode
  if (macroSection) {
    macroSection.style.display = 'none';
  }
});

document.getElementById('foodMode').addEventListener('click', () => {
  currentMode = 'food';
  document.getElementById('foodMode').classList.add('active');
  document.getElementById('labelMode').classList.remove('active');
  document.getElementById('gymMode').classList.remove('active');
  
  // Toggle macronutrient chart visibility based on mode
  if (macroSection) {
    macroSection.style.display = 'block';
  }
});

document.getElementById('gymMode').addEventListener('click', () => {
  currentMode = 'gym';
  document.getElementById('gymMode').classList.add('active');
  document.getElementById('labelMode').classList.remove('active');
  document.getElementById('foodMode').classList.remove('active');
  
  // Toggle macronutrient chart visibility based on mode
  if (macroSection) {
    macroSection.style.display = 'block';
  }
});

// Tab functionality
tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    // Deactivate all tabs
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    // Activate clicked tab
    button.classList.add('active');
    const tabId = `${button.dataset.tab}-tab`;
    document.getElementById(tabId).classList.add('active');
  });
});

// Camera initialization
async function initCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });
    video.srcObject = stream;
    captureBtn.style.display = 'block';
    retakeBtn.style.display = 'none';
    cameraPermissionDiv.style.display = 'none';
    errorDiv.style.display = 'none';
    video.style.display = 'block';
    canvas.style.display = 'none';
  } catch (err) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      cameraPermissionDiv.style.display = 'block';
      errorDiv.style.display = 'block';
      errorDiv.textContent = 'Camera access was denied. Please enable camera permissions to use this feature.';
    } else {
      errorDiv.style.display = 'block';
      errorDiv.textContent = 'Error accessing camera: ' + err.message;
    }
    video.style.display = 'none';
  }
}

// Toggle camera
toggleCameraBtn.addEventListener('click', async () => {
  if (!isCameraOn) {
    cameraContainer.style.display = 'block';
    await initCamera();
    isCameraOn = true;
    toggleCameraBtn.innerHTML = '<i class="fas fa-camera-slash"></i><span>Turn Off Camera</span>';
  } else {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    video.srcObject = null;
    cameraContainer.style.display = 'none';
    isCameraOn = false;
    toggleCameraBtn.innerHTML = '<i class="fas fa-camera"></i><span>Turn On Camera</span>';
  }
});

// Camera permission request
requestPermissionBtn.addEventListener('click', async () => {
  try {
    await initCamera();
  } catch (err) {
    errorDiv.style.display = 'block';
    errorDiv.textContent = 'Could not request camera permission: ' + err.message;
  }
});

// Capture photo
captureBtn.addEventListener('click', async () => {
  const width = video.videoWidth;
  const height = video.videoHeight;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.drawImage(video, 0, 0, width, height);
  video.style.display = 'none';
  canvas.style.display = 'block';
  captureBtn.style.display = 'none';
  retakeBtn.style.display = 'block';
  
  try {
    const imageData = canvas.toDataURL('image/jpeg');
    const base64Image = imageData.split(',')[1];
    loadingDiv.style.display = 'block';
    await analyzeImage(base64Image);
  } catch (err) {
    errorDiv.style.display = 'block';
    errorDiv.textContent = 'Error processing image: ' + err.message;
    loadingDiv.style.display = 'none';
  }
});

// Retake photo
retakeBtn.addEventListener('click', () => {
  video.style.display = 'block';
  canvas.style.display = 'none';
  captureBtn.style.display = 'block';
  retakeBtn.style.display = 'none';
  resultsDiv.style.display = 'none';
  loadingDiv.style.display = 'none';
  errorDiv.style.display = 'none';
});

// File upload
fileInput.addEventListener('change', async e => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = async event => {
      if (isCameraOn) {
        // Stop camera if it's on
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        isCameraOn = false;
        toggleCameraBtn.innerHTML = '<i class="fas fa-camera"></i><span>Turn On Camera</span>';
      }
      
      cameraContainer.style.display = 'block';
      video.style.display = 'none';
      canvas.style.display = 'block';
      
      const img = new Image();
      img.onload = async () => {
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        try {
          const imageData = canvas.toDataURL('image/jpeg');
          const base64Image = imageData.split(',')[1];
          loadingDiv.style.display = 'block';
          await analyzeImage(base64Image);
        } catch (err) {
          errorDiv.style.display = 'block';
          errorDiv.textContent = 'Error processing image: ' + err.message;
          loadingDiv.style.display = 'none';
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }
});

// Add Supabase scan history tracking
async function logScan(scanType, scanData) {
  if (!window.auth || !window.auth.currentUser()) return;
  
  const sb = window.supabase_client;
  try {
    await sb
      .from('scan_history')
      .insert([{
        user_id: window.auth.currentUser().id,
        scan_type: scanType,
        scan_data: {
          rating: scanData.rating || 5,  
          timestamp: new Date().toISOString(),
          items: scanData.items || []
        }
      }]);
  } catch (error) {
    console.error('Error logging scan:', error);
  }
}

// Analyze image with AI
async function analyzeImage(base64Image) {
  // Check if user can perform a scan
  if (window.auth.currentUser()) {
    try {
      const canScan = await window.auth.updateScansRemaining(1);
      if (!canScan) {
        loadingDiv.style.display = 'none';
        errorDiv.style.display = 'block';
        errorDiv.textContent = 'You have reached your daily scan limit.';
        return;
      }
    } catch (error) {
      console.error('Error checking scan permissions:', error);
      loadingDiv.style.display = 'none';
      errorDiv.style.display = 'block';
      errorDiv.textContent = 'Error with user permissions. Please try logging in again.';
      return;
    }
  }

  let systemPrompt;
  
  let goalContext = '';
  if (userHealthGoals && userHealthGoals.length > 0) {
    goalContext = 'The user has the following health goals:\n';
    userHealthGoals.forEach(goal => {
      goalContext += `- ${goal.type}: ${goal.target} (Timeline: ${goal.timeline})\n`;
    });
    goalContext += '\nPlease consider these goals in your analysis and provide specific advice related to them.\n\n';
  }
  
  if (currentMode === 'label') {
    systemPrompt = `You are an advanced nutrition and food safety expert. ${goalContext}Analyze the ingredients list and provide:
1. A health rating from 1-10
2. A detailed breakdown of concerning ingredients with specific health impacts
3. Comprehensive health insights and recommendations
4. Alternative suggestions for healthier options
5. Long-term health implications
6. Nutrition breakdown estimates with percentages of daily values

Your response MUST be valid JSON with this structure:
{
  "rating": number,
  "ratingExplanation": string,
  "ingredients": {
    "concerning": [
      {
        "name": string,
        "risk": "high" | "medium" | "low",
        "impact": string,
        "whyAvoid": string,
        "scientificEvidence": string
      }
    ],
    "safe": [string]
  },
  "insights": [
    {
      "category": string,
      "details": string,
      "recommendation": string,
      "evidence": string
    }
  ],
  "healthImplications": {
    "shortTerm": [string],
    "longTerm": [string]
  },
  "alternatives": [
    {
      "name": string,
      "benefits": string,
      "whereToFind": string
    }
  ],
  "nutritionEstimate": {
    "calories": string,
    "sugar": string,
    "sodium": string,
    "artificialContent": string,
    "preservatives": string,
    "transFat": string,
    "dailyValuePercentages": {
      "sugar": number,
      "sodium": number,
      "fat": number
    }
  }${userHealthGoals && userHealthGoals.length > 0 ? `,
  "goalAlignment": [
    {
      "goalType": string,
      "alignment": "good" | "neutral" | "poor",
      "recommendation": string
    }
  ]` : ''}
}`;
  } else if (currentMode === 'food') {
    systemPrompt = `You are an advanced nutrition and food science expert. ${goalContext}Analyze the food in this image and provide:
1. A health rating from 1-10
2. Identification of the food items visible
3. Estimated nutritional profile and caloric content
4. Potential health benefits and concerns
5. Dietary considerations (e.g., good for keto, vegan, etc.)
6. Healthier preparation suggestions if applicable
7. Scientific evidence and nutritional data sources

Your response MUST be valid JSON with this structure:
{
  "rating": number,
  "ratingExplanation": string,
  "foodIdentification": {
    "mainItems": [string],
    "ingredients": [string],
    "estimatedCuisine": string,
    "mealType": string
  },
  "ingredients": {
    "concerning": [
      {
        "name": string,
        "risk": "high" | "medium" | "low",
        "impact": string,
        "whyAvoid": string,
        "scientificEvidence": string
      }
    ],
    "beneficial": [
      {
        "name": string,
        "benefits": string,
        "nutrientsProvided": [string]
      }
    ]
  },
  "insights": [
    {
      "category": string,
      "details": string,
      "recommendation": string,
      "evidence": string
    }
  ],
  "healthImplications": {
    "shortTerm": [string],
    "longTerm": [string]
  },
  "alternatives": [
    {
      "name": string,
      "benefits": string,
      "preparation": string
    }
  ],
  "nutritionEstimate": {
    "calories": string,
    "protein": string,
    "carbs": string,
    "fat": string,
    "fiber": string,
    "vitamins": [string],
    "minerals": [string],
    "macroRatio": {
      "protein": number,
      "carbs": number,
      "fat": number
    }
  },
  "dietaryConsiderations": [string],
  "preparationTips": [string]
}${userHealthGoals && userHealthGoals.length > 0 ? `,
  "goalAlignment": [
    {
      "goalType": string,
      "alignment": "good" | "neutral" | "poor",
      "recommendation": string
    }
  ]` : ''}
}`;
  } else if (currentMode === 'gym') {
    systemPrompt = `You are an advanced sports nutrition and fitness expert. ${goalContext}Analyze the food in this image from a workout and fitness perspective:
1. A fitness rating from 1-10
2. Identification of the food items visible
3. Pre-workout and post-workout suitability assessment
4. Protein quality and quantity analysis
5. Energy provision for different workout types
6. Recovery potential and muscle-building properties
7. Scientific evidence and nutritional data for athletes

Your response MUST be valid JSON with this structure:
{
  "rating": number,
  "ratingExplanation": string,
  "foodIdentification": {
    "mainItems": [string],
    "ingredients": [string],
    "estimatedCuisine": string,
    "mealType": string
  },
  "workoutSuitability": {
    "preWorkout": {
      "rating": number,
      "timing": string,
      "benefits": [string],
      "concerns": [string]
    },
    "postWorkout": {
      "rating": number,
      "timing": string,
      "benefits": [string],
      "concerns": [string]
    },
    "bestFor": [string]
  },
  "proteinAnalysis": {
    "quantity": string,
    "quality": string,
    "aminoAcids": {
      "bcaa": string,
      "leucine": string,
      "complete": boolean
    },
    "absorptionRate": string
  },
  "energyProvision": {
    "glycemicLoad": string,
    "energyRelease": string,
    "enduranceSupport": number,
    "strengthSupport": number,
    "hiitSupport": number
  },
  "nutritionEstimate": {
    "calories": string,
    "protein": string,
    "carbs": string,
    "fat": string,
    "fiber": string,
    "electrolytes": [string],
    "macroRatio": {
      "protein": number,
      "carbs": number,
      "fat": number
    }
  },
  "recoveryPotential": {
    "rating": number,
    "inflammationReduction": string,
    "glycogenReplenishment": string,
    "muscleRepair": string
  },
  "fitnessConsiderations": [string],
  "supplementSuggestions": [string]
}${userHealthGoals && userHealthGoals.length > 0 ? `,
  "goalAlignment": [
    {
      "goalType": string,
      "alignment": "good" | "neutral" | "poor",
      "recommendation": string
    }
  ]` : ''}
}`;
  }

  const userPrompt = currentMode === 'label' ? 
    "Analyze this food label and provide detailed insights:" : 
    (currentMode === 'food' ? 
      "Analyze this food image and provide detailed nutritional insights:" :
      "Analyze this food image from a fitness and workout perspective:");
  
  const requestBody = {
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: userPrompt
          },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${base64Image}` }
          }
        ]
      }
    ],
    model: "claude-fast",
    response_format: { type: "json_object" }
  };
  
  const response = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer sk_ZDnV9hilntSLCLGEmJKPxavBNJaPLI4K'
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    throw new Error(`API responded with status: ${response.status}`);
  }
  
  const responseData = await response.json();
  const data = responseData.choices[0].message;
  
  try {
    if (data && data.content) {
      // Try parsing as JSON if content is a string
      if (typeof data.content === 'string') {
        analysisData = extractJSON(data.content);
      } else if (typeof data.content === 'object') {
        // If content is already an object
        analysisData = data.content;
      }
    } else {
      throw new Error('Invalid response format from API');
    }
  } catch (parseError) {
    console.error('Error parsing JSON:', parseError);
    throw new Error('Error parsing response: ' + parseError.message);
  }
  
  // Store actual analysis data rating from API response
  const actualRating = analysisData?.rating || 5;

  // Display the results
  displayResults(analysisData);
  loadingDiv.style.display = 'none';
  
  // Log the scan to the database if authenticated
  if (window.auth.currentUser()) {
    logScan(currentMode, {
      rating: actualRating || 5,
      timestamp: new Date().toISOString(),
      items: analysisData?.foodIdentification?.mainItems || []
    });
  }

  // Set up Log Meal button
  const logBtn = document.getElementById('log-meal-button');
  if (logBtn) {
    logBtn.onclick = () => logCurrentMeal();
  }
}

async function logCurrentMeal() {
    if (!analysisData || !window.auth || !window.auth.currentUser()) {
        alert("Please scan a meal first.");
        return;
    }

    try {
        const nutrition = analysisData.nutritionEstimate || {};
        const foodName = analysisData.foodIdentification?.mainItems?.join(', ') || "Scanned Meal";

        // Extract numeric values from strings like "250 kcal" or "10g"
        const parseNum = (str) => {
            if (!str) return 0;
            const matches = String(str).match(/[\d.]+/);
            return matches ? parseFloat(matches[0]) : 0;
        };

        const logData = {
            user_id: window.auth.currentUser().id,
            food_name: foodName,
            calories: parseNum(nutrition.calories),
            protein: parseNum(nutrition.protein),
            carbs: parseNum(nutrition.carbs),
            fat: parseNum(nutrition.fat),
            sugar: parseNum(nutrition.sugar),
            sodium: parseNum(nutrition.sodium)
        };

        const sb = window.supabase_client;
        const { error } = await sb
            .from('daily_logs')
            .insert([logData]);

        if (error) throw error;

        const successAlert = document.getElementById('log-success-alert');
        if (successAlert) {
            successAlert.style.display = 'block';
            setTimeout(() => successAlert.style.display = 'none', 3000);
        }

        // Update dashboard if it's open or refresh data
        if (typeof fetchDashboardData === 'function') fetchDashboardData();

    } catch (err) {
        console.error("Error logging meal:", err);
        alert("Failed to log meal: " + err.message);
    }
}

// Display results function - updated to handle gym mode
function displayResults(data) {
  loadingDiv.style.display = 'none';
  resultsDiv.style.display = 'block';
  errorDiv.style.display = 'none';
  
  // Health Score with more visual elements
  const healthScoreEl = document.getElementById('healthScore');
  const rating = data.rating || 'N/A';
  let ratingColor = rating >= 7 ? 'var(--success)' : (rating >= 4 ? 'var(--warning)' : 'var(--danger)');
  let ratingIcon = rating >= 7 ? 'thumbs-up' : (rating >= 4 ? 'meh' : 'thumbs-down');
  let scoreTitle = currentMode === 'gym' ? 'Fitness Score' : 'Health Score';
  
  healthScoreEl.innerHTML = `
    <h3><i class="fas fa-star"></i> Overall ${scoreTitle}</h3>
    <div class="health-score-container">
      <div class="rating-circle" style="--rating: ${rating};">
        <span style="color: ${ratingColor};">${rating}</span>
      </div>
      <div class="rating-explanation">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
          <i class="fas fa-${ratingIcon}" style="color: ${ratingColor};"></i>
          <span style="font-weight: 600; color: ${ratingColor};">
            ${rating >= 7 ? 'Good Choice' : (rating >= 4 ? 'Use with Caution' : 'Not Recommended')}
          </span>
        </div>
        <p>${data.ratingExplanation || ''}</p>
      </div>
    </div>
  `;
  
  // Nutrition Breakdown - handle all modes
  const nutritionBreakdownEl = document.getElementById('nutritionBreakdown');
  const nutrition = data.nutritionEstimate || {};
  
  if (currentMode === 'label') {
    let sugarPercent = nutrition.dailyValuePercentages?.sugar || Math.floor(Math.random() * 100);
    let sodiumPercent = nutrition.dailyValuePercentages?.sodium || Math.floor(Math.random() * 100);
    let fatPercent = nutrition.dailyValuePercentages?.fat || Math.floor(Math.random() * 100);
    
    nutritionBreakdownEl.innerHTML = `
      <div class="nutrition-item">
        <small>Calories</small>
        <div class="nutrition-value">${nutrition.calories || 'N/A'}</div>
      </div>
      <div class="nutrition-item">
        <small>Sugar</small>
        <div class="nutrition-value">${nutrition.sugar || 'N/A'}</div>
        <div class="progress-bar">
          <div class="progress" style="width: ${sugarPercent}%; 
            background-color: ${sugarPercent > 70 ? 'var(--danger)' : sugarPercent > 30 ? 'var(--warning)' : 'var(--success)'}">
          </div>
        </div>
        <small>${sugarPercent}% of daily value</small>
      </div>
      <div class="nutrition-item">
        <small>Sodium</small>
        <div class="nutrition-value">${nutrition.sodium || 'N/A'}</div>
        <div class="progress-bar">
          <div class="progress" style="width: ${sodiumPercent}%; 
            background-color: ${sodiumPercent > 70 ? 'var(--danger)' : sodiumPercent > 30 ? 'var(--warning)' : 'var(--success)'}">
          </div>
        </div>
        <small>${sodiumPercent}% of daily value</small>
      </div>
      <div class="nutrition-item">
        <small>Artificial Content</small>
        <div class="nutrition-value">${nutrition.artificialContent || 'N/A'}</div>
      </div>
      ${nutrition.preservatives ? `
      <div class="nutrition-item">
        <small>Preservatives</small>
        <div class="nutrition-value">${nutrition.preservatives}</div>
      </div>
      ` : ''}
      ${nutrition.transFat ? `
      <div class="nutrition-item">
        <small>Trans Fat</small>
        <div class="nutrition-value">${nutrition.transFat}</div>
        <div class="progress-bar">
          <div class="progress" style="width: ${fatPercent}%; 
            background-color: ${fatPercent > 70 ? 'var(--danger)' : fatPercent > 30 ? 'var(--warning)' : 'var(--success)'}">
          </div>
        </div>
        <small>${fatPercent}% of daily value</small>
      </div>
      ` : ''}
    `;
  } else if (currentMode === 'food') {
    // For food mode, show macronutrient ratio
    const macroRatio = nutrition.macroRatio || { protein: 25, carbs: 50, fat: 25 };
    
    nutritionBreakdownEl.innerHTML = `
      <div class="nutrition-item">
        <small>Calories</small>
        <div class="nutrition-value">${nutrition.calories || 'N/A'}</div>
      </div>
      <div class="nutrition-item">
        <small>Protein</small>
        <div class="nutrition-value">${nutrition.protein || 'N/A'}</div>
        <div class="progress-bar">
          <div class="progress" style="width: ${macroRatio.protein}%; background-color: var(--primary);"></div>
        </div>
        <small>${macroRatio.protein}% of calories</small>
      </div>
      <div class="nutrition-item">
        <small>Carbs</small>
        <div class="nutrition-value">${nutrition.carbs || 'N/A'}</div>
        <div class="progress-bar">
          <div class="progress" style="width: ${macroRatio.carbs}%; background-color: var(--secondary);"></div>
        </div>
        <small>${macroRatio.carbs}% of calories</small>
      </div>
      <div class="nutrition-item">
        <small>Fat</small>
        <div class="nutrition-value">${nutrition.fat || 'N/A'}</div>
        <div class="progress-bar">
          <div class="progress" style="width: ${macroRatio.fat}%; background-color: var(--warning);"></div>
        </div>
        <small>${macroRatio.fat}% of calories</small>
      </div>
    `;
    
    // Add vitamins and minerals if available
    if (nutrition.vitamins && nutrition.vitamins.length > 0) {
      nutritionBreakdownEl.innerHTML += `
        <div class="nutrition-item" style="grid-column: span 2;">
          <small>Vitamins</small>
          <div class="nutrition-tags">
            ${nutrition.vitamins.map(v => `<span class="nutrition-tag">${v}</span>`).join('')}
          </div>
        </div>
      `;
    }
    
    if (nutrition.minerals && nutrition.minerals.length > 0) {
      nutritionBreakdownEl.innerHTML += `
        <div class="nutrition-item" style="grid-column: span 2;">
          <small>Minerals</small>
          <div class="nutrition-tags">
            ${nutrition.minerals.map(m => `<span class="nutrition-tag">${m}</span>`).join('')}
          </div>
        </div>
      `;
    }
  } else if (currentMode === 'gym') {
    // For gym mode, show macronutrient ratio with workout emphasis
    const macroRatio = nutrition.macroRatio || { protein: 25, carbs: 50, fat: 25 };
    
    nutritionBreakdownEl.innerHTML = `
      <div class="nutrition-item">
        <small>Calories</small>
        <div class="nutrition-value">${nutrition.calories || 'N/A'}</div>
      </div>
      <div class="nutrition-item">
        <small>Protein</small>
        <div class="nutrition-value">${nutrition.protein || 'N/A'}</div>
        <div class="progress-bar">
          <div class="progress" style="width: ${macroRatio.protein}%; background-color: var(--primary);"></div>
        </div>
        <small>${macroRatio.protein}% of calories</small>
      </div>
      <div class="nutrition-item">
        <small>Carbs</small>
        <div class="nutrition-value">${nutrition.carbs || 'N/A'}</div>
        <div class="progress-bar">
          <div class="progress" style="width: ${macroRatio.carbs}%; background-color: var(--secondary);"></div>
        </div>
        <small>${macroRatio.carbs}% of calories</small>
      </div>
      <div class="nutrition-item">
        <small>Fat</small>
        <div class="nutrition-value">${nutrition.fat || 'N/A'}</div>
        <div class="progress-bar">
          <div class="progress" style="width: ${macroRatio.fat}%; background-color: var(--warning);"></div>
        </div>
        <small>${macroRatio.fat}% of calories</small>
      </div>
    `;
    
    // Add electrolytes if available
    if (nutrition.electrolytes && nutrition.electrolytes.length > 0) {
      nutritionBreakdownEl.innerHTML += `
        <div class="nutrition-item" style="grid-column: span 2;">
          <small>Electrolytes</small>
          <div class="nutrition-tags">
            ${nutrition.electrolytes.map(e => `<span class="nutrition-tag">${e}</span>`).join('')}
          </div>
        </div>
      `;
    }
  }
  
  // Update the macronutrient section visibility based on the current mode
  if (macroSection) {
    macroSection.style.display = currentMode !== 'label' ? 'block' : 'none';
  }
  
  // Ingredients Analysis - handle all modes
  const ingredientsDiv = document.getElementById('ingredients');
  
  if (currentMode === 'label') {
    if (data.ingredients?.concerning) {
      ingredientsDiv.innerHTML = `
        <div class="ingredients-warning">
          ${data.ingredients.concerning.map(ing => `
            <div class="ingredient-card ${ing.risk}-risk">
              <div class="ingredient-header">
                <i class="fas fa-${ing.risk === 'high' ? 'exclamation-triangle' : ing.risk === 'medium' ? 'exclamation-circle' : 'info-circle'}"
                   style="color: ${ing.risk === 'high' ? 'var(--danger)' : ing.risk === 'medium' ? 'var(--warning)' : 'var(--primary)'}">
                </i>
                <h4>${ing.name}</h4>
                <span class="status-badge badge-${ing.risk === 'high' ? 'danger' : ing.risk === 'medium' ? 'warning' : 'primary'}">
                  ${ing.risk.toUpperCase()} RISK
                </span>
              </div>
              <div class="ingredient-details">
                <p><strong>Health Impact:</strong> ${ing.impact}</p>
                <p><strong>Why Avoid:</strong> ${ing.whyAvoid}</p>
              </div>
            </div>
          `).join('')}
        </div>
        ${data.ingredients.safe?.length > 0 ? `
          <div class="safe-ingredients">
            <h4><i class="fas fa-check-circle" style="color: var(--success);"></i> Safe Ingredients</h4>
            <p>${data.ingredients.safe.join(', ')}</p>
          </div>
        ` : ''}
      `;
    } else {
      ingredientsDiv.innerHTML = '<p>No ingredient information available</p>';
    }
  } else if (currentMode === 'food') {
    // Food mode - show food identification and beneficial ingredients
    const foodItems = data.foodIdentification?.mainItems || [];
    const ingredientsList = data.foodIdentification?.ingredients || [];
    
    ingredientsDiv.innerHTML = `
      <div class="food-identification">
        <h4><i class="fas fa-utensils" style="color: var(--primary);"></i> Food Identified</h4>
        <p>${foodItems.join(', ') || 'No food items identified'}</p>
        
        ${ingredientsList.length > 0 ? `
          <h4><i class="fas fa-list" style="color: var(--primary);"></i> Estimated Ingredients</h4>
          <p>${ingredientsList.join(', ')}</p>
        ` : ''}
      </div>
      
      ${data.ingredients?.concerning ? `
        <div class="ingredients-warning">
          <h4><i class="fas fa-exclamation-circle" style="color: var(--warning);"></i> Health Concerns</h4>
          ${data.ingredients.concerning.map(ing => `
            <div class="ingredient-card ${ing.risk}-risk">
              <div class="ingredient-header">
                <i class="fas fa-${ing.risk === 'high' ? 'exclamation-triangle' : ing.risk === 'medium' ? 'exclamation-circle' : 'info-circle'}"
                   style="color: ${ing.risk === 'high' ? 'var(--danger)' : ing.risk === 'medium' ? 'var(--warning)' : 'var(--primary)'}">
                </i>
                <h4>${ing.name}</h4>
                <span class="status-badge badge-${ing.risk === 'high' ? 'danger' : ing.risk === 'medium' ? 'warning' : 'primary'}">
                  ${ing.risk.toUpperCase()} RISK
                </span>
              </div>
              <div class="ingredient-details">
                <p><strong>Health Impact:</strong> ${ing.impact}</p>
                <p><strong>Why Be Cautious:</strong> ${ing.whyAvoid}</p>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
      
      ${data.ingredients?.beneficial?.length > 0 ? `
        <div class="beneficial-ingredients">
          <h4><i class="fas fa-heart" style="color: var(--success);"></i> Beneficial Components</h4>
          ${data.ingredients.beneficial.map(ing => `
            <div class="ingredient-card" style="border-left: 4px solid var(--success);">
              <div class="ingredient-header">
                <i class="fas fa-plus-circle" style="color: var(--success);"></i>
                <h4>${ing.name}</h4>
              </div>
              <div class="ingredient-details">
                <p><strong>Benefits:</strong> ${ing.benefits}</p>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
      
      ${data.dietaryConsiderations?.length > 0 ? `
        <div class="dietary-considerations">
          <h4><i class="fas fa-clipboard-list" style="color: var(--primary);"></i> Dietary Considerations</h4>
          <ul class="implication-list">
            ${data.dietaryConsiderations.map(item => `
              <li>
                <i class="fas fa-check-circle" style="color: var(--success);"></i>
                <span>${item}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      ` : ''}
    `;
  } else if (currentMode === 'gym') {
    // Gym mode - show workout suitability and protein analysis
    const foodItems = data.foodIdentification?.mainItems || [];
    const workoutSuitability = data.workoutSuitability || {};
    const proteinAnalysis = data.proteinAnalysis || {};
    
    ingredientsDiv.innerHTML = `
      <div class="food-identification">
        <h4><i class="fas fa-utensils" style="color: var(--primary);"></i> Food Identified</h4>
        <p>${foodItems.join(', ') || 'No food items identified'}</p>
      </div>
      
      <div class="workout-suitability">
        <h4><i class="fas fa-dumbbell" style="color: var(--primary);"></i> Workout Suitability</h4>
        
        <div class="suitability-grid">
          <div class="suitability-card">
            <div class="suitability-header">
              <h5>Pre-Workout</h5>
              <span class="fitness-score">${workoutSuitability.preWorkout?.rating || 'N/A'}/10</span>
            </div>
            <p><strong>Best Timing:</strong> ${workoutSuitability.preWorkout?.timing || 'N/A'}</p>
            <div class="suitability-lists">
              <div class="benefits-list">
                <h6><i class="fas fa-check-circle" style="color: var(--success);"></i> Benefits</h6>
                <ul>
                  ${workoutSuitability.preWorkout?.benefits?.map(b => `<li>${b}</li>`).join('') || '<li>No data available</li>'}
                </ul>
              </div>
              <div class="concerns-list">
                <h6><i class="fas fa-exclamation-circle" style="color: var(--warning);"></i> Concerns</h6>
                <ul>
                  ${workoutSuitability.preWorkout?.concerns?.map(c => `<li>${c}</li>`).join('') || '<li>No data available</li>'}
                </ul>
              </div>
            </div>
          </div>
          
          <div class="suitability-card">
            <div class="suitability-header">
              <h5>Post-Workout</h5>
              <span class="fitness-score">${workoutSuitability.postWorkout?.rating || 'N/A'}/10</span>
            </div>
            <p><strong>Best Timing:</strong> ${workoutSuitability.postWorkout?.timing || 'N/A'}</p>
            <div class="suitability-lists">
              <div class="benefits-list">
                <h6><i class="fas fa-check-circle" style="color: var(--success);"></i> Benefits</h6>
                <ul>
                  ${workoutSuitability.postWorkout?.benefits?.map(b => `<li>${b}</li>`).join('') || '<li>No data available</li>'}
                </ul>
              </div>
              <div class="concerns-list">
                <h6><i class="fas fa-exclamation-circle" style="color: var(--warning);"></i> Concerns</h6>
                <ul>
                  ${workoutSuitability.postWorkout?.concerns?.map(c => `<li>${c}</li>`).join('') || '<li>No data available</li>'}
                </ul>
              </div>
            </div>
          </div>
        </div>
        
        ${workoutSuitability.bestFor?.length > 0 ? `
          <div class="best-for-workouts">
            <h5><i class="fas fa-award" style="color: var(--success);"></i> Best For</h5>
            <div class="workout-tags">
              ${workoutSuitability.bestFor.map(w => `<span class="workout-tag">${w}</span>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
      
      <div class="protein-analysis">
        <h4><i class="fas fa-drumstick-bite" style="color: var(--primary);"></i> Protein Analysis</h4>
        <div class="protein-grid">
          <div class="protein-item">
            <span class="protein-label">Quantity</span>
            <span class="protein-value">${proteinAnalysis.quantity || 'N/A'}</span>
          </div>
          <div class="protein-item">
            <span class="protein-label">Quality</span>
            <span class="protein-value">${proteinAnalysis.quality || 'N/A'}</span>
          </div>
          <div class="protein-item">
            <span class="protein-label">BCAA Content</span>
            <span class="protein-value">${proteinAnalysis.aminoAcids?.bcaa || 'N/A'}</span>
          </div>
          <div class="protein-item">
            <span class="protein-label">Leucine</span>
            <span class="protein-value">${proteinAnalysis.aminoAcids?.leucine || 'N/A'}</span>
          </div>
          <div class="protein-item">
            <span class="protein-label">Complete Protein</span>
            <span class="protein-value">${proteinAnalysis.aminoAcids?.complete ? 'Yes' : 'No'}</span>
          </div>
          <div class="protein-item">
            <span class="protein-label">Absorption Rate</span>
            <span class="protein-value">${proteinAnalysis.absorptionRate || 'N/A'}</span>
          </div>
        </div>
      </div>
      
      <div class="energy-provision">
        <h4><i class="fas fa-bolt" style="color: var(--warning);"></i> Energy Provision</h4>
        <div class="energy-grid">
          <div class="energy-item">
            <span class="energy-label">Glycemic Load</span>
            <span class="energy-value">${data.energyProvision?.glycemicLoad || 'N/A'}</span>
          </div>
          <div class="energy-item">
            <span class="energy-label">Energy Release</span>
            <span class="energy-value">${data.energyProvision?.energyRelease || 'N/A'}</span>
          </div>
        </div>
        
        <div class="workout-support">
          <h5>Workout Support Levels</h5>
          <div class="support-grid">
            <div class="support-item">
              <span class="support-label">Endurance</span>
              <div class="progress-bar">
                <div class="progress" style="width: ${data.energyProvision?.enduranceSupport * 10 || 0}%; 
                  background-color: var(--primary);">
                </div>
              </div>
              <span class="support-value">${data.energyProvision?.enduranceSupport || 'N/A'}/10</span>
            </div>
            <div class="support-item">
              <span class="support-label">Strength</span>
              <div class="progress-bar">
                <div class="progress" style="width: ${data.energyProvision?.strengthSupport * 10 || 0}%; 
                  background-color: var(--secondary);">
                </div>
              </div>
              <span class="support-value">${data.energyProvision?.strengthSupport || 'N/A'}/10</span>
            </div>
            <div class="support-item">
              <span class="support-label">HIIT</span>
              <div class="progress-bar">
                <div class="progress" style="width: ${data.energyProvision?.hiitSupport * 10 || 0}%; 
                  background-color: var(--warning);">
                </div>
              </div>
              <span class="support-value">${data.energyProvision?.hiitSupport || 'N/A'}/10</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="recovery-potential">
        <h4><i class="fas fa-heartbeat" style="color: var(--success);"></i> Recovery Potential</h4>
        <div class="recovery-header">
          <span>Overall Recovery Rating: </span>
          <span class="recovery-rating">${data.recoveryPotential?.rating || 'N/A'}/10</span>
        </div>
        <div class="recovery-grid">
          <div class="recovery-item">
            <span class="recovery-label">Inflammation Reduction</span>
            <span class="recovery-value">${data.recoveryPotential?.inflammationReduction || 'N/A'}</span>
          </div>
          <div class="recovery-item">
            <span class="recovery-label">Glycogen Replenishment</span>
            <span class="recovery-value">${data.recoveryPotential?.glycogenReplenishment || 'N/A'}</span>
          </div>
          <div class="recovery-item">
            <span class="recovery-label">Muscle Repair</span>
            <span class="recovery-value">${data.recoveryPotential?.muscleRepair || 'N/A'}</span>
          </div>
        </div>
      </div>
      
      ${data.supplementSuggestions ? `
        <div class="supplement-suggestions">
          <h4><i class="fas fa-pills" style="color: var(--primary);"></i> Supplement Suggestions</h4>
          <p>${data.supplementSuggestions}</p>
        </div>
      ` : ''}
    `;
  }
  
  // Insights section
  const insightsDiv = document.getElementById('insights');
  if (data.insights && data.insights.length > 0) {
    insightsDiv.innerHTML = data.insights.map(insight => `
      <div class="insight-card">
        <h4><i class="fas fa-lightbulb"></i> ${insight.category}</h4>
        <p>${insight.details}</p>
        <div class="recommendation">
          <i class="fas fa-arrow-right"></i>
          <span>${insight.recommendation}</span>
        </div>
      </div>
    `).join('');
  } else {
    insightsDiv.innerHTML = '<p>No insights available for this item.</p>';
  }
  
  // Health Implications
  const implicationsDiv = document.getElementById('implications');
  implicationsDiv.innerHTML = `
    <div class="implication-box">
      <h4><i class="fas fa-hourglass-start"></i> Short Term Effects</h4>
      <ul class="implication-list">
        ${data.healthImplications?.shortTerm?.map(effect => `
          <li>
            <i class="fas fa-circle"></i>
            <span>${effect}</span>
          </li>
        `).join('') || '<li><span>No short-term effects listed</span></li>'}
      </ul>
    </div>
    <div class="implication-box">
      <h4><i class="fas fa-hourglass-end"></i> Long Term Effects</h4>
      <ul class="implication-list">
        ${data.healthImplications?.longTerm?.map(effect => `
          <li>
            <i class="fas fa-circle"></i>
            <span>${effect}</span>
          </li>
        `).join('') || '<li><span>No long-term effects listed</span></li>'}
      </ul>
    </div>
  `;
  
  // Alternatives
  const alternativesDiv = document.getElementById('alternatives');
  if (data.alternatives && data.alternatives.length > 0) {
    alternativesDiv.innerHTML = data.alternatives.map(alt => {
      if (typeof alt === 'string') {
        return `
          <div class="alternative-item">
            <i class="fas fa-leaf" style="color: var(--success);"></i>
            <span>${alt}</span>
          </div>
        `;
      } else {
        return `
          <div class="alternative-item">
            <i class="fas fa-leaf" style="color: var(--success);"></i>
            <div>
              <h4>${alt.name}</h4>
              <p><small>${alt.benefits}</small></p>
              ${alt.whereToFind ? `<p><small><strong>Where to find:</strong> ${alt.whereToFind}</small></p>` : ''}
              ${alt.preparation ? `<p><small><strong>Preparation:</strong> ${alt.preparation}</small></p>` : ''}
            </div>
          </div>
        `;
      }
    }).join('');
  } else {
    alternativesDiv.innerHTML = '<div class="alternative-item"><span>No alternatives suggested</span></div>';
  }
  
  // Add goal alignment section if available
  if (data.goalAlignment && data.goalAlignment.length > 0) {
    const insightsDiv = document.getElementById('insights');
    
    insightsDiv.innerHTML += `
      <div class="results-section">
        <h3><i class="fas fa-bullseye"></i> Goal Alignment</h3>
        <div class="goal-alignment">
          ${data.goalAlignment.map(goal => `
            <div class="alignment-card ${goal.alignment}-alignment">
              <div class="alignment-header">
                <h4>${goal.goalType}</h4>
                <span class="alignment-badge ${goal.alignment}-badge">
                  ${goal.alignment === 'good' ? 'Good Match' : goal.alignment === 'neutral' ? 'Neutral' : 'Poor Match'}
                </span>
              </div>
              <p>${goal.recommendation}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  // Create enhanced nutrition charts
  createNutritionChart(data);
  createMacronutrientChart(data);
  
  // Show the AI assistant section
  document.getElementById('ai-assistant-container').style.display = 'block';
  
  // Log the scan to the database if authenticated
  if (window.auth.currentUser()) {
    logScan(currentMode, {
      rating: data.rating || 5,
      timestamp: new Date().toISOString(),
      items: data?.foodIdentification?.mainItems || []
    });
  }
}

// Create a more advanced nutrition radar chart
function createNutritionChart(data) {
  const chartEl = document.getElementById('nutritionChart');
  
  if (!chartEl) return;
  
  const ctx = chartEl.getContext('2d');
  
  // Destroy previous chart instance if it exists
  if (chartInstance) {
    chartInstance.destroy();
  }
  
  const rating = data.rating || 5;
  
  // Generate more meaningful chart data based on actual results
  let nutritionalValue = rating;
  let safety = rating * 0.8 + 2;
  let naturalIngredients = currentMode === 'label' ? 
    (data.ingredients?.safe?.length || 0) / ((data.ingredients?.safe?.length || 0) + (data.ingredients?.concerning?.length || 0)) * 10 : 
    rating * 0.9;
  let processingLevel = 10 - (currentMode === 'label' ? 
    (data.ingredients?.concerning?.filter(i => i.risk === 'high').length || 0) * 2 : 
    Math.abs(rating - 10));
  let additiveContent = 10 - (currentMode === 'label' ?
    (data.ingredients?.concerning?.length || 0) * 1.5 :
    Math.abs(rating - 10));
  
  // Ensure values are within 0-10 range
  [nutritionalValue, safety, naturalIngredients, processingLevel, additiveContent] = 
    [nutritionalValue, safety, naturalIngredients, processingLevel, additiveContent].map(v => 
      Math.max(0, Math.min(10, v)));
      
  chartInstance = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Nutritional Value', 'Safety', 'Natural Ingredients', 'Processing Level', 'Additive Content'],
      datasets: [{
        label: 'Product Score',
        data: [
          nutritionalValue, 
          safety,
          naturalIngredients,
          processingLevel,
          additiveContent
        ],
        backgroundColor: 'rgba(79, 70, 229, 0.2)',
        borderColor: 'rgba(79, 70, 229, 0.7)',
        pointBackgroundColor: 'rgba(79, 70, 229, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(79, 70, 229, 1)'
      }]
    },
    options: {
      scales: {
        r: {
          angleLines: {
            display: true,
            color: 'rgba(0, 0, 0, 0.1)'
          },
          suggestedMin: 0,
          suggestedMax: 10,
          ticks: {
            stepSize: 2,
            callback: function(value) {
              if (value === 0) return 'Poor';
              if (value === 10) return 'Excellent';
              return value;
            }
          },
          pointLabels: {
            font: {
              size: 12
            }
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let value = context.raw;
              let rating = value >= 7 ? 'Good' : value >= 4 ? 'Average' : 'Poor';
              return `${context.label}: ${value.toFixed(1)} - ${rating}`;
            }
          }
        }
      },
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

// Create a macronutrient pie chart for food mode
function createMacronutrientChart(data) {
  const macroChartEl = document.getElementById('macronutrientChart');
  
  if (!macroChartEl || currentMode !== 'food') return;
  
  const ctx = macroChartEl.getContext('2d');
  
  // Destroy previous chart instance if it exists
  if (window.macroChart) {
    window.macroChart.destroy();
  }
  
  const macroRatio = data.nutritionEstimate?.macroRatio || { protein: 25, carbs: 50, fat: 25 };
  
  window.macroChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Protein', 'Carbs', 'Fat'],
      datasets: [{
        data: [macroRatio.protein, macroRatio.carbs, macroRatio.fat],
        backgroundColor: [
          'rgba(79, 70, 229, 0.8)',  
          'rgba(14, 165, 233, 0.8)', 
          'rgba(245, 158, 11, 0.8)'  
        ],
        borderColor: [
          'rgba(79, 70, 229, 1)',
          'rgba(14, 165, 233, 1)',
          'rgba(245, 158, 11, 1)'
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.label}: ${context.raw}% of calories`;
            }
          }
        }
      }
    }
  });
}

// AI Chat Assistant functionality
async function submitAIQuestion() {
  const questionInput = document.getElementById('ai-question-input');
  const chatContainer = document.getElementById('ai-chat-container');
  
  const question = questionInput.value.trim();
  if (!question) return;
  
  // Add user message to chat
  chatContainer.innerHTML += `
    <div class="chat-message user-message">
      <div class="chat-bubble">
        <p>${question}</p>
      </div>
      <div class="chat-avatar">
        <i class="fas fa-user"></i>
      </div>
    </div>
  `;
  
  // Clear input
  questionInput.value = '';
  
  // Add user message to conversation history
  conversationHistory.push({
    role: "user",
    content: question
  });
  
  // Show loading indicator
  chatContainer.innerHTML += `
    <div class="chat-message ai-message" id="ai-loading-message">
      <div class="chat-avatar">
        <i class="fas fa-robot"></i>
      </div>
      <div class="chat-bubble">
        <div class="chat-loading">
          <div class="chat-loading-dot"></div>
          <div class="chat-loading-dot"></div>
          <div class="chat-loading-dot"></div>
        </div>
      </div>
    </div>
  `;
  
  // Scroll to bottom
  chatContainer.scrollTop = chatContainer.scrollHeight;
  
  try {
    // Create system message based on analysis data
    let systemMessage = `You are a helpful nutrition assistant named CalcuBite AI. 
Answer questions about nutrition, ingredients, health implications, and dietary advice.
${analysisData ? 'The user has just scanned a food item with the following analysis:' : ''}`;

    if (analysisData) {
      if (currentMode === 'label') {
        systemMessage += `
- Overall health rating: ${analysisData.rating}/10
- Key concerning ingredients: ${analysisData.ingredients?.concerning?.map(i => i.name).join(', ') || 'None'}
- Main health insights: ${analysisData.insights?.map(i => i.category).join(', ') || 'None available'}`;
      } else {
        systemMessage += `
- Food identified: ${analysisData.foodIdentification?.mainItems?.join(', ') || 'Unknown'}
- Overall health rating: ${analysisData.rating}/10
- Key beneficial ingredients: ${analysisData.ingredients?.beneficial?.map(i => i.name).join(', ') || 'None'}
- Dietary considerations: ${analysisData.dietaryConsiderations?.join(', ') || 'None specified'}`;
      }
    }
    
    systemMessage += `
Be helpful, accurate, and provide evidence-based advice. Keep answers concise but informative.
If the user asks about something not related to nutrition or health, politely redirect them.`;

    // Prepare messages for the API
    const messages = [
      {
        role: "system",
        content: systemMessage
      }
    ];
    
    // Only use the last 10 messages to avoid token limits
    if (conversationHistory.length > 10) {
      conversationHistory = conversationHistory.slice(-10);
    }
    
    messages.push(...conversationHistory);
    
    // Make request to Pollination API
    const response = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk_ZDnV9hilntSLCLGEmJKPxavBNJaPLI4K'
      },
      body: JSON.stringify({
        model: "claude-fast",
        messages: messages,
        temperature: 0.7,
        max_tokens: 800
      })
    });
    
    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    const aiResponse = data.choices && data.choices[0] && data.choices[0].message 
      ? data.choices[0].message.content 
      : "Sorry, I couldn't generate a response.";
    
    // Remove loading message
    const loadingMessage = document.getElementById('ai-loading-message');
    if (loadingMessage) loadingMessage.remove();
    
    // Add AI response to chat
    chatContainer.innerHTML += `
      <div class="chat-message ai-message">
        <div class="chat-avatar">
          <i class="fas fa-robot"></i>
        </div>
        <div class="chat-bubble">
          <p>${aiResponse.replace(/\n/g, '<br>')}</p>
        </div>
      </div>
    `;
    
    // Add AI response to conversation history
    conversationHistory.push({
      role: "assistant",
      content: aiResponse
    });
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
  } catch (error) {
    // Remove loading message
    const loadingMessage = document.getElementById('ai-loading-message');
    if (loadingMessage) loadingMessage.remove();
    
    // Show error message
    chatContainer.innerHTML += `
      <div class="chat-message ai-message">
        <div class="chat-avatar">
          <i class="fas fa-robot"></i>
        </div>
        <div class="chat-bubble error-bubble">
          <p>Sorry, I encountered an error: ${error.message}. Please try again.</p>
        </div>
      </div>
    `;
    
    console.error('AI Chat Error:', error);
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

// Show dashboard functionality
function showDashboard() {
  // AI Personalization check: If profile is not complete, prompt user
  if (window.auth) {
    const profile = window.auth.userProfile();
    if (profile && (!profile.gender || !profile.age || !profile.weight_kg)) {
      if (confirm("Personalize your health experience? \n\nFill out your profile details to enable AI-calculated daily limits for calories, protein, and more!")) {
          if (window.showProfileModal) {
            window.showProfileModal();
          } else {
            // Fallback just in case
            const btn = document.getElementById('profile-link');
            if (btn) btn.click();
          }
          return;
      }
    }
  }

  try {
    // Create dashboard modal if it doesn't exist
    let dashboardModal = document.getElementById('dashboard-modal');
    
    if (!dashboardModal) {
      dashboardModal = document.createElement('div');
      dashboardModal.id = 'dashboard-modal';
      dashboardModal.className = 'modal';
      
      dashboardModal.innerHTML = `
        <div class="modal-content" style="max-width: 1000px;">
          <div class="modal-header">
            <h2><i class="fas fa-tachometer-alt"></i> Your Dashboard</h2>
            <span class="close-modal">&times;</span>
          </div>
          <div class="modal-body">
            <div class="dashboard-content">
              <!-- New Daily Intake Tracker -->
              <div class="dashboard-section intake-tracker" style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                  <h3><i class="fas fa-calendar-day"></i> Today's Progress</h3>
                  <div id="today-date-display" style="font-size: 0.9rem; opacity: 0.9;"></div>
                </div>
                <div class="intake-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem;">
                  <div class="intake-stat">
                    <small>Calories</small>
                    <div id="today-calories" style="font-size: 1.5rem; font-weight: bold;">0 / 2000</div>
                    <div class="mini-progress-bar" style="height: 6px; background: rgba(255,255,255,0.2); border-radius: 3px; margin-top: 5px;">
                        <div id="cal-progress" style="height: 100%; width: 0%; background: #10b981; border-radius: 3px;"></div>
                    </div>
                  </div>
                  <div class="intake-stat">
                    <small>Sugar</small>
                    <div id="today-sugar" style="font-size: 1.5rem; font-weight: bold;">0 / 50g</div>
                    <div class="mini-progress-bar" style="height: 6px; background: rgba(255,255,255,0.2); border-radius: 3px; margin-top: 5px;">
                        <div id="sugar-progress" style="height: 100%; width: 0%; background: #f59e0b; border-radius: 3px;"></div>
                    </div>
                  </div>
                  <div class="intake-stat">
                    <small>Protein</small>
                    <div id="today-protein" style="font-size: 1.5rem; font-weight: bold;">0 / 50g</div>
                  </div>
                  <div class="intake-stat">
                    <small>Carbs</small>
                    <div id="today-carbs" style="font-size: 1.5rem; font-weight: bold;">0 / 275g</div>
                  </div>
                </div>
              </div>

              <div class="dashboard-overview">
                <div class="dashboard-chart">
                  <h3><i class="fas fa-chart-line"></i> Consumption History (30 Days)</h3>
                  <div class="chart-container" style="height: 250px;">
                    <canvas id="consumption-history-chart"></canvas>
                  </div>
                </div>
                <div class="dashboard-stats">
                  <div class="stat-card">
                    <div class="stat-icon">
                      <i class="fas fa-camera"></i>
                    </div>
                    <div class="stat-data">
                      <h4>Total Scans</h4>
                      <p id="dashboard-total-scans">0</p>
                    </div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-icon">
                      <i class="fas fa-calendar-check"></i>
                    </div>
                    <div class="stat-data">
                      <h4>Recent Activity</h4>
                      <p id="dashboard-last-scan">Never</p>
                    </div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-icon">
                      <i class="fas fa-bolt"></i>
                    </div>
                    <div class="stat-data">
                      <h4>Scans Remaining</h4>
                      <p id="dashboard-scans-remaining">0</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="dashboard-section personal-info" style="margin-bottom: 2rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                  <h3><i class="fas fa-user-edit"></i> Personal Profile</h3>
                </div>
                <div class="profile-form-compact" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; background: var(--bg-secondary); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border-color);">
                  <div class="form-group-compact">
                    <label style="font-size: 0.85rem; margin-bottom: 0.4rem; display: block;">Gender</label>
                    <select id="dash-gender" style="width: 100%; padding: 0.6rem; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-primary);">
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div class="form-group-compact">
                    <label style="font-size: 0.85rem; margin-bottom: 0.4rem; display: block;">Age</label>
                    <input type="number" id="dash-age" style="width: 100%; padding: 0.6rem; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-primary);" placeholder="Years">
                  </div>
                  <div class="form-group-compact">
                    <label style="font-size: 0.85rem; margin-bottom: 0.4rem; display: block;">Weight (kg)</label>
                    <input type="number" id="dash-weight" step="0.1" style="width: 100%; padding: 0.6rem; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-primary);" placeholder="kg">
                  </div>
                  <div class="form-group-compact">
                    <label style="font-size: 0.85rem; margin-bottom: 0.4rem; display: block;">Height (cm)</label>
                    <input type="number" id="dash-height" style="width: 100%; padding: 0.6rem; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-primary);" placeholder="cm">
                  </div>
                  <div class="form-group-compact" style="grid-column: span 1;">
                    <label style="font-size: 0.85rem; margin-bottom: 0.4rem; display: block;">Activity Level</label>
                    <select id="dash-activity" style="width: 100%; padding: 0.6rem; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-primary);">
                      <option value="sedentary">Sedentary</option>
                      <option value="light">Lightly active</option>
                      <option value="moderate">Moderately active</option>
                      <option value="very">Very active</option>
                      <option value="extra">Extra active</option>
                    </select>
                  </div>
                  <div class="form-group-compact" style="grid-column: 1 / -1; display: flex; gap: 1rem; align-items: flex-end; margin-top: 0.5rem;">
                    <button id="dash-update-profile" class="primary-button" style="padding: 0.7rem 1.5rem; flex: 1; justify-content: center;">
                      <i class="fas fa-save"></i> Save Profile
                    </button>
                    <button id="dash-generate-targets" class="secondary-button" style="padding: 0.7rem 1.5rem; flex: 1; justify-content: center; background: #4f46e5; color: white;">
                      <i class="fas fa-magic"></i> Generate AI Targets
                    </button>
                  </div>
                  <div id="dash-profile-status" style="grid-column: 1 / -1; font-size: 0.8rem; margin-top: 0.5rem; display: none; align-items: center; gap: 0.5rem;"></div>
                </div>
              </div>

              <div class="dashboard-section health-goals">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <h3><i class="fas fa-bullseye"></i> Health Goals</h3>
                  <button id="add-goal-button" class="secondary-button"><i class="fas fa-plus"></i> Add Goal</button>
                </div>
                <div id="goals-container" class="goals-container">
                  <div class="add-goal-card" id="no-goals-placeholder">
                    <p>You haven't set any health goals yet. Click "Add Goal" to get started!</p>
                  </div>
                </div>
              </div>
              
              <div class="dashboard-section">
                <h3><i class="fas fa-utensils"></i> Recent Logged Meals (30 Days)</h3>
                <div class="recent-logs">
                    <div id="recent-logs-list" class="scans-list">
                        <div class="empty-state">
                            <p>No meals logged in the last 30 days.</p>
                        </div>
                    </div>
                </div>
              </div>

              <div class="dashboard-section">
                <h3><i class="fas fa-history"></i> Recent Scans</h3>
                <div class="recent-scans">
                  <div id="recent-scans-list" class="scans-list">
                    <div class="empty-state" id="no-scans-placeholder">
                      <i class="fas fa-camera-retro"></i>
                      <p>You haven't scanned any items yet. Start scanning to see your history here!</p>
                      <button id="start-scanning-btn" class="primary-button">Start Scanning</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(dashboardModal);
      
      // Close button event
      const closeBtn = dashboardModal.querySelector('.close-modal');
      closeBtn.addEventListener('click', () => {
        dashboardModal.style.display = 'none';
        
        // Destroy chart to avoid canvas reuse issues
        if (window.scanHistoryChart) {
          window.scanHistoryChart.destroy();
          window.scanHistoryChart = null;
        }
      });
      
      // Add goal button
      const addGoalBtn = dashboardModal.querySelector('#add-goal-button');
      addGoalBtn.addEventListener('click', showAddGoalModal);
      
      // Start scanning button
      const startScanningBtn = dashboardModal.querySelector('#start-scanning-btn');
      startScanningBtn.addEventListener('click', () => {
        dashboardModal.style.display = 'none';
      });

      // Dash Profile Update
      const dashUpdateBtn = dashboardModal.querySelector('#dash-update-profile');
      dashUpdateBtn.addEventListener('click', handleDashboardProfileUpdate);

      // Dash AI Targets
      const dashTargetBtn = dashboardModal.querySelector('#dash-generate-targets');
      dashTargetBtn.addEventListener('click', handleDashboardTargetGeneration);
    }
    
    // Fetch user's dashboard data
    fetchDashboardData().then(() => {
      // Show the modal
      dashboardModal.style.display = 'block';
      
      // Update dashboard UI with fetched data
      updateDashboardUI();
      
      // Create chart
      createConsumptionChart();
    }).catch(error => {
      console.error('Error showing dashboard:', error);
      alert('Error loading dashboard data. Please try again.');
    });
    
  } catch (error) {
    console.error('Error showing dashboard:', error);
    alert('Error showing dashboard: ' + error.message);
  }
}

// Fetch dashboard data
async function handleDashboardProfileUpdate() {
    const updateData = {
        gender: document.getElementById('dash-gender').value,
        age: parseInt(document.getElementById('dash-age').value),
        weight_kg: parseFloat(document.getElementById('dash-weight').value),
        height_cm: parseFloat(document.getElementById('dash-height').value),
        activity_level: document.getElementById('dash-activity').value
    };

    const statusEl = document.getElementById('dash-profile-status');
    statusEl.style.display = 'flex';
    statusEl.style.color = 'var(--primary)';
    statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving profile...';

    const success = await window.auth.updateProfile(updateData);
    if (success) {
        statusEl.style.color = 'var(--success)';
        statusEl.innerHTML = '<i class="fas fa-check-circle"></i> Profile saved successfully!';
        setTimeout(() => statusEl.style.display = 'none', 3000);
    } else {
        statusEl.style.color = 'var(--danger)';
        statusEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> Error saving profile.';
    }
}

async function handleDashboardTargetGeneration() {
    const updateData = {
        gender: document.getElementById('dash-gender').value,
        age: parseInt(document.getElementById('dash-age').value),
        weight_kg: parseFloat(document.getElementById('dash-weight').value),
        height_cm: parseFloat(document.getElementById('dash-height').value),
        activity_level: document.getElementById('dash-activity').value
    };

    if (!updateData.gender || !updateData.age || !updateData.weight_kg) {
        alert("Please fill out your profile info first (Gender, Age, Weight) to generate accurate targets.");
        return;
    }

    const statusEl = document.getElementById('dash-profile-status');
    statusEl.style.display = 'flex';
    statusEl.style.color = 'var(--primary)';
    statusEl.innerHTML = '<i class="fas fa-magic fa-spin"></i> AI is calculating your nutritional targets...';

    try {
        const goals = await calculateNutritionalGoals(updateData);
        updateData.nutritional_goals = goals;

        const success = await window.auth.updateProfile(updateData);
        if (success) {
            statusEl.style.color = 'var(--success)';
            statusEl.innerHTML = '<i class="fas fa-check-circle"></i> AI Targets generated and saved!';

            // Refresh dashboard view
            await fetchDashboardData();
            updateDashboardUI();

            setTimeout(() => statusEl.style.display = 'none', 5000);
        } else {
            throw new Error("Failed to save goals");
        }
    } catch (err) {
        console.error("AI Target Error:", err);
        statusEl.style.color = 'var(--danger)';
        statusEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> Error generating targets. Please try again.';
    }
}

async function calculateNutritionalGoals(profile) {
    const prompt = `Based on the following user profile, calculate daily nutritional limits:
Gender: ${profile.gender}
Age: ${profile.age}
Weight: ${profile.weight_kg}kg
Height: ${profile.height_cm}cm
Activity Level: ${profile.activity_level}

Provide a JSON object with these keys: calories, protein (g), carbs (g), fat (g), sugar (g), sodium (mg).
Respond ONLY with the JSON object.`;

    const response = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer sk_ZDnV9hilntSLCLGEmJKPxavBNJaPLI4K'
        },
        body: JSON.stringify({
            model: "claude-fast",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        })
    });

    if (!response.ok) throw new Error("AI calculation failed");
    const data = await response.json();
    const content = data.choices[0].message.content;

    // Improved JSON extraction
    try {
      const firstBracket = content.indexOf('{');
      const lastBracket = content.lastIndexOf('}');
      if (firstBracket !== -1 && lastBracket !== -1) {
        return JSON.parse(content.substring(firstBracket, lastBracket + 1));
      }
      return JSON.parse(content);
    } catch (e) {
      console.error("AI Goal Parsing Failed. Raw content:", content);
      throw new Error("AI output was not valid JSON");
    }
}

async function fetchDashboardData() {
  if (!window.auth || !window.auth.currentUser()) return;
  
  const sb = window.supabase_client;
  try {
    // Fetch daily logs for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: logsData, error: logsError } = await sb
        .from('daily_logs')
        .select('*')
        .eq('user_id', window.auth.currentUser().id)
        .gte('logged_at', thirtyDaysAgo.toISOString())
        .order('logged_at', { ascending: false });

    if (logsError) throw logsError;

    // Fetch scan history
    const { data: scanData, error: scanError } = await sb
      .from('scan_history')
      .select('*')
      .eq('user_id', window.auth.currentUser().id)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (scanError) throw scanError;
    
    // Fetch health goals
    const { data: goalData, error: goalError } = await sb
      .from('health_goals')
      .select('*')
      .eq('user_id', window.auth.currentUser().id)
      .order('created_at', { ascending: false });
    
    if (goalError) throw goalError;
    
    // Fetch profile for scans remaining
    const { data: profileData, error: profileError } = await sb
      .from('profiles')
      .select('*')
      .eq('id', window.auth.currentUser().id)
      .single();
    
    if (profileError && profileError.code !== 'PGRST116') throw profileError;
    
    // Store data for UI update
    userDashboardData = {
      logs: logsData || [],
      scans: scanData || [],
      goals: goalData || [],
      profile: profileData || { scans_remaining: 0 },
      profile_data: profileData
    };
    
    // Update global variable for user health goals
    userHealthGoals = goalData?.map(g => ({
      id: g.id,
      type: g.goal_type,
      target: g.target,
      timeline: g.timeline,
      notes: g.notes,
      progress: g.progress
    })) || [];
    
    return userDashboardData;
    
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    throw error;
  }
}

// Update dashboard UI with data
function updateDashboardUI() {
  if (!userDashboardData) return;
  
  // Update Intake Tracker
  const today = new Date().toISOString().split('T')[0];
  const todayLogs = userDashboardData.logs.filter(log => log.logged_at.startsWith(today));

  const totals = todayLogs.reduce((acc, log) => ({
    calories: acc.calories + (log.calories || 0),
    protein: acc.protein + (log.protein || 0),
    carbs: acc.carbs + (log.carbs || 0),
    sugar: acc.sugar + (log.sugar || 0)
  }), { calories: 0, protein: 0, carbs: 0, sugar: 0 });

  const goals = window.auth ? window.auth.getNutritionalGoals() : {
    calories: 2000,
    protein: 50,
    carbs: 275,
    fat: 78,
    sugar: 50,
    sodium: 2300
  };

  document.getElementById('today-date-display').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('today-calories').textContent = `${Math.round(totals.calories)} / ${goals.calories}`;
  document.getElementById('today-sugar').textContent = `${Math.round(totals.sugar)} / ${goals.sugar}g`;
  document.getElementById('today-protein').textContent = `${Math.round(totals.protein)} / ${goals.protein}g`;
  document.getElementById('today-carbs').textContent = `${Math.round(totals.carbs)} / ${goals.carbs}g`;

  const calPct = Math.min(100, (totals.calories / goals.calories) * 100);
  const sugarPct = Math.min(100, (totals.sugar / goals.sugar) * 100);

  document.getElementById('cal-progress').style.width = `${calPct}%`;
  document.getElementById('sugar-progress').style.width = `${sugarPct}%`;
  document.getElementById('sugar-progress').style.backgroundColor = sugarPct > 90 ? '#ef4444' : '#f59e0b';

  // Update Profile Form Fields
  const profile = userDashboardData.profile_data || window.auth.userProfile();
  if (profile) {
    if (document.getElementById('dash-gender')) document.getElementById('dash-gender').value = profile.gender || '';
    if (document.getElementById('dash-age')) document.getElementById('dash-age').value = profile.age || '';
    if (document.getElementById('dash-weight')) document.getElementById('dash-weight').value = profile.weight_kg || '';
    if (document.getElementById('dash-height')) document.getElementById('dash-height').value = profile.height_cm || '';
    if (document.getElementById('dash-activity')) document.getElementById('dash-activity').value = profile.activity_level || 'sedentary';
  }

  // Update Recent Logs
  const recentLogsList = document.getElementById('recent-logs-list');
  if (recentLogsList && userDashboardData.logs.length > 0) {
      recentLogsList.innerHTML = '';
      userDashboardData.logs.slice(0, 10).forEach(log => {
          const logDate = new Date(log.logged_at).toLocaleDateString();
          const logItem = document.createElement('div');
          logItem.className = 'scan-item';
          logItem.innerHTML = `
            <div class="scan-icon"><i class="fas fa-utensils"></i></div>
            <div class="scan-details">
                <h4>${log.food_name}</h4>
                <p class="scan-date">${logDate}</p>
                <p class="scan-item-name">${Math.round(log.calories)} kcal | P: ${Math.round(log.protein)}g | C: ${Math.round(log.carbs)}g</p>
            </div>
          `;
          recentLogsList.appendChild(logItem);
      });
  }

  // Update stats
  const totalScansEl = document.getElementById('dashboard-total-scans');
  const scansRemainingEl = document.getElementById('dashboard-scans-remaining');
  const lastScanEl = document.getElementById('dashboard-last-scan');
  
  if (totalScansEl) totalScansEl.textContent = userDashboardData.scans?.length || 0;
  if (scansRemainingEl) scansRemainingEl.textContent = userDashboardData.profile?.scans_remaining || 0;
  
  // Last scan date
  if (lastScanEl) {
    if (userDashboardData.scans && userDashboardData.scans.length > 0) {
      const lastScanDate = new Date(userDashboardData.scans[0].created_at);
      lastScanEl.textContent = lastScanDate.toLocaleDateString();
    } else {
      lastScanEl.textContent = 'Never';
    }
  }
  
  // Update recent scans list
  const recentScansList = document.getElementById('recent-scans-list');
  const noScansPlaceholder = document.getElementById('no-scans-placeholder');

  if (recentScansList) {
    if (userDashboardData.scans.length > 0 && noScansPlaceholder) {
      noScansPlaceholder.style.display = 'none';
      
      // Clear existing list
      recentScansList.innerHTML = '';
      
      // Add scan items (up to 5)
      const recentScans = userDashboardData.scans.slice(0, 5);
      
      recentScans.forEach(scan => {
        const scanDate = new Date(scan.created_at).toLocaleDateString();
        const scanItem = document.createElement('div');
        scanItem.className = 'scan-item';
        
        let scanIcon, scanType;
        switch (scan.scan_type) {
          case 'label':
            scanIcon = 'tag';
            scanType = 'Label Analysis';
            break;
          case 'food':
            scanIcon = 'utensils';
            scanType = 'Food Analysis';
            break;
          case 'gym':
            scanIcon = 'dumbbell';
            scanType = 'Gym Analysis';
            break;
          default:
            scanIcon = 'camera';
            scanType = 'Scan';
        }
        
        // Get food items for display and actual rating from scan data
        const foodItems = scan.scan_data?.items ? scan.scan_data.items.join(', ') : 
                          (scanType === 'Label Analysis' ? 'Food label' : 'Food item');
        const scanRating = scan.scan_data?.rating !== undefined ? scan.scan_data.rating : 'N/A';
        
        scanItem.innerHTML = `
          <div class="scan-icon">
            <i class="fas fa-${scanIcon}"></i>
          </div>
          <div class="scan-details">
            <h4>${scanType}</h4>
            <p class="scan-date">${scanDate}</p>
            <p class="scan-item-name">${foodItems}</p>
          </div>
          <div class="scan-rating">${scanRating}</div>
        `;
        
        recentScansList.appendChild(scanItem);
      });
    } else if (noScansPlaceholder) {
      noScansPlaceholder.style.display = 'flex';
    }
  }
  
  // Update health goals
  const goalsContainer = document.getElementById('goals-container');
  const noGoalsPlaceholder = document.getElementById('no-goals-placeholder');
  
  if (goalsContainer) {
    if (userDashboardData.goals.length > 0 && noGoalsPlaceholder) {
      noGoalsPlaceholder.style.display = 'none';
      
      // Clear existing goals
      goalsContainer.innerHTML = '';
      
      // Add goal cards
      userDashboardData.goals.forEach(goal => {
        const goalCard = document.createElement('div');
        goalCard.className = 'goal-card';
        goalCard.id = `goal-${goal.id}`;
        
        let goalIcon;
        switch (goal.goal_type.toLowerCase()) {
          case 'weight loss':
            goalIcon = 'weight';
            break;
          case 'muscle gain':
            goalIcon = 'dumbbell';
            break;
          case 'nutrition':
            goalIcon = 'apple-alt';
            break;
          case 'health':
            goalIcon = 'heartbeat';
            break;
          default:
            goalIcon = 'bullseye';
        }
        
        goalCard.innerHTML = `
          <div class="goal-header">
            <h4><i class="fas fa-${goalIcon}"></i> ${goal.goal_type}</h4>
            <button class="delete-goal" data-id="${goal.id}">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="goal-details">
            <p><strong>Target:</strong> ${goal.target}</p>
            <p><strong>Timeline:</strong> ${goal.timeline || 'Not specified'}</p>
            ${goal.notes ? `<p><strong>Notes:</strong> ${goal.notes}</p>` : ''}
          </div>
          <div class="goal-progress">
            <div class="progress-bar">
              <div class="progress" style="width: ${goal.progress}%; background-color: var(--primary);"></div>
            </div>
            <small>${goal.progress}% complete</small>
          </div>
        `;
        
        goalsContainer.appendChild(goalCard);
        
        // Add delete event listener
        const deleteBtn = goalCard.querySelector('.delete-goal');
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteGoal(goal.id);
        });
      });
      
      // Add "Add Goal" card at the end
      const addGoalCard = document.createElement('div');
      addGoalCard.className = 'add-goal-card';
      addGoalCard.innerHTML = `
        <i class="fas fa-plus"></i>
        <p>Add New Goal</p>
      `;
      
      addGoalCard.addEventListener('click', showAddGoalModal);
      goalsContainer.appendChild(addGoalCard);
      
    } else {
      // No goals placeholder
      goalsContainer.innerHTML = `
        <div class="add-goal-card" id="no-goals-placeholder">
          <p>You haven't set any health goals yet. Click "Add Goal" to get started!</p>
        </div>
      `;
      
      // Add click event
      const addGoalCard = goalsContainer.querySelector('.add-goal-card');
      if (addGoalCard) {
        addGoalCard.addEventListener('click', showAddGoalModal);
      }
    }
  }
}

// Show add goal modal
function showAddGoalModal() {
  // Create modal if it doesn't exist
  let goalModal = document.getElementById('add-goal-modal');
  
  if (!goalModal) {
    goalModal = document.createElement('div');
    goalModal.id = 'add-goal-modal';
    goalModal.className = 'modal';
    
    goalModal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2><i class="fas fa-plus-circle"></i> Add Health Goal</h2>
          <span class="close-modal">&times;</span>
        </div>
        <div class="modal-body">
          <form id="add-goal-form">
            <div class="form-group">
              <label for="goal-type">Goal Type</label>
              <select id="goal-type" required>
                <option value="">Select a goal type</option>
                <option value="Weight Loss">Weight Loss</option>
                <option value="Muscle Gain">Muscle Gain</option>
                <option value="Nutrition">Nutrition</option>
                <option value="Health">Health Improvement</option>
                <option value="Fitness">Fitness</option>
              </select>
            </div>
            <div class="form-group">
              <label for="goal-target">Target</label>
              <input type="text" id="goal-target" placeholder="E.g., Lose 10 pounds, Reduce sugar intake" required>
            </div>
            <div class="form-group">
              <label for="goal-timeline">Timeline (optional)</label>
              <input type="text" id="goal-timeline" placeholder="E.g., 3 months, By December">
            </div>
            <div class="form-group">
              <label for="goal-notes">Notes (optional)</label>
              <textarea id="goal-notes" rows="3" placeholder="Additional details or notes"></textarea>
            </div>
            <button type="submit" class="primary-button">Save Goal</button>
          </form>
        </div>
      </div>
    `;
    
    document.body.appendChild(goalModal);
    
    // Close button event
    const closeBtn = goalModal.querySelector('.close-modal');
    closeBtn.addEventListener('click', () => {
      goalModal.style.display = 'none';
    });
    
    // Form submission
    const form = goalModal.querySelector('#add-goal-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      saveGoal();
    });
  }
  
  // Reset form
  const form = goalModal.querySelector('#add-goal-form');
  if (form) form.reset();
  
  // Show modal
  goalModal.style.display = 'block';
}

// Save goal to database
async function saveGoal() {
  try {
    const goalType = document.getElementById('goal-type').value;
    const target = document.getElementById('goal-target').value;
    const timeline = document.getElementById('goal-timeline').value;
    const notes = document.getElementById('goal-notes').value;
    
    if (!window.auth.currentUser()) {
      alert('You must be logged in to save goals.');
      return;
    }
    
    const sb = window.supabase_client;
    // Check for duplicate goal prevention
    const { data: existingGoals, error: checkError } = await sb
      .from('health_goals')
      .select('id')
      .eq('user_id', window.auth.currentUser().id)
      .eq('goal_type', goalType)
      .eq('target', target);
      
    if (checkError) throw checkError;
    
    // If duplicate found, alert and exit
    if (existingGoals && existingGoals.length > 0) {
      alert('You already have this goal in your dashboard.');
      return;
    }
    
    const { data, error } = await sb
      .from('health_goals')
      .insert([{
        user_id: window.auth.currentUser().id,
        goal_type: goalType,
        target: target,
        timeline: timeline,
        notes: notes,
        progress: 0
      }]);
    
    if (error) throw error;
    
    // Close modal
    const goalModal = document.getElementById('add-goal-modal');
    if (goalModal) goalModal.style.display = 'none';
    
    // Refresh dashboard data
    await fetchDashboardData();
    updateDashboardUI();
    
    // Show success message
    alert('Goal added successfully!');
    
  } catch (error) {
    console.error('Error saving goal:', error);
    alert('Error saving goal: ' + error.message);
  }
}

// Delete goal
async function deleteGoal(goalId) {
  if (!confirm('Are you sure you want to delete this goal?')) {
    return;
  }
  
  try {
    const sb = window.supabase_client;
    const { error } = await sb
      .from('health_goals')
      .delete()
      .eq('id', goalId);
    
    if (error) throw error;
    
    // Remove from UI
    const goalCard = document.getElementById(`goal-${goalId}`);
    if (goalCard) goalCard.remove();
    
    // Refresh dashboard data
    await fetchDashboardData();
    updateDashboardUI();
    
  } catch (error) {
    console.error('Error deleting goal:', error);
    alert('Error deleting goal: ' + error.message);
  }
}

// Dashboard link
const dashboardLink = document.getElementById('dashboard-link');
if (dashboardLink) {
    dashboardLink.addEventListener('click', (e) => {
        e.preventDefault();
        showDashboard();
    });
}

// Theme toggle functionality
function toggleTheme() {
  const body = document.body;
  const themeToggle = document.getElementById('theme-toggle');
  
  if (currentTheme === 'light') {
    body.classList.add('dark-theme');
    themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    currentTheme = 'dark';
  } else {
    body.classList.remove('dark-theme');
    themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    currentTheme = 'light';
  }
}

// Create consumption history chart
function createConsumptionChart() {
  const chartCanvas = document.getElementById('consumption-history-chart');
  if (!chartCanvas) return;

  if (window.consumptionChart) {
    window.consumptionChart.destroy();
    window.consumptionChart = null;
  }

  // Group calorie intake by date for the last 30 days
  const dataByDate = {};
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    dataByDate[dateStr] = 0;
  }

  if (userDashboardData?.logs) {
    userDashboardData.logs.forEach(log => {
      const dateStr = log.logged_at.split('T')[0];
      if (dataByDate[dateStr] !== undefined) {
        dataByDate[dateStr] += log.calories || 0;
      }
    });
  }

  const labels = Object.keys(dataByDate).map(date => {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
  const data = Object.values(dataByDate);

  try {
    window.consumptionChart = new Chart(chartCanvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Daily Calories',
          data: data,
          backgroundColor: 'rgba(79, 70, 229, 0.7)',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Daily Calorie Intake (30 Days)' }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  } catch (err) {
    console.error('Error creating consumption chart:', err);
  }
}

// Create scan history chart
function createScanHistoryChart() {
  const chartCanvas = document.getElementById('scan-history-chart');
  if (!chartCanvas) return;
  
  // Check if chart instance exists and destroy it
  if (window.scanHistoryChart) {
    window.scanHistoryChart.destroy();
    window.scanHistoryChart = null;
  }
  
  // Group scan data by date
  const scansByDate = {};
  
  if (userDashboardData?.scans) {
    // Create date range for the last 14 days
    const dateLabels = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const date = new Date();
      date.setDate(now.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dateLabels.push(dateStr);
      scansByDate[dateStr] = 0;
    }
    
    // Count scans by date
    userDashboardData.scans.forEach(scan => {
      const scanDate = new Date(scan.created_at);
      const dateStr = scanDate.toISOString().split('T')[0];
      if (scansByDate[dateStr] !== undefined) {
        scansByDate[dateStr]++;
      }
    });
    
    // Convert object to arrays for Chart.js
    const labels = Object.keys(scansByDate).sort();
    const data = labels.map(date => scansByDate[date]);
    
    // Format labels for display (e.g., "Apr 15")
    const formattedLabels = labels.map(date => {
      const d = new Date(date);
      return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
    });
    
    try {
      window.scanHistoryChart = new Chart(chartCanvas, {
        type: 'line',
        data: {
          labels: formattedLabels,
          datasets: [{
            label: 'Scans',
            data: data,
            backgroundColor: 'rgba(79, 70, 229, 0.2)',
            borderColor: 'rgba(79, 70, 229, 1)',
            tension: 0.4,
            fill: true,
            pointBackgroundColor: 'rgba(79, 70, 229, 1)',
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            },
            title: {
              display: true,
              text: 'Scan Activity (Last 14 Days)'
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                precision: 0
              }
            },
            x: {
              grid: {
                display: false
              }
            }
          }
        }
      });
    } catch (err) {
      console.error('Error creating chart:', err);
      
      // Fallback for chart creation error
      if (chartCanvas) {
        chartCanvas.getContext('2d').clearRect(0, 0, chartCanvas.width, chartCanvas.height);
        chartCanvas.insertAdjacentHTML('afterend', 
          `<div class="chart-fallback" style="text-align: center; padding: 20px;">
             <i class="fas fa-chart-line" style="color: var(--primary); font-size: 2rem; margin-bottom: 0.5rem;"></i>
             <p>No scan history available to display</p>
           </div>`
        );
      }
    }
  } else {
    // Handle case when no scan data is available
    if (chartCanvas) {
      chartCanvas.getContext('2d').clearRect(0, 0, chartCanvas.width, chartCanvas.height);
      chartCanvas.insertAdjacentHTML('afterend', 
        `<div class="chart-fallback" style="text-align: center; padding: 20px;">
           <i class="fas fa-chart-line" style="color: var(--primary); font-size: 2rem; margin-bottom: 0.5rem;"></i>
           <p>No scan history available to display</p>
         </div>`
      );
    }
  }
}

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Show landing page for unauthenticated users
  const isAuthenticated = window.auth && window.auth.currentUser && window.auth.currentUser();
  const landingPage = document.getElementById('landing-page');
  const appContainer = document.getElementById('app-container');
  const authContainer = document.getElementById('auth-container');
  
  if (!isAuthenticated && landingPage) {
    landingPage.style.display = 'block';
    appContainer.style.display = 'none';
    authContainer.style.display = 'none';
    document.body.classList.add('landing-mode');
    
    // Mobile menu functionality
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const landingNav = document.querySelector('.landing-nav');
    
    if (mobileMenuToggle) {
      mobileMenuToggle.addEventListener('click', () => {
        landingNav.classList.toggle('show');
        mobileMenuToggle.querySelector('i').classList.toggle('fa-bars');
        mobileMenuToggle.querySelector('i').classList.toggle('fa-times');
      });
      
      // Close menu when clicking navigation items
      const navLinks = landingNav.querySelectorAll('a');
      navLinks.forEach(link => {
        link.addEventListener('click', () => {
          landingNav.classList.remove('show');
          mobileMenuToggle.querySelector('i').classList.remove('fa-times');
          mobileMenuToggle.querySelector('i').classList.add('fa-bars');
        });
      });
    }
  }
  
  // Add landing page auth navigation
  const landingLoginBtn = document.getElementById('landing-login-btn');
  const landingSignupBtn = document.getElementById('landing-signup-btn');
  const heroSignupBtn = document.getElementById('hero-signup-btn');
  const ctaSignupBtn = document.getElementById('cta-signup-btn');
  
  if (landingLoginBtn) {
    landingLoginBtn.addEventListener('click', () => {
      showLoginForm();
      document.getElementById('landing-page').style.display = 'none';
      document.getElementById('auth-container').style.display = 'flex';
    });
  }
  
  if (landingSignupBtn) {
    landingSignupBtn.addEventListener('click', () => {
      showRegisterForm();
      document.getElementById('landing-page').style.display = 'none';
      document.getElementById('auth-container').style.display = 'flex';
    });
  }
  
  if (heroSignupBtn) {
    heroSignupBtn.addEventListener('click', () => {
      showRegisterForm();
      document.getElementById('landing-page').style.display = 'none';
      document.getElementById('auth-container').style.display = 'flex';
    });
  }
  
  if (ctaSignupBtn) {
    ctaSignupBtn.addEventListener('click', () => {
      showRegisterForm();
      document.getElementById('landing-page').style.display = 'none';
      document.getElementById('auth-container').style.display = 'flex';
    });
  }
  
  // Handle demo button click
  const demoBtn = document.getElementById('hero-demo-btn');
  if (demoBtn) {
    demoBtn.addEventListener('click', () => {
      // You can show a demo video modal here
      alert('Demo functionality coming soon!');
    });
  }
  
  // AI Chat submit button
  const aiSubmitBtn = document.getElementById('ai-submit-button');
  if (aiSubmitBtn) {
    aiSubmitBtn.addEventListener('click', submitAIQuestion);
  }
  
  // AI Chat input enter key
  const aiQuestionInput = document.getElementById('ai-question-input');
  if (aiQuestionInput) {
    aiQuestionInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        submitAIQuestion();
      }
    });
  }
  
  // Theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
  
  // Hide macronutrient section initially
  if (macroSection) {
    macroSection.style.display = 'none';
  }
  
  // Reset daily scan count if needed
  if (window.auth && window.auth.currentUser && window.auth.currentUser()) {
    window.auth.resetDailyScanCount();
  }
  
  // Additional landing page animations
  // Add scroll animations to landing page elements
  if (document.querySelector('.landing-page')) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
        }
      });
    }, {
      threshold: 0.1
    });
    
    document.querySelectorAll('.feature-card, .step-card, .testimonial-card, .section-header').forEach(el => {
      el.classList.add('animate-item');
      observer.observe(el);
    });
  }

  // Make device mockup interactive
  const deviceMockup = document.querySelector('.device-mockup');
  if (deviceMockup) {
    deviceMockup.addEventListener('mousemove', (e) => {
      const rect = deviceMockup.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      
      deviceMockup.style.transform = `rotate(${-5 + x * 5}deg) translateY(${-20 + y * 10}px)`;
    });

    deviceMockup.addEventListener('mouseleave', () => {
      deviceMockup.style.transform = 'rotate(-5deg) translateY(-20px)';
    });
  }
  
  // Dashboard link
  const dashboardLink = document.getElementById('dashboard-link');
  if (dashboardLink) {
    dashboardLink.addEventListener('click', (e) => {
      e.preventDefault();
      showDashboard();
    });
  }
});

// Helper to extract JSON from AI response
function extractJSON(text) {
  try {
    // Find the first '{' and last '}'
    const firstBracket = text.indexOf('{');
    const lastBracket = text.lastIndexOf('}');
    if (firstBracket !== -1 && lastBracket !== -1) {
      const jsonPart = text.substring(firstBracket, lastBracket + 1);
      return JSON.parse(jsonPart);
    }
    return JSON.parse(text);
  } catch (e) {
    console.error("Original text that failed parsing:", text);
    throw new Error("Could not parse JSON from AI response. Please try again.");
  }
}

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      }).catch(error => {
        console.log('ServiceWorker registration failed: ', error);
      });
  });
}

// Create a variable to track if installation prompt has been shown
let deferredPrompt;

// Listen for beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  
  // Show install banner after 3 seconds
  setTimeout(() => {
    showInstallBanner();
  }, 3000);
});

// Function to show install banner
function showInstallBanner() {
  if (!deferredPrompt) return;
  
  // Check if banner already exists
  if (document.getElementById('install-banner')) return;
  
  // Create install banner
  const banner = document.createElement('div');
  banner.id = 'install-banner';
  banner.className = 'install-banner';
  banner.innerHTML = `
    <div class="install-content">
      <img src="/6233209994745069536_120.jpg" alt="CalcuBite Icon" width="40" height="40">
      <div class="install-text">
        <strong>Add CalcuBite to Home Screen</strong>
        <span>Install for a better experience</span>
      </div>
    </div>
    <div class="install-actions">
      <button id="install-later">Later</button>
      <button id="install-now" class="primary-button">Install</button>
    </div>
    <button id="close-install-banner" aria-label="Close"><i class="fas fa-times"></i></button>
  `;
  
  document.body.appendChild(banner);
  
  // Add event listeners to buttons
  document.getElementById('install-now').addEventListener('click', () => {
    // Hide the banner
    banner.style.display = 'none';
    
    // Show the installation prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      // Clear the saved prompt since it can't be used again
      deferredPrompt = null;
    });
  });
  
  document.getElementById('install-later').addEventListener('click', () => {
    banner.style.display = 'none';
  });
  
  document.getElementById('close-install-banner').addEventListener('click', () => {
    banner.style.display = 'none';
  });
}