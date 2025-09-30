const crypto = require('crypto');
const { getTableClient } = require('../shared/tableClient');

// Lightweight internal subscription implementation (re-enabled)
// Stores rows in Subscribers table using partitions: pending, active, unsub, token
// Does NOT send email (external system may do that); admin can manually activate or user can hit confirm link.

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/i;
function sha256Hex(v){ return crypto.createHash('sha256').update(v,'utf8').digest('hex'); }
function randomToken(){ return crypto.randomBytes(24).toString('hex'); }

module.exports = async function(context, req){
  const body = (req.body || {});
  const email = (body.email||'').trim().toLowerCase();
  const websiteField = (body.website||'').trim(); // honeypot
  if(!email || !EMAIL_REGEX.test(email)){
    return context.res = { status:400, body:{ ok:false, error:'invalid_email' } };
  }
  if(websiteField){ // bot honeypot
    return context.res = { status:200, body:{ ok:true, status:'ignored' } };
  }
  const table = getTableClient();
  const hash = sha256Hex(email);
  // Check existing states
  let active=null, pending=null, unsub=null;
  try { active = await table.getEntity('active', hash); } catch {}
  try { pending = await table.getEntity('pending', hash); } catch {}
  try { unsub = await table.getEntity('unsub', hash); } catch {}
  if(active){
    return context.res = { status:200, body:{ ok:true, status:'already-active' } };
  }
  if(unsub){
    return context.res = { status:409, body:{ ok:false, error:'unsubscribed' } };
  }
  // If pending exists, refresh token (optional) else create new pending + token
  const now = new Date().toISOString();
  let token = pending && pending.token ? pending.token : randomToken();
  // Token row references hash for activation lookup
  await table.upsertEntity({ partitionKey:'token', rowKey: token, hash, email, createdUtc: pending? pending.createdUtc : now, refreshedUtc: now });
  await table.upsertEntity({ partitionKey:'pending', rowKey: hash, email, createdUtc: pending? pending.createdUtc : now, token, updatedUtc: now });
  return context.res = { status:200, body:{ ok:true, status:'pending', token } };
};