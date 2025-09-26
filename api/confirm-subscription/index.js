const { getTableClient } = require('../shared/tableClient');

module.exports = async function (context, req){
  const token = (req.query.token||'').trim();
  if(!token) return context.res = { status:400, body:'Missing token' };
  const table = getTableClient();
  // brute-force scan pending partition (small scale) for token
  // NOTE: For scale, add RowKey index by token or store token hash as RowKey
  let found = null;
  for await (const entity of table.listEntities({ queryOptions:{ filter: `PartitionKey eq 'pending'`}})){
    if(entity.token === token){ found = entity; break; }
  }
  if(!found) return context.res = { status:404, body:'Token not found or expired' };
  const { rowKey: hash, email } = found;
  // Move to active
  await table.upsertEntity({ partitionKey:'active', rowKey:hash, email, confirmedUtc: new Date().toISOString() });
  // Remove pending entry
  try { await table.deleteEntity('pending', hash); } catch {}
  context.res = { status:200, body:'Subscription confirmed. You may close this window.' };
};