const assert=require('node:assert/strict');
const test=require('node:test');
const cb=require('../core.js');
test('nutrition values reject negative/missing values without inventing data',()=>{
  assert.equal(cb.number('1,250 kcal'),1250); assert.equal(cb.number('12.5 g'),12.5);
  for(const value of ['',null,undefined,'unknown',-4]) assert.equal(cb.number(value),null);
});
test('untrusted analysis cannot become executable markup',()=>{
  const clean=cb.safeAnalysis(JSON.parse('{"rating":99,"foodIdentification":{"mainItems":["<img src=x onerror=alert(1)>"]},"__proto__":{"polluted":true}}'));
  assert.equal(clean.rating,10); assert.equal(clean.foodIdentification.mainItems[0],'&lt;img src=x onerror=alert(1)&gt;');
  assert.equal({}.polluted,undefined); assert.equal(Object.hasOwn(clean,'__proto__'),false);
  assert.equal(cb.safeURL('javascript:alert(1)'), '');
});
test('AI responses validate structure and fenced JSON',()=>{
  assert.equal(cb.parseAnalysis('```json\n{"nutritionEstimate":{"calories":"20 kcal"}}\n```').nutritionEstimate.calories,'20 kcal');
  for(const text of ['not json','[]','{}','null']) assert.throws(()=>cb.parseAnalysis(text));
});
test('diary keys follow local calendar and handle event-like offsets',()=>{
  const now=new Date(2026,9,2,0,15);
  assert.equal(cb.localDate(0,now),'2026-10-02'); assert.equal(cb.localDate(-1,now),'2026-10-01');
  assert.equal(cb.localDate({},now),'2026-10-02');
});
test('storage falls back when localStorage is unavailable',()=>{
  cb.storage.set('test-key','saved'); assert.equal(cb.storage.get('test-key'),'saved');
});
test('network deadlines and caller cancellation settle promptly',async()=>{
  const original=global.fetch;
  global.fetch=(_,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true}));
  try {
    await assert.rejects(cb.fetchWithTimeout('/test',{},5),/timed out/);
    const controller=new AbortController(); const request=cb.fetchWithTimeout('/test',{signal:controller.signal},100);
    controller.abort(); await assert.rejects(request,{name:'AbortError'});
  } finally { global.fetch=original; }
});
