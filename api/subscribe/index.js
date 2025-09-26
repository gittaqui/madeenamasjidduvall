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
  const table = getTableClient();
  try { await table.createTable(); } catch {}
  // Already active?
  try { await table.getEntity('active', hash); return context.res = { status:200, body:{ ok:true, status:'already-active' } }; } catch {}
  let pendingEntity = null; try { pendingEntity = await table.getEntity('pending', hash); } catch {}
  let token = pendingEntity && pendingEntity.token;
  if(!pendingEntity){
    token = randomToken();
    await table.upsertEntity({ partitionKey:'pending', rowKey:hash, email: emailRaw, token, createdUtc: new Date().toISOString() });
  }
  const site = process.env.SITE_ORIGIN || (req.headers['x-forwarded-host'] ? `https://${req.headers['x-forwarded-host']}` : '');
  const confirmUrl = site ? `${site}/confirm.html?token=${token}` : `/confirm.html?token=${token}`;
  // TODO integrate real email sender; for now log
  context.log('[subscribe] confirmation link', confirmUrl);
  context.res = { status:200, body:{ ok:true, status: pendingEntity?'resent':'pending' } };
};