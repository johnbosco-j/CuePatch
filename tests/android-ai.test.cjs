const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const core=require('../web/core.js');

test('Android review keeps the chosen inference mode and validates the native result before permitting an edit',async()=>{
  const note='Use a blue headset.';
  const sent=[];
  const bridge={postMessage(raw){sent.push(JSON.parse(raw));}};
  const context=vm.createContext({window:{CuePatchAndroid:bridge},CueCore:core,
    crypto:require('node:crypto').webcrypto,performance,setTimeout,clearTimeout});
  const ai=vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/ai.js'),'utf8')+'\nCueAI',context);
  await ai.connect();
  assert.equal(ai.ready(),true);
  const first=ai.analyse(core.sample,note,'private',()=>{});
  assert.equal(sent[0].mode,'private');
  const ok=[{id:'AU-01',after:'Open the blue headset.',evidence:'blue headset'}];
  bridge.onmessage({data:JSON.stringify({id:sent[0].id,source:'On Device',text:JSON.stringify(ok)})});
  assert.equal((await first).source,'On Device');
  const second=ai.analyse(core.sample,note,'hybrid',()=>{});
  assert.equal(sent[1].mode,'hybrid');
  const invalid=[{...ok[0],id:'missing'}];
  bridge.onmessage({data:JSON.stringify({id:sent[1].id,source:'In Cloud',text:JSON.stringify(invalid)})});
  await assert.rejects(second);
});
