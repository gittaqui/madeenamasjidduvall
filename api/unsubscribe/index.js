const crypto = require('crypto');
const { getTableClient } = require('../shared/tableClient');

function verify(hash, sig){
  const secret = process.env.SUBSCRIBE_SIGNING_SECRET;
  if(!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(hash).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected,'hex'), Buffer.from(sig||'', 'hex'));
}

module.exports = async function (context, req){
  const hash = (req.query.h||'').toLowerCase();
  const sig = (req.query.s||'').toLowerCase();
  if(!hash || !sig) return context.res = { status:400, body:'Missing parameters' };
  if(!verify(hash, sig)) return context.res = { status:403, body:'Invalid signature'};
  const table = getTableClient();
  let entity = null; try { entity = await table.getEntity('active', hash); } catch {}
  if(!entity) return context.res = { status:404, body:'Not subscribed' };
  await table.upsertEntity({ partitionKey:'unsub', rowKey:hash, email: entity.email, unsubUtc: new Date().toISOString() });
  try { await table.deleteEntity('active', hash); } catch {}
  context.res = { status:200, body:'You have been unsubscribed.' };
};