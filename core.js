/* Shared request, storage and rendering helpers. No UI framework required. */
(function (root) {
  const memory = new Map();
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const storage = {
    get(key) { try { return root.localStorage.getItem(key); } catch { return memory.get(key) ?? null; } },
    set(key, value) { memory.set(key, String(value)); try { root.localStorage.setItem(key, value); return true; } catch { return false; } }
  };
  function localDate(offset = 0, now = new Date()) {
    const date = new Date(now); date.setDate(date.getDate() + (Number.isFinite(offset) ? offset : 0));
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }
  function number(value) {
    if (value === null || value === undefined || value === '') return null;
    const match = String(value).replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);
    const n = match ? Number(match[0]) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  function safeURL(value) {
    try { const url = new URL(value, root.location?.origin || 'https://calcubite.vercel.app'); return url.protocol === 'https:' ? escapeHTML(url.href) : ''; } catch { return ''; }
  }
  function safeAnalysis(value) {
    if (typeof value === 'string') return escapeHTML(value);
    if (Array.isArray(value)) return value.map(safeAnalysis);
    if (!value || typeof value !== 'object') return value;
    const clean = {};
    for (const [key, item] of Object.entries(value)) {
      if (!['__proto__','constructor','prototype'].includes(key)) clean[key] = safeAnalysis(item);
    }
    if ('rating' in clean) { const n = number(clean.rating); clean.rating = n === null ? null : Math.max(1, Math.min(10,n)); }
    return clean;
  }
  function parseAnalysis(text) {
    const trimmed = String(text).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
    let data;
    try { data = JSON.parse(trimmed); } catch { throw new Error('The AI returned an unreadable result. Please retry with a clearer photo or description.'); }
    if (!data || Array.isArray(data) || typeof data !== 'object' || (!data.nutritionEstimate && !data.foodIdentification && !data.ingredients)) {
      throw new Error('The response did not contain a food analysis. Please try another photo or description.');
    }
    return data;
  }
  async function fetchWithTimeout(url, options = {}, timeout = 18000) {
    const controller = new AbortController();
    const signal = options.signal;
    const abort = () => controller.abort(signal.reason);
    if (signal?.aborted) abort(); else signal?.addEventListener('abort',abort,{once:true});
    const timer = setTimeout(() => controller.abort(new Error('Request timed out. Please check your connection and retry.')), timeout);
    try { return await fetch(url, { ...options, signal:controller.signal }); }
    catch (error) {
      if (signal?.aborted) throw new DOMException('Cancelled','AbortError');
      if (controller.signal.aborted) throw new Error('Request timed out. Please check your connection and retry.');
      throw error;
    } finally { clearTimeout(timer); signal?.removeEventListener('abort',abort); }
  }
  let task = null;
  function beginTask(message) {
    if (task) return null;
    task = { controller:new AbortController(), controls:[] };
    document.querySelectorAll('#scan-workspace button:not(#cancel-analysis), .mode-button').forEach(control => {
      task.controls.push([control,control.disabled]); control.disabled = true;
    });
    document.getElementById('scan-workspace')?.setAttribute('aria-busy','true');
    const loading = document.getElementById('loading');
    if (loading) { loading.style.display='block'; loading.querySelector('p').textContent=message; }
    const error = document.getElementById('error'); if (error) error.style.display='none';
    return task;
  }
  function finishTask(current) {
    if (task !== current) return;
    current.controls.forEach(([control,disabled]) => control.disabled=disabled);
    document.getElementById('scan-workspace')?.setAttribute('aria-busy','false');
    const loading=document.getElementById('loading'); if (loading) loading.style.display='none';
    task=null;
  }
  function cancelTask() { if (task) { const current=task; current.controller.abort(); finishTask(current); root.cbToast?.('Analysis cancelled. You can try another food.'); } }
  const api = { escapeHTML, storage, localDate, number, safeURL, safeAnalysis, parseAnalysis, fetchWithTimeout, beginTask, finishTask, cancelTask, get signal(){ return task?.controller.signal; } };
  root.cb = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
