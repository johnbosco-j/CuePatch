const test=require('node:test');
const assert=require('node:assert/strict');
const {snapshot,fragment,read,summary}=require('../web/crew-copy.js');
const rows=[
  {id:'S1',time:'23:59',crew:'Sound',text:'Open the blue headset 🎙️'},
  {id:'L1',time:'23:59',crew:'Lighting',text:'Private lighting note.'},
  {id:'S2',time:'00:03',crew:'Sound',text:'Sänger keeps the handheld.'}
];
test('crew link round-trips Unicode, excludes other departments and measures changes since their last handoff',()=>{
  const show={name:'Matinée',rows,history:[{ids:['S1']},{ids:['L1']}],handoffs:[{crew:'Sound',revision:1}],templates:['private rehearsal note']};
  const issued=snapshot(show,'Sound');
  assert.deepEqual(read(fragment(issued)),issued);
  assert.equal(summary(issued),'1 revised cue since R1');
  assert.deepEqual(issued.cues.map(c=>[c[0],c[3]]),[['S1',true],['S2',false]]);
  assert.doesNotMatch(JSON.stringify(issued),/Lighting|Private lighting|private rehearsal/);
  show.handoffs[0].revision=2;
  assert.equal(summary(snapshot(show,'Sound')),'No cue changes since R2');
  assert.equal(summary(snapshot(show,'Lighting')),'First recorded issue');
});
test('invalid and oversized shares cannot become a viewer page',()=>{
  for (const value of ['','#v1.e30','#v1.!!!','#v1.'+'a'.repeat(8000)]) assert.throws(()=>read(value));
  const sheet={name:'Long run',rows:Array.from({length:60},(_,i)=>({...rows[0],id:'S'+i,text:'演'.repeat(250)})),history:[],handoffs:[]};
  const full=snapshot(sheet,'Sound');assert.equal(full.cues.length,60);assert.equal(fragment(full),'');
});
