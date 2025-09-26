const { getTableClient } = require('../shared/tableClient');
const net = require('net');

function azuriteTablePort(){
  // Default Azurite table endpoint port
  return 10002;
}

async function isLocalAzuriteAvailable(){
  if(!(process.env.STORAGE_CONNECTION_STRING||'').startsWith('UseDevelopmentStorage')) return true; // using real storage or other config
  const port = azuriteTablePort();
  return await new Promise(res=>{
    const socket = new net.Socket();
    const timer = setTimeout(()=>{ socket.destroy(); res(false); }, 400);
    socket.on('error', ()=>{ clearTimeout(timer); res(false); });
    socket.connect(port, '127.0.0.1', ()=>{ clearTimeout(timer); socket.end(); res(true); });
  });
}

module.exports = async function (context){
  if(process.env.LOCAL_DISABLE_TIMER){
    context.log('[cleanup-pending] skipped due to LOCAL_DISABLE_TIMER');
    return;
  }
  if(!await isLocalAzuriteAvailable()){
    context.log('[cleanup-pending] Azurite Table endpoint not available locally; skipping cleanup (dev mode).');
    return;
  }
  const table = getTableClient();
  const cutoff = Date.now() - 24*60*60*1000; // 24h
  let removed = 0, tokensRemoved = 0;
  // Remove stale pending
  try {
    for await (const entity of table.listEntities({ queryOptions:{ filter: `PartitionKey eq 'pending'`}})){
      const ts = Date.parse(entity.createdUtc||entity.timestamp)||0;
      if(ts < cutoff){
        try { await table.deleteEntity('pending', entity.rowKey); removed++; } catch {}
        if(entity.token){ try { await table.deleteEntity('token', entity.token); tokensRemoved++; } catch {} }
      }
    }
  } catch (e){ context.log('cleanup pending scan error', e.message); }
  // Remove orphan token rows (older than 24h without matching pending)
  try {
    for await (const entity of table.listEntities({ queryOptions:{ filter: `PartitionKey eq 'token'`}})){
      const ts = Date.parse(entity.createdUtc||entity.timestamp)||0;
      if(ts < cutoff){
        // confirm pending entity absent
        let pending = null; try { pending = await table.getEntity('pending', entity.hash); } catch {}
        if(!pending){ try { await table.deleteEntity('token', entity.rowKey); tokensRemoved++; } catch {} }
      }
    }
  } catch (e){ context.log('cleanup token scan error', e.message); }
  context.log(`[cleanup-pending] removed pending=${removed} tokens=${tokensRemoved}`);
};