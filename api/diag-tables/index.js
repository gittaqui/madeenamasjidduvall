const { getTableClient } = require('../shared/tableClient');
module.exports = async function(context, req){
  const details = { env: {}, steps: [] };
  for(const k of ['STORAGE_CONNECTION_STRING','STORAGE_ACCOUNT_TABLE_URL','STORAGE_ACCOUNT_BLOB_URL','TABLES_ACCOUNT_URL','TABLES_SAS','SUBSCRIBERS_TABLE','WEBSITE_SITE_NAME']){
    if(process.env[k]) details.env[k] = (k.includes('CONNECTION_STRING')? process.env[k].slice(0,20)+'...': process.env[k]);
  }
  try {
    details.steps.push('creating_client');
    const client = getTableClient();
    details.steps.push('client_created');
    // lightweight list tables/ensure table
    try { await client.createTable(); details.steps.push('table_created_or_exists'); } catch(e){ details.steps.push('table_create_skip:'+e.code); }
    let count=0; try {
      for await (const ent of client.listEntities({ queryOptions:{ top:3 }})) {
        count++; if(count>=3) break;
      }
    } catch(e){ details.steps.push('list_failed:'+ (e.code||e.message)); }
    details.entitySampleCount = count;
    context.res = { status:200, body:{ ok:true, details } };
  } catch (e){
    details.error = { message: e.message, stack: e.stack };
    context.res = { status:500, body:{ ok:false, details } };
  }
};