// Deep storage diagnostic: validates Subscribers & Rsvps tables, returns partition counts & samples.
const { TableClient } = require('@azure/data-tables');
const { getTableClient } = require('../shared/tableClient');

async function ensureTable(client){
  try { await client.createTable(); return 'created_or_exists'; } catch(e){ return 'exists_or_failed:'+ (e.code||e.message); }
}

async function scanTable(tableClient, options={ maxSamples:3, maxPartitions:10 }){
  const result = { name: tableClient.tableName, ensure:null, partitions:{}, totalEntities:0, samples:[] };
  result.ensure = await ensureTable(tableClient);
  try {
    for await (const ent of tableClient.listEntities()){
      result.totalEntities++;
      const pk = ent.partitionKey;
      if(!result.partitions[pk]){
        if(Object.keys(result.partitions).length < options.maxPartitions){
          result.partitions[pk] = 0;
        } else {
          // collapse overflow into *other
          result.partitions['*other'] = (result.partitions['*other']||0);
        }
      }
      if(result.partitions[pk] !== undefined) result.partitions[pk]++;
      else result.partitions['*other']++;
      if(result.samples.length < options.maxSamples){
        const { partitionKey, rowKey, status, email, eventId, token, createdUtc, updatedUtc } = ent;
        result.samples.push({ partitionKey, rowKey, status, email, eventId, token, createdUtc, updatedUtc });
      }
    }
  } catch(e){
    result.error = { message: e.message, code: e.code };
  }
  return result;
}

module.exports = async function (context, req){
  const { hasRole } = require('../shared/clientPrincipal');
  const adminKey = process.env.SUBSCRIBERS_ADMIN_KEY;
  const provided = req.query.adminKey || req.headers['x-admin-key'];
  if(!adminKey || adminKey !== provided){
    if(!hasRole(req, 'admin')){
      return context.res = { status:401, body:{ ok:false, error:'unauthorized', hint:'Provide adminKey query param OR authenticate with admin role' } };
    }
  }
  const details = { steps:[], env:{} };
  for(const k of ['STORAGE_ACCOUNT_TABLE_URL','STORAGE_ACCOUNT_BLOB_URL','SUBSCRIBERS_TABLE','RSVP_TABLE_NAME']){
    if(process.env[k]) details.env[k] = process.env[k];
  }
  try {
    details.steps.push('create_base_clients');
    const subClient = getTableClient();
    // Rsvps: either separate name env or reuse logic with temp override
    let rsvpClient;
    if(process.env.RSVP_TABLE_NAME){
      if(process.env.STORAGE_CONNECTION_STRING){
        rsvpClient = TableClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING, process.env.RSVP_TABLE_NAME);
      } else {
        const baseUrl = process.env.STORAGE_ACCOUNT_TABLE_URL || process.env.TABLES_ACCOUNT_URL || process.env.STORAGE_ACCOUNT_BLOB_URL?.replace(/blob\./,'table.');
        rsvpClient = new TableClient(`${baseUrl}/${process.env.RSVP_TABLE_NAME}`, subClient.credential || subClient.pipeline?.credential);
      }
    } else {
      // default name Rsvps (same account) via connection string or derived URL
      if(process.env.STORAGE_CONNECTION_STRING){
        rsvpClient = TableClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING, 'Rsvps');
      } else {
        const baseUrl = process.env.STORAGE_ACCOUNT_TABLE_URL || process.env.TABLES_ACCOUNT_URL || process.env.STORAGE_ACCOUNT_BLOB_URL?.replace(/blob\./,'table.');
        rsvpClient = new TableClient(`${baseUrl}/Rsvps`, subClient.credential || subClient.pipeline?.credential);
      }
    }
    details.steps.push('scanning_tables');
    const subscribersInfo = await scanTable(subClient);
    const rsvpsInfo = await scanTable(rsvpClient);
    context.res = { status:200, body:{ ok:true, subscribers: subscribersInfo, rsvps: rsvpsInfo, details } };
  } catch (e){
    details.error = { message:e.message, code:e.code };
    context.res = { status:500, body:{ ok:false, details } };
  }
};
