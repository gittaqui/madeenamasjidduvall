// Admin-key protected diagnostic variant (does not rely on SWA role gate)
const { getTableClient } = require('../shared/tableClient');

module.exports = async function (context, req){
  const adminKey = process.env.SUBSCRIBERS_ADMIN_KEY;
  const provided = req.query.adminKey || req.headers['x-admin-key'];
  if(!adminKey || adminKey !== provided){
    return context.res = { status:401, body:{ ok:false, error:'unauthorized', hint:'supply adminKey query param' } };
  }
  const details = { env:{}, steps:[] };
  for(const k of ['STORAGE_ACCOUNT_TABLE_URL','STORAGE_ACCOUNT_BLOB_URL','TABLES_ACCOUNT_URL','SUBSCRIBERS_TABLE']){
    if(process.env[k]) details.env[k] = process.env[k];
  }
  try {
    details.steps.push('creating_client');
    const client = getTableClient();
    details.steps.push('client_created');
    try { await client.createTable(); details.steps.push('table_created_or_exists'); } catch(e){ details.steps.push('table_create_skip:'+(e.code||e.message)); }
    let count=0; try { for await (const _ of client.listEntities({ queryOptions:{ top:3 }})){ count++; if(count>=3) break; } } catch(e){ details.steps.push('list_failed:'+(e.code||e.message)); }
    details.sampleCount = count;
    return context.res = { status:200, body:{ ok:true, details } };
  } catch (e){
    details.error = { message:e.message, code:e.code };
    return context.res = { status:500, body:{ ok:false, details } };
  }
};
