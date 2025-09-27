const crypto=require('crypto'); const { getRsvpsTable } = require('../Shared/tableClient');
const EMAIL=/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/i; function norm(e){return (e||'').trim().toLowerCase();}
function randomToken(){ return crypto.randomBytes(20).toString('hex'); }
module.exports=async function(context,req){
  const b=req.body||{}; const eventId=(b.eventId||'').trim(); const email=norm(b.email); if(!EMAIL.test(email)) return context.res={status:400,body:{error:'invalid_email'}}; if(!eventId) return context.res={status:400,body:{error:'invalid_event'}};
  const name=(b.name||'').trim().slice(0,80); const adults=Number.isFinite(b.adults)?Math.max(0,Math.min(20,b.adults|0)):1; const children=Number.isFinite(b.children)?Math.max(0,Math.min(50,b.children|0)):0; const notes=(b.notes||'').trim().slice(0,300);
  let table; try{ table=getRsvpsTable(); }catch(e){ return context.res={status:500,body:{error:'table_client_error',detail:e.message}}; }
  try{ try{ await table.createTable(); }catch{} const pk=eventId, rk=email; let existing=null; try{ existing=await table.getEntity(pk,rk);}catch{}
    const now=new Date().toISOString(); if(existing){ if(existing.status==='confirmed') return context.res={status:200,body:{ok:true,status:'confirmed',already:true}}; existing.name=name||existing.name; existing.adults=adults; existing.children=children; existing.notes=notes; existing.updatedUtc=now; await table.updateEntity(existing,'Merge'); return context.res={status:200,body:{ok:true,status:existing.status||'pending',already:true}}; }
    const token=randomToken(); const requireConfirm=(process.env.RSVP_REQUIRE_CONFIRM||'false').toLowerCase()==='true'; const status=requireConfirm?'pending':'confirmed'; const ent={partitionKey:pk,rowKey:rk,email,name,adults,children,notes,status,createdUtc:now,updatedUtc:now}; await table.upsertEntity(ent); await table.upsertEntity({partitionKey:'token',rowKey:token,eventId,email,createdUtc:now}); context.res={status:200,body:{ok:true,status,needConfirm:requireConfirm}};
  }catch(e){ context.res={status:500,body:{error:'rsvp_failed',detail:e.message||String(e)}}; }
};
