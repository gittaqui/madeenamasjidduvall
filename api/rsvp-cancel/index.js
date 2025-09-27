const { getRsvpTable } = require('../shared/rsvpTable');
module.exports = async function(context, req){
  const token = (req.body && req.body.token || '').trim();
  if(!token) return context.res = { status:400, body:{ error:'missing_token' } };
  const table = getRsvpTable();
  try {
    let tokenRow; try { tokenRow = await table.getEntity('token', token); } catch {}
    if(!tokenRow) return context.res = { status:404, body:{ error:'token_not_found' } };
    const eventId = tokenRow.eventId || tokenRow.partitionKey;
    const email = tokenRow.email || tokenRow.rowKey;
    let rsvp; try { rsvp = await table.getEntity(eventId, email); } catch {}
    if(!rsvp) return context.res = { status:404, body:{ error:'rsvp_not_found' } };
    if(rsvp.status === 'canceled') return context.res = { status:200, body:{ ok:true, status:'canceled', already:true } };
    rsvp.status = 'canceled';
    rsvp.canceledUtc = new Date().toISOString();
    await table.updateEntity(rsvp, 'Merge');
    context.res = { status:200, body:{ ok:true, status:'canceled' } };
  } catch (e){
    const msg = e.message || String(e);
    context.log('[rsvp-cancel] error', msg);
    context.res = { status:500, body:{ error:'cancel_failed', detail: msg } };
  }
};
