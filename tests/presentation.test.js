const test=require('node:test'), assert=require('node:assert/strict');
require('../core.js');
const presentation=require('../presentation.js');
test('macro energy comes from supplied grams, never default ratios',()=>{
  assert.deepEqual(presentation.macroShares({protein:10,carbs:20,fat:4}),{protein:26,carbs:51,fat:23});
  assert.equal(presentation.macroShares({protein:10,carbs:20}),null);
  assert.equal(presentation.macroShares({protein:0,carbs:0,fat:0}),null);
});
test('analysis basis distinguishes database, per100g and serving estimates',()=>{
  assert.equal(presentation.analysisBasis({productMeta:{source:'off'}}),'Database values per 100 g');
  assert.equal(presentation.analysisBasis({nutritionEstimate:{calories:'389 kcal per 100g dry'}}),'AI estimate per 100 g');
  assert.equal(presentation.analysisBasis({nutritionEstimate:{calories:'450 kcal per serving'}}),'AI estimate per serving');
});
test('weekly averages exclude unlogged days',()=>{
  const days=[{key:'2026-10-01',totals:{count:1,calories:300,protein:20}},{key:'2026-10-02',totals:{count:0,calories:0,protein:0}}];
  const summary=presentation.weekSummary(days,{calories:2000});
  assert.equal(summary.days,1); assert.equal(summary.calories,300); assert.equal(summary.protein,20); assert.equal(summary.meals,1);
});
test('structured and fallback reports escape provider text',()=>{
  const html=presentation.reportHTML(JSON.stringify({summary:'<script>attack</script>',wentWell:['<img onerror=x>'],watch:[],nextWeek:['Check portions']}));
  assert.ok(!html.includes('<script>')); assert.ok(html.includes('&lt;script&gt;')); assert.ok(html.includes('Try next week'));
  assert.ok(presentation.reportHTML('<img src=x onerror=x>').includes('&lt;img'));
  assert.equal(presentation.parseReport('{}'),null);
});
