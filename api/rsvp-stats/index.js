const { getRsvpTable } = require('../shared/rsvpTable');
const { validateEventId } = require('../shared/rsvpEvents');
module.exports = async function(context, req){
  const eventId = (req.query.eventId||'').trim();
  if(!validateEventId(eventId)) return context.res = { status:400, body:{ error:'invalid_event' } };
  const table = getRsvpTable();
  let total=0, confirmed=0, pending=0, canceled=0, adults=0, children=0;
  try {
    for await (const ent of table.listEntities({ queryOptions:{ filter:`PartitionKey eq '${eventId}'`}})){
      total++;
      if(ent.status === 'confirmed') { confirmed++; adults += ent.adults||0; children += ent.children||0; }
      else if(ent.status === 'pending') pending++;
      else if(ent.status === 'canceled') canceled++;
    }
    return context.res = { status:200, body:{ ok:true, eventId, total, confirmed, pending, canceled, adults, children } };
  } catch (e){
    const msg = e.message || String(e);
    context.log('[rsvp-stats] error', msg);
    context.res = { status:500, body:{ error:'stats_failed', detail: msg } };
  }
};
