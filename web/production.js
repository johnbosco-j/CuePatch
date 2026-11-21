// The production book is local to this browser. Firebase receives only the note and cue rows on a request.
const CueProduction = (() => {
  const prefix = 'cuepatch.show.v2.';
  const activeKey = 'cuepatch.active.v2';
  const legacyKey = 'cuepatch.desk.v1';
  const empty = () => ({called: [], handoffs: [], templates: []});
  function create(name, rows, sample = false) {
    return {id: sample ? 'opening-night' : crypto.randomUUID(), version: 0, name, rows,
      history: [], sample, ...empty()};
  }
  function blocks(rows) {
    const groups = [];
    for (const row of rows) {
      if (groups.at(-1)?.time !== row.time) groups.push({time: row.time, rows: []});
      groups.at(-1).rows.push(row);
    }
    return groups;
  }
  function crewStatus(show) {
    const crews = [...new Set(show.rows.map(row => row.crew))];
    return crews.map(crew => {
      const ids = new Set(show.rows.filter(row => row.crew === crew).map(row => row.id));
      let required = 1;
      show.history.forEach((change, i) => {
        if (change.ids.some(id => ids.has(id))) required = i + 2;
      });
      const previous = show.handoffs.find(item => item.crew === crew);
      return {crew, required, previous, current: !!previous && previous.revision >= required};
    });
  }
  function backup(show) {
    const {name, rows, history, called, handoffs, templates} = show;
    return {format:'cuepatch-production', schema:2, name, rows, history, called, handoffs, templates};
  }
  function readBackup(data) {
    if (data?.format !== 'cuepatch-production' || data.schema !== 2) throw Error('Unsupported CuePatch backup.');
    if (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 60) throw Error('Invalid production name.');
    const rows = CueCore.validateSheet(data.rows);
    const ids = new Set(rows.map(row => row.id));
    const crews = new Set(rows.map(row => row.crew));
    const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
    const shortText = (value, max) => typeof value === 'string' && value.trim() && value.length <= max;
    if (!Array.isArray(data.history) || !Array.isArray(data.called) || !Array.isArray(data.handoffs) || !Array.isArray(data.templates))
      throw Error('Incomplete production backup.');
    const history = data.history.map(change => {
      if (!shortText(change?.source,160) || !Array.isArray(change.ids) || !change.ids.length ||
          new Set(change.ids).size !== change.ids.length || change.ids.some(id=>!ids.has(id))) throw Error('Invalid revision in backup.');
      const record = {source:change.source, ids:change.ids.slice()};
      if (change.approvedAt && timestamp(change.approvedAt)) record.approvedAt = change.approvedAt;
      if (change.edits !== undefined) {
        if (!Array.isArray(change.edits) || change.edits.length !== record.ids.length ||
            change.edits.some((e,i)=>e?.id!==record.ids[i] || !shortText(e.before,250) || !shortText(e.after,250))) throw Error('Invalid revision details.');
        record.edits = change.edits.map(({id,before,after})=>({id,before,after}));
      }
      return record;
    });
    if (data.called.length > blocks(rows).length || !data.called.every(timestamp)) throw Error('Invalid call progress.');
    if (data.handoffs.length > crews.size || new Set(data.handoffs.map(item=>item?.crew)).size !== data.handoffs.length ||
        data.handoffs.some(item=>!crews.has(item?.crew) || !Number.isInteger(item.revision) || item.revision < 1 ||
        item.revision > history.length+1 || !timestamp(item.at))) throw Error('Invalid crew handoffs.');
    if (data.templates.length > 20 || data.templates.some(note=>!shortText(note,1500))) throw Error('Invalid saved notes.');
    return {...create(data.name.trim(),rows), history, called:[...data.called],
      handoffs:data.handoffs.map(({crew,revision,at})=>({crew,revision,at})), templates:[...new Set(data.templates)]};
  }
  function open() {
    let storage;
    let session;
    try {session = sessionStorage;} catch {}
    try {storage = localStorage; storage.getItem(activeKey);} catch {storage = session;}
    const ram = new Map();
    function read(key) {return storage ? storage.getItem(key) : ram.get(key);}
    function write(key,value) {if (storage) storage.setItem(key,value); else ram.set(key,value);}
    function get(id) {const raw=read(prefix+id);return raw ? JSON.parse(raw) : null;}
    function remember(id) {
      try {session?.setItem(activeKey,id);write(activeKey,id);} catch {}
    }
    function list() {
      const keys = storage ? Array.from({length:storage.length},(_,i)=>storage.key(i)) : [...ram.keys()];
      return keys.filter(key=>key?.startsWith(prefix)).flatMap(key=>{
        try {const s=get(key.slice(prefix.length));return s ? [{id:s.id,name:s.name}] : [];} catch {return [];}
      }).sort((a,b)=>a.name.localeCompare(b.name));
    }
    function initial() {
      const chosen = session?.getItem(activeKey);
      if (chosen && get(chosen)) return get(chosen);
      const legacy = session?.getItem(legacyKey);
      if (legacy) {
        try {
          const old = JSON.parse(legacy);
          const migrated=readBackup({format:'cuepatch-production',schema:2,...empty(),...old});
          migrated.sample=!!old.sample;
          write(prefix+migrated.id,JSON.stringify(migrated));remember(migrated.id);return migrated;
        } catch {}
      }
      const last = read(activeKey);
      if (last && get(last)) {remember(last);return get(last);}
      const first = get('opening-night') || create('Opening night',CueCore.sample,true);
      write(prefix+first.id,JSON.stringify(first));remember(first.id);return first;
    }
    async function save(show, expected) {
      const commit=()=>{
        const existing=get(show.id);
        if ((existing?.version ?? null) !== expected) throw Error('Another tab changed this show. Review its latest version and try again.');
        const next={...show,version:(expected ?? 0)+1};
        write(prefix+next.id,JSON.stringify(next));remember(next.id);return next;
      };
      return typeof navigator!=='undefined' && navigator.locks ? navigator.locks.request(prefix+show.id,commit) : commit();
    }
    return {get,list,initial,save,remember,storage,isShowKey:(key,id)=>key===prefix+id};
  }
  return {create,blocks,crewStatus,backup,readBackup,open};
})();
if (typeof module !== 'undefined') module.exports = CueProduction;
