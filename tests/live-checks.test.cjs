const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const src=name=>fs.readFileSync(path.join(__dirname,'..','web',name),'utf8');
class Node {
  constructor(){this.children=[];this.value='';}
  append(...items){this.children.push(...items);}
  prepend(item){this.children.unshift(item);}
}
function page(analysis,ready=true) {
  const nodes=new Map([...src('checks.html').matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Node()]));
  const get=id=>nodes.get(id);
  get('route').value='private';
  const ctx=vm.createContext({
    document:{getElementById:get,createElement:()=>new Node()},navigator:{onLine:true},
    CueCore:require('../web/core.js'),CueAI:{analyse:analysis,ready:()=>ready,reason:()=>'Requires Firebase',connect:async()=>{}}
  });
  vm.runInContext(src('checks.js'),ctx);
  return {get,records:()=>JSON.parse(vm.runInContext('JSON.stringify(reports)',ctx))};
}
test('unconfigured checks never produce a report or call a model',async()=>{
  const p=page(()=>assert.fail('unexpected model request'),false);
  await new Promise(r=>setImmediate(r));
  assert.equal(p.get('run').disabled,true);
  await p.get('run').onclick();
  assert.deepEqual(p.records(),[]);
});
test('live-check UI compares returned IDs and preserves the source supplied by the SDK adapter',async()=>{
  const p=page(async()=>({source:'test-source',elapsed:0.123,patch:[{id:'VC-02',after:'Wide shot'}]}));
  p.get('case').value='2';
  await p.get('run').onclick();
  const [r]=p.records();
  assert.deepEqual(r.missed,['AU-01']);assert.deepEqual(r.unexpected,['VC-02']);
  assert.equal(r.sdkSource,'test-source'); assert.equal(r.outcome,'Cue IDs differ');
});
test('failure has no inferred source or successful score',async()=>{
  const p=page(async()=>{throw Error('provider unavailable');});
  await p.get('run').onclick();
  const [r]=p.records();assert.equal(r.outcome,'Request failed');
  assert.equal(r.sdkSource,undefined);assert.equal(r.edits,undefined);
  assert.equal(p.get('run').disabled,false);
});
