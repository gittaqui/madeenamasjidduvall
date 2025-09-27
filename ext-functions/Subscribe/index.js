const { getSubscribersTable } = require('../Shared/tableClient');
const { sha256Hex, randomToken } = require('../Shared/cryptoHelpers');

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/i;

module.exports = async function (context, req){
  const body = req.body || {};
  const emailRaw = (body.email||'').trim().toLowerCase();
  const honeypot = (body.website||'').trim();
  if(honeypot) return context.res = { status:200, body:{ ok:true } };
  if(!EMAIL_REGEX.test(emailRaw) || emailRaw.length>160) return context.res = { status:400, body:{ error:'invalid_email' } };
  const hash = sha256Hex(emailRaw);
  let table;
  try { table = getSubscribersTable(); } catch(e){ return context.res = { status:500, body:{ error:'table_client_error', detail:e.message } }; }
  try {
    try { await table.createTable(); } catch{}
    // Already active
    try { await table.getEntity('active', hash); return context.res = { status:200, body:{ ok:true, status:'already-active' } }; } catch{}
    let pending = null; try { pending = await table.getEntity('pending', hash); } catch{}
    let token = pending && pending.token;
    if(!pending){
      token = randomToken();
      const createdUtc = new Date().toISOString();
      await table.upsertEntity({ partitionKey:'pending', rowKey:hash, email: emailRaw, token, createdUtc });
      await table.upsertEntity({ partitionKey:'token', rowKey:token, hash, email: emailRaw, createdUtc });
    }
    context.res = { status:200, body:{ ok:true, status: pending?'resent':'pending' } };
  } catch(e){
    const msg = e.message||String(e);
    context.res = { status:500, body:{ error:'subscribe_failed', detail: msg } };
  }
};
