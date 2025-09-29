const { getRsvpTable } = require('../shared/rsvpTable');
const { validateEventId } = require('../shared/rsvpEvents');
module.exports = async function(context, req){
  const eventId = (req.query.eventId||'').trim();
  if(!validateEventId(eventId)) return context.res = { status:400, body:{ error:'invalid_event' } };
  let table;
  try { table = getRsvpTable(); } catch(e){
    context.log('[rsvp-stats] table init error', e.message);
    return context.res = { status:500, body:{ error:'table_init_failed', detail: e.message } };
  }
  let total=0, confirmed=0, pending=0, canceled=0, adults=0, children=0;
  const filter = `PartitionKey eq '${eventId}'`;
  try {
    for await (const ent of table.listEntities({ queryOptions:{ filter }})){
      total++;
      if(ent.status === 'confirmed') { confirmed++; adults += ent.adults||0; children += ent.children||0; }
      else if(ent.status === 'pending') pending++;
      else if(ent.status === 'canceled') canceled++;
    }
    // Graceful empty (not an error)
    return context.res = { status:200, body:{ ok:true, eventId, total, confirmed, pending, canceled, adults, children, empty: total===0 } };
  } catch (e){
    const msg = e.message || String(e);
    const code = e.statusCode || e.code || null;
    context.log('[rsvp-stats] iteration error', msg, code||'');
    context.res = { status:500, body:{ error:'stats_failed', detail: msg, code } };
  }
};
