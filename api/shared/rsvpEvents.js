const fs = require('fs');
const path = require('path');

function validateEventId(id){ return /^[a-z0-9\-]{4,120}$/.test(id); }

async function tryRead(p){
  try {
    const raw = await fs.promises.readFile(p, 'utf8');
    return JSON.parse(raw);
  } catch { return null; }
}

function resolveOrigin(req){
  const candidates = [];
  if(process.env.SITE_ORIGIN) candidates.push(process.env.SITE_ORIGIN);
  const xf = req && (req.headers['x-forwarded-host'] || req.headers['host']);
  if(xf) candidates.push(`https://${xf}`);
  if(process.env.WEBSITE_HOSTNAME) candidates.push(`https://${process.env.WEBSITE_HOSTNAME}`);
  for(const c of candidates){
    if(c){
      const norm = c.replace(/\/$/,'');
      if(/^https?:\/\//i.test(norm)) return norm;
    }
  }
  return null;
}

async function loadEvents(req){
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
  // Fallback: HTTP fetch from any resolvable origin (SITE_ORIGIN, headers, WEBSITE_HOSTNAME)
  const origin = resolveOrigin(req);
  if(origin){
    try {
      const resp = await fetch(origin + '/events.json', { method:'GET', headers:{'Accept':'application/json'} });
      if(resp.ok){
        const json = await resp.json();
        if(Array.isArray(json)) return json;
      }
    } catch {/* ignore network issues */}
  }
  return []; // final fallback
}

module.exports = { validateEventId, loadEvents };
