const $ = id => document.getElementById(id);
const el = (tag,text,cls) => {
  const node=document.createElement(tag);
  if(text!==undefined) node.textContent=text;
  if(cls) node.className=cls;
  return node;
};
const book = CueProduction.open();
let state;
try { state=book.initial(); }
catch { state=CueProduction.create('Opening night',CueCore.sample,true); $('session').textContent='Storage unavailable · export a backup'; }
let selectedBlock=null;
let pending=null;
let busy=false;
let saving=false;
const revision=()=>state.history.length+1;
const atTime=stamp=>new Date(stamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
function status(message) { $('status').textContent=message; }
function notice(message) {
  $('operation-status').textContent=message;
  if ($('caller-view').open) $('focus-status').textContent=message;
}
function selectShow(show) {
  state=show;book.remember(show.id);
  selectedBlock=null;$('cue-search').value='';$('crew').value='';$('note').value='';$('calling-copy').hidden=true;
  clearReview();status('');render();
}
async function persist(next, expected=state.version) {
  if (saving) return false;
  saving=true;
  const previousId=state.id;
  const activeVersion=state.version;
  try {
    const saved=await book.save(next,expected);
    if(state.id!==previousId || state.version!==activeVersion) return false;
    state=saved;return true;
  } catch(error) {
    let latest;
    try { latest=book.get(state.id); } catch {}
    if(latest && latest.version!==state.version) selectShow(latest);
    notice(error.name==='QuotaExceededError'?'Device storage is full. Back up this production before making further changes.':error.message);
    return false;
  } finally {saving=false;}
}
function download(name,text,type) {
  const url=URL.createObjectURL(new Blob([text],{type}));
  const a=el('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function releaseEdits(chosen,source) {
  if (!chosen.length || saving || busy) return false;
  let rows;
  try { rows=CueCore.commit(state.rows,chosen); }
  catch(error){notice(error.message);return false;}
  const change={source,ids:chosen.map(c=>c.id),approvedAt:new Date().toISOString(),
    edits:chosen.map(({id,before,after})=>({id,before,after}))};
  if (!await persist({...state,rows,history:[...state.history,change]})) return false;
  $('calling-copy').hidden=true;clearReview();render();
  notice('Revision '+revision()+' approved. Check the affected crew copies.');
  status('Revision '+revision()+' saved. Select a crew and export its calling copy.');return true;
}
function editCue(row,body,trigger) {
  if(busy || saving)return;
  const editor=el('form',undefined,'cue-editor'), field=el('textarea'), label=el('label','Calling instruction');
  const save=el('button','Save cue revision','primary'), cancel=el('button','Cancel','link');
  const message=el('p','','hint');
  field.value=row.text;field.maxLength=250;field.required=true;field.rows=3;label.append(field);
  save.type='submit';save.disabled=true;cancel.type='button';
  cancel.onclick=()=>{editor.remove();trigger.hidden=false;trigger.focus?.();};
  field.oninput=()=>{save.disabled=!field.value.trim() || field.value.trim()===row.text;};
  const showId=state.id;
  editor.onsubmit=async event=>{
    event.preventDefault();
    const after=field.value.trim();
    if(!after || after===row.text || after.length>250 || showId!==state.id)return;
    save.disabled=true;
    if(!await releaseEdits([{id:row.id,before:row.text,after}],'Caller edit')) {
      save.disabled=false;message.textContent='Check the current instruction before saving again.';
    }
  };
  const actions=el('div',undefined,'call-actions');actions.append(save,cancel);
  editor.append(label,actions,message);body.append(editor);trigger.hidden=true;field.focus?.();
}
function render() {
  const words=state.name.trim().split(/\s+/);
  const last=words.pop();
  $('title').replaceChildren(document.createTextNode(words.length ? words.join(' ')+' ' : ''),el('em',last));
  $('rev').textContent='REV '+String(revision()).padStart(2,'0');
  $('sub').textContent=state.sample?'Campus showcase · Rehearsal sheet':'Production rundown';
  const crew=$('crew').value;
  const crews=[...new Set(state.rows.map(r=>r.crew))];
  const times=state.rows.map(row=>row.time);
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
  const blocks=CueProduction.blocks(state.rows);
  const candidates=selectedBlock===null ? state.rows : (blocks[selectedBlock]?.rows || []);
  const search=$('cue-search').value.trim().toLowerCase();
  const visible=candidates.filter(r=>(!$('crew').value || r.crew===$('crew').value) &&
    (!search || [r.id,r.time,r.crew,r.text].some(value=>value.toLowerCase().includes(search))));
  $('visible-count').textContent=visible.length+' / '+state.rows.length+' cues';
  $('clear-time').hidden=selectedBlock===null;
  $('clear-time').textContent=selectedBlock===null?'Show all time blocks':'Clear '+blocks[selectedBlock].time+' filter';
  $('time-rail').replaceChildren(...blocks.map((block,index)=>{
    const tick=el('button',undefined,'schedule-tick');
    tick.setAttribute('aria-label','Inspect '+block.time+' block '+(index+1));
    tick.setAttribute('aria-pressed',String(selectedBlock===index));
    tick.append(el('strong',block.time),el('span',index<state.called.length?'Called':index===state.called.length?'Standby':block.rows.length+' cues'));
    tick.onclick=()=>{selectedBlock=index;$('crew').value='';$('cue-search').value='';render();$('sheet-title').scrollIntoView?.({block:'start'});};return tick;
  }));
  const updated=state.history.at(-1)?.ids || [];
  $('rundown').replaceChildren(...visible.map(r=>{
    const row=el('article',undefined,'cue'+(updated.includes(r.id)?' changed':''));
    const body=el('div');body.append(el('span',r.id+' / '+r.crew+(updated.includes(r.id)?' / revised':''),'cue-meta'),el('p',r.text));
    const edit=el('button','Edit','cue-edit');edit.type='button';edit.disabled=busy || saving;
    edit.setAttribute('aria-label','Edit cue '+r.id);edit.onclick=()=>editCue(r,body,edit);
    row.append(el('time',r.time),body,edit);return row;
  }));
  if(!visible.length) $('rundown').append(el('p','No cues match these filters.','ops-meta'));
  $('log').replaceChildren(...(state.history.length ? [...state.history].reverse().map((change,i)=>{
    const record=el('details',undefined,'revision-detail');
    const summary=el('summary','Rev '+(revision()-i)+' · '+change.ids.length+' '+(change.ids.length===1?'cue':'cues')+' · '+change.source);
    record.append(summary,el('p',(change.approvedAt?'Approved '+new Date(change.approvedAt).toLocaleString()+' · ':'')+change.ids.join(', ')));
    for(const edit of change.edits || []) {
      const diff=el('div',undefined,'stored-diff');
      diff.append(el('strong',edit.id),el('del',edit.before),el('ins',edit.after));record.append(diff);
    }
    return record;
  }) : [el('p','Opening copy. Approved changes will appear here.')]));
  renderOperations();
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
  apply.onclick=async()=>{
    const chosen=patch.filter((p,i)=>inputs[i].checked);
    if (!pending || !chosen.length || saving || busy) return;
    await releaseEdits(chosen,source);
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
  const requested=state;
  let active=true;
  const progress=message=>{if(active) status(message);};
  try {
    const result=await CueAI.analyse(state.rows,$('note').value.trim(),$('mode').value,progress);
    if (requested.id!==state.id || requested.version!==state.version) {
      status('The show changed during analysis. Run the note on the current revision.');return;
    }
    review(result.patch,'Firebase · '+result.source,result.elapsed);
  } catch (e) { status('Analysis stopped. '+(e instanceof SyntaxError?'The model returned unreadable JSON. Try a shorter note.':e.message)); }
  finally {active=false;busy=false;render();}
};
$('cue-search').oninput=render;
$('clear-time').onclick=()=>{selectedBlock=null;render();};
$('crew').onchange=()=>{$('calling-copy').hidden=true;render();};
function crewCopy() {
  const crew=$('crew').value;
  const items=state.rows.filter(row=>!crew || row.crew===crew);
  return [state.name+' / REV '+revision(),crew || 'All crews','',...items.map(row=>
    row.time+'  '+row.id+'  '+row.crew+'  '+row.text)].join('\n');
}
let issued=null;
function prepareIssue() {
  const crew=$('crew').value;
  issued=crew?CrewCopy.snapshot(state,crew):null;
  $('crew-issue').hidden=!issued;$('issue-url').hidden=true;
  if (!issued) return;
  const hash=CrewCopy.fragment(issued);
  const url=hash?new URL('crew.html'+hash,document.baseURI).href:'';
  $('issue-title').textContent=crew+' · Revision '+issued.revision;
  $('issue-summary').textContent=CrewCopy.summary(issued);
  $('issue-differences').replaceChildren(...issued.cues.filter(cue=>cue[3]).map(([id,time,text])=>{
    const line=el('p');line.append(el('strong',time+' · '+id),el('span',text));return line;
  }));
  $('issue-open').hidden=!url;$('issue-copy').hidden=!url;
  $('issue-open').href=url;$('issue-url').value=url;
  $('issue-note').textContent=url?'Anyone with this link can read this crew’s issued copy. Later revisions get a new link.':
    'This copy is too long for a portable link. Send the offline HTML to the crew.';
}
$('export').onclick=()=>{
  $('copy-text').textContent=crewCopy();prepareIssue();
  $('calling-copy').hidden=false;
};
$('issue-copy').onclick=async()=>{
  const value=$('issue-url').value;if(!issued || !value)return;
  try {
    await navigator.clipboard.writeText(value);
    $('issue-note').textContent='Crew link copied. Record the handoff after the crew receives it.';
  } catch {
    const field=$('issue-url');field.hidden=false;field.focus();field.select();
    $('issue-note').textContent='Copy the selected crew link.';
  }
};
$('issue-file').onclick=()=>{
  if(issued)download('cuepatch-'+issued.crew.replace(/[^a-z0-9_-]+/gi,'-')+'-R'+issued.revision+'.html',CrewPage.html(issued),'text/html;charset=utf-8');
};
$('save-sheet').onclick=()=>download('cuepatch-rev-'+revision()+'.txt',crewCopy(),'text/plain;charset=utf-8');
$('print-sheet').onclick=()=>{
  $('copy-text').textContent=crewCopy();
  document.body.classList.add('printing-copy');
  try { window.print(); } finally { document.body.classList.remove('printing-copy'); }
};
$('close-copy').onclick=()=>{$('calling-copy').hidden=true;};
async function openProduction(next) {
  if (!await persist(next,null)) return false;
  selectShow(state);notice('Production saved. Previous shows are available in Saved production.');
  return true;
}
$('show-form').onsubmit=async event=>{
  event.preventDefault();if(busy || saving) return;
  try {
    const name=$('show-name').value.trim();
    if(!name) throw Error('Enter a show name.');
    const next=CueProduction.create(name,CueCore.parseCueLines($('show-cues').value));
    if(await openProduction(next)){ $('show-form').reset();$('new-show').open=false; }
    $('form-error').textContent='';
  } catch(error){ $('form-error').textContent=error.message; }
};
$('backup').onclick=()=>download('cuepatch-production-r'+revision()+'.json',JSON.stringify(CueProduction.backup(state),null,2),'application/json');
$('download').onclick=()=>download('rundown.json',JSON.stringify(state.rows,null,2),'application/json');
$('file').onchange=async()=>{
  const file=$('file').files[0];if (!file) return;
  busy=true;render();
  try {
    if(file.size>5_000_000) throw Error('Use a rundown or backup smaller than 5 MB.');
    const parsed=JSON.parse(await file.text());
    const next=Array.isArray(parsed)
      ? CueProduction.create(file.name.replace(/\.json$/i,'').slice(0,60)||'Imported rundown',CueCore.validateSheet(parsed))
      : CueProduction.readBackup(parsed);
    await openProduction(next);
  } catch(e) {status(e.message);}
  finally {busy=false;$('file').value='';render();}
};
function cueLines(rows) {
  return rows.map(row=>{
    const line=el('li');
    line.append(el('span',row.id,'cue-id'),el('strong',row.crew),el('span',row.text));
    return line;
  });
}
function renderCallerView(blocks,index) {
  const block=blocks[index], following=blocks[index+1];
  $('focus-title').textContent=state.name;
  $('focus-progress').textContent=$('call-progress').textContent+' · Rev '+revision();
  $('focus-time').textContent=block?.time || 'Show complete';
  $('focus-cues').replaceChildren(...cueLines(block?.rows || []));
  $('focus-next').textContent=following?.time || (block?'Final block on standby':'All blocks called');
  $('focus-next-cues').replaceChildren(...cueLines(following?.rows || []));
  $('focus-call').textContent=$('call-block').textContent;
  $('focus-call').disabled=$('call-block').disabled;
  $('focus-undo').disabled=$('undo-call').disabled;
  $('focus-empty').hidden=index>0;
  $('focus-log').replaceChildren(...state.called.map((stamp,i)=>{
    const entry=el('li');
    const actual=el('time',atTime(stamp));actual.dateTime=stamp;
    entry.append(el('strong',blocks[i].time+' block'),el('span','Called '),actual);
    return entry;
  }).reverse());
}
function renderOperations() {
  const disabled=busy || saving;
  let shows=[];try { shows=book.list(); } catch {}
  if(!shows.some(show=>show.id===state.id)) shows.push({id:state.id,name:state.name});
  $('show-switch').replaceChildren(...shows.map(show=>{
    const item=el('option',show.name);item.value=show.id;return item;
  }));
  $('show-switch').value=state.id;$('show-switch').disabled=disabled;
  const blocks=CueProduction.blocks(state.rows);
  const index=state.called.length;
  const block=blocks[index];
  $('call-progress').textContent=index+' / '+blocks.length+' called';
  $('block-time').textContent=block?.time || 'Complete';
  $('block-summary').textContent=block ? block.rows.length+' '+(block.rows.length===1?'cue':'cues')+' on standby' : 'All scheduled blocks called';
  $('block-cues').replaceChildren(...cueLines(block?.rows || []));
  $('call-block').disabled=disabled || !block;
  $('call-block').textContent=block?'Call '+block.time+' block':'All blocks called';
  $('undo-call').disabled=disabled || !index;
  $('next-block').textContent=blocks[index+1]?'Next on standby · '+blocks[index+1].time:
    block?'Final scheduled block':state.called.length?'Last called at '+atTime(state.called.at(-1)):'';
  renderCallerView(blocks,index);
  const crews=CueProduction.crewStatus(state);
  $('handoff-count').textContent=crews.filter(c=>c.current).length+' / '+crews.length+' current';
  $('handoff-rows').replaceChildren(...crews.map(item=>{
    const row=el('div',undefined,'handoff-row');
    const identity=el('div');identity.append(el('strong',item.crew),el('span',item.current?'Current · handed off R'+item.previous.revision:
      item.previous?'Reissue · last handed off R'+item.previous.revision:'Awaiting first copy',item.current?'delivered':'not-issued'));
    if (item.previous && !item.current) {
      const revised=CrewCopy.snapshot(state,item.crew).cues.filter(cue=>cue[3]);
      identity.append(el('small',revised.length+' revised · '+revised.slice(0,3).map(cue=>cue[0]).join(', ')+(revised.length>3?' …':''),'handoff-ids'));
    }
    const actions=el('div',undefined,'crew-actions');const view=el('button','View copy','link');
    view.setAttribute('aria-label','View '+item.crew+' copy');
    view.onclick=()=>{selectedBlock=null;$('cue-search').value='';$('crew').value=item.crew;$('crew').onchange();$('export').onclick();$('calling-copy').scrollIntoView?.({block:'center'});};
    actions.append(view);
    if(!item.current) {
      const mark=el('button','Mark handed off','link');mark.disabled=disabled;mark.setAttribute('aria-label','Mark '+item.crew+' handed off');
      mark.onclick=async()=>{
        if(busy || saving) return;
        const handoffs=[...state.handoffs.filter(h=>h.crew!==item.crew),{crew:item.crew,revision:revision(),at:new Date().toISOString()}];
        if(await persist({...state,handoffs})){render();notice(item.crew+' handoff recorded for revision '+revision()+'.');}
      };actions.append(mark);
    }
    row.append(identity,actions);return row;
  }));
  $('template-count').textContent='('+state.templates.length+')';
  const note=$('note').value.trim();
  $('save-template').disabled=disabled || !note || state.templates.includes(note) || state.templates.length>=20;
  $('template-list').replaceChildren(...state.templates.map(note=>{
    const row=el('div',undefined,'saved-note');
    const use=el('button',note,'template-use');use.disabled=disabled;
    use.onclick=()=>{$('note').value=note;$('note').oninput();$('note').focus?.();};
    const remove=el('button','Remove','link');remove.disabled=disabled;
    remove.onclick=async()=>{if(await persist({...state,templates:state.templates.filter(value=>value!==note)})){render();notice('Saved note removed.');}};
    row.append(use,remove);return row;
  }));
}
$('show-switch').onchange=()=>{
  const selected=book.get($('show-switch').value);if(!selected || busy || saving)return;
  selectShow(selected);notice('Opened '+selected.name+'.');
};
$('focus-open').onclick=()=>{
  $('focus-status').textContent='';$('caller-view').showModal();
};
$('caller-view').onclose=()=>$('focus-open').focus?.();
$('caller-view').onkeydown=event=>{
  if(event.repeat && (event.key==='Enter' || event.key===' ')) event.preventDefault();
};
$('focus-call').onclick=$('call-block').onclick=async()=>{
  const block=CueProduction.blocks(state.rows)[state.called.length];
  if(!block || busy || saving)return;
  if(await persist({...state,called:[...state.called,new Date().toISOString()]})){render();notice('Called '+block.time+' · '+block.rows.map(r=>r.id).join(', '));}
};
$('focus-undo').onclick=$('undo-call').onclick=async()=>{
  if(!state.called.length || busy || saving)return;
  if(await persist({...state,called:state.called.slice(0,-1)})){render();notice('Last call undone. The block is on standby again.');}
};
$('save-template').onclick=async()=>{
  const note=$('note').value.trim();
  if(busy || saving || !note || state.templates.includes(note) || state.templates.length>=20)return;
  if(await persist({...state,templates:[...state.templates,note]})){render();notice('Reusable note saved with this production.');}
};
window.addEventListener('storage',event=>{
  if(book.isShowKey(event.key,state.id)){
    const latest=book.get(state.id);
    if(latest && latest.version!==state.version){
      state=latest;clearReview();$('calling-copy').hidden=true;render();notice('Updated from another tab. Review the current revision before approving.');
    }
  } else if(event.key?.startsWith('cuepatch.show.v2.')) renderOperations();
});
function network() { $('network').textContent=navigator.onLine?'Online':'Offline'; }
window.addEventListener('online',network);window.addEventListener('offline',network);
network();modeText();render();
CueAI.connect().then(()=>{if(!pending) status(CueAI.reason() || 'Firebase connected. Select a mode and enter a change note.');render();});
