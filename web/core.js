/* Shared by the browser and the Node regression tests. */
const CueCore = (() => {
  const sample = [
    ['ST-01','18:00','Stage','Stand by the opening host at the stage-left mark.'],
    ['AU-01','18:00','Sound','Open the host handheld for the opening welcome.'],
    ['LX-01','18:00','Lighting','Light the stage-left mark for the opening welcome.'],
    ['VC-01','18:00','Camera','Frame the opening host at the stage-left mark.'],
    ['ST-02','18:04','Stage','Bring the singer to the stage-left mark for the first song.'],
    ['AU-02','18:04','Sound','Open the singer handheld for the first song.'],
    ['LX-02','18:04','Lighting','Light the stage-left mark for the first song.'],
    ['VC-02','18:04','Camera','Take the singer close-up for the first song.']
  ].map(([id,time,crew,text]) => ({id,time,crew,text}));
  const example = 'For the opening welcome only, move the host to the centre lectern and use the lectern mic. The first song stays as rehearsed.';
  function parseCueLines(text) {
    const rows = text.trim().split(/\r?\n/).filter(line => line.trim()).map((line, i) => {
      const separator = line.includes('\t') ? '\t' : '|';
      const cells = line.split(separator).map(value => value.trim());
      if (cells.length !== 4) throw Error('Line '+(i+1)+' needs four columns: ID, time, crew and instruction.');
      const [id,time,crew,instruction] = cells;
      return {id,time,crew,text:instruction};
    });
    return validateSheet(rows);
  }
  function validateSheet(rows) {
    if (!Array.isArray(rows) || !rows.length || rows.length > 60) throw Error('Choose a JSON array with 1–60 cues.');
    const seen = new Set();
    return rows.map(row => {
      if (!row || !/^[A-Za-z0-9_-]{1,16}$/.test(String(row.id)) || typeof row.id !== 'string' || seen.has(row.id) ||
          typeof row.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.time) || typeof row.crew !== 'string' || !row.crew.trim() || row.crew.length>40 ||
          typeof row.text !== 'string' || !row.text.trim() || row.text.length>250) throw Error('Each cue needs a unique ID, a 24-hour HH:MM time, a crew and an instruction of up to 250 characters.');
      seen.add(row.id);
      return {id:row.id,time:row.time,crew:row.crew.trim(),text:row.text.trim()};
    });
  }
  function validatePatch(rows,note,proposals) {
    if (!Array.isArray(proposals) || proposals.length>rows.length) throw Error('Expected a list of cue changes. Try a narrower note.');
    const seen = new Set();
    return proposals.map(p => {
      const row = rows.find(r=>r.id===p?.id);
      if (!row || seen.has(row.id) || typeof p.after!=='string' || !p.after.trim() || p.after.length>250 || p.after.trim()===row.text ||
          typeof p.evidence!=='string' || !p.evidence.trim() || !note.includes(p.evidence)) throw Error('A proposal lacked a valid cue or an exact quote. The sheet is untouched. Refine the note and try again.');
      seen.add(row.id);
      return {id:row.id,before:row.text,after:p.after.trim(),evidence:p.evidence};
    });
  }
  function parseReply(text) {
    return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));
  }
  function commit(rows,patches) {
    const changes = new Map(patches.map(p=>[p.id,p]));
    for (const p of patches) if (!rows.some(r=>r.id===p.id && r.text===p.before)) throw Error('The sheet changed. Analyse this revision again.');
    return rows.map(r=>changes.has(r.id)?{...r,text:changes.get(r.id).after}:{...r});
  }
  return {sample,example,parseCueLines,validateSheet,validatePatch,parseReply,commit};
})();
if (typeof module !== 'undefined') module.exports = CueCore;
