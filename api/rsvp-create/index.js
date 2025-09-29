// Public endpoint: accept RSVP; if eventId not found in events.json, synthesize minimal event metadata in a side-table (optional) and proceed.
// NOTE: Does not replace external Function App but provides a fallback for early RSVPs.
const { getRsvpTable } = require('../shared/rsvpTable');
const { validateEventId, loadEvents } = require('../shared/rsvpEvents');
const crypto = require('crypto');

module.exports = async function(context, req){
  if(req.method !== 'POST'){ context.res = { status:405, body:{ error:'Method not allowed' } }; return; }
  const body = req.body || {};
  const eventId = (body.eventId||'').trim();
  if(!validateEventId(eventId)) return context.res = { status:400, body:{ ok:false, error:'invalid_eventId' } };
  const name = (body.name||'').trim();
  const email = (body.email||'').trim().toLowerCase();
  const adults = Number(body.adults||1); const children = Number(body.children||0);
  if(!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return context.res = { status:400, body:{ ok:false, error:'invalid_email' } };
  const table = getRsvpTable();
  // Basic event existence check
  let events = await loadEvents(req);
  let exists = events.some(e=> e.id === eventId);
  let syntheticCreated = false;
  if(!exists){
    // Synthesize event metadata inserted into a lightweight index partition so admins can see it.
    try {
      const dateMatch = eventId.match(/(\d{4}-\d{2}-\d{2})/);
      const date = dateMatch ? dateMatch[1] : new Date().toISOString().substring(0,10);
      const prettyTitle = eventId.replace(/\d{4}-\d{2}-\d{2}/,'').replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase()).trim() || eventId;
      const metaRow = { partitionKey:'event-meta', rowKey:eventId, title: prettyTitle, date, createdUtc: new Date().toISOString(), synthetic:true };
      await table.upsertEntity(metaRow, 'Merge');
      syntheticCreated = true;
    } catch(e){ context.log('[rsvp-create] synthetic meta failed', e.message); }
  }
  const now = new Date().toISOString();
  const entity = {
    partitionKey: eventId,
    rowKey: crypto.createHash('sha256').update(email,'utf8').digest('hex'),
    email,
    name,
    adults,
    children,
    status: 'confirmed', // no email confirmation path in fallback
    createdUtc: now,
    confirmedUtc: now
  };
  try {
    await table.upsertEntity(entity, 'Replace');
    context.res = { status:200, body:{ ok:true, eventId, syntheticEvent: syntheticCreated } };
  } catch(e){
    context.res = { status:500, body:{ ok:false, error:'rsvp_failed', detail:e.message } };
  }
};
