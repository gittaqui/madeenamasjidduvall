const { getSubscribersTable } = require('../Shared/tableClient');
const { sha256Hex, randomToken } = require('../Shared/cryptoHelpers');
const EMAIL=/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/i;
module.exports=async function(context,req){
  const b=req.body||{}; const email=(b.email||'').trim().toLowerCase(); const hp=(b.website||'').trim();
  if(hp) return context.res={status:200,body:{ok:true}};
  if(!EMAIL.test(email)||email.length>160) return context.res={status:400,body:{error:'invalid_email'}};
  const hash=sha256Hex(email); let table; try{ table=getSubscribersTable(); }catch(e){ return context.res={status:500,body:{error:'table_client_error',detail:e.message}}; }
  try{ try{await table.createTable();}catch{}
    try{ await table.getEntity('active',hash); return context.res={status:200,body:{ok:true,status:'already-active'}}; }catch{}
    let pending=null; try{ pending=await table.getEntity('pending',hash);}catch{}
    let token=pending&&pending.token; if(!pending){ token=randomToken(); const now=new Date().toISOString(); await table.upsertEntity({partitionKey:'pending',rowKey:hash,email,token,createdUtc:now}); await table.upsertEntity({partitionKey:'token',rowKey:token,hash,email,createdUtc:now}); }
    context.res={status:200,body:{ok:true,status:pending?'resent':'pending'}};
  }catch(e){ context.res={status:500,body:{error:'subscribe_failed',detail:e.message||String(e)}}; }
};
