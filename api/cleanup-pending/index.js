const { getTableClient } = require('../shared/tableClient');

function isAdmin(req){
  try {
    const userHeader = req.headers['x-ms-client-principal'];
    if(!userHeader) return false;
    const decoded = Buffer.from(userHeader, 'base64').toString('utf8');
    const principal = JSON.parse(decoded);
    const roles = principal.userRoles||[];
    return roles.includes('admin') || roles.includes('administrator');
  } catch { return false; }
}

async function performCleanup(context){
  const table = getTableClient();
  const cutoff = Date.now() - 24*60*60*1000; // 24h
  let removed = 0, tokensRemoved = 0, scannedPending = 0, scannedTokens = 0;
  try {
    for await (const entity of table.listEntities({ queryOptions:{ filter: `PartitionKey eq 'pending'`}})){
      scannedPending++;
      const ts = Date.parse(entity.createdUtc||entity.timestamp)||0;
      if(ts < cutoff){
        try { await table.deleteEntity('pending', entity.rowKey); removed++; } catch {}
        if(entity.token){ try { await table.deleteEntity('token', entity.token); tokensRemoved++; } catch {} }
      }
    }
  } catch (e){ context.log('[cleanup-pending] pending scan error', e.message); }
  try {
    for await (const entity of table.listEntities({ queryOptions:{ filter: `PartitionKey eq 'token'`}})){
      scannedTokens++;
      const ts = Date.parse(entity.createdUtc||entity.timestamp)||0;
      if(ts < cutoff){
        let pending = null; try { pending = await table.getEntity('pending', entity.hash); } catch {}
        if(!pending){ try { await table.deleteEntity('token', entity.rowKey); tokensRemoved++; } catch {} }
      }
    }
  } catch (e){ context.log('[cleanup-pending] token scan error', e.message); }
  return { removed, tokensRemoved, scannedPending, scannedTokens };
}

module.exports = async function(context, req){
  // Authorization: require admin role or explicit admin key reuse (SUBSCRIBERS_ADMIN_KEY)
  const adminKey = process.env.SUBSCRIBERS_ADMIN_KEY;
  const suppliedKey = (req.query.key || req.headers['x-admin-key'] || '').trim();
  if(!(isAdmin(req) || (adminKey && suppliedKey && suppliedKey === adminKey))){
    return context.res = { status:401, body:{ error:'Unauthorized' } };
  }
  const result = await performCleanup(context);
  context.log('[cleanup-pending] result', result);
  context.res = { status:200, body:{ ok:true, ...result } };
};