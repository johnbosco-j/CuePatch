// Run the shipped script event handlers with an in-memory DOM, without a browser or SDK.
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const src=name=>fs.readFileSync(path.join(__dirname,'../web',name),'utf8');
class Element {
  constructor(tag,text='') { this.tag=tag; this.textContent=text; this.children=[]; this.value=''; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children=children; }
}
function openDesk(storage) {
  const nodes=new Map([...src('index.html').matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element('div')]));
  const get=id=>nodes.get(id);
  get('mode').value='private';
  const context=vm.createContext({document:{getElementById:get,createElement:tag=>new Element(tag),createTextNode:t=>new Element('#text',t)},
    sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
    navigator:{onLine:true},window:{addEventListener(){}},console,confirm:()=>true});
  for(const file of ['config.js','core.js','ai.js','app.js']) vm.runInContext(src(file),context,{filename:file});
  return get;
}
test('unconfigured desk labels the fixture, applies a selection and restores its revision',async()=>{
  const storage=new Map();const get=openDesk(storage);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(get('rundown').children.length,8);
  assert.match(get('status').textContent,/needs a configured Firebase/);
  assert.equal(get('analyse').disabled,true);
  get('example').onclick();
  const panel=get('review').children;
  assert.equal(panel.length,6); assert.match(get('status').textContent,/scripted/);
  const first=panel[1].children[0]; first.checked=true;first.onchange();panel.at(-1).onclick();
  assert.equal(get('rev').textContent,'REV 02');assert.equal(get('review').children.length,0);
  const state=JSON.parse([...storage.values()][0]);
  assert.deepEqual(state.history[0].ids,['ST-01']); assert.match(state.rows[0].text,/lectern/);
  assert.match(state.rows[1].text,/handheld/);
  const reopened=openDesk(storage);
  assert.equal(reopened('rev').textContent,'REV 02');assert.equal(reopened('example').hidden,true);
  reopened('crew').value='Sound';reopened('crew').onchange();
  assert.equal(reopened('rundown').children.length,2);
});
test('editing the note invalidates an earlier scripted proposal',()=>{
  const get=openDesk(new Map());get('example').onclick();
  get('note').value='Use a wide shot for the first song.';get('note').oninput();
  assert.equal(get('review').children.length,0);assert.equal(get('rev').textContent,'REV 01');
});
