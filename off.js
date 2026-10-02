// ============================================================
// CalcuBite — off.js
// Barcode scanning (ZXing) + Open Food Facts product database
// + text/voice food search. All free & keyless.
// ============================================================

// ------------------------------------------------------------
// Open Food Facts API (free, no key, 3M+ products)
// ------------------------------------------------------------
const OFF_BASE = 'https://world.openfoodfacts.org';
const OFF_FIELDS = 'product_name,generic_name,brands,quantity,serving_size,' +
  'nutriments,nutriscore_grade,nova_group,ingredients_text,additives_tags,' +
  'categories,image_front_small_url,countries';

async function offFetchProduct(barcode) {
  const res = await window.cb.fetchWithTimeout(`${OFF_BASE}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS}`, { signal:window.cb.signal });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  return data.product;
}

async function offSearchProducts(query) {
  const url = `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
    `&search_simple=1&action=process&json=1&page_size=8` +
    `&fields=code,product_name,brands,quantity,nutriscore_grade,nova_group,image_front_small_url,nutriments`;
  const res = await window.cb.fetchWithTimeout(url, { signal:window.cb.signal });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.products || []).filter(p => p.product_name);
}

// ------------------------------------------------------------
// Number helpers
// ------------------------------------------------------------
function num(v) {
  const n = parseFloat(v);
  return isFinite(n) ? n : null;
}
function fmtQty(v, unit = 'g') {
  if (v === null || v === undefined) return 'N/A';
  const n = parseFloat(v);
  if (!isFinite(n)) return String(v);
  return (Math.round(n * 10) / 10) + ' ' + unit;
}
// Parse strings like "450 kcal", "12 g", "1.5g protein" into a number
function parseNutriNumber(str) {
  if (str === null || str === undefined) return null;
  if (typeof str === 'number') return str;
  const m = String(str).match(/([\d.,]+)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  return isFinite(n) ? n : null;
}

// ------------------------------------------------------------
// Heuristic health rating from hard nutrition data
// ------------------------------------------------------------
function computeOffRating(p) {
  const n = p.nutriments || {};
  const sugar = num(n['sugars_100g']);
  const sodium = num(n['sodium_100g']) != null ? num(n['sodium_100g']) * 1000
    : (num(n['salt_100g']) != null ? num(n['salt_100g']) * 393.7 : null); // mg per 100g
  const satFat = num(n['saturated-fat_100g']);
  const fiber = num(n['fiber_100g']);
  const protein = num(n['proteins_100g']);
  const nova = num(p.nova_group);

  let score = 6.5;
  const notes = [];

  // Nutri-Score (official front-of-pack grade)
  const ns = (p.nutriscore_grade || '').toLowerCase();
  if (ns === 'a') { score += 2; notes.push('Nutri-Score A (top official grade)'); }
  else if (ns === 'b') { score += 1; notes.push('Nutri-Score B'); }
  else if (ns === 'd') { score -= 1.5; notes.push('Nutri-Score D (poor official grade)'); }
  else if (ns === 'e') { score -= 2.5; notes.push('Nutri-Score E (worst official grade)'); }

  // NOVA processing level
  if (nova === 4) { score -= 1.5; notes.push('Ultra-processed (NOVA group 4)'); }
  else if (nova === 3) { score -= 0.5; notes.push('Processed food (NOVA group 3)'); }
  else if (nova === 1) { score += 0.5; notes.push('Unprocessed/minimally processed (NOVA 1)'); }

  if (sugar != null && sugar > 22.5) { score -= 1.5; notes.push('Very high sugar'); }
  else if (sugar != null && sugar > 15) { score -= 1; notes.push('High sugar'); }
  else if (sugar != null && sugar < 5) { score += 0.5; notes.push('Low sugar'); }

  if (sodium != null && sodium > 900) { score -= 1.5; notes.push('Very high sodium'); }
  else if (sodium != null && sodium > 400) { score -= 0.75; notes.push('High sodium'); }

  if (satFat != null && satFat > 15) { score -= 1; notes.push('High saturated fat'); }
  else if (satFat != null && satFat < 1.5) { score += 0.25; }

  if (fiber != null && fiber >= 6) { score += 0.75; notes.push('Good fiber source'); }
  if (protein != null && protein >= 12) { score += 0.5; notes.push('High protein'); }

  score = Math.max(1, Math.min(10, Math.round(score * 10) / 10));
  return { score, notes };
}

// ------------------------------------------------------------
// Convert an OFF product into the same JSON shape that the AI
// produces, so displayResults() renders everything unchanged.
// ------------------------------------------------------------
function offProductToAnalysis(product, barcode) {
  const n = product.nutriments || {};
  const kcal = num(n['energy-kcal_100g']) != null ? num(n['energy-kcal_100g'])
    : (num(n['energy_100g']) != null ? Math.round(num(n['energy_100g']) / 4.184) : null);
  const protein = num(n['proteins_100g']);
  const carbs = num(n['carbohydrates_100g']);
  const fat = num(n['fat_100g']);
  const sugar = num(n['sugars_100g']);
  const satFat = num(n['saturated-fat_100g']);
  const fiber = num(n['fiber_100g']);
  const sodiumMg = num(n['sodium_100g']) != null ? Math.round(num(n['sodium_100g']) * 1000)
    : (num(n['salt_100g']) != null ? Math.round(num(n['salt_100g']) * 393.7) : null);

  const name = product.product_name || product.generic_name || 'Unknown product';
  const brand = product.brands || '';
  const { score, notes } = computeOffRating(product);
  const nova = num(product.nova_group);
  const ns = (product.nutriscore_grade || '').toUpperCase();

  // Macro ratio by calories
  const pCal = (protein || 0) * 4, cCal = (carbs || 0) * 4, fCal = (fat || 0) * 9;
  const totalMacroCal = pCal + cCal + fCal || 1;
  const macroRatio = {
    protein: Math.round(pCal / totalMacroCal * 100),
    carbs: Math.round(cCal / totalMacroCal * 100),
    fat: Math.round(fCal / totalMacroCal * 100)
  };

  // Concerning ingredients — derived from hard data + additives
  const concerning = [];
  if (sugar != null && sugar > 15) {
    concerning.push({
      name: `Sugar (${fmtQty(sugar)} / 100g)`,
      risk: sugar > 22.5 ? 'high' : 'medium',
      impact: 'High sugar intake causes rapid blood-glucose spikes and contributes to weight gain.',
      whyAvoid: 'WHO recommends keeping free sugars under ~25 g per day total.',
      scientificEvidence: 'WHO guideline on sugars intake (2015); links to obesity and type 2 diabetes.'
    });
  }
  if (sodiumMg != null && sodiumMg > 400) {
    concerning.push({
      name: `Sodium (${sodiumMg} mg / 100g)`,
      risk: sodiumMg > 900 ? 'high' : 'medium',
      impact: 'High sodium raises blood pressure and strains the kidneys.',
      whyAvoid: 'Daily limit is ~2,300 mg — this product covers a large share per 100 g.',
      scientificEvidence: 'WHO recommends <5 g salt (~2,000 mg sodium) per day.'
    });
  }
  if (satFat != null && satFat > 10) {
    concerning.push({
      name: `Saturated fat (${fmtQty(satFat)} / 100g)`,
      risk: satFat > 15 ? 'high' : 'medium',
      impact: 'Excess saturated fat raises LDL cholesterol.',
      whyAvoid: 'Keep saturated fat under ~13 g/day on a 2,000 kcal diet.',
      scientificEvidence: 'American Heart Association saturated fat guidance.'
    });
  }
  if (nova === 4) {
    concerning.push({
      name: 'Ultra-processed formulation (NOVA 4)',
      risk: 'medium',
      impact: 'Ultra-processed foods are linked to overeating and poorer diet quality.',
      whyAvoid: 'Typically combines refined starches, sugars, oils and cosmetic additives.',
      scientificEvidence: 'BMJ 2019 cohort studies associate NOVA-4 foods with higher health risks.'
    });
  }
  const additives = Array.isArray(product.additives_tags) ? product.additives_tags.slice(0, 4) : [];
  additives.forEach(tag => {
    const code = tag.replace(/^en:/, '').toUpperCase();
    concerning.push({
      name: `Additive ${code}`,
      risk: 'low',
      impact: 'Food additive — generally approved, but some people prefer to limit them.',
      whyAvoid: 'Present in the ingredient list; see full label for details.',
      scientificEvidence: 'Approved food additive (EFSA/FSSAI evaluated).'
    });
  });

  const beneficial = [];
  if (protein != null && protein >= 8) beneficial.push({ name: 'Protein', benefits: `${fmtQty(protein)} per 100 g — supports muscle repair and satiety.`, nutrientsProvided: ['Protein'] });
  if (fiber != null && fiber >= 3) beneficial.push({ name: 'Dietary fiber', benefits: `${fmtQty(fiber)} per 100 g — supports digestion and steady energy.`, nutrientsProvided: ['Fiber'] });

  // Insights
  const insights = [];
  if (ns && 'ABCDE'.includes(ns)) {
    insights.push({
      category: 'Official grading',
      details: `This product carries Nutri-Score ${ns} (${ns <= 'B' ? 'a good' : ns === 'C' ? 'an average' : 'a poor'} nutritional grade).`,
      recommendation: ns <= 'B' ? 'A solid everyday choice within its category.' : 'Fine occasionally; look for a better-graded alternative for daily use.',
      evidence: 'Nutri-Score is the official front-of-pack label used in the EU and adopted by FSSAI pilots.'
    });
  }
  if (nova) {
    const novaDesc = {
      1: 'Unprocessed or minimally processed food.',
      2: 'Processed culinary ingredient (oils, butter, sugar, salt).',
      3: 'Processed food (canned, salted, freshly made).',
      4: 'Ultra-processed industrial formulation.'
    }[nova] || '';
    insights.push({
      category: 'Processing level',
      details: `NOVA group ${nova}: ${novaDesc}`,
      recommendation: nova <= 2 ? 'Minimal processing — generally a good foundation for meals.' : nova === 3 ? 'Reasonable in moderation as part of a varied diet.' : 'Best kept as an occasional item rather than a daily staple.',
      evidence: 'NOVA classification (University of São Paulo), used in WHO/PAHO reports.'
    });
  }
  if (kcal != null) {
    insights.push({
      category: 'Energy density',
      details: `${kcal} kcal per 100 g${product.serving_size ? ` (serving: ${product.serving_size})` : ''}.`,
      recommendation: kcal > 400 ? 'Energy-dense — watch portion sizes if you are managing weight.' : kcal < 100 ? 'Low energy density — easy to fit into most meal plans.' : 'Moderate energy density.',
      evidence: 'Energy density is a well-studied driver of total calorie intake.'
    });
  }

  const shortTerm = [];
  const longTerm = [];
  if (sugar != null && sugar > 15) { shortTerm.push('Quick energy followed by a likely sugar crash.'); longTerm.push('Frequent high-sugar foods raise the risk of weight gain and insulin resistance.'); }
  if (sodiumMg != null && sodiumMg > 400) { shortTerm.push('May increase thirst and temporary water retention.'); longTerm.push('Consistently high sodium intake is linked to high blood pressure.'); }
  if (nova === 4) { longTerm.push('Diets heavy in ultra-processed foods are associated with poorer long-term health outcomes.'); }
  if (shortTerm.length === 0) shortTerm.push('No acute concerns — steady energy from this product.');
  if (longTerm.length === 0) longTerm.push('Fits comfortably into a balanced long-term diet.');

  const alternatives = [];
  if (sugar != null && sugar > 15) alternatives.push({ name: 'Lower-sugar version of this product', benefits: 'Same use-case with far less sugar.', whereToFind: 'Compare labels — many brands offer a "less sugar" variant.' });
  if (nova === 4) alternatives.push({ name: 'A less-processed alternative', benefits: 'Fewer additives, usually more nutrients.', whereToFind: 'Whole-food or "clean label" options in the same aisle.' });
  alternatives.push({ name: 'Whole-food equivalent', benefits: 'More fiber and micronutrients, no additives.', whereToFind: 'Fresh or minimally processed foods.' });

  const dv = {
    sugar: sugar != null ? Math.min(100, Math.round(sugar / 50 * 100)) : 0,
    sodium: sodiumMg != null ? Math.min(100, Math.round(sodiumMg / 2300 * 100)) : 0,
    fat: fat != null ? Math.min(100, Math.round(fat / 78 * 100)) : 0
  };

  const analysis = {
    rating: score,
    ratingExplanation: (notes.length ? notes.join(' · ') + '. ' : '') +
      'Rating computed from official Nutri-Score, NOVA processing level and per-100 g nutrition data from Open Food Facts.',
    foodIdentification: {
      mainItems: [name + (brand ? ` (${brand})` : '')],
      ingredients: product.ingredients_text ? [product.ingredients_text.slice(0, 300)] : ['See packaging for the full ingredient list.'],
      estimatedCuisine: product.categories ? product.categories.split(',')[0].trim() : 'Packaged food',
      mealType: 'Any'
    },
    ingredients: { concerning, beneficial, safe: [] },
    insights,
    healthImplications: { shortTerm, longTerm },
    alternatives,
    nutritionEstimate: {
      calories: kcal != null ? `${kcal} kcal / 100g` : 'N/A',
      protein: fmtQty(protein),
      carbs: fmtQty(carbs),
      fat: fmtQty(fat),
      fiber: fmtQty(fiber),
      sugar: fmtQty(sugar),
      sodium: sodiumMg != null ? `${sodiumMg} mg / 100g` : 'N/A',
      vitamins: [],
      minerals: [],
      macroRatio,
      dailyValuePercentages: dv
    },
    dietaryConsiderations: [],
    preparationTips: [],
    // Extra metadata (not used by displayResults, used by diary/share/banner)
    productMeta: {
      source: 'off',
      barcode: barcode || null,
      name, brand,
      quantity: product.quantity || '',
      servingSize: product.serving_size || '',
      imageUrl: product.image_front_small_url || '',
      nutriscore: ns || null,
      nova: nova || null,
      per100: { kcal, protein, carbs, fat, sugar, sodiumMg, fiber, satFat }
    }
  };
  return analysis;
}

// ------------------------------------------------------------
// Product banner — shows verified-product info above results
// ------------------------------------------------------------
function renderProductBanner(meta) {
  const imageUrl = window.cb.safeURL(meta?.imageUrl);
  if (meta) meta = window.cb.safeAnalysis(meta);
  let banner = document.getElementById('product-banner');
  const host = document.getElementById('overview-tab');
  if (!host) return;
  if (!meta) { if (banner) banner.remove(); return; }
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'product-banner';
    banner.className = 'product-banner';
    host.insertBefore(banner, host.firstChild);
  }
  const nsClass = meta.nutriscore ? 'ns-' + meta.nutriscore.toLowerCase() : '';
  banner.innerHTML = `
    ${imageUrl ? `<img src="${imageUrl}" alt="" class="product-banner-img">` : '<div class="product-banner-img product-banner-placeholder"><i class="fas fa-box"></i></div>'}
    <div class="product-banner-info">
      <div class="product-banner-name">${meta.name}${meta.brand ? ` <span class="product-banner-brand">· ${meta.brand}</span>` : ''}</div>
      <div class="product-banner-badges">
        <span class="badge badge-verified">${meta.source === 'off' ? 'Open Food Facts · community data · per 100 g' : 'AI estimate · check the portion and label'}</span>
        ${meta.nutriscore ? `<span class="badge badge-nutri ${nsClass}">Nutri-Score ${meta.nutriscore}</span>` : ''}
        ${meta.nova ? `<span class="badge badge-nova">NOVA ${meta.nova}</span>` : ''}
        ${meta.barcode ? `<span class="badge badge-barcode"><i class="fas fa-barcode"></i> ${meta.barcode}</span>` : ''}
      </div>
    </div>`;
}

// ------------------------------------------------------------
// Show an analysis result (shared by barcode / search / AI)
// ------------------------------------------------------------
function showAnalysis(analysis, mode = 'food') {
  // script.js globals — displayResults branches on currentMode
  currentMode = mode;
  document.querySelectorAll('.mode-button').forEach(b => b.classList.remove('active'));
  const modeBtn = document.getElementById(mode + 'Mode');
  if (modeBtn) modeBtn.classList.add('active');

  analysisData = analysis; // script.js global
  window.lastProductMeta = analysis.productMeta || null;
  displayResults(analysis);
  if (window.diary) window.diary.updateAddButton();
}

// ------------------------------------------------------------
// Barcode scanning with ZXing (vendored at /vendor/zxing.min.js)
// ------------------------------------------------------------
let barcodeReader = null;
let barcodeControls = null;
let barcodeActive = false;

async function startBarcodeScan() {
  if (typeof ZXing === 'undefined' || !ZXing.BrowserMultiFormatReader) {
    alert('Barcode scanner failed to load. Check your connection and refresh.');
    return;
  }
  const btn = document.getElementById('barcodeScanBtn');
  if (barcodeActive) { stopBarcodeScan(); return; }

  // Make sure the camera preview is visible & running
  cameraContainer.style.display = 'block';
  if (!isCameraOn) {
    if (!await initCamera()) return;
  }
  if (!stream) return; // camera permission denied — initCamera showed the message

  barcodeActive = true;
  if (btn) { btn.classList.add('scanning'); btn.innerHTML = '<i class="fas fa-stop"></i><span>Stop Barcode Scan</span>'; }
  const hint = document.getElementById('barcode-hint');
  if (hint) hint.style.display = 'block';
  errorDiv.style.display = 'none';

  barcodeReader = new ZXing.BrowserMultiFormatReader();
  try {
    barcodeControls = await barcodeReader.decodeFromStream(
      stream, video, (result, err) => {
        if (result) {
          const code = result.getText();
          stopBarcodeScan();
          handleBarcode(code);
        }
        // NotFoundException is just "no barcode in this frame" — ignore
      }
    );
  } catch (e) {
    stopBarcodeScan();
    errorDiv.style.display = 'block';
    errorDiv.textContent = 'Could not start the barcode scanner: ' + e.message;
  }
}

function stopBarcodeScan() {
  barcodeActive = false;
  try { if (barcodeControls) barcodeControls.stop(); } catch (e) { /* already stopped */ }
  barcodeControls = null;
  const btn = document.getElementById('barcodeScanBtn');
  if (btn) { btn.classList.remove('scanning'); btn.innerHTML = '<i class="fas fa-barcode"></i><span>Scan Barcode</span>'; }
  const hint = document.getElementById('barcode-hint');
  if (hint) hint.style.display = 'none';
}

async function handleBarcode(code) {
  if (!/^\d{8,14}$/.test(code)) { window.cbToast?.('Use a valid product barcode.'); return; }
  const task = window.cb.beginTask('Looking up product database…');
  if (!task) return;
  if (navigator.vibrate) navigator.vibrate(80);
  loadingDiv.style.display = 'block';
  loadingDiv.querySelector('p').textContent = 'Looking up product database...';
  try {
    const product = await offFetchProduct(code);
    loadingDiv.style.display = 'none';
    if (!product) {
      errorDiv.style.display = 'block';
      errorDiv.innerHTML = `Product <strong>${code}</strong> wasn't found in Open Food Facts.<br>
        Try the <em>Label Analysis</em> mode and photograph the ingredient list instead.`;
      return;
    }
    showAnalysis(offProductToAnalysis(product, code), 'food');
    if (window.cbToast) window.cbToast('Product found ✓');
  } catch (e) {
    if (e.name === 'AbortError') return;
    loadingDiv.style.display = 'none';
    errorDiv.style.display = 'block';
    errorDiv.textContent = 'Product lookup failed: ' + e.message;
  } finally { window.cb.finishTask(task); }
}

// Decode a barcode from an uploaded image
async function decodeBarcodeFromImage(file) {
  if (typeof ZXing === 'undefined') return false;
  const url = URL.createObjectURL(file);
  try {
    const reader = new ZXing.BrowserMultiFormatReader();
    const result = await reader.decodeFromImageUrl(url);
    URL.revokeObjectURL(url);
    if (result) { await handleBarcode(result.getText()); return true; }
  } catch (e) { /* no barcode in image */ }
  URL.revokeObjectURL(url);
  return false;
}

// ------------------------------------------------------------
// Text search: Open Food Facts first, AI fallback
// ------------------------------------------------------------
async function handleFoodSearch(query) {
  query = (query || '').trim();
  if (!query) return;
  const task = window.cb.beginTask('Searching food database…');
  if (!task) return;
  try {
  const input = document.getElementById('foodSearchInput');
  if (input) input.blur();

  loadingDiv.style.display = 'block';
  loadingDiv.querySelector('p').textContent = 'Searching food database...';
  errorDiv.style.display = 'none';

  let candidates = [];
  try { candidates = await offSearchProducts(query); } catch (e) { if (e.name === 'AbortError') throw e; }

  if (candidates.length > 0) {
    loadingDiv.style.display = 'none';
    showProductPicker(candidates, query);
    return;
  }

  // No database match → AI estimate from the description
  loadingDiv.querySelector('p').textContent = 'No database match — asking AI to estimate...';
  try {
    const analysis = await aiTextAnalysis(query, task.controller.signal);
    loadingDiv.style.display = 'none';
    showAnalysis(analysis, 'food');
  } catch (e) {
    if (e.name === 'AbortError') return;
    loadingDiv.style.display = 'none';
    errorDiv.style.display = 'block';
    errorDiv.textContent = e.message || 'Search failed. Please try again.';
  }
  } catch (e) {
    if (e.name !== 'AbortError') { errorDiv.style.display='block'; errorDiv.textContent=e.message; }
  } finally { window.cb.finishTask(task); }
}

function showProductPicker(candidates, query) {
  let modal = document.getElementById('picker-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'picker-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2><i class="fas fa-list"></i> Pick a product</h2>
          <span class="close-modal">&times;</span>
        </div>
        <div class="modal-body">
          <p class="picker-sub">Found these in the Open Food Facts database. Don't see yours?
            <button id="picker-ai-fallback" class="link-button">Analyze "${''}" with AI instead</button>
          </p>
          <div id="picker-list" class="picker-list"></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('.close-modal').addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
  }
  const fallbackBtn = modal.querySelector('#picker-ai-fallback');
  fallbackBtn.textContent = `Analyze "${query}" with AI instead`;
  fallbackBtn.onclick = async () => {
    const task = window.cb.beginTask('Estimating nutrition…');
    if (!task) return;
    modal.style.display = 'none';
    loadingDiv.style.display = 'block';
    loadingDiv.querySelector('p').textContent = 'Asking AI to estimate nutrition...';
    try {
      const analysis = await aiTextAnalysis(query, task.controller.signal);
      loadingDiv.style.display = 'none';
      showAnalysis(analysis, 'food');
    } catch (e) {
      if (e.name === 'AbortError') return;
      loadingDiv.style.display = 'none';
      errorDiv.style.display = 'block';
      errorDiv.textContent = e.message || 'AI analysis failed.';
    } finally { window.cb.finishTask(task); }
  };

  const list = modal.querySelector('#picker-list');
  list.innerHTML = candidates.map((p, i) => {
    const image = window.cb.safeURL(p.image_front_small_url);
    p = window.cb.safeAnalysis(p);
    const kcal = p.nutriments && p.nutriments['energy-kcal_100g'] != null ? p.nutriments['energy-kcal_100g'] : '?';
    const ns = (p.nutriscore_grade || '').toUpperCase();
    return `
      <button class="picker-item" data-idx="${i}">
        ${image ? `<img src="${image}" alt="" loading="lazy">` : '<div class="picker-noimg"><i class="fas fa-box"></i></div>'}
        <div class="picker-item-info">
          <div class="picker-item-name">${p.product_name}</div>
          <div class="picker-item-meta">${p.brands || 'Unknown brand'}${p.quantity ? ' · ' + p.quantity : ''} · ${kcal} kcal/100g</div>
        </div>
        ${ns && 'ABCDE'.includes(ns) ? `<span class="badge badge-nutri ns-${ns.toLowerCase()}">${ns}</span>` : ''}
      </button>`;
  }).join('');
  list.querySelectorAll('.picker-item').forEach(el => {
    el.addEventListener('click', async () => {
      const task = window.cb.beginTask('Loading product data…');
      if (!task) return;
      const p = candidates[parseInt(el.dataset.idx, 10)];
      modal.style.display = 'none';
      loadingDiv.style.display = 'block';
      loadingDiv.querySelector('p').textContent = 'Loading full product data...';
      try {
        const full = await offFetchProduct(p.code) || p;
        loadingDiv.style.display = 'none';
        showAnalysis(offProductToAnalysis(full, p.code), 'food');
      } catch (e) {
        if (e.name === 'AbortError') return;
        loadingDiv.style.display = 'none';
        errorDiv.style.display = 'block';
        errorDiv.textContent = 'Could not load product: ' + e.message;
      } finally { window.cb.finishTask(task); }
    });
  });
  modal.style.display = 'block';
}

// AI nutrition estimate from a text description (no image)
async function aiTextAnalysis(query, signal) {
  const healthProfile = window.auth.getHealth ? window.auth.getHealth() : {};
  const healthFacts = buildHealthSummary(healthProfile);
  const goalContext = healthFacts.length
    ? 'The user has this health profile — tailor advice to them:\n' + healthFacts.join('\n') + '\n\n' : '';

  const prompt = `You are a nutrition expert. ${goalContext}Estimate the nutrition for this food/meal description: "${query}".
Assume typical serving sizes unless specified. Respond ONLY with valid JSON in exactly this structure:
{
  "rating": number (1-10),
  "ratingExplanation": string,
  "foodIdentification": {
    "mainItems": [string], "ingredients": [string],
    "estimatedCuisine": string, "mealType": string
  },
  "ingredients": {
    "concerning": [{"name": string, "risk": "high"|"medium"|"low", "impact": string, "whyAvoid": string, "scientificEvidence": string}],
    "beneficial": [{"name": string, "benefits": string, "nutrientsProvided": [string]}]
  },
  "insights": [{"category": string, "details": string, "recommendation": string, "evidence": string}],
  "healthImplications": {"shortTerm": [string], "longTerm": [string]},
  "alternatives": [{"name": string, "benefits": string, "preparation": string}],
  "nutritionEstimate": {
    "calories": string (e.g. "450 kcal per serving"),
    "protein": string, "carbs": string, "fat": string, "fiber": string,
    "vitamins": [string], "minerals": [string],
    "macroRatio": {"protein": number, "carbs": number, "fat": number}
  },
  "dietaryConsiderations": [string],
  "preparationTips": [string]
}`;
  const raw = await aiChat([
    { role: 'system', content: 'You are a precise nutrition analyst. Always respond with valid JSON only — no markdown, no code fences.' },
    { role: 'user', content: prompt }
  ], { temperature: 0.3, signal });

  const cleaned = raw.replace(/```json|```/g, '').trim();
  let parsed;
  try { parsed = window.cb.parseAnalysis(cleaned); }
  catch (e) { throw new Error('The AI returned an unreadable answer. Please try again.'); }
  parsed.productMeta = {
    source: 'ai-text',
    name: query,
    brand: '',
    per100: {},
    aiQuery: query,
    kcalEstimate: parseNutriNumber(parsed.nutritionEstimate?.calories),
    proteinEstimate: parseNutriNumber(parsed.nutritionEstimate?.protein),
    carbsEstimate: parseNutriNumber(parsed.nutritionEstimate?.carbs),
    fatEstimate: parseNutriNumber(parsed.nutritionEstimate?.fat)
  };
  return parsed;
}

// ------------------------------------------------------------
// Voice input (Web Speech API — keyless, on-device)
// ------------------------------------------------------------
function startVoiceSearch() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const micBtn = document.getElementById('voiceSearchBtn');
  if (!SR) {
    if (window.cbToast) window.cbToast('Voice input is not supported in this browser');
    return;
  }
  if (window._cbRecognition) { try { window._cbRecognition.stop(); } catch (e) {} window._cbRecognition = null; if (micBtn) micBtn.classList.remove('listening'); return; }

  const rec = new SR();
  window._cbRecognition = rec;
  rec.lang = navigator.language || 'en-US';
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  if (micBtn) { micBtn.classList.add('listening'); micBtn.innerHTML = '<i class="fas fa-stop"></i>'; }

  rec.onresult = (e) => {
    const text = e.results[0][0].transcript;
    const input = document.getElementById('foodSearchInput');
    if (input) input.value = text;
    handleFoodSearch(text);
  };
  rec.onend = () => { window._cbRecognition = null; if (micBtn) { micBtn.classList.remove('listening'); micBtn.innerHTML = '<i class="fas fa-microphone"></i>'; } };
  rec.onerror = () => { if (window.cbToast) window.cbToast('Could not hear you — try typing instead'); };
  try { rec.start(); } catch (e) { /* already started */ }
}

// ------------------------------------------------------------
// Wiring (DOMContentLoaded)
// ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const barcodeBtn = document.getElementById('barcodeScanBtn');
  if (barcodeBtn) barcodeBtn.addEventListener('click', startBarcodeScan);

  const searchBtn = document.getElementById('foodSearchBtn');
  const searchInput = document.getElementById('foodSearchInput');
  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => handleFoodSearch(searchInput.value));
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleFoodSearch(searchInput.value); });
  }
  const voiceBtn = document.getElementById('voiceSearchBtn');
  if (voiceBtn) voiceBtn.addEventListener('click', startVoiceSearch);

  // Barcode-from-upload: if barcode mode is armed, try decoding uploads first
  const barcodeUpload = document.getElementById('barcodeFileInput');
  if (barcodeUpload) {
    barcodeUpload.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/') || file.size > 15 * 1024 * 1024) { window.cbToast?.('Choose an image smaller than 15 MB.'); barcodeUpload.value=''; return; }
      if (window.cb.signal) return;
      loadingDiv.style.display = 'block';
      loadingDiv.querySelector('p').textContent = 'Looking for a barcode in the image...';
      const found = await decodeBarcodeFromImage(file);
      loadingDiv.style.display = 'none';
      if (!found && window.cbToast) window.cbToast('No barcode found in that image');
      barcodeUpload.value = '';
    });
  }
});

window.offAI = {
  startBarcodeScan, stopBarcodeScan, handleBarcode,
  handleFoodSearch, offFetchProduct, offSearchProducts,
  offProductToAnalysis, aiTextAnalysis, showAnalysis
};
