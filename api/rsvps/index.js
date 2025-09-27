const { getRsvpTable } = require('../shared/rsvpTable');
const { loadEvents } = require('../shared/rsvpEvents');

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

module.exports = async function (context, req){
  if(!isAdmin(req)) return context.res = { status:401, body:{ error:'Unauthorized' } };
  const table = getRsvpTable();
  if(req.method === 'DELETE'){
    // Future: allow delete of a specific RSVP (?eventId=&email=)
    const eventId = (req.query.eventId||'').trim();
    const email = (req.query.email||'').trim().toLowerCase();
    if(!eventId || !email){
      return context.res = { status:400, body:{ error:'Missing eventId or email' } };
    }
    try { await table.deleteEntity(eventId, email); context.res = { status:200, body:{ ok:true } }; }
    catch(e){ context.res = { status:404, body:{ error:'Not found' } }; }
    return;
  }
  // GET listing
  const eventId = (req.query.eventId||'').trim();
  const maintenance = (req.query.maintenance||'').trim();
  if(maintenance === 'stripTokens'){
    let updated = 0;
    for await (const ent of table.listEntities()){
      if(ent.partitionKey !== 'token' && Object.prototype.hasOwnProperty.call(ent,'token')){
        delete ent.token;
        try { await table.updateEntity(ent,'Replace'); updated++; } catch(e){ context.log('[rsvps] strip token fail', e.message); }
      }
    }
    return context.res = { status:200, body:{ ok:true, updated } };
  }
  const format = (req.query.format||'json').toLowerCase();
  const limit = Math.min(5000, Number(req.query.limit||1000));
  const items = [];
  const filter = eventId ? `PartitionKey eq '${eventId}'` : undefined;
  try {
    for await (const ent of table.listEntities({ queryOptions: filter? { filter } : undefined })){
      items.push({ eventId: ent.partitionKey, email: ent.rowKey, name: ent.name, adults: ent.adults, children: ent.children, status: ent.status, createdUtc: ent.createdUtc, confirmedUtc: ent.confirmedUtc, canceledUtc: ent.canceledUtc });
      if(items.length >= limit) break;
    }
  } catch (e){ context.log('[rsvps] list error', e.message); }
  if(format === 'csv'){
    const header = 'eventId,email,name,adults,children,status,createdUtc,confirmedUtc,canceledUtc';
    const lines = items.map(i=> [i.eventId,i.email,i.name||'',i.adults||'',i.children||'',i.status||'',i.createdUtc||'',i.confirmedUtc||'',i.canceledUtc||''].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','));
    const csv = [header, ...lines].join('\n');
    context.res = { status:200, headers:{ 'Content-Type':'text/csv', 'Content-Disposition':'attachment; filename="rsvps.csv"' }, body: csv };
    return;
  }
  const events = await loadEvents();
  context.res = { status:200, body:{ ok:true, count: items.length, items, events: events.filter(e=>e.published!==false) } };
};
