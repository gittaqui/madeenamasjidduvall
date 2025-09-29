const { getEventsTable } = require('../shared/eventsTable');
const { getRsvpTable } = require('../shared/rsvpTable');
const crypto = require('crypto');

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

function validateId(id){ return /^[a-z0-9][a-z0-9\-]{2,120}$/.test(id); }

module.exports = async function(context, req){
  if(!isAdmin(req)) return context.res = { status:401, body:{ error:'Unauthorized' } };
  let eventsTable, rsvpTable;
  try { eventsTable = getEventsTable(); } catch(e){ return context.res = { status:500, body:{ error:'events_table_init_failed', detail:e.message } }; }
  try { rsvpTable = getRsvpTable(); } catch(e){ rsvpTable = null; }
  const method = req.method;
  if(method === 'GET'){
    const includeRsvpStats = (req.query.stats||'').toLowerCase()==='1';
    const items = [];
    try {
      for await (const ent of eventsTable.listEntities()){
        if(ent.partitionKey !== 'event') continue;
        items.push({ id: ent.rowKey, title: ent.title, date: ent.date, time: ent.time, published: ent.published, updatedUtc: ent.updatedUtc, createdUtc: ent.createdUtc });
        if(items.length >= 1000) break;
      }
    } catch(e){ context.log('[events] list error', e.message); }
    if(includeRsvpStats && rsvpTable){
      // Build stats per event by enumerating RSVP table partition counts (bounded)
      const statsMap = {};
      try {
        for await (const ent of rsvpTable.listEntities()){
          if(ent.partitionKey === 'event-meta' || ent.partitionKey === 'rate') continue;
          const ev = ent.partitionKey;
            let s = statsMap[ev];
            if(!s) s = statsMap[ev] = { total:0, confirmed:0, pending:0, canceled:0, adults:0, children:0 };
            s.total++;
            if(ent.status === 'confirmed'){ s.confirmed++; s.adults += ent.adults||0; s.children += ent.children||0; }
            else if(ent.status === 'pending') s.pending++;
            else if(ent.status === 'canceled') s.canceled++;
        }
      } catch(e){ context.log('[events] stats enumeration error', e.message); }
      items.forEach(ev=>{ ev.stats = statsMap[ev.id] || { total:0, confirmed:0, pending:0, canceled:0, adults:0, children:0 }; });
    }
    return context.res = { status:200, body:{ ok:true, count: items.length, items } };
  }
  if(method === 'POST'){
    const body = req.body || {};
    const id = (body.id||'').trim();
    if(!validateId(id)) return context.res = { status:400, body:{ error:'invalid_id' } };
    const now = new Date().toISOString();
    // Pre-flight existence check to provide friendlier response (avoids opaque 409)
    let preExisting = null;
    try { preExisting = await eventsTable.getEntity('event', id); } catch{}
    if(preExisting){
      return context.res = { status:409, body:{ error:'exists', id, existing:{ title: preExisting.title, date: preExisting.date, time: preExisting.time, published: preExisting.published, updatedUtc: preExisting.updatedUtc, createdUtc: preExisting.createdUtc } } };
    }
    const entity = {
      partitionKey:'event',
      rowKey:id,
      title: body.title || id,
      date: body.date || now.substring(0,10),
      time: body.time || '00:00',
      description: body.description || '',
      image: body.image || '',
      published: body.published === false ? false : true,
      createdUtc: now,
      updatedUtc: now
    };
    try { await eventsTable.createEntity(entity); return context.res = { status:201, body:{ ok:true, created:id } }; }
    catch(e){
      // Double-check if now exists (race condition) and enrich response
      let existing = null; try { existing = await eventsTable.getEntity('event', id); } catch{}
      return context.res = { status:409, body:{ error:'exists', detail:e.message, id, existing: existing ? { title: existing.title, date: existing.date, time: existing.time, published: existing.published, updatedUtc: existing.updatedUtc, createdUtc: existing.createdUtc } : null } };
    }
  }
  if(method === 'PUT'){
    const body = req.body || {};
    const id = (body.id||'').trim();
    if(!validateId(id)) return context.res = { status:400, body:{ error:'invalid_id' } };
    let existing=null; try { existing = await eventsTable.getEntity('event', id); } catch{}
    if(!existing) return context.res = { status:404, body:{ error:'not_found' } };
    const now = new Date().toISOString();
    const updated = { ...existing, title: body.title ?? existing.title, date: body.date ?? existing.date, time: body.time ?? existing.time, description: body.description ?? existing.description, image: body.image ?? existing.image, published: typeof body.published === 'boolean' ? body.published : existing.published, updatedUtc: now };
    try { await eventsTable.updateEntity(updated, 'Replace'); return context.res = { status:200, body:{ ok:true, updated:id } }; }
    catch(e){ return context.res = { status:500, body:{ error:'update_failed', detail:e.message } }; }
  }
  if(method === 'DELETE'){
    const id = (req.query.id||'').trim();
    if(!validateId(id)) return context.res = { status:400, body:{ error:'invalid_id' } };
    try { await eventsTable.deleteEntity('event', id); return context.res = { status:200, body:{ ok:true, deleted:id } }; }
    catch(e){ return context.res = { status:404, body:{ error:'not_found' } }; }
  }
  context.res = { status:405, body:{ error:'method_not_allowed' } };
};
