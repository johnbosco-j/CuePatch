const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm'), path=require('node:path');
const context=vm.createContext({crypto:require('node:crypto').webcrypto});
for(const file of ['core.js','production.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../web',file),'utf8'),context);
const ops=vm.runInContext('CueProduction',context);
const rows=[{id:'1',time:'23:58',crew:'A',text:'Stand by.'},{id:'2',time:'00:02',crew:'B',text:'Open.'},{id:'3',time:'00:02',crew:'A',text:'Go.'}];
test('block order follows the caller’s rundown over midnight and groups simultaneous cues',()=>{
  const b=ops.blocks(rows);assert.equal(b.length,2);assert.equal(b[0].time,'23:58');assert.equal(b[1].rows.length,2);
});
test('a production backup carries confirmed calls, handoffs and revisions under a new identity',()=>{
  const s=ops.create('Concert',rows);s.called=['2026-11-21T18:00:00Z'];s.handoffs=[{crew:'A',revision:1,at:s.called[0]}];s.templates=['Use the wing mic.'];
  s.history=[{source:'Firebase · in_cloud',ids:['1'],edits:[{id:'1',before:'Wait.',after:'Stand by.'}]}];
  const raw=ops.backup(s),copy=ops.readBackup(JSON.parse(JSON.stringify(raw)));
  assert.notEqual(copy.id,s.id);assert.equal(JSON.stringify(ops.backup(copy)),JSON.stringify(raw));
  for(const invalid of [{...raw,called:[...s.called,...s.called,...s.called]},{...raw,handoffs:[{crew:'C',revision:22,at:s.called[0]}]},{...raw,history:[{source:'x',ids:['unknown']}]}])assert.throws(()=>ops.readBackup(invalid));
});
