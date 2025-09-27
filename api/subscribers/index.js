const { getTableClient } = require('../shared/tableClient');
const crypto = require('crypto');

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

module.exports = async function (context, req){
  const adminKey = process.env.SUBSCRIBERS_ADMIN_KEY;
  const suppliedKey = (req.query.key || req.headers['x-admin-key'] || '').trim();
  const adminKeyValid = adminKey && suppliedKey && suppliedKey === adminKey;
  if(!(isAdmin(req) || adminKeyValid)){
    if(suppliedKey && adminKey && suppliedKey !== adminKey){
      context.log('[subscribers] admin key mismatch');
    }
    return context.res = { status:401, body:{ error:'Unauthorized' } };
  }
  const table = getTableClient();
  const status = (req.query.status||'active');
  const emailQuery = (req.query.email||'').trim().toLowerCase();
  if(req.method === 'GET' && emailQuery && !req.query.action){
    // Direct email search across partitions
    const hash = crypto.createHash('sha256').update(emailQuery,'utf8').digest('hex');
    const parts = ['active','pending','unsub'];
    for(const p of parts){
      try { const ent = await table.getEntity(p, hash); return context.res = { status:200, body:{ ok:true, foundIn:p, email: ent.email, hash, createdUtc: ent.createdUtc, confirmedUtc: ent.confirmedUtc, unsubUtc: ent.unsubUtc } }; } catch {}
    }
    return context.res = { status:404, body:{ ok:false, error:'email-not-found', email: emailQuery, hash } };
  }
  // Debug inspect: locate a hash across partitions
  if(req.method === 'GET' && (req.query.action||'').toLowerCase()==='inspect'){
    const hash = (req.query.hash||'').toLowerCase();
    if(!hash) return context.res = { status:400, body:{ error:'Missing hash' } };
    const parts = ['active','pending','unsub'];
    for(const p of parts){
      try { const ent = await table.getEntity(p, hash); return context.res = { status:200, body:{ ok:true, foundIn:p, entity:{ email:ent.email, createdUtc:ent.createdUtc, confirmedUtc:ent.confirmedUtc, unsubUtc:ent.unsubUtc } } }; } catch {}
    }
    return context.res = { status:404, body:{ ok:false, error:'not-found-any-partition' } };
  }
  // Admin activation of a pending subscriber (POST action=activate)
  if(req.method === 'POST'){
    const action = (req.query.action||'').toLowerCase();
    if(action === 'activate'){
      // Accept status=pending OR status=any (or ignore)
      let hash = (req.query.hash||'').toLowerCase();
      const emailParam = (req.query.email||'').trim().toLowerCase();
      if(!hash && emailParam){
        hash = crypto.createHash('sha256').update(emailParam,'utf8').digest('hex');
      }
      if(!hash) return context.res = { status:400, body:{ error:'Missing hash or email' } };
      // Attempt to locate across partitions
      let pending=null, active=null, unsub=null, tokenRow=null;
      try { pending = await table.getEntity('pending', hash); } catch {}
      try { active = await table.getEntity('active', hash); } catch {}
      try { unsub = await table.getEntity('unsub', hash); } catch {}
      // Detect token index orphan
      if(!pending && !active && !unsub){
        // try to find a token row referencing this hash (scan tokens)
        try {
          for await (const t of table.listEntities({ queryOptions:{ filter:"PartitionKey eq 'token'" }})){
            if(t.hash === hash){ tokenRow = t; break; }
          }
        } catch {}
      }
      if(active){
        return context.res = { status:200, body:{ ok:true, status:'already-active' } };
      }
      if(unsub){
        return context.res = { status:409, body:{ error:'unsubscribed', status:'unsub' } };
      }
      if(!pending){
        const force = (req.query.force||'').toLowerCase()==='true';
        if(force && tokenRow && tokenRow.hash){
          // Minimal recreation using tokenRow (no createdUtc known -> now)
            const now = new Date().toISOString();
            await table.upsertEntity({ partitionKey:'active', rowKey:hash, email: tokenRow.email||emailParam||'unknown', createdUtc: now, confirmedUtc: now });
            return context.res = { status:200, body:{ ok:true, status:'activated', recreated:true } };
        }
        return context.res = { status:404, body:{ error:'not-found', hash, diagnostics:{ tokenIndex: !!tokenRow } } };
      }
      const confirmedUtc = new Date().toISOString();
      await table.upsertEntity({ partitionKey:'active', rowKey:hash, email: pending.email, createdUtc: pending.createdUtc, confirmedUtc });
      try { await table.deleteEntity('pending', hash); } catch {}
      if(pending.token){ try { await table.deleteEntity('token', pending.token); } catch {} }
      return context.res = { status:200, body:{ ok:true, status:'activated', confirmedUtc } };
    }
  }
  if(req.method === 'DELETE'){
    // Support deletion by hash (preferred) or email (will be hashed).
    let hash = (req.query.hash||'').toLowerCase();
    const emailParam = (req.query.email||'').trim().toLowerCase();
    if(!hash && emailParam){
      hash = crypto.createHash('sha256').update(emailParam,'utf8').digest('hex');
    }
    if(!hash) return context.res = { status:400, body:{ error:'Missing hash or email' } };
    const normalizedStatus = status.toLowerCase();
    let partitions;
    if(normalizedStatus === 'any'){
      partitions = ['active','pending','unsub'];
    } else {
      const preferred = normalizedStatus === 'pending' ? 'pending' : normalizedStatus === 'unsub' ? 'unsub' : 'active';
      // Try preferred first, then others so a stale UI filter still succeeds.
      const others = ['active','pending','unsub'].filter(p=>p!==preferred);
      partitions = [preferred, ...others];
    }
    for(const p of partitions){
      try { await table.deleteEntity(p, hash); return context.res = { status:200, body:{ ok:true, deletedFrom:p } }; } catch(e){ /* ignore and continue */ }
    }
    return context.res = { status:404, body:{ error:'Not found in any partition' } };
  }
  const part = status === 'pending' ? 'pending' : status === 'unsub' ? 'unsub' : 'active';
  const results = [];
  try {
    for await (const entity of table.listEntities({ queryOptions:{ filter:`PartitionKey eq '${part}'`}})){
      results.push({ hash: entity.rowKey, email: entity.email, createdUtc: entity.createdUtc, confirmedUtc: entity.confirmedUtc, unsubUtc: entity.unsubUtc });
      if(results.length >= 500) break; // safety cap
    }
  } catch (e){ context.log('List error', e.message); }
  context.res = { status:200, body:{ ok:true, status:part, count:results.length, items:results } };
};