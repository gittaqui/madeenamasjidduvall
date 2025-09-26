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

module.exports = async function (context, req){
  if(!isAdmin(req)) return context.res = { status:401, body:{ error:'Unauthorized' } };
  const table = getTableClient();
  const status = (req.query.status||'active');
  if(req.method === 'DELETE'){
    const hash = (req.query.hash||'').toLowerCase();
    const part = status === 'pending' ? 'pending' : status === 'unsub' ? 'unsub' : 'active';
    if(!hash) return context.res = { status:400, body:{ error:'Missing hash' } };
    try { await table.deleteEntity(part, hash); } catch (e){ return context.res = { status:404, body:{ error:'Not found' } }; }
    return context.res = { status:200, body:{ ok:true } };
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