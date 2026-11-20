const checkCases = [
  {name:'Move the host',note:CueCore.example,ids:['ST-01','AU-01','LX-01','VC-01']},
  {name:'Change one camera shot',note:'Keep everything as rehearsed except for the first song camera shot. Use a wide shot of the singer.',ids:['VC-02']},
  {name:'Swap the opening microphone',note:'During the opening welcome, keep the host on the stage-left mark but use the headset instead of the handheld.',ids:['AU-01']},
  {name:'Keep the rehearsal unchanged',note:'All positions, microphone assignments, lighting and camera shots stay as rehearsed.',ids:[]}
];
const find = id => document.getElementById(id);
const reports = [];
let running = false;
function element(tag,text) {
  const node=document.createElement(tag);
  node.textContent=text;
  return node;
}
function showCase() {
  const scenario=checkCases[Number(find('case').value)];
  find('note').textContent=scenario.note;
  find('expected').textContent='Expected cues · '+(scenario.ids.join(', ') || 'none');
  find('permission').textContent=find('route').value==='private'
    ? 'The test sends the fictional sheet to the on-device model only.'
    : 'This test permits Firebase to send the fictional sheet and test note to the cloud when the device model is unavailable.';
}
for (const [i,scenario] of checkCases.entries()) {
  const item=element('option',scenario.name); item.value=String(i);find('case').append(item);
}
find('case').value='0';
find('case').onchange=showCase;find('route').onchange=showCase;showCase();
find('run').onclick=async()=>{
  if(running || !CueAI.ready()) return;
  const scenario=checkCases[Number(find('case').value)];
  const mode=find('route').value;
  const started=new Date().toISOString();
  running=true;
  for(const id of ['run','route','case']) find(id).disabled=true;
  let active=true;
  const status=message=>{if(active) find('status').textContent=message;};
  status('Starting live inference…');
  const record={case:scenario.name,started,mode,networkOnline:navigator.onLine,expected:scenario.ids};
  try {
    const result=await CueAI.analyse(CueCore.sample,scenario.note,mode,status);
    const actual=result.patch.map(p=>p.id);
    record.sdkSource=result.source;
    record.elapsedSeconds=Number(result.elapsed.toFixed(2));
    record.missed=scenario.ids.filter(id=>!actual.includes(id));
    record.unexpected=actual.filter(id=>!scenario.ids.includes(id));
    record.edits=result.patch;
    record.outcome=record.missed.length || record.unexpected.length ? 'Cue IDs differ' : 'Cue IDs match';
    status('Live request finished. Inspect each proposed instruction.');
  } catch(e) {
    record.outcome='Request failed';
    // Provider errors can contain URLs or project metadata. Keep exported failure records minimal.
    record.failure='Inference or output validation failed.';
    status('Check stopped. '+e.message);
  } finally {
    active=false;running=false;
    for(const id of ['run','route','case']) find(id).disabled=false;
  }
  reports.push(record);
  const entry=element('article','');entry.className='logrow';
  entry.append(element('h3',record.case),element('p',record.outcome));
  if(record.edits){
    entry.append(element('p',record.sdkSource+' · '+record.elapsedSeconds+' seconds'),
      element('p','Missed cues · '+(record.missed.join(', ') || 'none')),
      element('p','Unexpected cues · '+(record.unexpected.join(', ') || 'none')));
    for(const edit of record.edits) entry.append(element('p',edit.id+' · '+edit.after));
  }
  find('results').prepend(entry);find('empty').hidden=true;find('export').disabled=false;
};
find('export').onclick=()=>{
  const content=JSON.stringify({scope:'Fictional rehearsal · cue IDs checked; wording requires human review',runs:reports},null,2);
  const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));
  const link=element('a','Download');link.href=url;link.download='cuepatch-live-checks.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
CueAI.connect().then(()=>{
  find('run').disabled=!CueAI.ready();
  find('status').textContent=CueAI.ready()?'Ready to test. A click starts a model request.':CueAI.reason();
});
