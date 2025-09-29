const { ensureEventsTableExists } = require('../shared/eventsTable');

module.exports = async function(context, req){
  const detail = { timeUtc: new Date().toISOString(), env:{ EVENTS_TABLE_NAME: process.env.EVENTS_TABLE_NAME, EVENTS_TABLE_NAME_type: typeof process.env.EVENTS_TABLE_NAME, STORAGE_ACCOUNT_TABLE_URL: process.env.STORAGE_ACCOUNT_TABLE_URL } };
  try {
    const table = await ensureEventsTableExists();
    detail.init = { ok:true };
    try {
      const iter = table.listEntities({ queryOptions:{ top:3 } });
      const sample = [];
      for await (const ent of iter){ sample.push({ pk:ent.partitionKey, rk:ent.rowKey, title: ent.title, date: ent.date }); if(sample.length>=3) break; }
      detail.sample = sample;
    } catch(e){ detail.sampleError = { message:e.message, code:e.code, statusCode:e.statusCode }; }
    context.res = { status:200, body: detail };
  } catch(e){
    detail.init = { ok:false, message: e.message, code: e.code, statusCode: e.statusCode, stack: (e.stack||'').split('\n').slice(0,6) };
    context.res = { status:500, body: detail };
  }
};
