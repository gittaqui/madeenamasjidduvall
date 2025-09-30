const { getTableClient } = require('../shared/tableClient');
const crypto = require('crypto');
function sha256Hex(v){ return crypto.createHash('sha256').update(v,'utf8').digest('hex'); }

module.exports = async function (context, req){
  const token = (req.query.token||'').trim();
  const emailParam = (req.query.email||'').trim().toLowerCase();
  const hashParam = emailParam ? sha256Hex(emailParam) : (req.query.hash||'').trim().toLowerCase();
  if(!token && !hashParam){
    return context.res = { status:400, body:{ ok:false, error:'missing_token_or_hash' } };
  }
  const table = getTableClient();
  let hash = hashParam;
  let pending=null, tokenRow=null, active=null, unsub=null;
  if(token){
    try { tokenRow = await table.getEntity('token', token); hash = tokenRow.hash || hash; } catch {}
  }
  if(!hash){ return context.res = { status:404, body:{ ok:false, error:'token_not_found' } }; }
  try { active = await table.getEntity('active', hash); } catch {}
  try { unsub = await table.getEntity('unsub', hash); } catch {}
  try { pending = await table.getEntity('pending', hash); } catch {}
  if(active){
    return context.res = { status:200, body:{ ok:true, status:'already-active' } };
  }
  if(unsub){
    return context.res = { status:409, body:{ ok:false, error:'unsubscribed' } };
  }
  if(!pending && !tokenRow){
    return context.res = { status:404, body:{ ok:false, error:'pending_not_found' } };
  }
  const email = pending? pending.email : (tokenRow? tokenRow.email : emailParam || 'unknown');
  const createdUtc = pending? pending.createdUtc : (tokenRow? tokenRow.createdUtc : new Date().toISOString());
  const now = new Date().toISOString();
  await table.upsertEntity({ partitionKey:'active', rowKey:hash, email, createdUtc, confirmedUtc: now });
  try { await table.deleteEntity('pending', hash); } catch {}
  if(token){ try { await table.deleteEntity('token', token); } catch {} }
  return context.res = { status:200, body:{ ok:true, status:'activated', confirmedUtc: now } };
};