const crypto = require('crypto');
const { getTableClient } = require('../shared/tableClient');

// Lightweight internal subscription implementation (re-enabled)
// Stores rows in Subscribers table using partitions: pending, active, unsub, token
// Does NOT send email (external system may do that); admin can manually activate or user can hit confirm link.

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/i;
function sha256Hex(v){ return crypto.createHash('sha256').update(v,'utf8').digest('hex'); }
function randomToken(){ return crypto.randomBytes(24).toString('hex'); }

module.exports = async function(context, req){
  const debug = (req.query.debug||'').toLowerCase()==='1';
  const body = (req.body || {});
  const email = (body.email||'').trim().toLowerCase();
  const websiteField = (body.website||'').trim(); // honeypot
  if(!email || !EMAIL_REGEX.test(email)){
    return context.res = { status:400, body:{ ok:false, error:'invalid_email' } };
  }
  if(websiteField){ // bot honeypot
    return context.res = { status:200, body:{ ok:true, status:'ignored' } };
  }
  let table;
  try { table = getTableClient(); }
  catch(e){
    return context.res = { status:500, body:{ ok:false, error:'table_init_failed', detail:e.message } };
  }
  // Ensure table exists (create if needed once)
  try { await table.createTable(); } catch(e){ if(!/TableAlreadyExists/i.test(e.message)) context.log('[subscribe] createTable note', e.message); }
  const hash = sha256Hex(email);
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
  const now = new Date().toISOString();
  let token = pending && pending.token ? pending.token : randomToken();
  try {
    await table.upsertEntity({ partitionKey:'token', rowKey: token, hash, email, createdUtc: pending? pending.createdUtc : now, refreshedUtc: now });
    await table.upsertEntity({ partitionKey:'pending', rowKey: hash, email, createdUtc: pending? pending.createdUtc : now, token, updatedUtc: now });
  } catch(e){
    return context.res = { status:500, body:{ ok:false, error:'upsert_failed', detail:e.message, code:e.statusCode, stack: debug? e.stack: undefined } };
  }
  return context.res = { status:200, body:{ ok:true, status:'pending', token: debug? token: undefined } };
};