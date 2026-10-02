/* Presentation derives every number from analysis or logged diary entries. */
(function(root) {
  const cb=root.cb;
  const esc=cb.escapeHTML;
  function macroShares(nutrition={}) {
    const grams=['protein','carbs','fat'].map(key=>cb.number(nutrition[key]));
    if (grams.some(value=>value===null)) return null;
    const calories=grams.map((value,index)=>value*(index===2?9:4));
    const total=calories.reduce((sum,value)=>sum+value,0);
    return total>0 ? Object.fromEntries(['protein','carbs','fat'].map((key,index)=>[key,Math.round(calories[index]/total*100)])) : null;
  }
  function analysisBasis(data) {
    if(data.productMeta?.source==='off') return 'Database values per 100 g';
    const text=String(data.nutritionEstimate?.calories||'');
    return /100\s*g/i.test(text) ? 'AI estimate per 100 g' : /serving|portion/i.test(text) ? 'AI estimate per serving' : 'AI estimate. Check the portion before logging.';
  }
  function renderAnalysis(data) {
    const host=document.getElementById('healthScore'), nutritionHost=document.getElementById('nutritionBreakdown');
    if(!host||!nutritionHost) return;
    const nutrition=data.nutritionEstimate||{}, rating=cb.number(data.rating);
    host.innerHTML=`<div class="analysis-intro"><div><h3>Food overview</h3><p>${esc(data.ratingExplanation||'Review the nutrition and portion below before adding this food to your diary.')}</p></div><div class="analysis-score"><span>App score</span><strong>${rating===null?'N/A':Math.min(10,rating)}${rating===null?'':'<small>/10</small>'}</strong><span>Estimated, not medical advice</span></div></div>`;
    const calories=cb.number(nutrition.calories);
    const shares=macroShares(nutrition);
    nutritionHost.classList.add('modern-nutrition');
    nutritionHost.innerHTML=`<div class="energy-tile"><span>Energy</span><div><strong>${calories===null?'N/A':calories.toLocaleString()}</strong>${calories===null?'':'<span>kcal</span>'}</div><p>${esc(analysisBasis(data))}</p>${nutrition.calories?`<small>${esc(nutrition.calories)}</small>`:''}</div><div class="macro-stack">${['protein','carbs','fat'].map(key=>{
      const number=cb.number(nutrition[key]);
      return `<div class="macro-row macro-${key}"><span>${key==='carbs'?'Carbohydrates':key[0].toUpperCase()+key.slice(1)}</span><strong>${number===null?'Not provided':number+'<small> g</small>'}</strong>${shares?`<span class="macro-share">${shares[key]}% of macro energy</span>`:''}</div>`;
    }).join('')}</div>`;
    const details=['fiber','sugar','sodium','saturatedFat','transFat'].filter(key=>nutrition[key]!==null&&nutrition[key]!==undefined&&nutrition[key]!=='');
    if(details.length) nutritionHost.innerHTML+=`<dl class="nutrition-details">${details.map(key=>`<div><dt>${esc(key.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase()))}</dt><dd>${esc(nutrition[key])}</dd></div>`).join('')}</dl>`;
    for(const key of ['vitamins','minerals','electrolytes']) {
      if(Array.isArray(nutrition[key])&&nutrition[key].length) nutritionHost.innerHTML+=`<div class="nutrient-tags"><span>${key[0].toUpperCase()+key.slice(1)}</span><p>${nutrition[key].map(esc).join(', ')}</p></div>`;
    }
    document.getElementById('results')?.classList.add('modern-results');
    document.querySelector('.content-grid')?.classList.add('has-analysis');
  }
  function weekSummary(days, targets) {
    const logged=days.filter(day=>day.totals.count>0);
    const sum=key=>logged.reduce((value,day)=>value+(cb.number(day.totals[key])||0),0);
    return {days:logged.length, meals:sum('count'), calories:logged.length?Math.round(sum('calories')/logged.length):0,
      protein:logged.length?Math.round(sum('protein')/logged.length):0,target:targets.calories,
      start:days[0]?.key,end:days.at(-1)?.key};
  }
  function renderWeekSummary(days,targets) {
    const summary=weekSummary(days,targets);
    const host=document.getElementById('week-summary');
    if(!host)return;
    host.innerHTML=`<div class="week-heading"><div><h4>Your week at a glance</h4><p>${esc(summary.start)} to ${esc(summary.end)}</p></div><span class="coverage-label">${summary.days} of ${days.length} days logged</span></div><div class="week-metrics"><div><strong>${summary.meals}</strong><span>Meals logged</span></div><div><strong>${summary.days?summary.calories.toLocaleString():'N/A'}<small>${summary.days?' kcal':''}</small></strong><span>Average energy</span></div><div><strong>${summary.days?summary.protein:'N/A'}<small>${summary.days?' g':''}</small></strong><span>Average protein</span></div></div><p class="report-coverage">${summary.days?'Averages include logged days only. An unlogged day is missing data, not zero intake.':'Log a meal to start your weekly summary.'}</p>`;
  }
  function parseReport(raw) {
    const text=String(raw).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
    try {
      const report=JSON.parse(text);
      if(!report||typeof report.summary!=='string'||!Array.isArray(report.nextWeek))return null;
      return {summary:report.summary,wentWell:Array.isArray(report.wentWell)?report.wentWell:[],watch:Array.isArray(report.watch)?report.watch:[],nextWeek:report.nextWeek};
    }catch{return null;}
  }
  function reportHTML(raw) {
    const report=parseReport(raw);
    if(!report)return `<article class="report-article"><h4>Your weekly review</h4>${String(raw).split('\n').filter(line=>line.trim()).map(line=>`<p>${esc(line.replace(/^[-*•]\s*/,''))}</p>`).join('')}<p class="report-note">AI guidance based on your logged entries.</p></article>`;
    const list=items=>`<ul>${items.slice(0,5).map(item=>`<li>${esc(typeof item==='string'?item:JSON.stringify(item))}</li>`).join('')}</ul>`;
    return `<article class="report-article"><div class="report-summary"><span class="report-label">Weekly review</span><h4>A look at your logged meals</h4><p>${esc(report.summary)}</p></div><div class="report-columns"><section><h5>What went well</h5>${report.wentWell.length?list(report.wentWell):'<p>Not enough information to identify a pattern yet.</p>'}</section><section><h5>Worth a closer look</h5>${report.watch.length?list(report.watch):'<p>No specific pattern was identified.</p>'}</section></div><section class="report-next"><h5>Try next week</h5><ol>${report.nextWeek.slice(0,3).map((item,index)=>`<li><span>${index+1}</span><p>${esc(typeof item==='string'?item:JSON.stringify(item))}</p></li>`).join('')}</ol></section><p class="report-note">AI guidance based on logged entries. Estimates may differ from actual intake.</p></article>`;
  }
  root.cbPresentation={macroShares,analysisBasis,renderAnalysis,weekSummary,renderWeekSummary,parseReport,reportHTML};
  if(typeof module!=='undefined')module.exports=root.cbPresentation;
})(typeof window!=='undefined'?window:globalThis);
