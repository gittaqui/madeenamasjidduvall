const { getTableClient } = require('../shared/tableClient');

module.exports = async function (context, req){
  const token = (req.query.token||'').trim();
  if(!token) return context.res = { status:400, body:'Missing token' };
  const table = getTableClient();
  // Token index row: partition 'token', rowKey = token, contains hash of email
  let tokenRow = null; try { tokenRow = await table.getEntity('token', token); } catch {}
  if(!tokenRow) return context.res = { status:404, body:'Token not found or expired' };
  const hash = tokenRow.hash;
  let pendingEntity = null; try { pendingEntity = await table.getEntity('pending', hash); } catch {}
  if(!pendingEntity || pendingEntity.token !== token) return context.res = { status:410, body:'Token no longer valid' };
  const email = pendingEntity.email;
  // Move to active
  await table.upsertEntity({ partitionKey:'active', rowKey:hash, email, confirmedUtc: new Date().toISOString() });
  // Remove pending entry
  try { await table.deleteEntity('pending', hash); } catch {}
  try { await table.deleteEntity('token', token); } catch {}
  context.res = { status:200, body:'Subscription confirmed. You may close this window.' };
};