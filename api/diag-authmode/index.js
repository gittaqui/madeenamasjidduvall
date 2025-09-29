const { getTableClient, getSpecificTableClient, getLastAuthMode } = require('../shared/tableClient');
const { getRsvpTable } = require('../shared/rsvpTable');

module.exports = async function (context, req) {
  const details = { timeUtc: new Date().toISOString() };
  function safe(fn){ try { return { ok:true, value: fn() }; } catch(e){ return { ok:false, error: e.message }; } }

  const mainClient = safe(()=> getTableClient());
  details.main = { init: mainClient }; 
  if(mainClient.ok){
    try {
      // list 1 entity to force a round trip (may 404 if empty; ignore)
      const iter = mainClient.value.listEntities({ queryOptions:{ top:1 } });
      const { done } = await iter.next();
      details.main.probe = { ok:true, done };
    } catch(e){ details.main.probe = { ok:false, error:e.message, code:e.statusCode||e.code }; }
  }

  const rsvpClient = safe(()=> getRsvpTable());
  details.rsvps = { init: rsvpClient };
  if(rsvpClient.ok){
    try {
      const iter = rsvpClient.value.listEntities({ queryOptions:{ top:1 } });
      const { done } = await iter.next();
      details.rsvps.probe = { ok:true, done };
    } catch(e){ details.rsvps.probe = { ok:false, error:e.message, code:e.statusCode||e.code }; }
  }

  // If user asks for an explicit table name test (?table=Events)
  const explicit = (req.query.table||'').trim();
  if(explicit){
    const specific = safe(()=> getSpecificTableClient(explicit));
    details.explicit = { name: explicit, init: specific };
    if(specific.ok){
      try {
        const iter = specific.value.listEntities({ queryOptions:{ top:1 } });
        const { done } = await iter.next();
        details.explicit.probe = { ok:true, done };
      } catch(e){ details.explicit.probe = { ok:false, error:e.message, code:e.statusCode||e.code }; }
    }
  }

  details.authMode = getLastAuthMode();
  details.env = {
    SUBSCRIBERS_TABLE: process.env.SUBSCRIBERS_TABLE,
    RSVP_TABLE_NAME: process.env.RSVP_TABLE_NAME,
    EVENTS_TABLE_NAME: process.env.EVENTS_TABLE_NAME,
    MANAGED_IDENTITY_CLIENT_ID: !!process.env.MANAGED_IDENTITY_CLIENT_ID,
    TABLES_SAS: !!process.env.TABLES_SAS,
    STORAGE_CONNECTION_STRING: !!process.env.STORAGE_CONNECTION_STRING,
    STORAGE_ACCOUNT_TABLE_URL: process.env.STORAGE_ACCOUNT_TABLE_URL ? 'set' : null
  };

  context.res = { status:200, body: details };
};
