const test=require('node:test'), assert=require('node:assert/strict'), vm=require('node:vm'), fs=require('node:fs');
function runtime(values=new Map()) {
  const localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const window={localStorage,addEventListener(){},dispatchEvent(){},crypto:require('node:crypto').webcrypto};
  const ctx=vm.createContext({window,localStorage,crypto:window.crypto,document:{addEventListener(){},getElementById(){return null}},console,URL,Map,AbortController,DOMException,setTimeout,clearTimeout,fetch:async()=>{throw new Error('offline fixture')}});
  for(const file of ['core.js','auth.js','diary.js']) vm.runInContext(fs.readFileSync(require.resolve('../'+file),'utf8'),ctx);
  return {window,values};
}
test('scans and goals survive reload while cloud is offline',()=>{
  const first=runtime(); first.window.store.addScan({scan_type:'food',scan_data:{rating:8,items:['oats']}});
  first.window.store.addGoal({goal_type:'Nutrition',target:'Review labels'});
  const second=runtime(first.values);
  assert.equal(second.window.store.getScans().length,1); assert.equal(second.window.store.getGoals().length,1);
  const id=second.window.store.getGoals()[0].id; second.window.store.deleteGoal(id);
  assert.equal(runtime(first.values).window.store.getGoals().length,0);
});
test('diary clamps nutrition inputs and persists deletion tombstones',()=>{
  const first=runtime(); first.window.diary.addEntry({name:'Fixture',meal:'lunch',calories:200,protein:-3,carbs:25,fat:5});
  const stored=JSON.parse(first.values.get('cb_diary')); const date=Object.keys(stored.days)[0], entry=stored.days[date].entries[0];
  assert.equal(entry.protein,0); assert.equal(entry.calories,200);
  first.window.diary.removeEntry(date,entry.id);
  const deleted=JSON.parse(first.values.get('cb_diary')); assert.equal(deleted.days[date].entries.length,0); assert.ok(deleted.deleted.includes(entry.id));
});
