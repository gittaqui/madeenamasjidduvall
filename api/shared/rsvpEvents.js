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
  // 1. Try site-config.json for embedded events array
  const cfgCandidates = [
    path.join(__dirname, '..', '..', 'site-config.json'),
    path.join(process.cwd(), 'site-config.json')
  ];
  for(const p of cfgCandidates){
    const cfg = await tryRead(p);
    if(cfg && Array.isArray(cfg.events) && cfg.events.length) return cfg.events;
  }
  // 2. Fallback to legacy events.json
  const eventsCandidates = [
    path.join(__dirname, '..', '..', 'events.json'),
    path.join(__dirname, '..', 'events.json'),
    path.join(process.cwd(), 'events.json')
  ];
  for(const p of eventsCandidates){
    const data = await tryRead(p);
    if(data && Array.isArray(data) && data.length) return data;
  }
  // 3. HTTP fetches (site-config first, then events.json)
  const origin = resolveOrigin(req);
  if(origin){
    const httpSources = ['/site-config.json','/events.json'];
    for(const rel of httpSources){
      try {
        const resp = await fetch(origin + rel, { method:'GET', headers:{'Accept':'application/json'} });
        if(resp.ok){
          const json = await resp.json();
            if(rel.includes('site-config') && json && Array.isArray(json.events) && json.events.length) return json.events;
            if(rel.includes('events.json') && Array.isArray(json) && json.length) return json;
        }
      } catch {/* ignore network issues */}
    }
  }
  return []; // final fallback
}

module.exports = { validateEventId, loadEvents };
