const { getSubscribersTable } = require('../Shared/tableClient');
module.exports = async function(context, req){
  const token = (req.query.token||'').trim();
  if(!token) return context.res = { status:400, body:{ ok:false, error:'missing_token' } };
  let table; try { table = getSubscribersTable(); } catch(e){ return context.res = { status:500, body:{ ok:false, error:'table_client_error', detail:e.message } }; }
  let tokenRow = null; try { tokenRow = await table.getEntity('token', token); } catch{}
  if(!tokenRow) return context.res = { status:404, body:{ ok:false, error:'invalid_token' } };
  const hash = tokenRow.hash;
  let pending = null; try { pending = await table.getEntity('pending', hash); } catch{}
  if(!pending) return context.res = { status:410, body:{ ok:false, error:'gone' } };
  const email = pending.email;
  // Move to active
  await table.upsertEntity({ partitionKey:'active', rowKey:hash, email, confirmedUtc: new Date().toISOString() });
  try { await table.deleteEntity('pending', hash); } catch{}
  context.res = { status:200, body:{ ok:true, email, status:'active' } };
};
