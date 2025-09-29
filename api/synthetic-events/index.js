const { getRsvpTable } = require('../shared/rsvpTable');
const fs = require('fs');
const path = require('path');

function isAdmin(req){
  try {
    const userHeader = req.headers['x-ms-client-principal'];
    if(!userHeader) return false;
    const decoded = Buffer.from(userHeader, 'base64').toString('utf8');
    const principal = JSON.parse(decoded);
    const roles = principal.userRoles||[];
    return roles.includes('admin') || roles.includes('administrator');
  } catch { return false; }
}

module.exports = async function(context, req){
  if(!isAdmin(req)) return context.res = { status:401, body:{ error:'Unauthorized' } };
  const table = getRsvpTable();
  const method = req.method;
  if(method === 'GET'){
    const items = [];
    try {
      for await (const ent of table.listEntities({ queryOptions:{ filter:"PartitionKey eq 'event-meta'" }})){
        items.push({ id: ent.rowKey, title: ent.title, date: ent.date, createdUtc: ent.createdUtc, synthetic:true });
        if(items.length >= 500) break;
      }
    } catch(e){ context.log('[synthetic-events] list error', e.message); }
    return context.res = { status:200, body:{ ok:true, count: items.length, items } };
  }
  if(method === 'DELETE'){
    const id = (req.query.id||'').trim();
    if(!id) return context.res = { status:400, body:{ error:'Missing id' } };
    try { await table.deleteEntity('event-meta', id); return context.res = { status:200, body:{ ok:true, deleted:id } }; }
    catch(e){ return context.res = { status:404, body:{ error:'Not found' } }; }
  }
  if(method === 'POST'){
    // Promote a synthetic event into events.json
    const id = (req.query.id||'').trim();
    if(!id) return context.res = { status:400, body:{ error:'Missing id' } };
    let meta = null;
    try { meta = await table.getEntity('event-meta', id); } catch{}
    if(!meta) return context.res = { status:404, body:{ error:'Meta not found' } };
    // Load existing events.json (attempt several locations)
    const candidates = [
      path.join(__dirname,'..','..','events.json'),
      path.join(process.cwd(),'events.json')
    ];
    let eventsPath = null; let events = null;
    for(const p of candidates){
      try { const raw = await fs.promises.readFile(p,'utf8'); const json = JSON.parse(raw); if(Array.isArray(json)){ eventsPath=p; events=json; break; } } catch{}
    }
    if(!events){
      // If no file found, initialize a new one at repo root relative
      eventsPath = path.join(__dirname,'..','..','events.json');
      events = [];
    }
    if(events.some(e=> e.id === id)){
      return context.res = { status:409, body:{ error:'Already exists in events.json' } };
    }
    const newEvent = {
      id,
      title: meta.title || id,
      date: meta.date || new Date().toISOString().substring(0,10),
      time: '00:00',
      description: '(Imported from RSVP synthetic metadata – update details)',
      image: 'img/events-1.jpg',
      published: true
    };
    events.push(newEvent);
    try {
      await fs.promises.writeFile(eventsPath, JSON.stringify(events,null,2));
      return context.res = { status:200, body:{ ok:true, promoted: newEvent, path: eventsPath } };
    } catch(e){
      return context.res = { status:500, body:{ error:'Write failed', detail:e.message } };
    }
  }
  context.res = { status:405, body:{ error:'Method not allowed' } };
};
