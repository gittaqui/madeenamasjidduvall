const { getTableClient } = require('../shared/tableClient');
const { getEventsTable, ensureEventsTableExists } = require('../shared/eventsTable');
const { getSubscribersTable, ensureSubscribersTableExists } = require('../shared/subscribersTable');

module.exports = async function(context, req){
  const out = { timeUtc: new Date().toISOString() };
  async function test(name, getFn, autoCreateFn){
    try {
      let client = getFn();
      let created = false;
      try {
        const it = client.listEntities({ queryOptions:{ top:1 }});
        await it.next();
        return { ok:true, probe:'ok' };
      } catch(e){
        const raw = e.message || String(e);
        const notFound = /ResourceNotFound|TableNotFound|404/.test(raw);
        if(notFound && autoCreateFn){
          try {
            client = await autoCreateFn();
            const it2 = client.listEntities({ queryOptions:{ top:1 }}); await it2.next();
            created = true;
            return { ok:true, probe:'ok', autoCreated:true };
          } catch(inner){
            return { ok:false, error: inner.message, phase:'autoCreate', stack:(inner.stack||'').split('\n').slice(0,4) };
          }
        }
        return { ok:false, error: raw, code: e.code || e.statusCode, odata: tryParseOData(raw) };
      }
    } catch(e){
      return { ok:false, error: e.message, stack:(e.stack||'').split('\n').slice(0,4) };
    }
  }

  function tryParseOData(msg){
    try {
      const parsed = JSON.parse(msg);
      if(parsed && parsed['odata.error']) return parsed;
    } catch{}
    return undefined;
  }

  const autocreateFlag = /true/i.test(req.query.autocreate||'');
  out.subscribers = await test('Subscribers', ()=>getSubscribersTable(), autocreateFlag ? ensureSubscribersTableExists : null);
  const autocreate = autocreateFlag ? ensureEventsTableExists : null;
  out.events = await test('Events', ()=>getEventsTable(), autocreate);

  out.notes = [
  'Add ?autocreate=true to attempt automatic creation of missing Subscribers & Events tables.',
    'probeError previously returned raw message; now structured error fields are provided.'
  ];

  context.res = { status:200, body: out };
};
