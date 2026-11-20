const test=require('node:test');
const assert=require('node:assert/strict');
const c=require('../web/core.js');
const patch=()=>c.validatePatch(c.sample,c.example,c.fixture);
test('four opening cues change and the four first-song cues stay identical',()=>{
  const result=c.commit(c.sample,patch());
  assert.equal(result.filter((r,i)=>r.text!==c.sample[i].text).length,4);
  assert.deepEqual(result.slice(4),c.sample.slice(4));
});
test('accepting one proposal changes exactly one cue and leaves the source intact',()=>{
  const result=c.commit(c.sample,patch().slice(0,1));
  assert.notEqual(result[0].text,c.sample[0].text); assert.deepEqual(result.slice(1),c.sample.slice(1));
  assert.throws(()=>c.commit(result,patch()));
});
test('unknown IDs, repeated IDs, empty or invented evidence fail closed',()=>{
  const p=c.fixture[0];
  for(const input of [[{...p,id:'BAD'}],[p,p],[{...p,evidence:' '}],[{...p,evidence:'invented'}],[{...p,after:''}],{}])
    assert.throws(()=>c.validatePatch(c.sample,c.example,input));
});
test('valid empty and fenced responses',()=>{
  assert.deepEqual(c.validatePatch(c.sample,c.example,[]),[]);
  assert.deepEqual(c.parseReply('```json\n[]\n```'),[]);
});
test('rundown import validates and drops extraneous private fields',()=>{
  assert.deepEqual(c.validateSheet(c.sample),c.sample);
  assert.deepEqual(c.validateSheet([{...c.sample[0],contact:'private'}]),[c.sample[0]]);
  for(const rows of [[],[c.sample[0],c.sample[0]],[{...c.sample[0],time:'30:00'}],[{...c.sample[0],crew:''}]]) assert.throws(()=>c.validateSheet(rows));
});
