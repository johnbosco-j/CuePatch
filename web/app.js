const $ = id => document.getElementById(id);
const el = (tag,text,cls) => {
  const node=document.createElement(tag);
  if(text!==undefined) node.textContent=text;
  if(cls) node.className=cls;
  return node;
};
const stateKey = 'cuepatch.desk.v1';
let state = {rows:CueCore.sample,history:[],name:'Opening night',sample:true};
try {
  const saved=JSON.parse(sessionStorage.getItem(stateKey));
  if (saved && Array.isArray(saved.history) && typeof saved.name==='string') {
    state={...saved,rows:CueCore.validateSheet(saved.rows)};
  }
} catch {}
let pending=null;
let busy=false;
const revision=()=>state.history.length+1;
function status(message) { $('status').textContent=message; }
function persist(next) {
  try { sessionStorage.setItem(stateKey,JSON.stringify(next)); }
  catch { $('session').textContent='In memory · export before closing'; }
  state=next;
}
function download(name,text,type) {
  const url=URL.createObjectURL(new Blob([text],{type}));
  const a=el('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function render() {
  const words=state.name.trim().split(/\s+/);
  const last=words.pop();
  $('title').replaceChildren(document.createTextNode(words.length ? words.join(' ')+' ' : ''),el('em',last));
  $('rev').textContent='REV '+String(revision()).padStart(2,'0');
  $('sub').textContent=state.sample?'Campus showcase · Rehearsal sheet':'Production rundown';
  const crew=$('crew').value;
  const crews=[...new Set(state.rows.map(r=>r.crew))];
  const times=state.rows.map(row=>row.time).sort();
  $('map-time').textContent=times[0]===times.at(-1) ? times[0] : times[0]+' – '+times.at(-1);
  $('counts').textContent=state.rows.length+' '+(state.rows.length===1?'cue':'cues')+' / '+crews.length+' '+(crews.length===1?'crew':'crews');
  const options=['',...crews].map(s=>{const opt=el('option',s||'All crews');opt.value=s;return opt;});
  $('crew').replaceChildren(...options); $('crew').value=crews.includes(crew)?crew:'';
  const previousButtons=$('crew-rail').children;
  if (!previousButtons.length || $('crew-rail').dataset?.crews!==JSON.stringify(crews)) {
    const chips=['',...crews].map(group=>{
      const chip=el('button',group||'All','crew-chip');
      chip.type='button';chip.value=group;
      chip.onclick=()=>{$('crew').value=group;$('crew').onchange();};
      return chip;
    });
    $('crew-rail').replaceChildren(...chips);
    if($('crew-rail').dataset) $('crew-rail').dataset.crews=JSON.stringify(crews);
  }
  for(const chip of $('crew-rail').children) chip.setAttribute('aria-pressed',String(chip.value===$('crew').value));
  const visible=state.rows.filter(r=>!$('crew').value || r.crew===$('crew').value);
  const updated=state.history.at(-1)?.ids || [];
  $('rundown').replaceChildren(...visible.map(r=>{
    const row=el('article',undefined,'cue'+(updated.includes(r.id)?' changed':''));
    const body=el('div');body.append(el('span',r.id+' / '+r.crew+(updated.includes(r.id)?' / revised':''),'cue-meta'),el('p',r.text));
    row.append(el('time',r.time),body);return row;
  }));
  $('log').replaceChildren(...(state.history.length ? [...state.history].reverse().map((r,i)=>{
    return el('div','Rev '+(revision()-i)+' · '+r.source+' · '+r.ids.join(', '),'logrow');
  }) : [el('p','Opening copy. Approved changes will appear here.')]));
  $('analyse').disabled=busy || !CueAI.ready() || !$('note').value.trim();
  $('file').disabled=busy; $('mode').disabled=busy; $('note').disabled=busy;
  $('example').hidden=!state.sample || revision()!==1;
  $('example').disabled=busy;
  $('create-show').disabled=busy;
}
function clearReview() { pending=null;$('review').replaceChildren(); }
function review(patch,source,elapsed) {
  clearReview();
  if (!patch.length) {status(source+' · No supported changes found. Review the rundown before calling the show.');return;}
  pending={patch,source};
  const root=$('review');root.append(el('h3','Review '+patch.length+' proposed '+(patch.length===1?'change':'changes')));
  status(source+(elapsed===undefined?'':' · '+elapsed.toFixed(1)+' s')+' · Sheet awaiting approval.');
  const inputs=patch.map(p=>{
    const label=el('label',undefined,'patch');const item=el('input');item.type='checkbox';
    label.append(item,document.createTextNode(' '+p.id+' · '+state.rows.find(r=>r.id===p.id).crew),el('del',p.before),el('ins',p.after),el('q',p.evidence));
    root.append(label);return item;
  });
  const apply=el('button','Approve selected cues','primary');apply.disabled=true;
  inputs.forEach(input=>input.onchange=()=>{apply.disabled=!inputs.some(i=>i.checked);});
  apply.onclick=()=>{
    const chosen=patch.filter((p,i)=>inputs[i].checked);
    if (!pending || !chosen.length) return;
    const next=CueCore.commit(state.rows,chosen);
    persist({...state,rows:next,history:[...state.history,{source,ids:chosen.map(c=>c.id)}]});
    $('calling-copy').hidden=true;clearReview();render();status('Revision '+revision()+' saved. Select a crew and export its calling copy.');
  };
  root.append(apply);
}
$('example').onclick=()=>{
  $('note').value=CueCore.example;
  clearReview();
  status(CueAI.reason() || 'Note loaded. Select your inference mode and find affected cues.');
  render();
};
function modeText() {
  $('privacy').textContent=$('mode').value==='private'?'This mode processes the note and cue sheet on this device only.':'By running this mode, you allow the full note and cue sheet to go to Firebase AI Logic if the local model is unavailable.';
}
$('mode').onchange=()=>{modeText();clearReview();status('');};
$('note').oninput=()=>{clearReview();status(CueAI.reason());render();};
$('analyse').onclick=async()=>{
  if (busy || !CueAI.ready()) return;
  clearReview();busy=true;render();
  let active=true;
  const progress=message=>{if(active) status(message);};
  try {
    const result=await CueAI.analyse(state.rows,$('note').value.trim(),$('mode').value,progress);
    review(result.patch,'Firebase · '+result.source,result.elapsed);
  } catch (e) { status('Analysis stopped. '+(e instanceof SyntaxError?'The model returned unreadable JSON. Try a shorter note.':e.message)); }
  finally {active=false;busy=false;render();}
};
$('crew').onchange=()=>{$('calling-copy').hidden=true;render();};
function crewCopy() {
  const crew=$('crew').value;
  const items=state.rows.filter(row=>!crew || row.crew===crew);
  return [state.name+' / REV '+revision(),crew || 'All crews','',...items.map(row=>
    row.time+'  '+row.id+'  '+row.crew+'  '+row.text)].join('\n');
}
$('export').onclick=()=>{
  $('copy-text').textContent=crewCopy();
  $('calling-copy').hidden=false;
};
$('save-sheet').onclick=()=>download('cuepatch-rev-'+revision()+'.txt',crewCopy(),'text/plain;charset=utf-8');
$('close-copy').onclick=()=>{$('calling-copy').hidden=true;};
function openRundown(name,rows) {
  if((!state.sample || state.history.length) && !confirm('Replace this tab’s current rundown? Export it first if you need to keep it.')) return false;
  persist({rows,history:[],name,sample:false});
  $('crew').value='';$('calling-copy').hidden=true;clearReview();$('note').value='';
  status('Rundown ready. Enter a rehearsal change.');render();
  return true;
}
$('show-form').onsubmit=event=>{
  event.preventDefault();
  if (busy) return;
  try {
    const name=$('show-name').value.trim();
    if(!name) throw Error('Enter a show name.');
    const rows=CueCore.parseCueLines($('show-cues').value);
    if(openRundown(name,rows)){ $('show-form').reset();$('new-show').open=false; }
    $('form-error').textContent='';
  } catch(error){ $('form-error').textContent=error.message; }
};
$('download').onclick=()=>download('rundown.json',JSON.stringify(state.rows,null,2),'application/json');
$('file').onchange=async()=>{
  const file=$('file').files[0];if (!file) return;
  busy=true;render();
  try {
    if(file.size>100000) throw Error('Use a rundown file smaller than 100 KB.');
    const rows=CueCore.validateSheet(JSON.parse(await file.text()));
    openRundown(file.name.replace(/\.json$/i,'').slice(0,60)||'Imported rundown',rows);
  } catch(e) {status(e.message);}
  finally {busy=false;$('file').value='';render();}
};
function network() { $('network').textContent=navigator.onLine?'Online':'Offline'; }
window.addEventListener('online',network);window.addEventListener('offline',network);
network();modeText();render();
CueAI.connect().then(()=>{if(!pending) status(CueAI.reason() || 'Firebase connected. Select a mode and enter a change note.');render();});
