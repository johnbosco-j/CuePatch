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
  reset() {}
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children=children; }
}
function openDesk(storage, withModel=false) {
  const nodes=new Map([...src('index.html').matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element('div')]));
  const get=id=>nodes.get(id);
  get('mode').value='private';
  const mem={get length(){return storage.size;},key:i=>[...storage.keys()][i],getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
  const context=vm.createContext({crypto:require('node:crypto').webcrypto,localStorage:mem,document:{getElementById:get,createElement:tag=>new Element(tag),createTextNode:t=>new Element('#text',t)},
    sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
    navigator:{onLine:true},window:{addEventListener(){}},console,confirm:()=>true});
  for(const file of ['config.js','core.js','production.js']) vm.runInContext(src(file),context,{filename:file});
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
  assert.equal(panel.length,6); const first=panel[1].children[0];first.checked=true;first.onchange();await panel.at(-1).onclick();
  assert.equal(get('rev').textContent,'REV 02');assert.equal(get('review').children.length,0);
  const state=JSON.parse(storage.get('cuepatch.show.v2.opening-night'));assert.deepEqual(state.history[0].ids,['ST-01']);
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
test('a production can be called, handed off, found by cue, and reopened after a different show',async()=>{
  const storage=new Map(), get=openDesk(storage,true);
  get('show-name').value='Festival';
  get('show-cues').value='A1|19:00|Sound|Open host mic.\nC1|19:00|Camera|Hold wide.\nA2|19:05|Sound|Mute host mic.';
  await get('show-form').onsubmit({preventDefault(){}});
  assert.equal(get('block-time').textContent,'19:00');assert.equal(get('block-cues').children.length,2);
  await get('call-block').onclick();assert.equal(get('block-time').textContent,'19:05');
  await get('undo-call').onclick();assert.equal(get('block-time').textContent,'19:00');
  await get('handoff-rows').children[0].children[1].children[1].onclick();
  assert.equal(get('handoff-count').textContent,'1 / 2 current');
  get('note').value='Keep the house lights on.';await get('save-template').onclick();
  get('note').value='';get('template-list').children[0].children[0].onclick();
  assert.equal(get('note').value,'Keep the house lights on.');
  get('cue-search').value='A2';get('cue-search').oninput();assert.equal(get('visible-count').textContent,'1 / 3 cues');
  const active=get('show-switch').value;
  get('show-switch').value='opening-night';get('show-switch').onchange();
  assert.equal(get('counts').textContent,'8 cues / 4 crews');
  get('show-switch').value=active;get('show-switch').onchange();const reopened=openDesk(storage,true);
  assert.equal(reopened('handoff-count').textContent,'1 / 2 current');assert.equal(reopened('template-count').textContent,'(1)');
});
test('only an affected department needs a new copy after a selective approval',async()=>{
  const get=openDesk(new Map(),true);
  for (const idx of [0,1]) await get('handoff-rows').children[idx].children[1].children[1].onclick();
  assert.equal(get('handoff-count').textContent,'2 / 4 current');get('example').onclick();await get('analyse').onclick();
  const review=get('review').children;const selected=review[1].children[0];selected.checked=true;selected.onchange();
  await review.at(-1).onclick();assert.equal(get('handoff-count').textContent,'1 / 4 current');
  assert.match(get('handoff-rows').children[0].children[0].children[1].textContent,/Reissue/);
  assert.match(get('handoff-rows').children[1].children[0].children[1].textContent,/Current/);
  assert.match(get('log').children[0].children[2].children[2].textContent,/lectern/);
});
test('two desk tabs cannot silently overwrite the newer production state',async()=>{
  const storage=new Map(), first=openDesk(storage,true), second=openDesk(storage,true);
  await first('call-block').onclick();await second('call-block').onclick();
  assert.match(second('operation-status').textContent,/Another tab/);
  const persisted=JSON.parse(storage.get('cuepatch.show.v2.opening-night'));assert.equal(persisted.called.length,1);
});

test('the caller can correct a cue without Firebase and the correction uses the same revision and reissue workflow',async()=>{
  const storage=new Map(),get=openDesk(storage,false);
  await get('handoff-rows').children[0].children[1].children[1].onclick();
  const row=get('rundown').children[0];row.children[2].onclick();
  const form=row.children[1].children.at(-1),field=form.children[0].children[0];
  field.value='Place the host at the centre lectern.';field.oninput();
  await form.onsubmit({preventDefault(){}});
  const saved=JSON.parse(storage.get('cuepatch.show.v2.opening-night'));
  assert.equal(saved.history[0].source,'Caller edit');assert.equal(saved.rows[0].text,field.value);
  assert.match(get('handoff-rows').children[0].children[0].children[1].textContent,/Reissue/);
});

test('caller view shares the desk progress, shows the following block and restores the call log on reopen',async()=>{
  const storage=new Map(),get=openDesk(storage);
  assert.equal(get('focus-time').textContent,'18:00');
  assert.equal(get('focus-next').textContent,'18:04');
  assert.equal(get('focus-cues').children.length,4);
  await get('focus-call').onclick();
  assert.equal(get('block-time').textContent,'18:04');
  assert.equal(get('focus-log').children[0].children[0].textContent,'18:00 block');
  const reopened=openDesk(storage);
  assert.equal(reopened('focus-log').children.length,1);
  await reopened('focus-call').onclick();
  assert.equal(reopened('focus-time').textContent,'Show complete');
  assert.equal(reopened('focus-call').disabled,true);
  await reopened('focus-undo').onclick();
  assert.equal(reopened('focus-log').children.length,1);
  assert.equal(reopened('block-time').textContent,'18:04');
});
