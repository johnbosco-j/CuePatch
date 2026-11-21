const {example} = require('../web/core.js');
  const fixture = [
    ['ST-01','Stand by the opening host at the centre lectern.'],
    ['AU-01','Open the lectern mic for the opening welcome.'],
    ['LX-01','Light the centre lectern for the opening welcome.'],
    ['VC-01','Frame the opening host at the centre lectern.']
  ].map(([id,after]) => ({id,after,evidence: example.split('. ')[0]+'.'}));
module.exports = fixture;
