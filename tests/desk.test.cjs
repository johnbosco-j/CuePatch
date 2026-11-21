// Run the shipped script event handlers with an in-memory DOM, without a browser or SDK.
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const src=name=>fs.readFileSync(path.join(__dirname,'../web',name),'utf8');
class Element {
  constructor(tag,text='') { this.tag=tag; this.textContent=text; this.children=[]; this.value=''; }
  setAttribute(key,value) { this[key]=value; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children=children; }
}
function openDesk(storage, withModel=false) {
  const nodes=new Map([...src('index.html').matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element('div')]));
  const get=id=>nodes.get(id);
  get('mode').value='private';
  const context=vm.createContext({document:{getElementById:get,createElement:tag=>new Element(tag),createTextNode:t=>new Element('#text',t)},
    sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
    navigator:{onLine:true},window:{addEventListener(){}},console,confirm:()=>true});
  for(const file of ['config.js','core.js']) vm.runInContext(src(file),context,{filename:file});
  if (withModel) {
    context.CueAI={ready:()=>true,reason:()=>'',connect:async()=>{},analyse:async(rows,note)=>({
      patch:require('../web/core.js').validatePatch(rows,note,require('./fixture.cjs')),source:'unit-test',elapsed:1})};
  } else vm.runInContext(src('ai.js'),context);
  vm.runInContext(src('app.js'),context);
  return get;
}
test('an unavailable model cannot create any proposals from the example note',async()=>{
  const get=openDesk(new Map());await new Promise(resolve=>setImmediate(resolve));
  get('example').onclick();
  assert.match(get('status').textContent,/configured Firebase/);
  assert.equal(get('analyse').disabled,true);assert.equal(get('review').children.length,0);
});
test('a reviewed change, crew export and restored revision use approved rows',async()=>{
  const storage=new Map();const get=openDesk(storage,true);
  await new Promise(resolve=>setImmediate(resolve));
  get('example').onclick();await get('analyse').onclick();
  const panel=get('review').children;
  assert.equal(panel.length,6); const first=panel[1].children[0];first.checked=true;first.onchange();panel.at(-1).onclick();
  assert.equal(get('rev').textContent,'REV 02');assert.equal(get('review').children.length,0);
  const state=JSON.parse([...storage.values()][0]);assert.deepEqual(state.history[0].ids,['ST-01']);
  assert.match(state.rows[0].text,/lectern/);assert.match(state.rows[1].text,/handheld/);
  const reopened=openDesk(storage,true);assert.equal(reopened('rev').textContent,'REV 02');
  reopened('crew').value='Stage';reopened('crew').onchange();reopened('export').onclick();
  assert.match(reopened('copy-text').textContent,/REV 2[\s\S]+ST-01.+lectern/);
  assert.doesNotMatch(reopened('copy-text').textContent,/AU-01/);
});
test('editing the note invalidates an earlier proposal',async()=>{
  const get=openDesk(new Map(),true);get('example').onclick();await get('analyse').onclick();
  get('note').value='Use a wide shot for the first song.';get('note').oninput();
  assert.equal(get('review').children.length,0);assert.equal(get('rev').textContent,'REV 01');
});
