const crypto = require('crypto');
const { getTableClient } = require('../shared/tableClient');

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/i;
function sha256Hex(v){ return crypto.createHash('sha256').update(v,'utf8').digest('hex'); }
function randomToken(){ return crypto.randomBytes(24).toString('hex'); }

module.exports = async function (context, req){
  if((req.headers['content-type']||'').includes('multipart')) return context.res = { status:400, body:{error:'multipart not supported'} };
  const body = req.body || {};
  const emailRaw = (body.email||'').trim().toLowerCase();
  const honeypot = (body.website||'').trim();
  if(honeypot) return context.res = { status:200, body:{ ok:true } }; // silent bot success
  if(!EMAIL_REGEX.test(emailRaw) || emailRaw.length>160) return context.res = { status:400, body:{ error:'Invalid email' } };
  const hash = sha256Hex(emailRaw);
  let table;
  try {
    table = getTableClient();
  } catch (e){
    context.log('[subscribe] table client creation failed (will attempt fallback)', e.message);
    // Hot-reload fallback: construct TableClient directly if connection string present
    if(process.env.STORAGE_CONNECTION_STRING){
      try {
        const { TableClient } = require('@azure/data-tables');
        table = TableClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING, process.env.SUBSCRIBERS_TABLE || 'Subscribers');
      } catch (inner){
        return context.res = { status:500, body:{ error:'table-client-error', detail: inner.message } };
      }
    } else {
      return context.res = { status:500, body:{ error:'table-client-error', detail: e.message } };
    }
  }
  try {
    try { await table.createTable(); } catch {}
    // Already active?
    try { await table.getEntity('active', hash); return context.res = { status:200, body:{ ok:true, status:'already-active' } }; } catch {}
    let pendingEntity = null; try { pendingEntity = await table.getEntity('pending', hash); } catch {}
    let token = pendingEntity && pendingEntity.token;
    if(!pendingEntity){
      token = randomToken();
      const createdUtc = new Date().toISOString();
      await table.upsertEntity({ partitionKey:'pending', rowKey:hash, email: emailRaw, token, createdUtc });
      // token index row for O(1) confirmation lookup
      await table.upsertEntity({ partitionKey:'token', rowKey:token, hash, createdUtc });
    } else {
      // ensure token index exists if upgrading from previous version
      try { await table.getEntity('token', pendingEntity.token); } catch {
        await table.upsertEntity({ partitionKey:'token', rowKey:pendingEntity.token, hash, createdUtc: pendingEntity.createdUtc || new Date().toISOString() });
      }
    }
    const site = process.env.SITE_ORIGIN || (req.headers['x-forwarded-host'] ? `https://${req.headers['x-forwarded-host']}` : '');
    const confirmUrl = site ? `${site}/confirm.html?token=${token}` : `/confirm.html?token=${token}`;
    context.log('[subscribe] confirmation link', confirmUrl);
    context.res = { status:200, body:{ ok:true, status: pendingEntity?'resent':'pending' } };
  } catch (opErr){
    const msg = opErr && opErr.message || String(opErr);
    if(/ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i.test(msg)){
      return context.res = { status:503, body:{ error:'table-endpoint-unreachable', detail: msg, hint:'Start Azurite (npx azurite --silent) or configure real storage account env vars.' } };
    }
    context.log('[subscribe] operation error', msg);
    return context.res = { status:500, body:{ error:'table-operation-failed', detail: msg } };
  }
};