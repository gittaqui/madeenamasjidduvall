const { getTableClient, getSpecificTableClient } = require('../shared/tableClient');
const { getEventsTable } = require('../shared/eventsTable');

module.exports = async function(context, req){
  const out = { timeUtc: new Date().toISOString() };
  try {
    const subs = getTableClient();
    out.subscribers = { ok:true };
    try { const it = subs.listEntities({ queryOptions:{ top:1 }}); await it.next(); out.subscribers.probe='ok'; } catch(e){ out.subscribers.probeError=e.message; }
  } catch(e){ out.subscribers = { ok:false, error:e.message }; }

  try {
    const events = getEventsTable();
    out.events = { ok:true };
    try { const it = events.listEntities({ queryOptions:{ top:1 }}); await it.next(); out.events.probe='ok'; } catch(e){ out.events.probeError=e.message; }
  } catch(e){ out.events = { ok:false, error:e.message, stack:(e.stack||'').split('\n').slice(0,4) }; }

  context.res = { status:200, body: out };
};
