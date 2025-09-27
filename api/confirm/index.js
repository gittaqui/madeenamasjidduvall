const { getTableClient } = require('../shared/tableClient');

module.exports = async function (context, req){
  const token = (req.query.token||'').trim();
  if(!token) return context.res = { status:400, body:{ ok:false, error:'missing-token' } };
  const table = getTableClient();
  // lookup token index
  let tokenRow = null; try { tokenRow = await table.getEntity('token', token); } catch {}
  if(!tokenRow) return context.res = { status:404, body:{ ok:false, error:'invalid-token' } };
  const hash = tokenRow.hash;
  // does active already exist?
  try { const active = await table.getEntity('active', hash); return context.res = { status:200, body:{ ok:true, status:'already-active', email: active.email } }; } catch {}
  // get pending row
  let pending = null; try { pending = await table.getEntity('pending', hash); } catch {}
  if(!pending) return context.res = { status:404, body:{ ok:false, error:'not-pending' } };
  const confirmedUtc = new Date().toISOString();
  await table.upsertEntity({ partitionKey:'active', rowKey:hash, email: pending.email, createdUtc: pending.createdUtc, confirmedUtc });
  try { await table.deleteEntity('pending', hash); } catch {}
  try { await table.deleteEntity('token', token); } catch {}
  context.res = { status:200, body:{ ok:true, status:'confirmed', email: pending.email, confirmedUtc } };
};