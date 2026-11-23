// Used by the public viewer and the standalone HTML download. Crew text is always inserted as text.
const CrewPage = (() => {
  const styles = `
    :root{color-scheme:light;font:16px/1.5 system-ui,sans-serif;color:#232328;background:#f5f5f6}
    *{box-sizing:border-box}body{margin:0}main{max-width:780px;margin:auto;padding:clamp(18px,5vw,56px)}
    header{display:flex;align-items:center;justify-content:space-between;padding-bottom:16px;border-bottom:1px solid #ccccd1}
    header strong{font:italic 25px Georgia,serif}header span,.eyebrow,time,.cue-id{font:500 14px/1.4 ui-monospace,monospace}
    h1{font-size:clamp(40px,8vw,74px);line-height:1;letter-spacing:-.055em;margin:10px 0 16px;overflow-wrap:anywhere}
    .eyebrow{margin:32px 0 0;color:#991e2b}.revision{margin:0 0 24px;color:#515159}
    .list{background:#fff;border:1px solid #d7d7dc;border-radius:16px;overflow:hidden}
    .cue{padding:18px 20px;border-bottom:1px solid #dedee2;overflow-wrap:anywhere}.cue:last-child{border-bottom:0}
    .cue.revised{border-inline-start:4px solid #ab2532;background:#fff7f7;padding-inline-start:16px}
    .line{display:flex;align-items:center;gap:14px;flex-wrap:wrap}.line time{font-weight:700}.cue-id{color:#55555b}
    .line em{color:#9e1e2d;font-size:14px;font-weight:650}.cue p{margin:7px 0 0;font-size:18px}
    label{display:inline-flex;align-items:center;gap:8px;margin:0 0 16px;cursor:pointer}input{width:18px;height:18px;accent-color:#aa2332}
    main:has(input:checked) .cue:not(.revised){display:none}footer{font-size:14px;color:#585860;margin:24px 0;max-width:60ch}
    button{font:600 15px system-ui;background:white;color:#29292c;border:1px solid #ccc;border-radius:26px;padding:10px 16px;cursor:pointer}
    :focus-visible{outline:2px solid #9e1e2d;outline-offset:3px}@media print{main{max-width:none;padding:0}body,:root,.list{background:white}
    label,button,footer{display:none}main:has(input:checked) .cue:not(.revised){display:block}.cue{break-inside:avoid}.list{border:0}}
  `;
  function render(doc,root,copy) {
    const make=(tag,txt,cls)=>{
      const e=doc.createElement(tag);if(txt!==undefined)e.textContent=txt;if(cls)e.className=cls;return e;
    };
    const css=make('style',styles);doc.head.append(css);
    const head=make('header');head.append(make('strong','CuePatch'),make('span','REV '+String(copy.revision).padStart(2,'0')));
    const list=make('section',undefined,'list');list.setAttribute('aria-label','Crew cues');
    const heading=make('h1',copy.crew);
    const detail=make('p',copy.cues.length+' '+(copy.cues.length===1?'cue':'cues')+' · '+CrewCopy.summary(copy),'revision');
    root.replaceChildren(head,make('p',copy.show,'eyebrow'),heading,detail);
    if (copy.cues.some(c=>c[3])) {
      const label=make('label'),toggle=make('input');toggle.type='checkbox';
      label.append(toggle,doc.createTextNode('Show revised cues only'));root.append(label);
    }
    for (const [id,time,text,revised] of copy.cues) {
      const row=make('article',undefined,'cue'+(revised?' revised':''));
      const line=make('div',undefined,'line');line.append(make('time',time),make('span',id,'cue-id'));
      if(revised)line.append(make('em','Revised'));
      row.append(line,make('p',text));list.append(row);
    }
    root.append(list,make('footer','Issued copy of revision '+copy.revision+'. Ask the caller for a new copy after a change.'));
    doc.title=copy.show+' · '+copy.crew+' · R'+copy.revision;
  }
  function html(copy) {
    const doc=document.implementation.createHTMLDocument('Crew calling copy');
    doc.documentElement.lang='en';
    const charset=doc.createElement('meta');charset.setAttribute('charset','utf-8');doc.head.prepend(charset);
    const viewport=doc.createElement('meta');viewport.name='viewport';viewport.content='width=device-width,initial-scale=1';doc.head.append(viewport);
    const root=doc.createElement('main');doc.body.append(root);render(doc,root,copy);
    return '<!doctype html>\n'+doc.documentElement.outerHTML;
  }
  return {render,html};
})();
