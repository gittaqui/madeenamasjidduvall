const crypto = require('crypto');
const { getRsvpsTable } = require('../Shared/tableClient');
const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/i;
function normalizeEmail(e){ return (e||'').trim().toLowerCase(); }
function randomToken(){ return crypto.randomBytes(20).toString('hex'); }

module.exports = async function(context, req){
  const body = req.body || {};
  const eventId = (body.eventId||'').trim();
  const email = normalizeEmail(body.email);
  if(!EMAIL_REGEX.test(email)) return context.res = { status:400, body:{ error:'invalid_email' } };
  if(!eventId) return context.res = { status:400, body:{ error:'invalid_event' } };
  const name = (body.name||'').trim().slice(0,80);
  const adults = Number.isFinite(body.adults)? Math.max(0, Math.min(20, body.adults|0)) : 1;
  const children = Number.isFinite(body.children)? Math.max(0, Math.min(50, body.children|0)) : 0;
  const notes = (body.notes||'').trim().slice(0,300);
  let table;
  try { table = getRsvpsTable(); } catch(e){ return context.res = { status:500, body:{ error:'table_client_error', detail:e.message } }; }
  try {
    try { await table.createTable(); } catch{}
    const partitionKey = eventId;
    const rowKey = email;
    let existing = null; try { existing = await table.getEntity(partitionKey, rowKey); } catch{}
    const now = new Date().toISOString();
    if(existing){
      if(existing.status === 'confirmed') return context.res = { status:200, body:{ ok:true, status:'confirmed', already:true } };
      existing.name = name || existing.name;
      existing.adults = adults; existing.children = children; existing.notes = notes; existing.updatedUtc = now;
      await table.updateEntity(existing,'Merge');
      return context.res = { status:200, body:{ ok:true, status: existing.status||'pending', already:true } };
    }
    // Minimal implementation without capacity logic (add later if needed)
    const token = randomToken();
    const requireConfirm = (process.env.RSVP_REQUIRE_CONFIRM || 'false').toLowerCase() === 'true';
    const status = requireConfirm ? 'pending' : 'confirmed';
    const entity = { partitionKey, rowKey, email, name, adults, children, notes, status, createdUtc: now, updatedUtc: now };
    await table.upsertEntity(entity);
    await table.upsertEntity({ partitionKey:'token', rowKey:token, eventId, email, createdUtc: now });
    context.res = { status:200, body:{ ok:true, status, needConfirm: requireConfirm } };
  } catch(e){
    const msg = e.message||String(e);
    context.res = { status:500, body:{ error:'rsvp_failed', detail: msg } };
  }
};
