// Global variables
let currentMode = 'label'; // Default mode is label analysis
let conversationHistory = [];
let currentTheme = 'light';
let analysisData = null;
let isCameraOn = false;
let stream = null;
let chartInstance = null;

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
  if (!window.auth.currentUser()) return;
  
  try {
    await supabase
      .from('scan_history')
      .insert([{
        user_id: window.auth.currentUser().id,
        scan_type: scanType,
        scan_data: scanData
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
      // Only check scan limits for non-premium users
      if (!window.auth.isPremium()) {
        const canScan = await window.auth.updateScansRemaining(1);
        if (!canScan) {
          // Show premium notification if user can't scan
          premiumNotification.style.display = 'flex';
          loadingDiv.style.display = 'none';
          return;
        }
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
  
  if (currentMode === 'label') {
    systemPrompt = `You are an advanced nutrition and food safety expert. Analyze the ingredients list and provide:
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
  }
}`;
  } else if (currentMode === 'food') {
    systemPrompt = `You are an advanced nutrition and food science expert. Analyze the food in this image and provide:
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
}`;
  } else if (currentMode === 'gym') {
    systemPrompt = `You are an advanced sports nutrition and fitness expert. Analyze the food in this image from a workout and fitness perspective:
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
}`;
  }

  try {
    loadingDiv.style.display = 'block';
    errorDiv.style.display = 'none';
    
    const completion = await websim.chat.completions.create({
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
              text: currentMode === 'label' ? 
                "Analyze this food label and provide detailed insights:" : 
                (currentMode === 'food' ? 
                  "Analyze this food image and provide detailed nutritional insights:" :
                  "Analyze this food image from a fitness and workout perspective:")
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64Image}` }
            }
          ]
        }
      ],
      model: "openai-large", // Use the larger model
      json: true
    });

    // Store the data globally for the AI chat to use
    analysisData = JSON.parse(completion.content);
    displayResults(analysisData);
    loadingDiv.style.display = 'none';
    
    // Log the scan to the database
    if (window.auth.currentUser()) {
      logScan(currentMode, {
        rating: analysisData.rating,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    errorDiv.style.display = 'block';
    errorDiv.textContent = 'Error analyzing image: ' + error.message;
    loadingDiv.style.display = 'none';
    console.error("API Error:", error);
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
      ${nutrition.fiber ? `
      <div class="nutrition-item">
        <small>Fiber</small>
        <div class="nutrition-value">${nutrition.fiber}</div>
      </div>
      ` : ''}
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
  
  // Create enhanced nutrition charts
  createNutritionChart(data);
  createMacronutrientChart(data);
  
  // Show the AI assistant section
  document.getElementById('ai-assistant-container').style.display = 'block';
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
          'rgba(79, 70, 229, 0.8)',  // Primary
          'rgba(14, 165, 233, 0.8)', // Secondary
          'rgba(245, 158, 11, 0.8)'  // Warning
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
    let systemMessage = `You are a helpful nutrition assistant named NutriScan AI. 
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

    // Prepare messages for the AI chat
    let messages = [
      {
        role: "system",
        content: systemMessage
      }
    ];
    
    // Only use the last 10 messages to avoid token limits
    if (conversationHistory.length > 10) {
      conversationHistory = conversationHistory.slice(-10);
    }
    
    messages = [...messages, ...conversationHistory];
    
    // Make the AI call
    const completion = await websim.chat.completions.create({
      messages: messages
    });
    
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
          <p>${completion.content.replace(/\n/g, '<br>')}</p>
        </div>
      </div>
    `;
    
    // Add AI response to conversation history
    conversationHistory.push({
      role: "assistant",
      content: completion.content
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
          <p>Sorry, I encountered an error. Please try again.</p>
        </div>
      </div>
    `;
    
    console.error('AI Chat Error:', error);
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
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

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Check for auth confirmation in URL
  const hash = window.location.hash;
  if (hash.includes('access_token=') || hash.includes('refresh_token=')) {
    // Remove the hash to clean the URL
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
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
  if (window.auth.currentUser() && !window.auth.isPremium()) {
    window.auth.resetDailyScanCount();
  }
});

// Flash functionality
const flashOption = document.querySelector('.flash-option');
if (flashOption) {
  let flashEnabled = false;
  
  flashOption.addEventListener('click', async () => {
    try {
      if (!video.srcObject) return;
      
      const track = video.srcObject.getVideoTracks()[0];
      const capabilities = track.getCapabilities();
      
      if (capabilities.torch) {
        flashEnabled = !flashEnabled;
        await track.applyConstraints({
          advanced: [{ torch: flashEnabled }]
        });
        flashOption.style.backgroundColor = flashEnabled ? 'rgba(255,255,0,0.3)' : 'rgba(255,255,255,0.8)';
      } else {
        console.log('Torch not supported on this device');
      }
    } catch (err) {
      console.error('Flash error:', err);
    }
  });
}