const fs = require('fs');
const path = require('path');

function validateEventId(id){ return /^[a-z0-9\-]{4,120}$/.test(id); }

async function tryRead(p){
  try {
    const raw = await fs.promises.readFile(p, 'utf8');
    return JSON.parse(raw);
  } catch { return null; }
}

async function loadEvents(){
  // Attempt multiple filesystem locations (local dev: root has events.json; prod Functions: root may not include it)
  const candidates = [
    path.join(__dirname, '..', '..', 'events.json'), // repo root when running locally
    path.join(__dirname, '..', 'events.json'),        // if copied into api/
    path.join(process.cwd(), 'events.json')           // current working dir fallback
  ];
  for(const p of candidates){
    const data = await tryRead(p);
    if(data && Array.isArray(data)) return data;
  }
  // Fallback: HTTP fetch from SITE_ORIGIN if provided (Node 18 global fetch available)
  const origin = (process.env.SITE_ORIGIN||'').replace(/\/$/,'');
  if(origin){
    try {
      const resp = await fetch(origin + '/events.json', { method:'GET', headers:{'Accept':'application/json'} });
      if(resp.ok){
        const json = await resp.json();
        if(Array.isArray(json)) return json;
      }
    } catch {/* ignore */}
  }
  return []; // final fallback
}

module.exports = { validateEventId, loadEvents };
