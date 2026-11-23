// The portable format contains only the selected department's current instructions.
const CrewCopy = (() => {
  const maxFragment = 7600;
  function snapshot(show,crew) {
    const rows=show.rows.filter(row=>row.crew===crew);
    if (!rows.length) throw Error('Select a department to issue a crew copy.');
    const since=show.handoffs.find(h=>h.crew===crew)?.revision || 0;
    const changed=new Set();
    if (since) {
      for (const revision of show.history.slice(since-1))
        for (const id of revision.ids) changed.add(id);
    }
    return {format:1,show:show.name,crew,revision:show.history.length+1,since,
      cues:rows.map(({id,time,text})=>[id,time,text,changed.has(id)])};
  }
  function summary(copy) {
    if (!copy.since) return 'First recorded issue';
    const count=copy.cues.filter(cue=>cue[3]).length;
    return count ? count+' revised '+(count===1?'cue':'cues')+' since R'+copy.since : 'No cue changes since R'+copy.since;
  }
  function validate(v) {
    const short=(s,max)=>typeof s==='string' && s.trim().length>0 && s.length<=max;
    const validRevision=n=>Number.isSafeInteger(n) && n>=0;
    if (v?.format!==1 || !short(v.show,60) || !short(v.crew,40) || !validRevision(v.revision) || v.revision<1 ||
        !validRevision(v.since) || v.since>v.revision || !Array.isArray(v.cues) || !v.cues.length || v.cues.length>60)
      throw Error('Invalid crew copy.');
    const seen=new Set();
    for (const c of v.cues) {
      if (!Array.isArray(c) || c.length!==4 || typeof c[0]!=='string' || !/^[A-Za-z0-9_-]{1,16}$/.test(c[0]) || seen.has(c[0]) ||
          typeof c[1]!=='string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(c[1]) || !short(c[2],250) || typeof c[3]!=='boolean')
        throw Error('Invalid crew cue.');
      seen.add(c[0]);
    }
    return v;
  }
  function fragment(copy) {
    const bytes=new TextEncoder().encode(JSON.stringify(copy));
    if (bytes.length>maxFragment*3/4) return '';
    const encoded=btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
    return encoded.length<=maxFragment?'#v1.'+encoded:'';
  }
  function read(hash) {
    if (typeof hash!=='string' || hash.length>maxFragment+4 || !/^#v1\.[A-Za-z0-9_-]+$/.test(hash)) throw Error('Incomplete crew link.');
    const binary=atob(hash.slice(4).replaceAll('-','+').replaceAll('_','/'));
    return validate(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(binary,c=>c.charCodeAt(0)))));
  }
  return {snapshot,summary,fragment,read};
})();
if(typeof module!=='undefined') module.exports=CrewCopy;
